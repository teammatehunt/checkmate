from django.conf import settings
from django.http import JsonResponse, HttpResponse
from django.shortcuts import redirect, render
from django.template import TemplateDoesNotExist
from django.views.decorators.http import require_GET, require_POST
from django.views.static import serve

def render_app(request, page, props=None, **kwargs):
    template_name = 'app.html'
    context = kwargs.get('context', {})
    context['page'] = page
    if props is not None:
        context['props'] = props
    kwargs['context'] = context
    return render(request, template_name, **kwargs)

def home(request):
    page = 'index'
    props = {
        'page': 'home',
    }
    return render_app(request, page, props)
