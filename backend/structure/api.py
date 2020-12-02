from django.conf import settings
from django.http import JsonResponse, HttpResponse
from django.shortcuts import redirect, render
from django.template import TemplateDoesNotExist
from django.views.decorators.http import require_GET, require_POST
from django.views.static import serve


