from django.contrib import admin
from django import forms
from django.db import transaction

from django_admin_hstore_widget.forms import HStoreFormWidget
from . import models

# Inline models first (for relationships)
class DeferredUniqueForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        kwargs['empty_permitted'] = True
        super().__init__(*args, **kwargs)
    def clean(self):
        # do not set _validate_unique to defer this to the database level
        return self.cleaned_data
class TabularInline(admin.TabularInline):
    form = DeferredUniqueForm
    validate_min = False
    @property
    def verbose_name_plural(self):
        return f'{self.verbose_name}s'
class RoundPuzzleInlinePuzzle(TabularInline):
    model = models.RoundPuzzle
class RoundPuzzleInlineRound(TabularInline):
    model = models.RoundPuzzle
    verbose_name = 'Round'
    readonly_fields = ('order',)
    min_num = 1
    extra = 0
class MetaFeederInlineFeeder(TabularInline):
    model = models.MetaFeeder
    fk_name = 'meta'
    verbose_name = 'Feeder Puzzle'
class MetaFeederInlineMeta(TabularInline):
    model = models.MetaFeeder
    fk_name = 'feeder'
    verbose_name = 'Meta Puzzle'
    readonly_fields = ('order',)
    min_num = 1
    extra = 0

class ModelAdmin(admin.ModelAdmin):
    formfield_overrides = {
        models.fields.HStoreField: {'widget': HStoreFormWidget, 'required': False},
    }

@admin.register(models.HuntConfig)
class HuntConfigAdmin(ModelAdmin):
    pass

@admin.register(models.Round)
class RoundAdmin(ModelAdmin):
    list_display = ('name', 'slug', 'created', 'created_by')
    inlines = (
        RoundPuzzleInlinePuzzle,
    )

@admin.register(models.Puzzle)
class PuzzleAdmin(ModelAdmin):
    list_display = ('name', 'slug', 'created', 'created_by')
    inlines = (
        RoundPuzzleInlineRound,
        MetaFeederInlineMeta,
        MetaFeederInlineFeeder,
    )

    def get_readonly_fields(self, request, obj=None):
        extra_readonly_fields = []
        if obj is not None:
            if obj.feeders.exists():
                extra_readonly_fields.append('is_meta')
        return (*self.readonly_fields, *extra_readonly_fields)
