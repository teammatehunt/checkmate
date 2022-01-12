To start a server or to develop, you will need docker and docker-compose. On Ubuntu, you can install with `sudo apt install docker.io docker-compose`.

After everything is set up, use the following to build the components and start the server.

You will need credentials in Discord and in Drive.

Drive:
1. Create or select a project [here](https://console.developers.google.com/).
1. [Enable the Drive API Instructions.](https://developers.google.com/drive/api/v3/enable-drive-api)
1. Do the same for the Sheets API.
1. [Create a service account.](https://console.cloud.google.com/iam-admin/serviceaccounts)
1. Create a key and download the json to `credentials`. Rename or add the filename to `SECRETS.yaml`.

Ensure the database is setup (choose a better password):
```sh
docker-compose build
mkdir frontend/node_modules
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
#docker-compose exec app /app/backend/manage.py makemigrations accounts checkmate structure
docker-compose exec app /app/backend/manage.py migrate
docker-compose exec app /app/backend/manage.py shell -c "from django.contrib.auth.models import User; User.objects.create_superuser('admin', password='admin')"
# or `docker-compose exec app /app/backend/manage.py createsuperuser --username admin --email ''` to prompt for password
docker-compose down
```

To run in `dev` mode, run the following:
```sh
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```
Note that the checkmate-extension zip file is not created in dev mode but it exists (unzipped) in the repository. The `build_extension` script for Firefox requires credentials for a Firefox developer account.

To run in `prod` mode, run the following (replace `docker-compose.prod.yml` with `docker-compose.prod.localhost.yml` if running locally):
```sh
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker-compose exec app /app/build_static
# remove --sign if the current version of the firefox extension already exists
docker-compose exec app /app/build_extension --sign
docker-compose restart app
```

To test autocreating puzzles, use this command:
```sh
docker-compose exec -w /app/backend app celery -A checkmate call services.tasks.auto_create_new_puzzles
```
This will be a `dry_run` by default and will print a task id. To check the result, use:
```sh
docker-compose exec -w /app/backend app celery -A checkmate result [TASK_ID]
```
or if there was an error:
```sh
docker-compose exec -w /app/backend app celery -A checkmate result --traceback [TASK_ID]
```

To migrate a postgres database between servers:
```sh
# on old server
docker-compose exec -u postgres postgres pg_dump postgres > dumpfile.dump
# on new server
docker-compose exec -T -u postgres postgres psql -U postgres < dumpfile.dump
```
