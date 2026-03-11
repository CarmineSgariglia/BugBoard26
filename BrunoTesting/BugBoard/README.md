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

## CI/CD (GitHub Actions)

Workflow consigliato:

- suite `safe`: `00_Setup`, `01_Auth/Me`, `02_Users/00_Setup`, `03_Projects/00_Setup`, `03_Projects/ProjectIssues/Issues_list_auth`, `04_Issues/00_Setup`, `05_Notifications/00_Setup`, `05_Notifications/List`
- suite `mutating`: create/update/delete/read/status/assign/unassign, da eseguire separatamente o manualmente

Best practice per pipeline:

- avvia backend + db in job prima dei test
- esegui bootstrap dati iniziale per utenti/progetti/issue/notifiche
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
