# Analisi euristica dei feedback di usabilità di BugBoard

## Introduzione

Il presente documento sintetizza i risultati di un test guidato di usabilità condotto su BugBoard, con l'obiettivo di valutare la comprensibilità dell'interfaccia e la facilità di esecuzione di alcune attività fondamentali. L'analisi si basa sia sulle osservazioni raccolte durante l'esecuzione dei task, sia sulle risposte fornite dai partecipanti nel questionario finale.

Per correttezza metodologica, questo elaborato non descrive una heuristic evaluation in senso stretto, cioè una valutazione svolta da esperti secondo una checklist formale. Si tratta invece di una lettura euristica dei feedback emersi da utenti reali: i dati raccolti vengono interpretati alla luce di principi di usabilità, così da evidenziare le aree in cui l'interfaccia risulta chiara e quelle in cui richiede maggiore familiarità con il dominio.

È inoltre importante chiarire il contesto d'uso previsto del prodotto: BugBoard nasce come strumento rivolto a team interni e a utenti con un minimo di dimestichezza con processi tecnici, issue e flussi collaborativi di progetto. Per questo motivo, i feedback raccolti da partecipanti meno vicini a tale contesto sono particolarmente utili per valutare la learnability iniziale, ma non devono essere letti come un segnale di inadeguatezza del sistema rispetto al suo pubblico di riferimento.

## Metodo di valutazione

Il campione analizzato è composto da 6 partecipanti, tutti in grado di completare il test in autonomia seguendo le istruzioni fornite in un documento dedicato. I profili possono essere distinti, in modo descrittivo e non statistico, in due gruppi:

- 3 partecipanti con profilo non tecnico o con esposizione limitata al dominio del bug tracking.
- 3 partecipanti con familiarità tecnica medio-alta o con studi e attività vicini all'ambito informatico.

La presenza di profili eterogenei ha permesso di osservare sia la tenuta dell'interfaccia rispetto al target più naturale del software, sia la sua comprensibilità da parte di utenti meno esperti. I risultati vanno quindi interpretati tenendo presente che non tutti i partecipanti coincidono con l'utenza principale per cui BugBoard è stato progettato.

Il test prevedeva 5 task sequenziali:

1. Aprire il progetto corretto.
2. Trovare una issue specifica.
3. Creare una nuova issue.
4. Assegnare la issue a un developer.
5. Aggiungere un commento con allegato.

Per ciascun task i partecipanti hanno indicato se erano riusciti a completarlo, quanto fosse stato facile, quanto si sentissero sicuri di aver svolto l'azione corretta e in quale punto avessero avuto dubbi. Al termine del test hanno inoltre espresso una valutazione globale dell'interfaccia, della chiarezza dei comandi e della loro predisposizione a riutilizzare BugBoard in futuro.

## Sintesi dei risultati

Nel complesso, i risultati mostrano un quadro positivo. Tutti e 6 i partecipanti hanno completato tutti i task previsti, senza che emergessero blocchi funzionali gravi. Questo è un primo indicatore importante di solidità del sistema, soprattutto considerando che parte del campione non apparteneva pienamente al target tecnico di riferimento.

Dal questionario finale risulta una valutazione media generale pari a circa **4,1/5**, valore che suggerisce una buona usabilità percepita. La dimensione più solida riguarda la chiarezza del flusso di creazione e modifica di una issue, che raggiunge circa **4,5/5**. Le dimensioni relativamente più deboli sono invece:

- la facilità nel trovare progetti, issue e azioni principali, con una media di circa **3,67/5**;
- la qualità dei feedback di sistema dopo azioni, salvataggi o errori, con una media di circa **3,83/5**.

Anche i singoli task sono stati giudicati generalmente accessibili. I valori medi di facilità percepita si collocano tra **4,17/5** e **4,83/5**, mentre la sicurezza percepita risulta più bassa soprattutto nei task iniziali, quelli più legati all'orientamento nell'interfaccia.

La differenza più significativa emerge confrontando i due gruppi di utenti:

- gli utenti meno tecnici esprimono un giudizio medio globale di circa **3,71/5** e una confidenza media nei task di circa **3,87/5**;
- gli utenti più tecnici raggiungono un giudizio medio globale di circa **4,5/5** e una confidenza media nei task di circa **4,8/5**.

Questa differenza supporta l'ipotesi interpretativa principale: le difficoltà emerse riguardano soprattutto l'ingresso nel contesto, la terminologia e la leggibilità delle azioni da parte di chi non ha familiarità con strumenti di issue tracking, più che la presenza di ostacoli operativi interni ai flussi. In questa prospettiva, il risultato è coerente con la natura del prodotto, pensato per team interni e utenti già vicini al dominio tecnico-organizzativo.

## Lettura interpretativa dei feedback

### Comprensione iniziale e onboarding

