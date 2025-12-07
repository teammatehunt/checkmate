# base contains system packages
FROM node:25.2-trixie-slim AS base

RUN apt-get update -qq && apt-get install --no-install-recommends -y \
      espeak \
      ffmpeg \
      gcc \
      g++ \
      libpq-dev \
      opus-tools \
      python-is-python3 \
      python3-dev \
      python3-pip \
      supervisor \
      zip \
      && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED 1
ENV PYTHONDONTWRITEBYTECODE 1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_BREAK_SYSTEM_PACKAGES=1
ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8

RUN pip3 install pipenv

# node_modules generates node_modules
FROM base AS node_modules
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --non-interactive --frozen-lockfile

# generate python environment and then copy node_modules and configs over
FROM base AS python_env
COPY backend/Pipfile ./
COPY backend/Pipfile.lock ./
RUN PIPENV_VENV_IN_PROJECT=1 pipenv install --deploy

FROM base AS runtime
COPY --from=node_modules /node_modules /node_modules
COPY --from=python_env /.venv /.venv

# activate venv
ENV PATH="/.venv/bin:${PATH}"
# yarn --modules-folder has a bug for .bin so add to the path manually
ENV PATH="${PATH}:/node_modules/.bin"

RUN mkdir /run/daphne /run/celery
COPY supervisord.conf /etc/supervisor/conf.d/checkmate.conf

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/checkmate.conf"]
