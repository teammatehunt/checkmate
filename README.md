After everything is set up, use the following to build the components and start the server.

You will need credentials in Discord and in Drive.
Drive:
1. Create or select a project [here](https://console.developers.google.com/).
1.
[Enable the Drive API Instructions.](https://developers.google.com/drive/api/v3/enable-drive-api)
1. Do the same for the Sheets API.
1. [Create a service account.](https://console.cloud.google.com/iam-admin/serviceaccounts)
1. Create a key and download the json to `credentials`. Rename or add the filename to `SECRETS.yaml`.

Ensure the database is setup:
```
docker-compose up -d
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -c 'CREATE DATABASE checkmate_postgres'
cd backend
. ./.venv/bin/activate
./manage.py makemigrations checkmate accounts puzzles
./manage.py migrate
./manage.py shell -c "from django.contrib.auth.models import User; User.objects.create_superuser('admin', password='admin')"
```

To run in `dev` mode, run the following in separate terminals:
- `cd frontend && yarn start`
- `cd backend && . ./.venv/bin/activate && celery -A checkmate worker --loglevel=INFO -n worker1@%h`
- `cd backend && . ./.venv/bin/activate && ./manage.py runserver`
- `cd backend && . ./.venv/bin/activate && ./manage.py runworker fan_root`

To run in `prod` mode, run the following:
```
set -e
cd frontend
rm -rf frontent/build || true
yarn build
pushd
cd backend
rm -rf build || true
. ./.venv/bin/activate
./manage.py collectstatic
popd
deactivate
docker-compose up -d
docker restart checkmate_app
```
