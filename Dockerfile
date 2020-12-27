FROM ubuntu:20.04

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
      yarn

ENV PYTHONUNBUFFERED 1

COPY backend/requirements.txt .

RUN pip3 install --upgrade pip
RUN pip3 install -r requirements.txt

RUN mkdir /run/daphne
COPY supervisord.conf /etc/supervisor/conf.d/checkmate.conf

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/checkmate.conf"]
