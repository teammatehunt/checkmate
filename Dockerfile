# base contains system packages
FROM ubuntu:20.04 AS base

RUN apt-get update -qq && apt-get install --no-install-recommends -y ca-certificates curl gnupg2
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

RUN apt-get update -qq && apt-get install --no-install-recommends -y \
      espeak \
      ffmpeg \
      gcc \
      libpq-dev \
      nodejs \
      opus-tools \
      python-is-python3 \
      python3-dev \
      python3-pip \
      supervisor \
      yarn \
      zip

# node_modules generates node_modules
FROM base AS node_modules
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --non-interactive --frozen-lockfile

# generate python environment and then copy node_modules and configs over
FROM base AS python_env
ENV PIP_NO_CACHE_DIR=1
ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8

COPY backend/Pipfile ./
COPY backend/Pipfile.lock ./
RUN pip3 install --upgrade pip && pip3 install pipenv
RUN PIPENV_VENV_IN_PROJECT=1 pipenv install --deploy

FROM base AS runtime
COPY --from=node_modules /node_modules /node_modules
COPY --from=python_env /.venv /.venv

ENV PYTHONUNBUFFERED 1
ENV PYTHONDONTWRITEBYTECODE 1

# activate venv
ENV PATH="/.venv/bin:${PATH}"
# yarn --modules-folder has a bug for .bin so add to the path manually
ENV PATH="${PATH}:/node_modules/.bin"

RUN mkdir /run/daphne /run/celery
COPY supervisord.conf /etc/supervisor/conf.d/checkmate.conf

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/checkmate.conf"]
