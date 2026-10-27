import React, { useEffect, useState } from 'react';
import { Check, Copy, Dices, MessageCircle } from 'lucide-react';
import {
  dossierGaps,
  editBlocker,
  modes,
  slidesUrlPattern,
  type Action,
  type Actor,
  type Participant,
  type State,
} from './domain';
import { DEADLINE_LABEL, DOSSIER_DEADLINE, EVENT_DAY } from './event';
import { Button, Stamp } from './ui';

export const roleIdeas = [
  'Ricercatore della seconda pagina di Google',
  'Autodidatta in Tutto, con master in Fonti Introvabili',
  'Studiosa indipendente di screenshot sgranati',
  'Ricercatore autodidatta (fonte: un blog del 2009)',
  'Esperto di tutto dopo un video da 3 ore su YouTube',
  'Investigatrice da gruppo Telegram',
  'Archivista di PDF scaricati da siti senza lucchetto',
  'Ha letto tutto, soprattutto i commenti',
  'Analista di catene di Sant’Antonio su WhatsApp',
  'Consulente scientifica (iscritta a 4 canali YouTube)',
  'Dottore di ricerca su forum chiusi nel 2011',
  'Cugino di uno che lavora alla NASA',
  'Esperto di 5G per sentito dire',
  'Fact-checker di sé stessa',
  'Influencer della verità (12 follower, tutti bot)',
];
/** Missing pieces, said like a person would. */
const gapWords: Record<string, string> = {
  'titolo da congresso': 'il tuo titolo',
  'come presenti': 'come partecipi',
  'link delle slide': 'il link delle slide',
};
const andList = (xs: string[]) =>
  xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1];
const pick = (list: string[], not = '') => {
  const options = list.filter((x) => x !== not);
  return options[Math.floor(Math.random() * options.length)];
};
export const emptyDossier = (): Participant => ({
  id: '',
  name: '',
  role: '',
  title: '',
  deckUrl: '',
  mode: null,
  spectator: false,
  plusOne: null,
});
/** Client-side check before saving; the server repeats it. */
export function dossierProblem(d: Participant): string | null {
  if (d.name.trim().length < 2) return 'Scrivi il tuo nome. Tanto lo sanno già.';
  if (d.mode === 'slides' && d.deckUrl.trim() && !slidesUrlPattern.test(d.deckUrl.trim()))
    return 'Quello non sembra un link di Google Slides: deve iniziare con https://docs.google.com/presentation/';
  return null;
}

/** Time left until the dossier deadline, ticking every second. */
export function Countdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = DOSSIER_DEADLINE.getTime() - now;
  if (left <= 0)
    return (
      <div className="countdown expired" role="timer">
        <span className="mono">TEMPO SCADUTO</span>
        <strong>Completalo subito: la regia chiude un occhio.</strong>
      </div>
    );
  const sec = Math.floor(left / 1000),
    d = Math.floor(sec / 86400),
    h = Math.floor((sec % 86400) / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="countdown" role="timer" aria-label={`Mancano ${d} giorni e ${h} ore alla consegna`}>
      <span className="mono">COMPLETA IL FASCICOLO ENTRO</span>
      <div className="countdown-digits" aria-hidden="true">
        <span>
          {d}
          <small>giorni</small>
        </span>
        <span>
          {pad(h)}
          <small>ore</small>
        </span>
        <span>
          {pad(m)}
          <small>min</small>
        </span>
        <span>
          {pad(s)}
          <small>sec</small>
        </span>
      </div>
    </div>
  );
}

