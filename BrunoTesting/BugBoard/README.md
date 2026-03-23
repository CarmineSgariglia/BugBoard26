# BugBoard API Test Suite (Bruno)

Questa cartella contiene una suite Bruno rifattorizzata e organizzata per route API.

## Struttura

- `00_Setup`: bootstrap globale (health, csrf, login)
- `API/01_Auth`: `/auth/*`
- `API/02_Users`: `/users/*`
- `API/03_Projects`: `/projects/*` e `/projects/{projectId}/issues`
- `API/04_Issues`: `/issues/*`
- `API/05_Notifications`: `/notifications/*`
- `API/07_Tags`: `/tags/*`
- `API/08_Attachments`: `/attachments/*` e upload collegati

Ogni area include test `auth`, `no_auth`, `not_found` e casi di validazione/permesso.

Nota Fase 1 REST cleanup:

- l'attivazione utente usa `PATCH /users/{userId}` con body `{ "active": boolean }`
- l'update issue canonico usa solo `PATCH /issues/{issueId}`
- `DELETE /issues/{issueId}` non richiede body
- l'upload profilo self-service usa solo `POST /users/me/upload-profile-image`

## Environment

Disponibili:

- `environments/local_admin.yml`
- `environments/local_dev.yml`

Variabili chiave usate dalla suite:

- `baseURL`
- `access_token`
- `current_user_id`
- `project_id`, `issue_id`, `notify_user_id`, `target_user_id`
- `tag_id`, `attachment_id`
- `target_user_id`, `invalid_id`, `invalid_token`

I valori ID vengono aggiornati automaticamente dalle request `00_Setup` presenti nelle singole aree.

## Esecuzione consigliata

Ordine locale:

1. `00_Setup/Health`
2. `00_Setup/GetCSRF`
3. `00_Setup/Login`
4. `API` (intera cartella)

Esegui due run separati:

1. `local_admin`
2. `local_dev`

### Bruno CLI locale

Per il runner CLI, usa preferibilmente `--env-file` JSON esplicito invece di affidarti agli environment YAML della UI.

Esempio minimale:

```bash
mkdir -p ../.tmp/bruno

cat > ../.tmp/bruno/local_dev_ci.json <<'EOF'
{
  "name": "local_dev_ci",
  "variables": [
    { "name": "baseURL", "value": "http://127.0.0.1:8000/api", "enabled": true },
    { "name": "email", "value": "dev@test.it", "enabled": true },
    { "name": "password", "value": "StrongPass123!", "enabled": true },
    { "name": "invalid_id", "value": "999999", "enabled": true },
    { "name": "invalid_token", "value": "abc.def.ghi", "enabled": true },
    { "name": "access_token", "value": "", "enabled": true }
  ]
}
EOF

cd BrunoTesting/BugBoard
bru run 00_Setup/GetCSRF.yml 00_Setup/Login.yml --env-file ../.tmp/bruno/local_dev_ci.json
```

Nota: in questo repository il login CLI e la suite safe sono stati verificati con `--env-file`; l’uso diretto di `--env local_dev` dipende dal runtime Bruno locale e non va considerato la modalità di riferimento per CI.

## CI/CD (GitHub Actions)

Workflow consigliato:

- suite `safe`: `00_Setup`, `01_Auth/Me`, `02_Users/00_Setup`, `03_Projects/00_Setup`, `03_Projects/ProjectIssues/Issues_list_auth`, `04_Issues/00_Setup`, `05_Notifications/00_Setup`, `05_Notifications/List`
- suite `full`: superset della `safe` con test di validazione, read, create, update e delete; da eseguire solo manualmente

Best practice per pipeline:

- avvia backend + db in job prima dei test
- se Bruno gira in container, usa l'hostname Docker `backend` invece di `127.0.0.1` per `baseURL`
- esegui bootstrap dati iniziale per utenti/progetti/issue/notifiche
- usa `--env-file` JSON generato nel job CI
- esegui Bruno in un container dedicato Node 24 sulla stessa rete Docker dei servizi applicativi
- mantieni la suite `safe` su `push` e `pull_request`, e la suite `full` solo su `workflow_dispatch`
- pubblica report JUnit o HTML come artifact
- fallisci il job su qualunque request fallita
- non accettare `404` nei test nominali

## Nota didattica

I test sono stati mantenuti semplici e leggibili, con assert essenziali ma robusti su:

- status code
- forma minima payload
- permessi per ruolo (admin vs developer)
- error handling (missing auth, invalid input, not found)
- setup deterministici senza fallback permissivi agli ID invalidi
