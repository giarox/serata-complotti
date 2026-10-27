# Slides helper (Mac del proiettore)

Fa girare Google Slides **vere** sul proiettore (animazioni e video compresi) e le fa avanzare
dal telefono di chi presenta.

## Una volta sola
1. Sul Mac del proiettore serve Node.js 18 o più recente (`node -v`) e Google Chrome.
2. Nella cartella `app/`: `npm install`.

## Prima della serata
1. Apri Chrome sulla **Vista proiettore** dell'app (dalla regia: "Vista proiettore") e mettila a schermo intero
   (Visualizza → Entra a schermo intero). Lasciala in primo piano.
2. Apri il Terminale nella cartella `app/` e lancia:
   - serata vera: `npm run helper`
   - serata di prova: `npm run helper -- --prova`
3. Scrivi il PIN della regia. Deve comparire "Collegato come regia… In ascolto dei comandi".
4. La prima volta macOS chiede di permettere al Terminale di controllare "System Events" e l'Accessibilità
   (Impostazioni di Sistema → Privacy e sicurezza → Accessibilità): consenti, poi rilancia il comando.

## Durante la serata
- Quando parte un turno con slide, l'helper apre la presentazione in modalità "Presenta" come nuova scheda.
- Il relatore tocca **Avanti / Indietro** sul telefono (anche la regia ha gli stessi tasti): l'helper preme → / ←.
- Al question time (o se annulli il turno) l'helper esce dalla presentazione e chiude la scheda:
  torna la vista proiettore.
- Non toccare il Mac mentre l'helper lavora: i tasti vanno alla finestra in primo piano.

## Consigli per i relatori
- Link condiviso come "Chiunque abbia il link".
- I video: in Slides, Opzioni formato → Riproduzione video → "Riproduci (automaticamente)".

## Prova senza toccare la tastiera
`npm run helper -- --prova --dry-run` stampa i comandi senza premere nulla.
