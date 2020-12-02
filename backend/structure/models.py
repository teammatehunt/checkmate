from django import forms
from django.conf import settings
from django.contrib.postgres import fields
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import models
from django import dispatch
from django.utils.translation import gettext_lazy as _

import autoslug
import crum

MAX_LENGTH = 500

def CharField(*args, **kwargs):
    return models.CharField(*args, max_length=MAX_LENGTH, **kwargs)

class Entity(models.Model):
    name = CharField()
    slug = autoslug.AutoSlugField(max_length=MAX_LENGTH, primary_key=True,
                                  populate_from='name')
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

    def __str__(self):
        return self.name

class Round(Entity):
    round_puzzles = models.ManyToManyField('Puzzle', through='RoundPuzzle')

class Puzzle(Entity):
    meta_feeders = models.ManyToManyField('Puzzle', through='MetaFeeder')
    answer = CharField(blank=True)
    solved = models.DateTimeField(null=True, blank=True, db_index=True)
    solved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                  null=True, editable=False,
                                  related_name='%(class)s_solved_set')
    is_meta = models.BooleanField(
        default=False, help_text='Can only be edited directly when there are no feeder puzzles. Adding feeder puzzles will also set this field.')

    def save(self, *args, **kwargs):
        if self.feeder_set.exists():
            self.is_meta = True
        super().save(*args, **kwargs)


class BasePuzzleRelation(models.Model):
    @property
    def KEY(self):
        raise NotImplementedError()
    def next_order(self):
        try:
            return self._meta.model.objects.filter(**{self.KEY: getattr(self, self.KEY)}).latest('order').order + 1
        except models.ObjectDoesNotExist:
            return 0

    created = models.DateTimeField(auto_now_add=True, db_index=True)
    order = models.PositiveSmallIntegerField(
        blank=True,
        help_text='Order of puzzles (0-indexed). Will default to last.')

    class Meta:
        abstract = True
        get_latest_by = 'created'
        ordering = ['order']
        required_db_features = {
            'supports_deferrable_unique_constraints',
        }

    def save(self, *args, **kwargs):
        if self.order is None:
            self.order = self.next_order()
        super().save(*args, **kwargs)


class RoundPuzzle(BasePuzzleRelation):
    KEY = 'round'
    round = models.ForeignKey('Round', on_delete=models.CASCADE)
    puzzle = models.ForeignKey('Puzzle', on_delete=models.CASCADE)

    class Meta(BasePuzzleRelation.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=['round', 'puzzle'], name='unique_puzzle',
                deferrable=models.Deferrable.DEFERRED,
            ),
            models.UniqueConstraint(
                fields=['round', 'order'], name='unique_puzzle_order',
                deferrable=models.Deferrable.DEFERRED,
            ),
        ]

class MetaFeeder(BasePuzzleRelation):
    KEY = 'meta'
    meta = models.ForeignKey('Puzzle', on_delete=models.CASCADE, related_name='feeder_set')
    feeder = models.ForeignKey('Puzzle', on_delete=models.CASCADE, related_name='meta_set')

    class Meta(BasePuzzleRelation.Meta):
        constraints = [
            models.CheckConstraint(check=~models.Q(meta=models.F('feeder')), name='meta_ne_feeder'),
            models.UniqueConstraint(
                fields=['meta', 'feeder'], name='unique_feeder',
                deferrable=models.Deferrable.DEFERRED,
            ),
            models.UniqueConstraint(
                fields=['meta', 'order'], name='unique_feeder_order',
                deferrable=models.Deferrable.DEFERRED,
            ),
        ]

    def clean(self, *args, **kwargs):
        if self.meta_id == self.feeder_id:
            raise ValidationError(_('Puzzle cannot feed itself.'), code='invalid')
        return super().clean(*args, **kwargs)

@dispatch.receiver([models.signals.post_save, models.signals.post_delete], sender=RoundPuzzle)
@dispatch.receiver([models.signals.post_save, models.signals.post_delete], sender=MetaFeeder)
def puzzle_relation_changed(sender, **kwargs):
    instance = kwargs['instance']
    for field in instance._meta.get_fields():
        if isinstance(field, models.ForeignKey):
            getattr(instance, field.name).save()
