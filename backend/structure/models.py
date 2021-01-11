from collections import defaultdict
import logging

from django import forms
from django.conf import settings
from django.contrib.postgres import fields
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import models, transaction
from django import dispatch
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

import autoslug
import crum

from services.celery import app
from services.redis_manager import RedisManager

logger = logging.getLogger(__name__)

MAX_LENGTH = 500

def CharField(*args, **kwargs):
    if kwargs.get('blank') and kwargs.get('default') is None:
        kwargs['default'] = ''
    return models.CharField(*args, max_length=MAX_LENGTH, **kwargs)

class SingletonModel(models.Model):
    class Meta:
        abstract = True

    @classmethod
    def get(cls):
        obj = cls.objects.last()
        if obj is None:
            obj = cls()
            for field in obj._meta.fields:
                setattr(obj, field.name, field.get_default())
        return obj

    def save(self, *args, **kwargs):
        with transaction.atomic():
            super().save(*args, **kwargs)
            # Remove all previous configs
            objs = self.__class__.objects.exclude(pk=self.pk).delete()

class HuntConfig(SingletonModel):
    auto_assign_puzzles_to_meta = models.BooleanField(
        default=True, help_text='Should be true when the entire round corresponds to one meta.',
    )
    root = CharField(blank=True, help_text='Hunt prefix (protocol, domain, and path prefix). (eg https://example.com)')
    discord_server_id = models.BigIntegerField(
        null=True, blank=True,
        default=settings.SECRETS.get('DISCORD_CREDENTIALS', {}).get('server_id', None))
    tag_colors = fields.HStoreField(default=dict, help_text='Tag value to (CSS) color mapping.')

class BotConfig(SingletonModel):
    '''Settings for bot that don't need to be passed to web users.'''
    # Hunt site and scraper settings
    puzzles_page = CharField(blank=True, help_text='Page with puzzles list (or data endpoint) to be queried by scraper.')
    login_page = CharField(blank=True, help_text='Login page (used by scraper).')
    login_api_endpoint = CharField(blank=True, help_text='Login endpoint (used by scraper).')
    enable_scraping = models.BooleanField(default=False, help_text='Enable auto scraping for new puzzles.')

    # Discord settings
    # server_id in SECRETS and HuntConfig
    default_category_id = models.BigIntegerField(
        null=True, blank=True,
        help_text='Discord category for puzzles to be placed if not in round category.')
    # need to use webhooks because of better hyperlink support
    alert_new_puzzle_webhook = CharField(
        blank=True, help_text='Discord webhook for new puzzle alerts.')
    alert_solved_puzzle_webhook = CharField(
        blank=True, help_text='Discord webhook for solved puzzle alerts.')
    afk_voice_channel_id = models.BigIntegerField(
        null=True, blank=True, help_text='Discord channel to put people in when deleting channels.')

class Entity(models.Model):
    slug = autoslug.AutoSlugField(max_length=MAX_LENGTH, primary_key=True,
                                  populate_from='name')
    name = CharField()
    link = CharField(blank=True, help_text='Can be path relative to hunt root')
    original_link = CharField(blank=True, editable=False,
                              help_text='Link upon creation. (Used to ensure scraper does not duplicate)')
    created = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                   null=True, editable=False,
                                   related_name='%(class)s_created_set')
    modified = models.DateTimeField(auto_now=True, db_index=True)
    modified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                    null=True, editable=False,
                                    related_name='%(class)s_modified_set')
    hidden = models.BooleanField(default=False, help_text='Hidden objects will not be shown.')
    notes = models.TextField(blank=True)
    tags = fields.HStoreField(default=dict, help_text='Keys with optional values.')

    discord_text_channel_id = models.BigIntegerField(null=True, blank=True)
    discord_voice_channel_id = models.BigIntegerField(null=True, blank=True)
    sheet_link = CharField(blank=True)

    class Meta:
        abstract = True
        get_latest_by = 'created'
        ordering = ('created',)

    def save(self, *args, **kwargs):
        user = crum.get_current_user()
        if user and user.pk is None:
            user = None
        self.modified_by = user
        auto_fields = ['modified', 'modified_by']
        if self._state.adding:
            self.created_by = user
            self.original_link = self.link
            auto_fields.extend(['created', 'created_by', 'original_link'])
        if 'update_fields' in kwargs:
            kwargs['update_fields'] = list({*kwargs['update_fields'], *auto_fields})
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    @classmethod
    def get_lock(cls, slug, blocking_timeout=5):
        return RedisManager.instance().reentrant_lock(f'lock-order-{cls.__name__}-{slug}', blocking_timeout=blocking_timeout)

