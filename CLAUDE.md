# Serata Complotti — how we iterate

Amateur party app, event on 31 October. Speed over ceremony until the final check.

## Fast loop (default)
- Edit directly in this repo. Run `npm run check`: it only runs what the change could break
  (typecheck for .ts/.tsx; rules tests for `src/domain.ts`, `api.ts`, `event.ts`; database tests for `supabase/`).
  Copy, CSS and docs changes run nothing.
- Commit and push to `main`. GitHub Actions builds and publishes in about a minute; it runs the rules tests only
  when the rules changed.
- No screenshots unless the change is a layout change that is hard to judge from the code.
- `supabase/setup.sql` changes still need running in the Supabase SQL editor (functions only; never reset data
  without the owner's explicit yes).
- Sync files to the owner's local folder and update the project docs in batches (every few changes or at the end of
  a session), not on every commit.

## Full check (before the event, or after big changes)
- `npm run check:full`: typecheck, all rules + database tests, and the browser journeys (demo mode, no `.env.local`).
- Then look at the main screens on a phone-sized viewport.
