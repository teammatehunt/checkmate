#!/bin/bash
set -e
# build js files
yarn --cwd /app/frontend build
# purge existing static volume
rm -rf /build/backend/*
# collect static files
/app/backend/manage.py collectstatic
# zip extension
(cd /app && zip -r /build/backend/static/checkmate-extension.zip checkmate-extension)
