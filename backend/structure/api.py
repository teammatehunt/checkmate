import datetime
import inspect
import logging

import discord
from django import db
from django.contrib.auth.decorators import login_required
from django.middleware import csrf
from django.db import transaction
from django.db.models import F
from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import decorators, exceptions, permissions, response, serializers, status, viewsets
from allauth.socialaccount.models import SocialAccount

from services import tasks
from services.discord_manager import DiscordManager
from . import models

logger = logging.getLogger(__name__)

class SocialAccountSerializer(serializers.ModelSerializer):
    extra_data = serializers.JSONField()
    class Meta:
        model = SocialAccount
        fields = ('provider', 'uid', 'extra_data')
class UserSerializer(serializers.ModelSerializer):
    socialaccounts = SocialAccountSerializer(source='socialaccount_set', many=True, read_only=True)
    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name', 'socialaccounts')
class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all().prefetch_related('socialaccount_set')
    serializer_class = UserSerializer

class HuntConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.HuntConfig
        fields = '__all__'
class HuntConfigViewSet(viewsets.ModelViewSet):
    queryset = models.HuntConfig.objects.all()
    serializer_class = HuntConfigSerializer

class ExtraFieldsSerializer(serializers.ModelSerializer):
    def get_field_names(self, *args, **kwargs):
        direct_fields = super().get_field_names(*args, **kwargs)
        expanded_fields = (*direct_fields, *getattr(self.Meta, 'extra_fields', ()))
        mapping = getattr(self.Meta, 'field_names_map', {})
        mapped_fields = tuple(mapping.get(field, field) for field in expanded_fields)
        return mapped_fields

class ContainerSpecialization:
    def process_items(self, request, pk=None):
        if request.method == 'POST':
            return process_relation(self.relation_model, pk, request)
        else: # GET
            try:
                items = [getattr(relation, self.relation_model.ITEM) for relation in getattr(self.model.objects.get(pk=pk), f'{self.relation_model.ITEM}_relations').prefetch_related(self.relation_model.ITEM)]
            except self.model.DoesNotExist:
                raise exceptions.NotFound()
            return response.Response(self.item_serializer_class(items, many=True).data)

    def perform_destroy(self, instance):
        now = datetime.datetime.now()
        instance.hidden = True
        instance.save()


class BaseRoundSerializer(ExtraFieldsSerializer):
    class Meta:
        model = models.Round
        exclude = ['puzzles']
class RoundSerializer(BaseRoundSerializer):
    class Meta(BaseRoundSerializer.Meta):
        extra_fields = ['puzzles']
class BasePuzzleSerializer(ExtraFieldsSerializer):
    class Meta:
        model = models.Puzzle
        exclude = ['feeders']
class PuzzleSerializer(BasePuzzleSerializer):
    class Meta(BasePuzzleSerializer.Meta):
        extra_fields = ['rounds', 'metas', 'feeders']
        depth = 0

class RoundViewSet(ContainerSpecialization, viewsets.ModelViewSet):
    model = models.Round
    relation_model = models.RoundPuzzle
    queryset = model.objects.all().prefetch_related('puzzle_relations')
    serializer_class = RoundSerializer
    item_serializer_class = PuzzleSerializer

    @decorators.action(methods=['POST'], detail=False)
    def create_and_populate(self, request):
        data = request.data
        if 'name' not in data:
            raise exceptions.NotAcceptable('Need name')
        kwargs_names = set(inspect.signature(tasks.create_round).parameters.keys())
        extra_args = set(data.keys()) - kwargs_names
        if extra_args:
            raise exceptions.NotAcceptable(f'Unrecognized args: {sorted(extra_args)}')
        tasks.create_round.delay(**data)
        return response.Response(status=status.HTTP_204_NO_CONTENT)

    @decorators.action(methods=['GET', 'POST'], detail=True)
    def puzzles(self, *args, **kwargs):
        return self.process_items(*args, **kwargs)

class PuzzleViewSet(ContainerSpecialization, viewsets.ModelViewSet):
    model = models.Puzzle
    relation_model = models.MetaFeeder
    queryset = model.objects.all().prefetch_related('round_relations', 'meta_relations', 'feeder_relations')
    serializer_class = PuzzleSerializer
    item_serializer_class = PuzzleSerializer

    @decorators.action(methods=['POST'], detail=False)
    def create_and_populate(self, request):
        data = request.data
        if 'name' not in data or 'link' not in data:
            raise exceptions.NotAcceptable('Need name and link')
        kwargs_names = set(inspect.signature(tasks.create_puzzle).parameters.keys())
        extra_args = set(data.keys()) - kwargs_names
        if extra_args:
            raise exceptions.NotAcceptable(f'Unrecognized args: {sorted(extra_args)}')
        tasks.create_puzzle.delay(**data)
        return response.Response(status=status.HTTP_204_NO_CONTENT)

    @decorators.action(methods=['GET', 'POST'], detail=True)
    def feeders(self, *args, **kwargs):
        return self.process_items(*args, **kwargs)

