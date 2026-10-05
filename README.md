# Mille Birre

Statistiche e proiezioni per i gruppi WhatsApp che puntano a **mille birre bevute insieme**.

Il gioco funziona così: chi beve una birra manda la foto nel gruppo con in didascalia il numero successivo all'ultimo (`1`, `2`, `3`… fino a `1000`). Mille Birre legge l'export della chat e ti dice a che punto siete, che ritmo tenete, chi beve di più e quando arriverete al traguardo.

- **Dashboard nel browser**: carichi il `.txt` (o lo `.zip` di iOS) e vedi tutto. Il file non lascia il tuo computer.
- **Riga di comando**: riepilogo nel terminale, JSON, CSV o un report HTML da condividere col gruppo.
- **Zero dipendenze**: serve solo Node.js 18 o successivo.

## Cosa calcola

| | |
|---|---|
| **Avanzamento** | birre totali, quante ne mancano, percentuale sull'obiettivo |
| **Ritmo** | media giornaliera dall'inizio, negli ultimi 30 e negli ultimi 7 giorni, confronto con la settimana prima |
| **Proiezioni** | data stimata di arrivo per ognuno dei tre ritmi; birre al giorno necessarie per arrivare entro una data |
| **Andamento** | birre al giorno con media mobile a 7 giorni, birre a settimana (lunedì–domenica) |
| **Abitudini** | media per giorno della settimana, distribuzione per ora |
| **Classifica** | birre per persona, quota sul totale, giorni attivi |
| **Record** | giorno e settimana migliori, serie più lunga di giorni con almeno una birra, siccità più lunga |
| **Traguardi** | data e autore di ogni centinaio, stima per i prossimi |
| **Controllo** | elenco di ogni correzione fatta durante il conteggio, per verificarlo a mano |

## Iniziare

### 1. Esporta la chat

- **iPhone**: apri il gruppo → tocca il nome in alto → *Esporta chat* → *Senza media*. Ottieni uno `.zip` con dentro `_chat.txt`.
- **Android**: apri il gruppo → ⋮ → *Altro* → *Esporta chat* → *Senza media*. Ottieni un `.txt`.

Le foto non servono: nell'export restano come `<immagine omessa>` o `<Media omessi>`, ed è tutto quello che il contatore deve sapere.

### 2a. Dashboard

Apri la versione pubblicata su GitHub Pages, oppure generala in locale:

```sh
npm run build          # crea dist/index.html
open dist/index.html   # o doppio clic sul file
```

Trascina l'export sulla pagina oppure usa *Carica export*. La pagina si apre con una chat di esempio con persone inventate, così vedi subito come funziona.

### 2b. Riga di comando

```sh
git clone https://github.com/droidizzz/1000-Birre-Project.git
cd 1000-Birre-Project
node bin/mille-birre.js _chat.txt
```

Oppure, per averla come comando `mille-birre`:

```sh
npm install -g .
mille-birre _chat.txt
```

```
MILLE BIRRE
███████████████···································  295 / 1000  (29,5%)
Mancano 705 · dal 1 ago al 26 settembre 2026 (57 giorni) · giornata dalle 05:00

QUANDO ARRIVIAMO A 1000
  Dall'inizio          5,2 al giorno  →  10 febbraio 2027  tra 137 giorni
  Ultimi 30 giorni     5,3 al giorno  →  7 febbraio 2027  tra 134 giorni
  Ultimi 7 giorni      4,9 al giorno  →  19 febbraio 2027  tra 146 giorni
…
```

Opzioni principali:

