import asyncio

from django.conf import settings
from django.contrib import admin
from django.contrib import messages
from django.shortcuts import redirect

import discord
from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.exceptions import ImmediateHttpResponse

import services.discord_manager as dmgr
from structure import models


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return False

async def get_member(bot_token, server_id, uid):
    client = dmgr.StaticDiscordHttpClient(bot_token)
    await client.static_login(bot_token, bot=True)
    member = await client.get_member(server_id, uid)
    return member

class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def is_open_for_signup(self, request, sociallogin):
        return True

    def pre_social_login(self, request, sociallogin):
        bot_token = settings.SECRETS.get('DISCORD_CREDENTIALS', {}).get('bot_token', None)
        server_id = models.HuntConfig.get().discord_server_id
        account = sociallogin.account.get_provider_account().account
        uid = account.uid
        username = account.extra_data.get('username', None)
        discriminator = account.extra_data.get('discriminator', None)
        if username is None or discriminator is None:
            user = f'User {uid}'
        else:
            user = f'{username}#{discriminator}'
        error_message = None
        try:
            member = asyncio.run(get_member(bot_token, server_id, uid))
        except discord.HTTPException as e:
            if isinstance(e, discord.NotFound):
                error_message = f'{user} is not a member of the Discord server.'
            else:
                error_message = e
            messages.error(request, error_message)
            raise ImmediateHttpResponse(redirect('/accounts/social/login/error/')) from e

    def save_user(self, request, sociallogin, form=None):
        sociallogin.user.username = sociallogin.account.get_provider_account().to_str()
        return super().save_user(request, sociallogin, form=form)
