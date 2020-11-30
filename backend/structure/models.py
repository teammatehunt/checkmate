from django.db import models
from django import forms

from django.conf import settings
from django.contrib.postgres import fields

import crum

MAX_LENGTH = 500

def CharField(*args, **kwargs):
    return models.CharField(*args, max_length=MAX_LENGTH, **kwargs)

class Tag(models.Model):
    name = CharField()
    value = CharField(blank=True)


class Entity(models.Model):
    name = CharField()
    slug = models.SlugField(max_length=MAX_LENGTH, primary_key=True)
    link = CharField(blank=True)
    created = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                   null=True, editable=False,
                                   related_name='%(class)s_created_set')
    modified = models.DateTimeField(auto_now=True, db_index=True)
    modified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                    null=True, editable=False,
                                    related_name='%(class)s_modified_set')
    tags = fields.HStoreField()

    discord_text_channel_id = models.IntegerField(null=True, blank=True)
    discord_voice_channel_id = models.IntegerField(null=True, blank=True)
    sheet_link = CharField(blank=True)

    # list of Puzzle slugs
    puzzles = fields.ArrayField(CharField(), default=list, blank=True)

    class Meta:
        abstract = True
        get_latest_by = 'created'
        ordering = ('created',)

    def save(self, *args, **kwargs):
        user = crum.get_current_user()
        if user and user.pk is None:
            user = None
        if self._state.adding:
            self.created_by = user
        self.modified_by = user
        super().save(*args, **kwargs)

class Round(Entity):
    pass

class Puzzle(Entity):
    answer = CharField(blank=True)
    solved = models.DateTimeField(null=True, blank=True, db_index=True)
    solved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                  null=True, editable=False,
                                  related_name='%(class)s_solved_set')
    is_meta = models.BooleanField(default=False)