class Round(Entity):
    puzzles = models.ManyToManyField('Puzzle', through='RoundPuzzle', related_name='rounds')
    auto_assign_puzzles_to_meta = models.BooleanField(
        default=True, help_text='Should be true when the entire round corresponds to one meta.',
    )
    discord_category_id = models.BigIntegerField(null=True, blank=True)
    round_tags = fields.ArrayField(
        CharField(), default=list, blank=True,
        help_text='Tag categories that should be displayed / set for each puzzle in the round.')

class Puzzle(Entity):
    feeders = models.ManyToManyField('Puzzle', through='MetaFeeder', related_name='metas')
    answer = CharField(blank=True)
    solved = models.DateTimeField(null=True, blank=True, db_index=True)
    solved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                  null=True, editable=False,
                                  related_name='%(class)s_solved_set')
    status = CharField(blank=True)
    is_meta = models.BooleanField(
        default=False, help_text='Can only be edited directly when there are no feeder puzzles. Adding feeder puzzles will also set this field.')

    # should match statuses in `colors.tsx` in the frontend
    SOLVED_STATUSES = set(['solved', 'backsolved', 'bought'])

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.original_is_meta = self.is_meta
        self.original_solved = self.solved
        self.original_is_solved = self.is_solved()

    @staticmethod
    def get_link(slug):
        return f'{settings.ORIGIN}/puzzles/{slug}'

    def is_solved(self):
        return self.status in self.SOLVED_STATUSES

    def save(self, *args, **kwargs):
        feeder_ids = set(self.feeders.through.objects.filter(meta_id=self.pk))
        auto_fields = []
        if feeder_ids:
            self.is_meta = True
            auto_fields.append('is_meta')
        if self.solved is None and not self.original_is_solved and self.is_solved():
            self.solved = timezone.now()
            auto_fields.append('solved')
        if self.solved != self.original_solved:
            if self.solved is None:
                self.solved_by = None
            else:
                self.solved_by = crum.get_current_user()
            auto_fields.append('solved_by')
        if 'update_fields' in kwargs:
            kwargs['update_fields'] = list({*kwargs['update_fields'], *auto_fields})
        with transaction.atomic():
            super().save(*args, **kwargs)
            if self.is_meta and not self.original_is_meta:
                # add feeders from rounds
                for _round in self.rounds.all().prefetch_related('puzzle_relations'):
                    if _round.auto_assign_puzzles_to_meta:
                        for relation in _round.puzzle_relations.all():
                            puzzle_id = relation.puzzle_id
                            if puzzle_id not in feeder_ids and puzzle_id != self.pk:
                                self.feeders.through(meta_id=self.pk, feeder_id=puzzle_id).save()
                                feeder_ids.add(puzzle_id)
        if not self.original_is_solved and self.is_solved():
            # cleanup
            app.send_task('services.tasks.post_solve_puzzle', args=[self.pk])
        if self.original_is_solved and not self.is_solved() and self.solved is not None:
            # unsolve
            app.send_task('services.tasks.unsolve_puzzle', args=[self.pk], countdown=60.)