def process_relation(cls, pk, request):
    '''
    Process the request to change the set of puzzles for a round/meta.
    cls: RoundPuzzle or MetaFeeder
    pk: primary key of round/meta
    request:
        data:
            action: 'add', 'remove', 'set', 'move'
            puzzles: list of puzzle slugs. This should be a single puzzle for the move operation.
            order (move only): the new order for the puzzle
    '''
    try:
        data = request.data
        actions = ['add', 'remove', 'set', 'move']
        action = data.pop('action', None)
        slugs = data.pop('puzzles', None)
        container_cls = cls._meta.get_field(cls.CONTAINER).related_model
        item_cls = cls._meta.get_field(cls.ITEM).related_model

        # validate primary key
        try:
            container_cls.objects.get(pk=pk)
        except container_cls.DoesNotExist:
            raise exceptions.NotFound()

        # check parameters
        if action not in actions:
            raise exceptions.NotAcceptable(f'action must be one of {actions}')
        if not isinstance(slugs, list) or not slugs or not all(isinstance(slug, str) for slug in slugs):
            raise exceptions.NotAcceptable('puzzles must be a nonempty list of puzzle slugs')
        if action == 'move':
            order = data.pop('order', None)
            if len(slugs) != 1:
                raise exceptions.NotAcceptable('move operation requires a single slug')
            if not isinstance(order, int):
                raise exceptions.NotAcceptable('move operation requires an integer order parameter')
        if data:
            raise exceptions.NotAcceptable(f'request has extra fields: {list(data.keys())}')

        # validate inputs slugs
        valid_slugs_query = item_cls.objects.filter(pk__in=slugs).values_list('pk', flat=True)
        valid_slugs = set(valid_slugs_query)
        invalid_slugs = [slug for slug in slugs if slug not in valid_slugs]
        valid_slugs = [slug for slug in slugs if slug in valid_slugs]
        if invalid_slugs:
            raise exceptions.NotAcceptable(f'invalid puzzle slugs: {invalid_slugs}')

        # action based operations
        existing_relations_query = cls.objects.filter(**{f'{cls.CONTAINER}_id': pk})
        existing_slugs_query = existing_relations_query.values_list(f'{cls.ITEM}_id', flat=True)
        if action == 'add':
            existing_slugs = set(existing_slugs_query)
            new_slugs = [slug for slug in slugs if slug not in existing_slugs]
            if new_slugs:
                with transaction.atomic():
                    for slug in new_slugs:
                        cls(**{f'{cls.CONTAINER}_id': pk, f'{cls.ITEM}_id': slug}).save()
                return response.Response(status=status.HTTP_204_NO_CONTENT)
            else:
                raise exceptions.NotAcceptable('Request is a no-op.')
        elif action == 'remove':
            slugs = set(slugs)
            existing_relations = list(existing_relations_query)
            relations_to_remove = [relation for relation in existing_relations if getattr(relation, f'{cls.ITEM}_id') in slugs]
            if relations_to_remove:
                with transaction.atomic():
                    for relation in relations_to_remove:
                        relation.delete()
                return response.Response(status=status.HTTP_204_NO_CONTENT)
            else:
                raise exceptions.NotAcceptable('Request is a no-op.')
        elif action == 'set':
            new_relations = [
                cls(**{
                    f'{cls.CONTAINER}_id': pk,
                    f'{cls.ITEM}_id': slug,
                    'order': order,
                }) for order, slug in enumerate(slugs)
            ]
            now = datetime.datetime.now()
            with transaction.atomic():
                item_cls.objects.filter(pk__in=existing_slugs_query).update(modified=now, modified_by=request.user)
                existing_relations_query.delete()
                cls.objects.bulk_create(new_relations)
                item_cls.objects.filter(pk__in=valid_slugs_query).update(modified=now, modified_by=request.user)
                container_cls.objects.filter(pk=pk).update(modified=now, modified_by=request.user)
            return response.Response(status=status.HTTP_204_NO_CONTENT)
        elif action == 'move':
            slug = next(iter(slugs))
            relations_set = cls.objects.filter(**{f'{cls.CONTAINER}_id': pk})
            relations = list(relations_set)
            existing_relation = None
            for relation in relations:
                if getattr(relation, f'{cls.ITEM}_id') == slug:
                    existing_relation = relation
            if existing_relation is None:
                raise exceptions.NotFound()
            if not 0 <= order < len(relations):
                raise exceptions.NotAcceptable(f'order is out of range: {order} is not in [0, {len(relations)})')
            new_order = relations[order].order
            if new_order != existing_relation.order:
                with container_cls.get_lock(pk):
                    with transaction.atomic():
                        if new_order < existing_relation.order:
                            relations_set.filter(order__gte=new_order, order__lt=existing_relation.order).update(order=F('order')+1)
                        else:
                            relations_set.filter(order__gt=existing_relation.order, order__lte=new_order).update(order=F('order')-1)
                        existing_relation.order = new_order
                        existing_relation.save()
                return response.Response(status=status.HTTP_204_NO_CONTENT)
            else:
                raise exceptions.NotAcceptable('Request is a no-op.')
        else:
            raise NotImplementedError()
    except db.Error as e:
        raise exceptions.APIException(e)


