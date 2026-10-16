# Serata Complotti

Web app per una serata di presentazioni complottiste: regia dal telefono del GM, schermo per il proiettore, telefoni dei partecipanti per telecomando e voto.

- React + TypeScript + Vite, dati condivisi su Supabase (`supabase/setup.sql`, istruzioni in `supabase/README.md`).
- Senza `.env.local` l’app gira in modalità demo locale nel browser.
- `npm test` — regole, premi e permessi del database (Postgres locale via PGlite). `npm run test:browser` — percorsi completi con Playwright.
- Ogni push su `main` pubblica su GitHub Pages.
