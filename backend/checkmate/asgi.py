"""
ASGI config for checkmate project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/3.1/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

build = os.environ.get('DJANGO_SERVER', 'dev')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', f'checkmate.settings.{build}')

application = get_asgi_application()
