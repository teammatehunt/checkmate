"""
ASGI config for checkmate project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/3.1/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack
from channels.routing import ChannelNameRouter, ProtocolTypeRouter, URLRouter

import structure.routing
import structure.consumers

build = os.environ.get('BUILD_MODE', 'dev')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', f'checkmate.settings.{build}')

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AuthMiddlewareStack(
        URLRouter(
            structure.routing.websocket_urlpatterns,
        )
    ),
    'channel': ChannelNameRouter({
        structure.consumers.MASTER_CHANNEL_NAME: structure.consumers.BroadcastMasterConsumer.as_asgi(),
    }),
})
