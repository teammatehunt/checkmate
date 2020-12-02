from django.contrib.auth.models import User
from rest_framework import permissions, serializers, viewsets
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

class RoundSerializer(GetExtraFields, serializers.ModelSerializer):
    puzzles = serializers.PrimaryKeyRelatedField(source='round_puzzles', many=True, read_only=True)
    class Meta:
        model = models.Round
        fields = '__all__'
        field_names_map = {
            'round_puzzles': 'puzzles',
        }
class RoundViewSet(viewsets.ModelViewSet):
    queryset = models.Round.objects.all()
    serializer_class = RoundSerializer

class PuzzleSerializer(GetExtraFields, serializers.ModelSerializer):
    rounds = serializers.PrimaryKeyRelatedField(source='round_set', many=True, read_only=True)
    metas = serializers.SlugRelatedField(source='meta_set', slug_field='meta_id', many=True, read_only=True)
    feeders = serializers.SlugRelatedField(source='feeder_set', slug_field='feeder_id', many=True, read_only=True)
    class Meta:
        model = models.Puzzle
        fields = '__all__'
        extra_fields = ('rounds', 'metas')
        field_names_map = {
            'meta_feeders': 'feeders',
        }
class PuzzleViewSet(viewsets.ModelViewSet):
    queryset = models.Puzzle.objects.all()
    serializer_class = PuzzleSerializer
