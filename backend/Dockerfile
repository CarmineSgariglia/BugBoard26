FROM python:3.12-slim

ARG DEBIAN_FRONTEND=noninteractive

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_ROOT_USER_ACTION=ignore

WORKDIR /app

# Installazione dipendenze di sistema
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Creazione utente e gruppo di sistema
RUN groupadd --system app && useradd --system --gid app --home /app --shell /usr/sbin/nologin app

# Installazione requisiti Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- MODIFICA CRITICA QUI ---
# Creiamo le cartelle per gli statici e i media PRIMA di copiare il codice
# e assegniamo i permessi all'utente 'app'
RUN mkdir -p /app/staticfiles /app/media \
    && chown -R app:app /app/staticfiles /app/media

# Copia del codice sorgente
COPY . .

# Assicuriamo che tutto il contenuto di /app appartenga all'utente 'app'
RUN chown -R app:app /app

# Passaggio all'utente non-root
USER app

EXPOSE 8000

# Il comando CMD rimane lo stesso, ma ora ha i permessi per scrivere in /app/staticfiles
CMD ["sh", "-c", "python manage.py relabel_bugboardapi && python manage.py migrate && if [ \"${DEBUG}\" = \"True\" ]; then python manage.py runserver 0.0.0.0:8000; else gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-1} --threads ${GUNICORN_THREADS:-8} --timeout ${GUNICORN_TIMEOUT:-0} --keep-alive ${GUNICORN_KEEPALIVE:-75}; fi"]
