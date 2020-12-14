import datetime
import json
import time

import cachalot
from channels.consumer import SyncConsumer
from channels.generic.websocket import AsyncWebsocketConsumer

from . import api

MASTER_CHANNEL_NAME = 'fan_root'
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
        self.send(text_data=event['update'])

    async def receive(self, text_data=None):
        if self.timestamp is not None:
            try:
                data = json.loads(text_data)
            except:
                return
            version = data.get('version')
            if data.get('force_fetch') is True:
                await self.fetch()
            elif isinstance(version, int) and version < self.version and self.timestamp - time.time() > self.SYNC_THRESHOLD:
                await self.fetch()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            CLIENT_GROUP_NAME,
            self.channel_name,
        )



class FanConsumer(SyncConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.timestamp = cachalot.api.get_last_invalidation()
        self.version = 1 # version 0 is empty set, version 1 is initial data
        self.data = api.data_everything()

    def client_fetch(self, event):
        self.channel_layer.send(
            event['channel_name'],
            {
                'type': 'client.update',
                'version': self.version,
                'timestamp': self.timestamp,
                'update': json.dumps({
                    'prev_version': None, # version None for any
                    'version': self.version,
                    'data': self.data,
                    'update': True,
                }),
            },
        )

    def maybe_update(self):
        timestamp = cachalot.api.get_last_invalidation()
        if self.timestamp < timestamp:
            version = self.version + 1
            data = api.data_everything()
            diff, update = diff(self.data, data)
            self.channel_layer.group_send(
                CLIENT_GROUP_NAME,
                {
                    'type': 'client.update',
                    'version': version,
                    'timestamp': timestamp,
                    'update': json.dumps({
                        'prev_version': self.version,
                        'version': version,
                        'data': diff,
                        'update': update,
                    }),
                },
            )
            self.version = version
            self.data = data

VOID = lambda: None
def diff(old, new):
    '''
    Return (data, update) where `data` is the tree of updates and `update`
    specifies which nodes should be replaced.
    '''
    # a threshold which if surpassed will return the entire object as the
    # update instead of individual subfields
    REPLACE_THRESH = 0.5
    if isinstance(old, dict) and isinstance(new, dict):
        data = {}
        update = {}
        for key in set(old.keys()) | set(new.keys()):
            subdata, subupdate = diff(old.get(key, VOID), new.get(key, VOID))
            if subupdate:
                update[key] = subupdate
                if subdata is not VOID:
                    data[key] = subdata
        if update:
            if len(update) > REPLACE_THRESH * len(new):
                return new, True # old != new and REPLACE_THRESH is surpassed
            else:
                return data, update # old != new and REPLACE_THRESH is not surpassed
        else:
            return None, False # old == new
    else:
        if old == new:
            return None, False # old == new
        else:
            return new, True # old != new
