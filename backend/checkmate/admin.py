from django.contrib import admin

from django_admin_hstore_widget.forms import HStoreFormWidget
from . import models

from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return False

class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def is_open_for_signup(self, request, sociallogin):
        return True

    def save_user(self, request, sociallogin, form=None):
        sociallogin.user.username = sociallogin.account.get_provider_account().to_str()
        return super().save_user(request, sociallogin, form=form)

class ModelAdmin(admin.ModelAdmin):
    formfield_overrides = {
        models.fields.HStoreField: {'widget': HStoreFormWidget, 'required': False},
    }

@admin.register(models.Round)
class RoundAdmin(ModelAdmin):
    pass


@admin.register(models.Puzzle)
class PuzzleAdmin(ModelAdmin):
    pass
