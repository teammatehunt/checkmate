from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponse
from django.shortcuts import redirect, render
from django.template import TemplateDoesNotExist
from django.views.decorators.http import require_GET, require_POST
from django.views.static import serve

from rest_framework import renderers

from . import api

@login_required
def render_app(request, page, props=None, **kwargs):
    template_name = 'app.html'
    context = kwargs.get('context', {})
    context['page'] = page
    if props is not None:
        context['props'] = props
    kwargs['context'] = context
    return render(request, template_name, **kwargs)

def master(request):
    page = 'main'
    data = api.everything(request).data
    props = {
        'page': 'master',
        'data': data,
    }
    return render_app(request, page, props)

def puzzle(request, slug):
    data = api.everything(request).data
    if slug not in data['puzzles']:
        return redirect('/')
    page = 'main'
    props = {
        'page': 'puzzle',
        'slug': slug,
        'data': data,
    }
    return render_app(request, page, props)
