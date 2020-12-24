import aiohttp
import asyncio

import discord

from django.conf import settings

class StaticDiscordHttpClient(discord.http.HTTPClient):
    async def static_login(self, token, *, bot):
        self._HTTPClient__session = aiohttp.ClientSession()
        self._token(token, bot=bot)

class DiscordManager:
    def __init__(self):
        self.server_id = settings.DISCORD_CREDENTIALS['server_id']
        self.bot_token = settings.DISCORD_CREDENTIALS['bot_token']
        self.default_category_id = settings.DISCORD_CREDENTIALS.get('default_category_id')
        self.deprecated_category_id = settings.DISCORD_CREDENTIALS.get('deprecated_category_id')

        self.client = None
        self.__setup_done = False

    async def setup(self):
        if not self.__setup_done:
            loop = asyncio.get_running_loop()
            self.client = StaticDiscordHttpClient(self.bot_token, loop=loop)
            await self.client.static_login(self.bot_token, bot=True)
            self.__setup_done = True

    async def close(self):
        await self.client.close()

    async def __aenter__(self):
        await self.setup()
        return self

    async def __aexit__(self, *args, **kwargs):
        await self.close()

    async def create_channels(self, slug, voice=True, link=None):
        await self.setup()
        requests = {}
        requests['text'] = self.client.create_channel(
            self.server_id,
            discord.enums.ChannelType.text.value,
            name=slug,
            parent_id=self.default_category_id,
            topic=link,
        )
        if voice:
            requests['voice'] = self.client.create_channel(
                self.server_id,
                discord.enums.ChannelType.voice.value,
                name=slug,
                parent_id=self.default_category_id,
            )
        keys, values = zip(*requests.items())
        results = await asyncio.gather(*values)
        ids = [result['id'] for result in results]
        return dict(zip(keys, ids))

    async def get_member(self, uid):
        await self.setup()
        member = await self.client.get_member(self.server_id, uid)
        return member

    @classmethod
    def sync_threadsafe_get_member(cls, uid):
        '''
        Threadsafe at the cost of running its own event loop.
        This cannot be called from an async context
        '''
        async def func():
            async with cls() as dmgr:
                return await dmgr.get_member(uid)
        return asyncio.run(func())
