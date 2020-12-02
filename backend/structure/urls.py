from django.urls import include, path
from rest_framework import routers as rest_routers
from . import api
from . import views

rest_router = rest_routers.DefaultRouter()
rest_router.register('users', api.UserViewSet)
rest_router.register('rounds', api.RoundViewSet)
rest_router.register('puzzles', api.PuzzleViewSet)

urlpatterns = [
    path('', views.home),
    path('api/', include(rest_router.urls)),
    path('accounts/', include('rest_framework.urls', namespace='rest_framework')),
]
