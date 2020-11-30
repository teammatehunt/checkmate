from django.contrib import admin

from django_admin_hstore_widget.forms import HStoreFormWidget
from . import models

class ModelAdmin(admin.ModelAdmin):
    formfield_overrides = {
        models.fields.HStoreField: {'widget': HStoreFormWidget, 'required': False},
    }

class EntityAdmin(ModelAdmin):
    list_display = ('name', 'slug', 'created', 'created_by')

@admin.register(models.Round)
class RoundAdmin(EntityAdmin):
    pass

@admin.register(models.Puzzle)
class PuzzleAdmin(EntityAdmin):
    pass
