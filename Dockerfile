FROM python:3.8.5-alpine

RUN apk update && apk add --no-cache \
      gcc \
      libffi-dev \
      libpq \
      musl-dev \
      openssl-dev \
      postgresql-dev \
      python3-dev \
      supervisor

ENV PYTHONUNBUFFERED 1

COPY backend/requirements.txt .

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

RUN mkdir /run/daphne
COPY supervisord.conf /etc/supervisor/conf.d/checkmate.conf

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/checkmate.conf"]
