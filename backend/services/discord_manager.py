import asyncio
import json
import logging
import threading

from allauth.socialaccount.models import SocialAccount
from asgiref.sync import sync_to_async
from django.conf import settings
from django import http

import aiohttp
import discord

logger = logging.getLogger(__name__)

class StaticDiscordHttpClient(discord.http.HTTPClient):
    async def static_login(self, token, *, bot):
        self._HTTPClient__session = aiohttp.ClientSession()
        self._token(token, bot=bot)

class DiscordManager:
    __main_instance = None
    __thread_instance = None
    __thread = None

    @classmethod
    def instance(cls):
        '''
        Get a threadsafe instance.
        '''
        if threading.current_thread() is threading.main_thread():
            if cls.__main_instance is None:
                cls.__main_instance = cls(asyncio.get_event_loop())
            return cls.__main_instance
        else:
            if cls.__thread_instance is None:
                cls.__thread_instance = cls(asyncio.new_event_loop())
                def f():
                    asyncio.set_event_loop(cls.__thread_instance.loop)
                    cls.__thread_instance.loop.run_forever()
                cls.__thread = threading.Thread(target=f)
                cls.__thread.start()
            return cls.__thread_instance

    def __init__(self, loop):
        self.server_id = settings.DISCORD_CREDENTIALS['server_id']
        self.bot_token = settings.DISCORD_CREDENTIALS['bot_token']

        self.loop = loop
        self.client = None
        self.__setup_done = False

    async def setup(self):
        assert asyncio.get_running_loop() is self.loop
        if not self.__setup_done:
            self.client = StaticDiscordHttpClient(self.bot_token, loop=self.loop)
            await self.client.static_login(self.bot_token, bot=True)
            self.__setup_done = True

    async def close(self):
        if self.client is not None:
            await self.client.close()

    async def __aenter__(self):
        await self.setup()
        return self

    async def __aexit__(self, *args, **kwargs):
        await self.close()

    async def create_channels(self, slug, *, parent_id=None, text=True, voice=True, link=None):
        await self.setup()
        requests = {}
        if text:
            requests['text'] = self.client.create_channel(
                self.server_id,
                discord.enums.ChannelType.text.value,
                name=slug,
                parent_id=parent_id,
                topic=link,
            )
        if voice:
            requests['voice'] = self.client.create_channel(
                self.server_id,
                discord.enums.ChannelType.voice.value,
                name=slug,
                parent_id=parent_id,
            )
        keys, values = zip(*requests.items())
        results = await asyncio.gather(*values)
        ids = [result['id'] for result in results]
        return dict(zip(keys, ids))

    async def create_category(self, slug):
        await self.setup()
        result = await self.client.create_channel(
            self.server_id,
            discord.enums.ChannelType.category.value,
            name=slug,
        )
        return result['id']

    async def delete_channel(self, channel_id):
        await self.setup()
        return await self.client.delete_channel(channel_id)

    async def rename_channel(self, channel_id, name):
        await self.setup()
        return await self.client.edit_channel(channel_id, name=name)

    async def get_member(self, uid):
        await self.setup()
        member = await self.client.get_member(self.server_id, uid)
        return member

    async def move_member(self, uid, channel_id):
        'Raises discord.errors.HTTPException if the user is not connected to voice (or if uid or channel_id is invalid).'
        await self.setup()
        return await self.client.edit_member(guild_id=self.server_id, user_id=uid, channel_id=channel_id)

    async def move_members_to_afk(self, channel_id):
        # TODO: Looks like this would entail having a full fledged discord
        # client maintaining state and websockets to know who is in the channel
        await self.setup()
        pass

    @classmethod
    def sync_threadsafe_get_member(cls, uid):
        '''
        Threadsafe at the cost of running its own event loop.
        This cannot be called from an async context
        '''
        dmgr = cls.instance()
        return asyncio.run_coroutine_threadsafe(dmgr.get_member(uid), dmgr.loop).result()

    @classmethod
    def sync_threadsafe_move_member(cls, uid, channel_id):
        dmgr = cls.instance()
        return asyncio.run_coroutine_threadsafe(dmgr.move_member(uid, channel_id), dmgr.loop).result()
