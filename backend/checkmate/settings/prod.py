from .base import *

DEBUG = False
STATICFILES_DIRS.append(os.path.join(FRONTEND_DIR, 'build', 'prod', 'static'))
STATIC_ROOT = os.path.join(BASE_DIR, 'build', 'prod', 'static')
