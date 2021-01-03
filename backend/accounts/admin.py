import logging

from django.contrib import admin
from django.contrib import messages
from django.shortcuts import redirect

import discord
from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.exceptions import ImmediateHttpResponse

from services.discord_manager import DiscordManager
from structure import models

logger = logging.getLogger(__name__)


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return False

class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def is_open_for_signup(self, request, sociallogin):
        return True

    def pre_social_login(self, request, sociallogin):
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
            member = DiscordManager.sync_threadsafe_get_member(uid)
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