| Opzione | Effetto |
|---|---|
| `--html report.html` | report HTML autonomo, con grafici, da aprire o mandare al gruppo (solo lettura: senza caricamento di chat, quello c'è solo nel sito e nel repo) |
| `--json [file]` | statistiche in JSON (senza file, sullo standard output) |
| `--csv birre.csv` | una riga per birra: numero, data, ora, autore, tipo |
| `-g, --goal 500` | obiettivo diverso da 1000 |
| `-d, --day-start 5` | ora in cui inizia la giornata (default 5: una birra all'1 di notte conta per la sera prima) |
| `-j, --max-jump 5` | salto massimo tra due numeri prima di considerarlo un refuso |
| `--no-photo` | conta anche i numeri scritti senza foto |
| `--strict` | scarta i messaggi con testo oltre al numero |
| `--date-order dmy\|mdy` | forza il formato della data se il riconoscimento automatico sbaglia |
| `-c, --config gruppo.json` | opzioni e nomi da file |
| `--no-mask` | mostra i numeri di telefono interi |

Le opzioni si combinano: `mille-birre _chat.txt -c gruppo.json --html report.html --csv birre.csv`.

## Nomi e numeri di telefono

Chi non è salvato in rubrica compare nell'export come numero di telefono. Per privacy, il contatore lo mostra abbreviato (`+39 ··· 0142`). Per usare i nomi veri crea un file di configurazione partendo da [`config.example.json`](config.example.json):

```json
{
  "goal": 1000,
  "aliases": {
    "Tu": "Admiring Turing",
    "+39 333 555 0142": "Elated Hopper",
    "3475550198": "Quirky Lovelace",
    "Sleepy Volta": "Drowsy Volta"
  }
}
```

- Le chiavi sono il nome **come appare nella chat**. `Tu` è chi ha esportato la chat.
- I numeri si possono scrivere in qualsiasi formato, con o senza prefisso internazionale.
- Due modi diversi di scrivere la stessa persona con lo stesso nome vengono uniti in classifica.

Nella dashboard i nomi si cambiano da *Classifica → Cambia i nomi visualizzati* e restano salvati solo nel browser.

> Il file di configurazione con i nomi dei tuoi amici è già escluso da git se lo chiami `config.json` o `*.local.json`.

## Come vengono contate le birre

Il numero scritto nella chat è la fonte di verità: il totale è l'ultimo numero valido. Il contatore scorre i messaggi in ordine e gestisce gli errori tipici di un gruppo vero:

| Caso | Esempio | Cosa succede |
|---|---|---|
| Numero successivo | `<immagine omessa> 57` | una birra |
| Foto e numero in due messaggi | foto, poi `57` dallo stesso autore entro 10 minuti | una birra |
| Più birre in un messaggio | `28, 29, 30` oppure `41-42` | una birra per numero |
| Stesso numero postato insieme | due `78` a pochi secondi, poi `80` | il secondo diventa la 79 |
| Refuso | `1230` al posto di `123`, poi `124` | il refuso diventa la 123 |
| Numero mancante | `56`, poi `58` senza nessun `57` | la 57 conta, senza autore |
| Chiacchiere | `stasera 2 birre e poi a casa` | ignorato (nessuna foto) |
| Messaggi eliminati e di sistema | `Questo messaggio è stato eliminato.` | ignorati |
| Export iniziato a metà | la chat parte dalla birra 348 | le 347 precedenti contano nel totale ma non nelle statistiche |

Ogni correzione compare nella sezione *Controllo lettura* della dashboard e in fondo al riepilogo da terminale, così il gruppo può verificarla.

Formati supportati: export iOS e Android, in italiano e in inglese, orologio a 12 o 24 ore, date giorno/mese o mese/giorno (riconosciute in automatico).

## Usarlo come libreria

```js
import { readFileSync } from 'node:fs';
import { analyzeChat } from 'mille-birre';

const { stats, counted } = analyzeChat(readFileSync('_chat.txt', 'utf8'), { goal: 1000 });
console.log(stats.total, stats.rates[0].rate, counted.anomalies);
```

Le funzioni pubbliche sono in [`src/index.js`](src/index.js): `parseChat`, `countBeers`, `computeStats`, `analyzeChat`, `requiredPace`, `createNameResolver`.

## Struttura del progetto

```
bin/mille-birre.js        riga di comando
src/core/                 parsing, conteggio, statistiche (Node e browser)
  parse.js                  export WhatsApp → messaggi
  count.js                  messaggi → birre, con le correzioni
  stats.js                  birre → statistiche e proiezioni
  names.js                  nomi visualizzati e numeri mascherati
  options.js                opzioni e valori predefiniti
  analyze.js                tutto in una chiamata
src/report/               uscite: terminale, JSON/CSV, HTML
web/                      dashboard: template, stile, interfaccia
scripts/build.js          genera dist/index.html (file unico)
scripts/generate-example.js  rigenera la chat di esempio
examples/                 chat inventate per demo e test
test/                     test con node:test
```

La dashboard usa gli stessi moduli di `src/core`: `npm run build` li concatena in un unico file HTML insieme a `web/`, così la pagina funziona anche aperta dal disco.

## Sviluppo

```sh
npm test          # test
npm run build     # dashboard in dist/index.html
npm start         # riepilogo della chat di esempio
npm run example   # rigenera examples/chat-esempio.txt
```

Non servono dipendenze. I grafici della dashboard usano [Chart.js](https://www.chartjs.org/) e la lettura degli zip usa [JSZip](https://stuk.github.io/jszip/), entrambi caricati da CDN.

Se il tuo export ha un formato che il parser non riconosce, apri una issue allegando **poche righe anonimizzate** (sostituisci nomi e numeri). Leggi [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy

- La dashboard legge il file nel browser e non lo invia a nessun server.
- Il report HTML generato dalla riga di comando contiene solo i messaggi con un numero o una foto, con i nomi già sostituiti. Il resto della chat non entra nel file.
- Non mettere export di chat reali nel repository: `.gitignore` esclude i nomi di file che WhatsApp usa per gli export.

## Licenza

[MIT](LICENSE)
