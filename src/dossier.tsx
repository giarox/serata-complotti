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
  /** At booking: also offer “Solo pubblico”, and skip the title for the audience. */
  withAudience?: boolean;
}) {
  const set = (patch: Partial<Participant>) => onChange({ ...value, ...patch });
  const askTitle = !(withAudience && value.mode === 'none');
  return (
    <>
      {askTitle && (
        <>
          <label>
            Il tuo seriosissimo titolo da ricercatore
            <input
              maxLength={80}
              placeholder="Es. Ricercatore della seconda pagina di Google"
              value={value.role}
              onChange={(e) => set({ role: e.target.value })}
            />
          </label>
          <Button secondary className="dice" onClick={() => set({ role: pick(roleIdeas, value.role) })}>
            <Dices size={18} /> Dammi un’idea
          </Button>
        </>
      )}
      <div className="field-mode" role="radiogroup" aria-label={withAudience ? 'Come partecipi' : 'Come presenti'}>
        <span className="label">{withAudience ? 'Come partecipi' : 'Come presenti'}</span>
        <div className={'mode-chips' + (withAudience ? ' three' : '')}>
          {modes
            .filter((m) => withAudience || m.key !== 'none')
            .map((m) => (
              <button
                type="button"
                role="radio"
                aria-checked={value.mode === m.key}
                key={m.key}
                className={'mode-chip ' + (value.mode === m.key ? 'chosen' : '')}
                onClick={() => set({ mode: m.key })}
              >
                <strong>{m.label}</strong>
                <span>{m.hint}</span>
              </button>
            ))}
        </div>
      </div>
      {value.mode === 'slides' && (
        <div className="slides-field">
          <label>
            Link Google Slides
            <input
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://docs.google.com/presentation/…"
              value={value.deckUrl}
              onChange={(e) => set({ deckUrl: e.target.value })}
            />
          </label>
          <p className="howto-inline">
            <strong>Non sai dove trovarlo?</strong> In Google Slides: <b>Condividi</b> → <b>Chiunque abbia il link</b> →{' '}
            <b>Copia link</b>.{withAudience && ' Non è pronto? Aggiungilo dopo.'}
          </p>
        </div>
      )}
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
    [saved, setSaved] = useState(false);
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
  return (
    <section className="booked">
      <h1>Benvenuto, {me.name}.</h1>
      {!audience && gaps.length > 0 && <Countdown />}
      {sheet}
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

/** Who else is in and how far along they are. Names and status only: titles stay secret. */
export function Registry({ s, meId }: { s: State; meId?: string }) {
  const people = [...s.participants].sort((a, b) => order[statusOf(a)] - order[statusOf(b)]);
  const speakers = people.filter((p) => statusOf(p) !== 'audience'),
    ready = speakers.filter((p) => statusOf(p) === 'ready').length;
  return (
    <section className="registry" aria-labelledby="registry-title">
      <div className="registry-head">
        <h2 id="registry-title">Gli altri ricercatori</h2>
        <p>
          {speakers.length === 1 ? '1 ricercatore' : `${speakers.length} ricercatori`}, {ready}{' '}
          {ready === 1 ? 'pronto' : 'pronti'}.{' '}
          {speakers.length > ready
            ? 'I ritardatari verranno segnalati alle autorità.'
            : 'Nessun ritardatario. Sospetto.'}
        </p>
      </div>
      <ol className="registry-list">
        {people.map((p) => {
          const st = statusOf(p);
          return (
            <li key={p.id} className={'registry-row ' + st + (p.id === meId ? ' me' : '')}>
              <span className="registry-name">
                {p.name}
                {p.id === meId && <small>tu</small>}
              </span>
              <span className={'registry-status ' + st}>
                {st === 'ready' && <Check size={14} />}
                {statusLabel[st]}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** GM tool: build the invite link with the event password inside, ready to paste in a chat. */
export function InvitePanel() {
  const [code, setCode] = useState(''),
    [copied, setCopied] = useState(false);
  const base = location.origin + location.pathname;
  const link = code.trim() ? `${base}#invito=${encodeURIComponent(code.trim())}` : '';
  const message = `🕵️ Documento riservato. Siccome non cielo dicono, ce lo diciamo noi: il ${EVENT_DAY} si riunisce il congresso dei ricercatori indipendenti. Blocca il tuo posto prima che lo cancellino: ${link}`;
  return (
    <section className="panel invite-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Per chi deve ancora iscriversi</p>
          <h2>Il link d’invito</h2>
        </div>
        <MessageCircle size={22} />
      </div>
      <p className="footnote">
        Scrivi la parola d’ordine degli ospiti: il link la contiene già, così i tuoi amici non devono digitare niente.
      </p>
      <label>
        Parola d’ordine degli ospiti
        <input
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setCopied(false);
          }}
        />
      </label>
      {link && (
        <>
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
        </>
      )}
    </section>
  );
}