L'incertezza più ricorrente si concentra nella fase iniziale del test. Alcuni partecipanti dichiarano esplicitamente di non aver capito subito l'interfaccia o di aver avuto dubbi "all'inizio", mentre altri suggeriscono di semplificarla. Questo dato indica che il primo impatto con BugBoard richiede un certo adattamento, soprattutto per chi non possiede già un modello mentale vicino a quello di un sistema di gestione issue.

In altri termini, la difficoltà principale non appare legata all'impossibilità di portare a termine i task, ma al costo cognitivo necessario per comprendere da dove iniziare e quale percorso seguire nelle prime interazioni. Per un software rivolto a un contesto interno e specialistico, questo aspetto rappresenta più un'opportunità di accompagnamento iniziale che una debolezza strutturale.

### Navigazione e reperibilità delle azioni

La ricerca del progetto corretto e della issue specifica non ha impedito il completamento dei task, ma ha ridotto in più casi la sicurezza percepita. I task iniziali mostrano infatti una confidenza media inferiore rispetto a quelli successivi, segnale che il problema non è l'assenza di funzionalità, bensì la loro immediata riconoscibilità da parte di utenti meno abituati a questo tipo di strumenti.

Un partecipante segnala dubbi "nelle task che dovevo svolgere", un altro osserva di non essere abituato a questo tipo di interfacce, mentre un altro ancora riferisce pochi dubbi nel capire cosa cliccare per trovare dove creare la issue. 

### Terminologia e modello mentale

Una parte rilevante delle difficoltà sembra derivare dal lessico e dal dominio applicativo. Termini come `issue`, `bug`, assegnazione, timeline e allegati risultano molto più naturali per chi ha già usato strumenti come Jira, Trello o GitHub Issues, mentre per utenti meno esperti il significato operativo di questi elementi deve essere ricostruito sul momento.

Dal punto di vista euristico, questo aspetto richiama il principio di corrispondenza tra sistema e mondo reale: l'interfaccia funziona meglio quando il vocabolario usato coincide con le aspettative dell'utente. Nel caso di BugBoard, il lessico è coerente con il dominio professionale di riferimento e quindi adeguato al target previsto, ma può risultare meno trasparente per utenti esterni o occasionali.

### Feedback di sistema e visibilità delle azioni

Un partecipante riferisce di aver inviato prima il messaggio e poi l'allegato, senza comprendere subito il flusso corretto. Un altro osserva che il controllo per aggiungere un allegato sotto la barra del commento non si nota facilmente. Un ulteriore feedback segnala che l'ordinamento di default su `oldest` rende poco evidente la issue appena creata, che finisce in basso nella lista.

### Elementi che hanno aiutato

Accanto alle criticità, emergono anche aspetti chiaramente efficaci. Un partecipante sottolinea che titoli e sottotitoli delle sezioni hanno aiutato molto l'orientamento; altri riferiscono di non avere avuto dubbi nei task centrali o finali. Questo suggerisce che, superata la fase iniziale di adattamento, la struttura generale dell'applicazione risulta coerente, guidante e ben allineata ai flussi operativi attesi.

Particolarmente positivi risultano i task di assegnazione e gestione della issue una volta entrati nel contesto corretto. Ciò indica che il nucleo operativo di BugBoard appare solido e che le principali opportunità di miglioramento riguardano la chiarezza percepita, non la funzionalità di base. In particolare, per utenti già vicini al target del prodotto, i flussi sembrano risultare naturali e ben comprensibili.

## Problemi principali emersi

Dai feedback raccolti emergono tre osservazioni principali:

1. L'attrito maggiore si concentra all'inizio dell'esperienza, non nella parte centrale del flusso.
2. Gli utenti meno tecnici faticano soprattutto per contesto, terminologia e orientamento iniziale, più che per veri errori funzionali.
3. La reperibilità di progetti, issue e azioni principali può essere resa più immediata.

## Conclusioni e raccomandazioni

Nel complesso, BugBoard risulta uno strumento usabile e coerente con il proprio contesto d’impiego: tutti i task sono stati completati con successo e la valutazione media generale è positiva. Le criticità emerse non segnalano limiti strutturali del sistema, ma alcuni margini di miglioramento legati soprattutto all’onboarding iniziale, alla chiarezza di alcuni feedback operativi e alla semplicità percepita dell’interfaccia.

L’analisi evidenzia inoltre che le principali difficoltà riguardano soprattutto utenti meno tecnici o poco familiari con il dominio del bug tracking, in linea con la natura specialistica di BugBoard, pensato per team interni e profili tecnici. Di conseguenza, gli interventi migliorativi dovrebbero puntare a rendere più immediato l’accesso iniziale e più esplicite alcune azioni, senza modificare l’identità del sistema.

In sintesi, BugBoard presenta una base funzionale solida, flussi centrali ben strutturati e una buona aderenza al pubblico di riferimento, con possibilità di affinamento utili a facilitarne ulteriormente l’uso iniziale.
