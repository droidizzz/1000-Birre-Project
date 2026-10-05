# Contribuire

Grazie dell'interesse! Il progetto è piccolo e vuole restare semplice: niente dipendenze a runtime, un nucleo che gira sia in Node sia nel browser.

## Segnalare un export che non viene letto bene

WhatsApp cambia il formato degli export tra versioni, lingue e sistemi operativi. Se il conteggio non torna:

1. Guarda la sezione *Controllo lettura* della dashboard o il blocco *Correzioni* nel terminale.
2. Apri una issue con **poche righe dell'export**, dopo aver sostituito nomi e numeri di telefono con valori inventati.
3. Indica telefono (iOS/Android), lingua di WhatsApp e cosa ti aspettavi.

Non allegare mai l'export completo di una chat reale.

## Sviluppo

```sh
npm test
npm run build
```

- Il codice di `src/core/` viene concatenato nel bundle del browser da `src/report/html.js`: tieni ogni `import` su una sola riga e usa solo `export function` / `export const`.
- Ogni nuovo caso di parsing o di conteggio va coperto da un test in `test/`. Se serve una chat di prova, aggiungi le righe in `examples/` o costruiscile dentro il test.
- Testi dell'interfaccia in italiano, codice e commenti in inglese.
- La chat di esempio si rigenera con `npm run example`: se cambi il generatore, aggiorna i numeri attesi nei test.
