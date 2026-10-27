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
  const askTitle = true;
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
      <div className="field-mode" role="radiogroup" aria-label="Come presenti">
        <span className="label">Come presenti</span>
        <div className="mode-chips">
          {modes
            .filter((m) => m.key !== 'none')
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
      <div className="field-mode" role="radiogroup" aria-label="Porti un collaboratore?">
        <span className="label">Porti un collaboratore?</span>
        <p className="field-hint">L’invito vale per te più una persona, non di più.</p>
        <div className="mode-chips">
          {(
            [
              [true, 'Sì, porto un collaboratore', 'Una persona in più: partner, amico, parente.'],
              [false, 'No, vengo da solo', 'Solo tu.'],
            ] as const
          ).map(([v, label, hint]) => (
            <button
              type="button"
              role="radio"
              aria-checked={value.plusOne === v}
              key={label}
              className={'mode-chip ' + (value.plusOne === v ? 'chosen' : '')}
              onClick={() => set({ plusOne: v })}
            >
              <strong>{label}</strong>
              <span>{hint}</span>
            </button>
          ))}
        </div>
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
  return (
    <section className="booked">
      <div className="welcome">
        <Stamp className="ok" sub="Iscrizione confermata">
          Sei dentro
        </Stamp>
        <h1>Benvenuto nel congresso, {me.name}.</h1>
        <p className="welcome-lede">
          {audience
            ? 'Sei tra il pubblico: il 31 ottobre ascolti, fai domande e voti.'
            : 'Il tuo posto da ricercatore è bloccato.'}{' '}
          Puoi modificare il tuo seriosissimo titolo e il link alle slide fino alla <strong>{DEADLINE_LABEL}</strong>.
        </p>
        {!editing && (
          <Button secondary className="welcome-edit" onClick={() => setEditing(true)}>
            Modifica il mio fascicolo
          </Button>
        )}
      </div>
      {!audience && gaps.length > 0 && <Countdown />}
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
  return (
    <section className="panel registry" aria-labelledby="registry-title">
      <div className="panel-heading">
        <h2 id="registry-title">I ricercatori</h2>
      </div>
      <p className="registry-sum">
        {speakers.length === 1 ? '1 ricercatore' : `${speakers.length} ricercatori`}
        {plusOnes > 0 && ` (+${plusOnes} ${plusOnes === 1 ? 'collaboratore' : 'collaboratori'})`}, {ready}{' '}
        {ready === 1 ? 'pronto' : 'pronti'}.{' '}
        {speakers.length > ready ? 'I ritardatari verranno segnalati alle autorità.' : 'Nessun ritardatario. Sospetto.'}
      </p>
      <div className="people-list">
        {people.map((p, i) => {
          const st = statusOf(p),
            mine = p.id === meId;
          return (
            <article key={p.id} className={'person-row registry-row ' + st + (mine ? ' me' : '')}>
              <div className={'person-avatar color-' + (i % 4)}>{p.name.slice(0, 1)}</div>
              <div className="person-info">
                <h3>
                  {p.name}
                  {mine && <span className="tiny-status">Tu</span>}
                </h3>
                <p>
                  {mine ? p.role || 'Titolo da scegliere' : st === 'audience' ? 'Osservatore' : 'Titolo top secret'}
                </p>
                {p.mode && p.mode !== 'none' && <em className="mode-tag">{modeTag[p.mode]}</em>}
                {p.plusOne && <em className="mode-tag">+1 collaboratore</em>}
              </div>
              <span className={'registry-status ' + st}>
                {st === 'ready' && <Check size={14} />}
                {statusLabel[st]}
              </span>
            </article>
          );
        })}
      </div>
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
