import aiohttp

import discord

class StaticDiscordHttpClient(discord.http.HTTPClient):
    async def static_login(self, token, *, bot):
        self._HTTPClient__session = aiohttp.ClientSession()
        self._token(token, bot=bot)
