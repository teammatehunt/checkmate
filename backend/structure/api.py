import datetime

from django.db import transaction
from django.db.models import F
from django.http import JsonResponse
from django.contrib.auth.models import User
from rest_framework import decorators, exceptions, permissions, response, serializers, viewsets
from allauth.socialaccount.models import SocialAccount

from . import models

def get_all_data(request):
    rounds = models.Round.objects.all()
    puzzles = models.Puzzle.objects.all()

class GetExtraFields:
    def get_field_names(self, *args, **kwargs):
        direct_fields = super().get_field_names(*args, **kwargs)
        expanded_fields = (*direct_fields, *getattr(self.Meta, 'extra_fields', ()))
        mapping = getattr(self.Meta, 'field_names_map', {})
        mapped_fields = tuple(mapping.get(field, field) for field in expanded_fields)
        return mapped_fields

class SocialAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialAccount
        fields = ('provider', 'uid', 'extra_data')
class UserSerializer(serializers.ModelSerializer):
    socialaccounts = SocialAccountSerializer(source='socialaccount_set', many=True, read_only=True)
    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name', 'socialaccounts')
class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class HuntConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.HuntConfig
        fields = '__all__'
class HuntConfigViewSet(viewsets.ModelViewSet):
    queryset = models.HuntConfig.objects.all()
    serializer_class = HuntConfigSerializer

class RoundSerializer(GetExtraFields, serializers.ModelSerializer):
    puzzles = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    class Meta:
        model = models.Round
        fields = '__all__'
class RoundViewSet(viewsets.ModelViewSet):
    queryset = models.Round.objects.all()
    serializer_class = RoundSerializer

    @decorators.action(methods=['GET', 'POST'], detail=True)
    def puzzles(self, request, pk=None):
        if request.method == 'POST':
            return process_relation(models.RoundPuzzle, pk, request)
        else: # GET
            try:
                puzzles = [relation.puzzle for relation in models.Round.objects.get(pk=pk).puzzle_relations.prefetch_related('puzzle')]
            except models.Round.DoesNotExist:
                raise exceptions.NotFound()
            return response.Response(PuzzleSerializer(puzzles, many=True).data)

class PuzzleSerializer(GetExtraFields, serializers.ModelSerializer):
    rounds = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    metas = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    feeders = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    class Meta:
        model = models.Puzzle
        fields = '__all__'
        extra_fields = ('rounds', 'metas')
class PuzzleViewSet(viewsets.ModelViewSet):
    queryset = models.Puzzle.objects.all()
    serializer_class = PuzzleSerializer

    @decorators.action(methods=['GET', 'POST'], detail=True)
    def feeders(self, request, pk=None):
        if request.method == 'POST':
            return process_relation(models.MetaFeeder, pk, request)
        else: # GET
            try:
                feeders = [relation.feeder for relation in models.Puzzle.objects.get(pk=pk).feeder_relations.prefetch_related('feeder')]
            except models.Puzzle.DoesNotExist:
                raise exceptions.NotFound()
            return response.Response(PuzzleSerializer(feeders, many=True).data)

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
        for slug in slugs:
            if slug not in existing_slugs:
                cls(**{f'{cls.CONTAINER}_id': pk, f'{cls.ITEM}_id': slug}).save()
        return response.Response()
    elif action == 'remove':
        slugs = set(slugs)
        existing_relations = list(existing_relations_query)
        for existing_relation in existing_relations:
            if getattr(existing_relation, f'{cls.ITEM}_id') in slugs:
                existing_relation.delete()
        return response.Response()
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
        return response.Response()
    elif action == 'move':
        slug = next(iter(slugs))
        try:
            valid_relation = cls.objects.get(**{f'{cls.CONTAINER}_id': pk, f'{cls.ITEM}_id': slug})
        except cls.DoesNotExist:
            raise NotFound()
        if order != valid_relation.order:
            with transaction.atomic():
                if order < valid_relation.order:
                    cls.objects.filter(order__gte=order, order__lt=valid_relation.order).update(order=F('order')+1)
                else:
                    cls.objects.filter(order__gt=valid_relation.order, order__lte=order).update(order=F('order')-1)
                valid_relation.order = order
                valid_relation.save()
        return response.Response()
    else:
        raise NotImplementedError()
