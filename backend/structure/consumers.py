from collections import deque
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
        self.tab = None
        self.puzzle = None

        await self.channel_layer.group_add(
            CLIENT_GROUP_NAME,
            self.channel_name,
        )
        await self.accept()
        await self.query(fetch=True)

    async def query(self, *, fetch=False, activity=None):
        # single request that combines fetching entire data state and notifying
        # with current activity
        request = {
            'type': 'client.query',
        }
        if fetch:
            request['fetch'] = True
            request['channel'] = self.channel_name
        if activity is not None:
            request['activity'] = activity
        await self.channel_layer.send(MASTER_CHANNEL_NAME, request)

    async def client_update(self, event):
        if self.version < event['version']:
            self.version = event['version']
            self.timestamp = event['timestamp']
        await self.send(text_data=event['update'])

    async def client_notify(self, event):
        # similar to update but no versioning
        await self.send(text_data=event['payload'])

    async def receive(self, text_data=None, data=None):
        if self.timestamp is not None:
            if data is None:
                try:
                    data = json.loads(text_data)
                except:
                    return
            version = data.get('version')
            activity = data.get('activity')
            request = {}
            if data.get('force') is True:
                request['fetch'] = True
            elif isinstance(version, int) and version < self.version and self.timestamp - time.time() > self.SYNC_THRESHOLD:
                request['fetch'] = True
            if isinstance(activity, dict):
                puzzle = activity.get('puzzle')
                tab = activity.get('tab')
                user = self.scope['user']
                uid = None if user is None else user.id
                if (isinstance(puzzle, str) or puzzle is None) and isinstance(tab, int) and uid is not None:
                    self.tab = tab
                    self.puzzle = puzzle
                    request['activity'] = {
                        'uid': uid,
                        'tab': tab,
                        'puzzle': puzzle,
                    }
                    await self.channel_layer.group_send(
                        CLIENT_GROUP_NAME,
                        {
                            'type': 'client.notify',
                            'payload': json.dumps({
                                'activities': [request['activity']],
                            }),
                        },
                    )
            if request:
                await self.query(**request)

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            CLIENT_GROUP_NAME,
            self.channel_name,
        )
        if self.puzzle is not None and self.tab is not None:
            await self.receive(data={
                'activity': {
                    'puzzle': None,
                    'tab': self.tab,
                },
            })


class BroadcastMasterConsumer(SyncConsumer):
    ACTIVITY_CACHE_TIME = 60 # s

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.timestamp = None
        self.version = None
        self.data = None
        self.activity = deque()

    def maybe_init(self):
        if self.version is None:
            self.timestamp = cachalot.api.get_last_invalidation()
            self.version = 1 # version 0 is empty set, version 1 is initial data
            self.data = api.data_everything()

    def client_query(self, event):
        self.maybe_init()
        # prune activity
        now = time.monotonic()
        while self.activity and self.activity[0][0] < now - self.ACTIVITY_CACHE_TIME:
            self.activity.popleft()
        # perform fetch
        if event.get('fetch') is True:
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
                        'activities': [_activity for ts, _activity in self.activity],
                    }),
                },
            )
        # update cache with client's activity
        activity = event.get('activity')
        if activity is not None:
            self.activity.append((now, activity))

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
