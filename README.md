After everything is set up, use the following to build the components and start the server.

Ensure the database is setup:
```
cd backend
docker run -d --name checkmate-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -c 'CREATE DATABASE checkmate_postgres'
./manage.py shell -c "from django.contrib.auth.models import User; User.objects.create_superuser('admin', password='admin')"
. ./.venv/bin/activate
./manage.py makemigrations checkmate
./manage.py migrate
```

To run in `dev` mode, run the following in separate terminals:
- `cd frontend && yarn start`
- `cd backend && . ./.venv/bin/activate && ./manage.py runserver`

To run in `prod` mode, run the following:
```
set -e
pushd
cd frontend
rm -rf build || true
yarn build
popd
pushd
cd backend
rm -rf build || true
. ./.venv/bin/activate
./manage.py collectstatic
DJANGO_SERVER=prod ./manage.py runserver
popd
```