def data_everything():
    # using Django REST Framework serializers directly is slow
    # hunt_config = HuntConfigSerializer(models.HuntConfig.get()).data
    def cast(objs):
        return [{
            key: value.isoformat() if isinstance(value, datetime.datetime) else value
            for key, value in obj.items()
        } for obj in objs]
    hunt_config = models.HuntConfig.get()
    hunt_config = {key: getattr(hunt_config, key) for key in HuntConfigSerializer().fields.keys()}
    users = cast(User.objects.values(*(key for key in UserSerializer().fields.keys() if key != 'socialaccounts')))
    socialaccounts = cast(SocialAccount.objects.values('user_id', *SocialAccountSerializer().fields.keys()))
    user_by_id = {user['id']: user for user in users}
    for socialaccount in socialaccounts:
        user_by_id[socialaccount['user_id']].setdefault('socialaccount', []).append(
            {key: socialaccount[key] for key in SocialAccountSerializer().fields.keys()})
    # NB: important to fetch relations before objects
    round_puzzles = cast(models.RoundPuzzle.objects.values('round_id', 'puzzle_id'))
    meta_feeders = cast(models.MetaFeeder.objects.values('meta_id', 'feeder_id'))
    rounds = cast(models.Round.objects.values(*BaseRoundSerializer().fields.keys()))
    puzzles = cast(models.Puzzle.objects.values(*BasePuzzleSerializer().fields.keys()))
    round_by_slug = {}
    puzzle_by_slug = {}
    for _round in rounds:
        round_by_slug[_round['slug']] = _round
        _round.setdefault('puzzles', [])
    for puzzle in puzzles:
        puzzle_by_slug[puzzle['slug']] = puzzle
        puzzle.setdefault('rounds', [])
        puzzle.setdefault('metas', [])
        puzzle.setdefault('feeders', [])
    for round_puzzle in round_puzzles:
        puzzle = puzzle_by_slug.get(round_puzzle['puzzle_id'])
        _round = round_by_slug.get(round_puzzle['round_id'])
        if puzzle is not None:
            puzzle['rounds'].append(round_puzzle['round_id'])
        if _round is not None:
            _round['puzzles'].append(round_puzzle['puzzle_id'])
    for meta_feeder in meta_feeders:
        feeder = puzzle_by_slug.get(meta_feeder['feeder_id'])
        meta = puzzle_by_slug.get(meta_feeder['meta_id'])
        if feeder is not None:
            feeder['metas'].append(meta_feeder['meta_id'])
        if meta is not None:
            meta['feeders'].append(meta_feeder['feeder_id'])
    data = {
        'hunt': hunt_config,
        'users': {user['id']: user for user in users},
        'rounds': {_round['slug']: _round for _round in rounds},
        'round_order': [_round['slug'] for _round in rounds],
        'puzzles': {puzzle['slug']: puzzle for puzzle in puzzles},
        'extension_version': settings.EXTENSION_VERSION,
    }
    if settings.SECRETS['LOGIN']['username'] and settings.SECRETS['LOGIN']['password']:
        data['login'] = settings.SECRETS['LOGIN']
    return data

@decorators.api_view()
def everything(request):
    data = data_everything()
    return response.Response(data)

@login_required
def data_everything_with_uid(request):
    data = data_everything()
    data['uid'] = request.user.id
    return data

@login_required
def google_sheets_owner_data(request):
    owner = models.GoogleSheetOwner.get()
    if owner is not None:
        owner = {
            'name': owner.name,
            'email': owner.email,
            'expires_at': datetime.datetime.utcfromtimestamp(owner.expires_at).isoformat(),
        }
    return {
        'owner': owner,
        'csrfmiddlewaretoken': csrf.get_token(request),
    }

@decorators.api_view(['POST'])
@login_required
def discord_voice_move(request):
    socialaccount = SocialAccount.objects.filter(provider='discord', user_id=request.user.id).first()
    if socialaccount is None:
        raise exceptions.NotAcceptable()
    uid = socialaccount.uid
    channel_id = request.data.get('channel_id')
    try:
        channel_id = int(channel_id)
    except:
        raise exceptions.ValidationError()
    try:
        DiscordManager.sync_threadsafe_move_member(uid, channel_id)
    except discord.HTTPException:
        raise exceptions.NotAcceptable()
    else:
        return response.Response(status=status.HTTP_204_NO_CONTENT)
