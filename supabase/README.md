# Connecting Supabase (once, ~10 minutes)

Everything here happens in the Supabase dashboard of the **Complotto1** project plus one command on the Mac.
No SQL to write. Never paste the database password or a `service_role`/secret key anywhere in the app.

1. **Allow anonymous sign-ins** — Authentication → Sign In / Providers → turn on *Allow anonymous sign-ins* → Save.
   Guests don't register: each phone gets an invisible anonymous session after the event password.
2. **Create the tables and rules** — SQL Editor → New query → paste all of `supabase/setup.sql` → Run.
   Safe to run again after future updates: data is kept, functions are replaced.
3. **Names** — edit `supabase/roster.json` with the real people (or keep the demo names and fix them later from
   *Fascicoli*). `spectator: true` = no talk. Use your own entry (`gianluca`) to present and vote as GM.
4. **Passwords** — in Terminal, inside `app/`: `npm run make-init`. Type the guest password and a *different*
   GM password. It writes `supabase/init.PRIVATE.sql` (hashes only). SQL Editor → paste it → Run → delete the file.
   - Change passwords later: run it again (names, rounds and votes are kept).
   - Start a clean event: `npm run make-init -- --reset` (deletes rounds and votes, disconnects all phones).
5. **Connect the app** — Project Settings → API Keys: copy the **Project URL** and the **Publishable key**
   (`sb_publishable_…`). Create `app/.env.local`:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
   ```

   `npm run dev` → the yellow *Laboratorio demo* bar disappears and the top bar says *Collegato*.

Free projects pause after about a week without activity: open the dashboard a day before the evening and resume it if needed.

## Tests

`npm test` runs the rules tests and the database tests. The database tests load `setup.sql` into a local
Postgres (PGlite) and call every function as a real guest or GM would, so they need no Supabase account.
They can't simulate two phones hitting the database at the same instant; the ballot/close race is handled by
a row lock in `party_action` and should be checked once in the rehearsal.
