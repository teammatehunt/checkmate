from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponse
from django.shortcuts import redirect, render
from django.template import TemplateDoesNotExist
from django.views.decorators.http import require_GET, require_POST
from django.views.static import serve

from rest_framework import renderers

from . import api

def render_app(request, page, props=None, **kwargs):
    template_name = 'app.html'
    context = kwargs.get('context', {})
    context['page'] = page
    if props is not None:
        context['props'] = props
    kwargs['context'] = context
    return render(request, template_name, **kwargs)

@login_required
def master(request):
    page = 'main'
    data = api.data_everything_with_uid(request)
    props = {
        'page': 'master',
        'data': data,
    }
    return render_app(request, page, props)

@login_required
def puzzle(request, slug):
    data = api.data_everything_with_uid(request)
    if slug not in data['puzzles']:
        return redirect('/')
    page = 'main'
    props = {
        'page': 'puzzle',
        'slug': slug,
        'data': data,
    }
    return render_app(request, page, props)

@login_required
def getting_started(request):
    page = 'gettingstarted'
    return render_app(request, page)

@login_required
def extension(request):
    page = 'extension'
    props = {
        'extension_version': settings.EXTENSION_VERSION,
    }
    return render_app(request, page, props)