/** The details needed before the evening: silly title, how, and the Slides link. No talk title: no spoilers, not even for the GM. */
export function DossierFields({
  value,
  onChange,
  withAudience = false,
}: {
  value: Participant;
  onChange: (p: Participant) => void;
  /** At booking: slightly different wording (link can come later). */
  withAudience?: boolean;
}) {
  const set = (patch: Partial<Participant>) => onChange({ ...value, ...patch });
  return (
    <>
      <div className="form-line">
        <label htmlFor="f-role">
          Titolo da ricercatore <span className="label-aside">(certificato seriamente, eh)</span>
        </label>
        <div className="line-with-action">
          <input
            id="f-role"
            maxLength={80}
            placeholder="Es. Ricercatore della seconda pagina di Google"
            value={value.role}
            onChange={(e) => set({ role: e.target.value })}
          />
          <button
            type="button"
            className="line-action"
            aria-label="Dammi un’idea"
            onClick={() => set({ role: pick(roleIdeas, value.role) })}
          >
            <Dices size={18} /> Idea
          </button>
        </div>
      </div>
      <div className="form-line" role="radiogroup" aria-label="Come presenti" id="f-mode">
        <span className="label">Come presenti</span>
        <div className="ticks">
          {modes
            .filter((m) => m.key !== 'none')
            .map((m) => (
              <button
                type="button"
                role="radio"
                aria-checked={value.mode === m.key}
                key={m.key}
                className={'tick ' + (value.mode === m.key ? 'chosen' : '')}
                onClick={() => set({ mode: m.key })}
              >
                <i aria-hidden="true" />
                <span>
                  <strong>{m.label}</strong>
                  <small>{m.hint}</small>
                </span>
              </button>
            ))}
        </div>
      </div>
      {value.mode === 'slides' && (
        <div className="form-line">
          <label htmlFor="f-deck">Link Google Slides</label>
          <input
            id="f-deck"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://docs.google.com/presentation/…"
            value={value.deckUrl}
            onChange={(e) => set({ deckUrl: e.target.value })}
          />
          <p className="howto-inline">
            <strong>Non sai dove trovarlo?</strong> Condividi → Chiunque abbia il link → Copia link.
            {withAudience && ' Non è pronto? Aggiungilo dopo.'}
          </p>
        </div>
      )}
      <div className="form-line" id="f-plus">
        <button
          type="button"
          role="checkbox"
          aria-checked={!!value.plusOne}
          className={'tick plus-one ' + (value.plusOne ? 'chosen' : '')}
          onClick={() => set({ plusOne: !value.plusOne })}
        >
          <i aria-hidden="true" />
          <span>
            <strong>Porto un collaboratore</strong>
            <small>Una persona in più, non di più.</small>
          </span>
        </button>
      </div>
    </>
  );
}

