"""
WSGI config for checkmate project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/3.1/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

build = os.environ.get('DJANGO_SERVER', 'dev')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', f'checkmate.settings.{build}')

application = get_wsgi_application()