class BasePuzzleRelation(models.Model):
    created = models.DateTimeField(auto_now_add=True, db_index=True)
    order = models.PositiveSmallIntegerField(
        blank=True,
        help_text='Order of puzzles (0-indexed). Will default to last.')

    class Meta:
        abstract = True
        ordering = ['order']
        get_latest_by = 'created'
        required_db_features = {
            'supports_deferrable_unique_constraints',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.original_related_objects = self.related_objects

    @property
    def CONTAINER(self):
        raise NotImplementedError()

    @property
    def ITEM(self):
        raise NotImplementedError()

    @property
    def related_objects(self):
        return {
            key: None if getattr(self, f'{key}_id') is None else getattr(self, key)
            for key in (self.CONTAINER, self.ITEM)
        }

    def objects_in_container(self):
        return self._meta.model.objects.filter(**{self.CONTAINER: getattr(self, self.CONTAINER)})

    def next_order(self):
        try:
            return self.objects_in_container().latest('order').order + 1
        except models.ObjectDoesNotExist:
            return 0

    def get_container_lock(self):
        container_cls = self._meta.get_field(self.CONTAINER).related_model
        return container_cls.get_lock(getattr(self, f'{self.CONTAINER}_id'))

    def save(self, *args, **kwargs):
        with self.get_container_lock():
            with transaction.atomic():
                if self.order is None:
                    self.order = self.next_order()
                super().save(*args, **kwargs)
        self.touch_related()

    def delete(self, *args, **kwargs):
        with self.get_container_lock():
            with transaction.atomic():
                super().delete(*args, **kwargs)
                self.objects_in_container().filter(order__gt=self.order).update(order=models.F('order')-1)
        self.touch_related(deleted=True)

    def touch_related(self, deleted=False):
        relation_was_modified = False
        saved_related_objects = defaultdict(lambda: None) if deleted else self.related_objects
        for key in self.original_related_objects:
            if self.original_related_objects[key] != saved_related_objects[key]:
                relation_was_modified = True
        if relation_was_modified:
            objs = {*self.original_related_objects.values(), *saved_related_objects.values()}
            for obj in objs:
                if obj is not None:
                    obj.save(update_fields=[])


class RoundPuzzle(BasePuzzleRelation):
    CONTAINER = 'round'
    ITEM = 'puzzle'
    round = models.ForeignKey('Round', on_delete=models.CASCADE, related_name='puzzle_relations')
    puzzle = models.ForeignKey('Puzzle', on_delete=models.CASCADE, related_name='round_relations')

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

    def save(self, *args, **kwargs):
        with self.get_container_lock():
            with transaction.atomic():
                adding = self._state.adding
                super().save(*args, **kwargs)
                if adding:
                    if self.round.auto_assign_puzzles_to_meta:
                        if self.puzzle.is_meta:
                            feeder_ids = set(self.puzzle.feeder_relations.filter(meta_id=self.puzzle_id))
                            for relation in self.round.puzzle_relations.all():
                                puzzle_id = relation.puzzle_id
                                if puzzle_id not in feeder_ids and puzzle_id != self.puzzle_id:
                                    MetaFeeder(meta_id=self.puzzle_id, feeder_id=puzzle_id).save()
                                    feeder_ids.add(puzzle_id)
                        metas = list(self.round.puzzles.all().filter(is_meta=True).prefetch_related('feeder_relations'))
                        for meta in metas:
                            feeder_ids = set(relation.feeder_id for relation in meta.feeder_relations.all())
                            if self.puzzle_id not in feeder_ids and self.puzzle_id != meta.pk:
                                MetaFeeder(meta_id=meta.pk, feeder_id=self.puzzle_id).save()


class MetaFeeder(BasePuzzleRelation):
    CONTAINER = 'meta'
    ITEM = 'feeder'
    meta = models.ForeignKey('Puzzle', on_delete=models.CASCADE, related_name='feeder_relations')
    feeder = models.ForeignKey('Puzzle', on_delete=models.CASCADE, related_name='meta_relations')

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
