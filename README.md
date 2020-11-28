After everything is set up, use the following to build the components and start the server.

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
