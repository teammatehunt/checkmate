from django.contrib import admin

from django_admin_hstore_widget.forms import HStoreFormWidget
from . import models

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
