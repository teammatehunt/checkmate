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
```
docker-compose build
mkdir frontend/node_modules
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
#docker-compose exec app /app/backend/manage.py makemigrations accounts checkmate structure
docker-compose exec app /app/backend/manage.py migrate
docker-compose exec app /app/backend/manage.py shell -c "from django.contrib.auth.models import User; User.objects.create_superuser('admin', password='admin')"
docker-compose down
```

To run in `dev` mode, run the following:
```
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```
Note that the checkmate-extension zip file is not created in dev mode but it exists (unzipped) in the repository. The `build_extension` script requires a Firefox account with credentials.

To run in `prod` mode, run the following (replace `docker-compose.prod.yml` with `docker-compose.prod.localhost.yml` if running locally):
```
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker-compose exec app /app/build_static
docker-compose exec app /app/build_extension
docker-compose restart app
```

To test autocreating puzzles, use this command:
```
docker-compose exec -w /app/backend app celery -A checkmate call services.tasks.auto_create_new_puzzles
```
This will be a `dry_run` by default and will print a task id. To check the result, use:
```
docker-compose exec -w /app/backend app celery -A checkmate task [TASK_ID]
```
or if there was an error:
```
docker-compose exec -w /app/backend app celery -A checkmate task --traceback [TASK_ID]
```
