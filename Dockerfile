# base contains system packages
FROM ubuntu:20.04 as base

RUN apt-get update -qq && apt-get install --no-install-recommends -y ca-certificates curl gnupg2
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

RUN apt-get update -qq && apt-get install --no-install-recommends -y \
      gcc \
      libpq-dev \
      nodejs \
      python-is-python3 \
      python3-dev \
      python3-pip \
      supervisor \
      yarn \
      zip

# node_modules generates node_modules
FROM base as node_modules
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --non-interactive --frozen-lockfile

# generate python environment and then copy node_modules and configs over
FROM base
COPY backend/requirements.txt ./
RUN pip3 install --upgrade pip && pip3 install -r requirements.txt

COPY --from=node_modules /node_modules /node_modules

ENV PYTHONUNBUFFERED 1
ENV PYTHONDONTWRITEBYTECODE 1
# yarn --modules-folder has a bug for .bin so add to the path manually
ENV PATH="${PATH}:/node_modules/.bin"
RUN mkdir /run/daphne /run/celery
COPY supervisord.conf /etc/supervisor/conf.d/checkmate.conf

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/checkmate.conf"]
