import asyncio
import json
import logging

from allauth.socialaccount.models import SocialAccount
from asgiref.sync import sync_to_async
from django.conf import settings
from django import http

import aiohttp
import discord

from .threadsafe_manager import ThreadsafeManager

logger = logging.getLogger(__name__)

class StaticDiscordHttpClient(discord.http.HTTPClient):
    async def static_login(self, token, *, bot):
        self._HTTPClient__session = aiohttp.ClientSession()
        self._token(token, bot=bot)

    @property
    def session(self):
        return self._HTTPClient__session


class DiscordManager(ThreadsafeManager):
    @staticmethod
    async def initiate_gateway():
        '''
        Connect to gateway and then close. This is necessary before Discord
        will allow certain actions like posting messages.
        '''
        bot_token = settings.DISCORD_CREDENTIALS['bot_token']
        client = discord.Client()
        await client.start(bot_token)
        await client.close()
        logger.warning('connected to discord')

    def __init__(self, loop):
        super().__init__(loop)

        self.server_id = settings.DISCORD_CREDENTIALS['server_id']
        self.bot_token = settings.DISCORD_CREDENTIALS['bot_token']

        self.client = None
        self.__setup_done = False

    async def get_session(self):
        await self.setup()
        return self.client.session

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
        results = await asyncio.gather(*values, return_exceptions=True)
        exceptions = [result for result in results if isinstance(result, Exception)]
        if exceptions:
            logger.error(f'Discord Errors: {repr(exceptions)}')
        mapping = {
            key: result['id']
            for key, result in zip(keys, results)
            if not isinstance(result, Exception)
        }
        return mapping

    async def create_category(self, slug, discord_category_ids):
        # discord_category_ids should be a list of existing auto-created category ids.
        # This will position the new category at the top of these.
        await self.setup()
        discord_category_ids = set(discord_category_ids)
        channels = await self.client.get_all_guild_channels(
            self.server_id,
        )
        first_auto_category_position = min(
            [
                channel['position'] for channel in channels if
                channel['type'] == discord.enums.ChannelType.category.value and
                int(channel['id']) in discord_category_ids
            ],
            default=None,
        )
        result = await self.client.create_channel(
            self.server_id,
            discord.enums.ChannelType.category.value,
            name=slug,
            position=first_auto_category_position,
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
        return cls._run_sync_threadsafe(cls.get_member, uid).result()

    @classmethod
    def sync_threadsafe_move_member(cls, uid, channel_id):
        return cls._run_sync_threadsafe(cls.move_member, uid, channel_id).result()
