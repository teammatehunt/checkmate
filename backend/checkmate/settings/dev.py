from .base import *

DEBUG = True
STATICFILES_DIRS.append(os.path.join(FRONTEND_DIR, 'build', 'dev', 'static'))
STATIC_ROOT = os.path.join(BASE_DIR, 'build', 'dev', 'static')
