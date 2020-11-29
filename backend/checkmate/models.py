from django.db import models
from django import forms
from django.contrib.postgres import fields

def CharField(*args, **kwargs):
    MAX_LENGTH = 500
    return models.CharField(*args, max_length=MAX_LENGTH, **kwargs)

class Tag(models.Model):
    name = CharField()
    value = CharField(blank=True)


class Entity(models.Model):
    name = CharField()
    slug = CharField()
    link = CharField(blank=True)
    created = models.DateTimeField(auto_now_add=True)
    created_by = models.IntegerField(null=True, blank=True) # Discord user id
    touched = models.DateTimeField(auto_now=True)
    touched_by = models.IntegerField(null=True, blank=True) # Discord user id
    tags = fields.HStoreField()

    discord_text_channel_id = models.IntegerField(null=True, blank=True)
    discord_voice_channel_id = models.IntegerField(null=True, blank=True)
    sheet_link = CharField(blank=True)

    class Meta:
        abstract = True

class Round(Entity):
    pass

class Puzzle(Entity):
    answer = CharField(blank=True)
    solved = models.DateTimeField(null=True, blank=True)
    solved_by = models.IntegerField(null=True, blank=True) # Discord user id
    # feeds_into = models.ArrayReferenceField('Puzzle')
