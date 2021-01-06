import datetime
import json
import logging
import time

from asgiref.sync import async_to_sync
import cachalot
from channels.layers import get_channel_layer
from channels.consumer import SyncConsumer
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django import dispatch

from . import api

logger = logging.getLogger(__name__)

MASTER_CHANNEL_NAME = 'channels_master'
CLIENT_GROUP_NAME = 'all_updates'


class ClientConsumer(AsyncWebsocketConsumer):
    SYNC_THRESHOLD = 20 # seconds

    async def connect(self):
        self.version = 0
        self.timestamp = None
        await self.channel_layer.group_add(
            CLIENT_GROUP_NAME,
            self.channel_name,
        )
        await self.accept()
        await self.fetch()

    async def fetch(self):
        await self.channel_layer.send(
            MASTER_CHANNEL_NAME,
            {
                'type': 'client.fetch',
                'channel': self.channel_name,
            },
        )

    async def client_update(self, event):
        if self.version < event['version']:
            self.version = event['version']
            self.timestamp = event['timestamp']
        await self.send(text_data=event['update'])

    async def client_notify(self, event):
        # similar to update but no versioning
        await self.send(text_data=event['payload'])

    async def receive(self, text_data=None):
        if self.timestamp is not None:
            try:
                data = json.loads(text_data)
            except:
                return
            action = data.get('action')
            if action == 'fetch':
                version = data.get('version')
                if data.get('force') is True:
                    await self.fetch()
                elif isinstance(version, int) and version < self.version and self.timestamp - time.time() > self.SYNC_THRESHOLD:
                    await self.fetch()
            elif action == 'activity':
                puzzle = data.get('puzzle')
                tab = data.get('tab')
                user = self.scope['user']
                uid = None if user is None else user.id
                if (isinstance(puzzle, str) or puzzle is None) and isinstance(tab, int) and uid is not None:
                    await self.channel_layer.group_send(
                        CLIENT_GROUP_NAME,
                        {
                            'type': 'client.notify',
                            'payload': json.dumps({
                                'activity': {
                                    'uid': uid,
                                    'tab': tab,
                                    'puzzle': puzzle,
                                },
                            }),
                        },
                    )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            CLIENT_GROUP_NAME,
            self.channel_name,
        )


class BroadcastMasterConsumer(SyncConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.timestamp = None
        self.version = None
        self.data = None

    def maybe_init(self):
        if self.version is None:
            self.timestamp = cachalot.api.get_last_invalidation()
            self.version = 1 # version 0 is empty set, version 1 is initial data
            self.data = api.data_everything()

    def client_fetch(self, event):
        self.maybe_init()
        async_to_sync(self.channel_layer.send)(
            event['channel'],
            {
                'type': 'client.update',
                'version': self.version,
                'timestamp': self.timestamp,
                'update': json.dumps({
                    'prev_version': None, # version None for any
                    'version': self.version,
                    'data': self.data,
                    'roots': True,
                }),
            },
        )

    def server_maybe_update(self, event):
        self.maybe_init()
        timestamp = cachalot.api.get_last_invalidation()
        if self.timestamp < timestamp:
            self.timestamp = timestamp
            version = self.version + 1
            data = api.data_everything()
            delta, roots = diff(self.data, data)
            if roots:
                async_to_sync(self.channel_layer.group_send)(
                    CLIENT_GROUP_NAME,
                    {
                        'type': 'client.update',
                        'version': version,
                        'timestamp': timestamp,
                        'update': json.dumps({
                            'prev_version': self.version,
                            'version': version,
                            'data': delta,
                            'roots': roots,
                        }),
                    },
                )
                self.version = version
                self.data = data


VOID = lambda: None
def diff(old, new):
    '''
    Return (data, roots) where `data` is the tree of updates and `roots`
    specifies which nodes should be replaced.
    '''
    if isinstance(old, dict) and isinstance(new, dict):
        data = {}
        roots = {}
        for key in set(old.keys()) | set(new.keys()):
            subdata, subroots = diff(old.get(key, VOID), new.get(key, VOID))
            if subroots:
                roots[key] = subroots
                if subdata is not VOID:
                    data[key] = subdata
        if roots:
            return data, roots # old != new
        else:
            return None, False # old == new
    else:
        if old == new:
            return None, False # old == new
        else:
            return new, True # old != new

@dispatch.receiver(cachalot.signals.post_invalidation)
def update_cache(sender, **kwargs):
    async_to_sync(get_channel_layer().send)(
        MASTER_CHANNEL_NAME,
        {'type': 'server.maybe_update'},
    )