/** Screen 2: countdown, the dossier to complete, then the registry of everyone else. */
export function DossierHome({
  s,
  actor,
  busy,
  perform,
  compact = false,
}: {
  s: State;
  actor: Actor;
  busy: boolean;
  perform: (a: Action) => Promise<boolean>;
  compact?: boolean;
}) {
  const me = s.participants.find((p) => p.id === actor.participantId);
  const [draft, setDraft] = useState<Participant | null>(null),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [editing, setEditing] = useState(() => !me || dossierGaps(me).length > 0);
  if (!me) return null;
  const value = draft ?? me,
    gaps = dossierGaps(me),
    blocker = editBlocker(s, actor, me.id),
    audience = me.mode === 'none',
    dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(me);
  const change = (p: Participant) => {
    setDraft(p);
    setSaved(false);
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = dossierProblem(value);
    if (problem) return setError(problem);
    setError('');
    if (await perform({ type: 'participant', participant: value })) {
      setDraft(null);
      setSaved(true);
    }
  }
  const sheet = (
    <form className="booking on-paper" onSubmit={submit} id="fascicolo">
      {gaps.length === 0 ? (
        <Stamp className="ok" sub={audience ? 'Spettatore' : 'Fascicolo completo'}>
          Ammesso
        </Stamp>
      ) : (
        <Stamp sub="Posto bloccato">Prenotato</Stamp>
      )}
      {blocker ? (
        <p className="footnote">{blocker}</p>
      ) : audience ? (
        <>
          <h2>Sei tra il pubblico.</h2>
          <p className="booking-lede">Vuoi presentare anche tu? Scegli come.</p>
          <DossierFields value={value} onChange={change} />
        </>
      ) : (
        <>
          <h2>{gaps.length ? 'Il tuo fascicolo' : 'Fascicolo completo. Sospetto.'}</h2>
          <p className="booking-lede">
            {gaps.length
              ? `${gaps.length > 1 ? 'Mancano' : 'Manca'} ancora ${andList(gaps.map((g) => gapWords[g] ?? g))}.`
              : 'Puoi modificarlo fino al tuo turno.'}
          </p>
          <DossierFields value={value} onChange={change} />
        </>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {!blocker && (
        <Button type="submit" className="booking-cta" disabled={busy || !dirty}>
          {busy ? 'Salvataggio…' : saved && !dirty ? 'Salvato' : 'Salva il fascicolo'}
          <Check size={18} />
        </Button>
      )}
    </form>
  );
  if (compact)
    return (
      <details className="dossier-compact">
        <summary>Il tuo fascicolo{gaps.length ? ': da completare' : ''}</summary>
        {sheet}
      </details>
    );
  const passNo = String(s.participants.findIndex((p) => p.id === me.id) + 1).padStart(3, '0');
  const modeLabel = me.mode ? modes.find((m) => m.key === me.mode)?.label : 'Modo da scegliere';
  return (
    <section className="booked">
      <p className="receipt-kicker">Ricevuta d’iscrizione / {passNo}</p>
      <h1 className="receipt-title">
        Ammissione accolta.
        <br />
        Sei nel congresso.
      </h1>
      <p className="welcome-lede">Il 31 ottobre porta la tua teoria e la faccia di chi l’ha scoperta.</p>

      <article className="guest-pass" aria-label="Il tuo pass">
        <header>
          <span>Pass / SC-{passNo}</span>
          <span className="pass-live">Posto riservato</span>
        </header>
        <div className="pass-body">
          <div>
            <span className="pass-label">Ricercatore</span>
            <strong className="pass-name">{me.name}</strong>
            <span className="pass-role">{me.role ? `«${me.role}»` : 'Titolo ancora da scegliere'}</span>
            <span className="pass-meta">
              {modeLabel} · collaboratore: {me.plusOne ? 'sì (+1)' : 'no'}
            </span>
          </div>
          <div className="pass-seal" aria-hidden="true">
            <span>N. {passNo}</span>
          </div>
        </div>
        <footer>
          <span>31 ottobre</span>
          <strong>Luogo: top secret</strong>
        </footer>
      </article>

      <section className="edit-box" aria-labelledby="edit-title">
        <h2 id="edit-title">Il posto è tuo. Il resto può aspettare.</h2>
        <p>
          Fino alla <strong>{DEADLINE_LABEL}</strong> puoi ancora completare o cambiare tutto qui sotto. Il tuo posto
          resta tenuto.
        </p>
        {gaps.length > 0 && (
          <>
            <p className="edit-todo">
              {gaps.length > 1 ? 'Mancano' : 'Manca'} ancora {andList(gaps.map((g) => gapWords[g] ?? g))}.
            </p>
            <Countdown />
          </>
        )}
        <div className="edit-chips">
          {(
            [
              ['f-role', 'Titolo'],
              ['f-mode', 'Come presenti'],
              ['f-deck', 'Link slide'],
              ['f-plus', 'Collaboratore'],
            ] as const
          )
            .filter(([field]) => field !== 'f-deck' || me.mode === 'slides')
            .map(([field, label]) => (
              <button
                type="button"
                key={field}
                className="chip"
                onClick={() => {
                  setEditing(true);
                  window.setTimeout(() => {
                    const el = document.getElementById(field) ?? document.getElementById('fascicolo');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (el instanceof HTMLInputElement) el.focus({ preventScroll: true });
                  }, 60);
                }}
              >
                {label}
              </button>
            ))}
        </div>
        {!editing && (
          <button type="button" className="edit-link" onClick={() => setEditing(true)}>
            Apri il fascicolo completo
          </button>
        )}
      </section>
      {editing && sheet}
      <Registry s={s} meId={me.id} />
    </section>
  );
}

type Status = 'ready' | 'booked' | 'audience';
const statusOf = (p: Participant): Status =>
  p.mode === 'none' ? 'audience' : dossierGaps(p).length === 0 ? 'ready' : 'booked';
const statusLabel: Record<Status, string> = {
  ready: 'Pronto',
  booked: 'Incompleto',
  audience: 'Pubblico',
};
const order: Record<Status, number> = { ready: 0, booked: 1, audience: 2 };

const modeTag: Record<string, string> = { slides: 'Slide', paper: 'Dal vivo', none: 'Pubblico' };

/** Everyone who signed up, as mugshots. Others' titles stay secret until they present. */
export function Registry({ s, meId }: { s: State; meId?: string }) {
  const people = [...s.participants].sort((a, b) => order[statusOf(a)] - order[statusOf(b)]);
  const speakers = people.filter((p) => statusOf(p) !== 'audience'),
    ready = speakers.filter((p) => statusOf(p) === 'ready').length,
    plusOnes = people.filter((p) => p.plusOne).length;
  const initials = (n: string) =>
    n
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  return (
    <section className="roster" aria-labelledby="registry-title">
      <header className="roster-head">
        <h2 id="registry-title">Gli altri ricercatori</h2>
        <span>
          {speakers.length} iscritti{plusOnes > 0 && ` +${plusOnes}`} · {ready} pronti
        </span>
      </header>
      <ol className="roster-list">
        {people.map((p) => {
          const st = statusOf(p),
            mine = p.id === meId;
          return (
            <li key={p.id} className={'roster-row registry-row ' + st + (mine ? ' me' : '')}>
              <span className="roster-badge" aria-hidden="true">
                {initials(p.name)}
              </span>
              <div className="roster-info">
                <strong>
                  {p.name}
                  {mine && <small> (tu)</small>}
                </strong>
                <span>{mine ? `«${p.role || 'titolo da scegliere'}»` : '«Titolo top secret»'}</span>
                <span className="roster-tags">
                  {p.mode && p.mode !== 'none' && <em className="mode-tag">{modeTag[p.mode]}</em>}
                  {p.plusOne && <em className="mode-tag">+1</em>}
                  <em className={'registry-status ' + st}>{statusLabel[st]}</em>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="roster-foot">
        {speakers.length > ready ? 'I ritardatari verranno segnalati alle autorità.' : 'Nessun ritardatario. Sospetto.'}
      </p>
    </section>
  );
}

/** GM tool: the invite link, ready to paste in a chat. Whoever has it can register. */
export function InvitePanel() {
  const [copied, setCopied] = useState(false);
  const link = location.origin + location.pathname;
  const message = `🕵️ Documento riservato. Siccome non cielo dicono, cielo diciamo noi: il ${EVENT_DAY} si riunisce il congresso dei ricercatori indipendenti. Blocca il tuo posto prima che lo cancellino: ${link}`;
  return (
    <section className="panel invite-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Per chi deve ancora iscriversi</p>
          <h2>Il link d’invito</h2>
        </div>
        <MessageCircle size={22} />
      </div>
      <p className="invite-link">{link}</p>
      <div className="result-actions">
        <Button
          onClick={() => {
            void navigator.clipboard?.writeText(message).then(() => setCopied(true));
          }}
        >
          <Copy size={17} /> {copied ? 'Copiato' : 'Copia messaggio'}
        </Button>
        <a
          className="button secondary"
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={17} /> Manda su WhatsApp
        </a>
      </div>
    </section>
  );
}
