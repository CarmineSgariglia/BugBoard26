# Guida alla Messa in Produzione

Questa guida spiega come configurare e avviare lo stack in modalità produzione.

## 1. Preparazione delle Variabili d'Ambiente

Crea un file `.env` per la produzione partendo dal template `env/production.example`.

```bash
cp env/production.example .env
```

Modifica il file `.env` con i tuoi parametri di produzione:

| Variabile | Descrizione / Azione |
| :--- | :--- |
| `POSTGRES_PASSWORD` | Imposta una password robusta per il database. |
| `DJANGO_SECRET_KEY` | Genera una chiave segreta lunga e casuale. |
| `ALLOWED_HOSTS` | Aggiungi il tuo dominio (es. `tuo-dominio.com`). |
| `CORS_ALLOWED_ORIGINS` | Inserisci l'URL del tuo dominio (es. `https://tuo-dominio.com`). |
| `CSRF_TRUSTED_ORIGINS` | Inserisci l'URL del tuo dominio (es. `https://tuo-dominio.com`). |

Assicurati che `DEBUG=False` per disabilitare la modalità di debug in Django.

---

## 2. Certificati SSL (Nginx)

Nginx è configurato per ascoltare sulla porta 443 con SSL (`nginx/default.conf/production.conf`).

Di default, la configurazione cerca questi certificati:
- `/etc/nginx/certs/localhost.pem`
- `/etc/nginx/certs/localhost-key.pem`

### Come procedere:
1. **Certificati Propri**: Copia i tuoi certificati `.pem` e `.key` nella cartella `./nginx/certs`.
2. **Aggiorna Nginx**: Modifica `nginx/default.conf/production.conf` se i nomi dei file differiscono:
   ```nginx
   ssl_certificate /etc/nginx/certs/tuo-certificato.pem;
   ssl_certificate_key /etc/nginx/certs/tua-chiave-privata.pem;
   ```

---

## 3. Avvio dello Stack

Usa il `Makefile` per avviare i container in background (`-d`).

### Opzione A: Standalone (Standard)
Per un'installazione singola non scalabile orizzontalmente:
```bash
make prod-up
```
*(Equivale a `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`)*

Questa modalità usa il realtime in memoria del processo backend ed è quindi compatibile con il contratto di deploy supportato: singola istanza backend e `GUNICORN_WORKERS=1`.

---

## 4. Verifica e Log

Una volta avviato, Nginx si occuperà di:
1. Servire i file statici del Frontend (compilati durante la build).
2. Proxy delle chiamate `/api/` e `/media/` al Backend (Django).

Controlla che tutto sia in ordine:
```bash
docker compose logs -f web
docker compose logs -f backend
```
