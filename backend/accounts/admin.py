import datetime
import logging

from django.conf import settings
from django.contrib import admin
from django.contrib import messages
from django.shortcuts import redirect

import discord
from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.exceptions import ImmediateHttpResponse

from services.discord_manager import DiscordManager
from services.google_manager import GoogleManager
from structure import models

logger = logging.getLogger(__name__)


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return False

class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def is_open_for_signup(self, request, sociallogin):
        return True

    def add_google(self, request, sociallogin):
        scopes = request.GET.get('scope', '')
        missing_scopes = (
            set(settings.SOCIALACCOUNT_PROVIDERS['google']['SCOPE'])
            - set(scopes.split())
        )
        if missing_scopes:
            e = ValueError(f'You need to allow all scopes: {" ".join(missing_scopes)}')
            messages.error(request, e)
            raise ImmediateHttpResponse(redirect('/accounts/social/login/error/')) from e

        extra_data = sociallogin.account.extra_data
        token = sociallogin.token
        owner = models.GoogleSheetOwner(
            name=extra_data.get('name', ''),
            email=extra_data.get('email', ''),
            uid=sociallogin.account.uid,
            refresh_token=token.token_secret,
            access_token=token.token,
            expires_at=datetime.datetime.utcfromtimestamp(extra_data.get('exp')).replace(tzinfo=datetime.timezone.utc),
            scopes=scopes,
        )
        if not GoogleManager.sync_check_access(owner):
            e = ValueError(f'{owner.email} does not have access to the template sheet and the puzzle folder')
            messages.error(request, e)
            raise ImmediateHttpResponse(redirect('/accounts/social/login/error/')) from e
        owner.save()
        raise ImmediateHttpResponse(redirect('/google'))

    def pre_social_login(self, request, sociallogin):
        account = sociallogin.account
        if account.provider == 'google':
            self.add_google(request, sociallogin)
            raise ImmediateHttpResponse(redirect('/'))

        uid = account.uid
        username = account.extra_data.get('username')
        discriminator = account.extra_data.get('discriminator')
        nick = account.extra_data.get('nick')
        roles = account.extra_data.get('roles')
        if username is None or discriminator is None:
            user = f'User {uid}'
        else:
            user = f'{username}#{discriminator}'
        error_message = None
        try:
            member = DiscordManager.sync_threadsafe_get_member(uid)

            adding = False
            if nick != member['nick']:
                account.extra_data['nick'] = member['nick']
                adding = True
            if roles != member.get('roles'):
                account.extra_data.pop('roles', None)
                if member.get('roles') is not None:
                    account.extra_data['roles'] = member.get('roles')
                adding = True
            if adding and not account._state.adding:
                account.save(update_fields=['extra_data'])
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
