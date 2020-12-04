from django.shortcuts import redirect
from django.urls import include, path
from rest_framework import routers as rest_routers

from . import api
from . import views

class OptionalSlashRouter(rest_routers.DefaultRouter):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.trailing_slash = '/?'

rest_router = OptionalSlashRouter()
rest_router.register('hunt_config', api.HuntConfigViewSet)
rest_router.register('users', api.UserViewSet)
rest_router.register('rounds', api.RoundViewSet)
rest_router.register('puzzles', api.PuzzleViewSet)

urlpatterns = [
    path('accounts/', include('rest_framework.urls', namespace='rest_framework')),
    path('api/', include(rest_router.urls)),
    path('api/everything', api.everything),
    path('', views.master),
    path('puzzles/', lambda req: redirect('/')),
    path('puzzles/<slug:slug>', views.puzzle),
]
