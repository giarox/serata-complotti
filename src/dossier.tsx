import React, { useEffect, useState } from 'react';
import { Check, Copy, Dices, MessageCircle } from 'lucide-react';
import {
  displayName,
  dossierGaps,
  editBlocker,
  modes,
  slidesUrlPattern,
  type Action,
  type Admission,
  type Actor,
  type Participant,
  type Partner,
  type State,
} from './domain';
import { DEADLINE_LABEL, DOSSIER_DEADLINE, EVENT_DAY, EVENT_TIME } from './event';
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
  'titolo da congresso': 'la qualifica',
  'come presenti': 'la modalità di presentazione',
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
  partner: null,
  partnerName: '',
});
/** Client-side check before saving; the server repeats it. */
export function dossierProblem(d: Participant): string | null {
  if (d.name.trim().length < 2) return 'Scrivi il nome del relatore.';
  if (d.partner && (d.partnerName ?? '').trim().length < 2)
    return d.partner === 'copresenter' ? 'Scrivi il nome del co-relatore.' : 'Scrivi il nome del testimone.';
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
  nameField,
}: {
  value: Participant;
  onChange: (p: Participant) => void;
  /** At booking: slightly different wording (link can come later). */
  withAudience?: boolean;
  /** The name field, shown first in the speaker section (booking only). */
  nameField?: React.ReactNode;
}) {
  const set = (patch: Partial<Participant>) => onChange({ ...value, ...patch });
  const partner = value.partner ?? null;
  const setPartner = (v: Partner | null) => set({ partner: v, plusOne: v !== null });
  return (
    <>
      <fieldset className="form-section first">
        <legend>Relatore</legend>
        <p className="section-note">Chi sei e cosa ti autorizza a parlare. Nessuno verificherà.</p>
        {nameField}
        <div className="form-line">
          <label htmlFor="f-role">
            Qualifica accademica <span className="label-aside">(autocertificata)</span>
          </label>
          <textarea
            id="f-role"
            rows={2}
            maxLength={80}
            value={value.role}
            onChange={(e) => set({ role: e.target.value.replace(/\n/g, ' ') })}
          />
          <div className="examples-row">
            <p className="examples">Es. «Investigatrice da gruppo Telegram»</p>
            <button type="button" className="link-action" onClick={() => set({ role: pick(roleIdeas, value.role) })}>
              <Dices size={16} /> Genera qualifica
            </button>
          </div>
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend>Presentazione</legend>
        <p className="section-note">Come intendi esporre la verità al congresso.</p>
        <div className="form-line choices" role="radiogroup" aria-label="Modalità di presentazione" id="f-mode">
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
              <strong>Non sai dove trovarlo?</strong>
              <br />
              Clicca su Condividi → Chiunque abbia il link → Copia link, poi incollalo qui.
            </p>
          </div>
        )}
      </fieldset>
      <fieldset className="form-section" id="f-plus">
        <legend>Accompagnatore</legend>
        <p className="section-note">
          Puoi portare <strong>una sola persona</strong>: un testimone passivo oppure un co-relatore attivo.
        </p>
        <div className="ticks stacked" role="radiogroup" aria-label="Accompagnatore">
          {(
            [
              [null, 'Agisco da solo', 'Meglio soli che male informati.'],
              ['witness', 'Porto un testimone', 'Viene con me ma non presenta. Osserva e al massimo annuisce.'],
              ['copresenter', 'Porto un co-relatore', 'Viene con me e presenta. Conferma tutto, anche le invenzioni.'],
            ] as const
          ).map(([v, label, hint]) => (
            <button
              type="button"
              role="radio"
              aria-checked={partner === v}
              key={label}
              className={'tick ' + (partner === v ? 'chosen' : '')}
              onClick={() => setPartner(v)}
            >
              <i aria-hidden="true" />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </button>
          ))}
        </div>
        {partner && (
          <div className="form-line">
            <label htmlFor="f-partner">
              {partner === 'copresenter' ? 'Nome del co-relatore' : 'Nome del testimone'}
            </label>
            <input
              id="f-partner"
              maxLength={40}
              value={value.partnerName ?? ''}
              onChange={(e) => set({ partnerName: e.target.value })}
            />
          </div>
        )}
      </fieldset>
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
    [editing, setEditing] = useState(compact);
  if (!me) return null;
  const value = draft ?? me,
    gaps = dossierGaps(me),
    blocker = editBlocker(s, actor, me.id),
    dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(me);
  async function save() {
    const problem = dossierProblem(value);
    if (problem) return setError(problem);
    setError('');
    if (await perform({ type: 'participant', participant: value })) setDraft(null);
  }
  const sheet = (
    <form
      className="booking on-paper"
      id="fascicolo"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2>Modifica il fascicolo</h2>
      {blocker ? (
        <p className="footnote">{blocker}</p>
      ) : (
        <>
          <p className="booking-lede">
            Qui puoi ritoccare qualifica, presentazione e accompagnatore. Il nome no: quello è già agli atti.
          </p>
          <DossierFields value={value} onChange={setDraft} />
        </>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {!blocker && (
        <Button type="submit" className="booking-cta" disabled={busy || !dirty}>
          {busy ? 'Salvataggio…' : dirty ? 'Salva modifiche al fascicolo' : 'Nessuna modifica'}
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
  const modeLabel = me.mode ? (modes.find((m) => m.key === me.mode)?.label ?? '—') : 'Da scegliere';
  const adm = me.admission ?? 'pending';
  const head = {
    pending: [
      'Richiesta inoltrata.',
      'In fase di valutazione.',
      'Figure non meglio identificate stanno esaminando il tuo fascicolo: controlla qui il tuo esito nelle prossime ore.',
    ],
    admitted: [
      'Esito: ammesso.',
      'Sei nel congresso.',
      `I poteri forti si sono espressi a tuo favore. Ci vediamo il ${EVENT_DAY} alle ${EVENT_TIME}.`,
    ],
    reserve: [
      'Esito: riserva.',
      'Non perdere la speranza.',
      'Per ora i posti sono pieni. Se qualcuno sparisce misteriosamente, verrai ripescato. Ricontrolla qui.',
    ],
  }[adm];
  const toggleLabel = !editing
    ? 'Modifica il fascicolo allegato'
    : dirty
      ? 'Salva modifiche al fascicolo'
      : 'Nascondi il fascicolo';
  return (
    <section className="booked">
      <p className="receipt-kicker">Richiesta di ammissione / {passNo}</p>
      <h1 className="receipt-title">
        {head[0]}
        <br />
        {head[1]}
      </h1>
      <p className="welcome-lede">{head[2]}</p>

      <article className="guest-pass" aria-label="Il tuo pass">
        <header>
          <span>Pass / SC-{passNo}</span>
          <span className={'pass-live ' + adm}>{admissionLabel[adm]}</span>
        </header>
        <p className="pass-event">1° Congresso dei ricercatori indipendenti</p>
        <div className="pass-body">
          <div>
            <span className="pass-label">Relatore</span>
            <strong className="pass-name">{me.name}</strong>
            <span className="pass-role">{me.role ? `«${me.role}»` : 'Qualifica da indicare'}</span>
          </div>
          {adm === 'admitted' ? (
            <Stamp className="ok pass-stamp" sub="Dai poteri forti">
              Ammesso
            </Stamp>
          ) : (
            <div className="pass-seal" aria-hidden="true">
              <span>N. {passNo}</span>
            </div>
          )}
        </div>
        <dl className="pass-fields">
          <div>
            <dt>Modalità</dt>
            <dd>{modeLabel}</dd>
          </div>
          <div>
            <dt>Accompagnatore</dt>
            <dd>{partnerText(me)}</dd>
          </div>
          {me.mode === 'slides' && (
            <div className={'pass-wide' + (me.deckUrl ? '' : ' missing')}>
              <dt>Link slide</dt>
              <dd>{me.deckUrl ? 'Allegato al fascicolo' : 'Mancante: aggiungilo modificando il fascicolo'}</dd>
            </div>
          )}
        </dl>
        <div className="pass-actions">
          <Button
            secondary
            className="pass-edit"
            disabled={busy}
            onClick={() => {
              if (!editing) return setEditing(true);
              if (dirty) return void save();
              setDraft(null);
              setError('');
              setEditing(false);
            }}
          >
            {toggleLabel}
          </Button>
          <p>
            Puoi modificare il fascicolo fino alla <strong>{DEADLINE_LABEL}</strong>.
          </p>
          {gaps.length > 0 && <Countdown />}
        </div>
      </article>
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

/** “con il co-relatore Camilla”, “testimone: sì”… for the pass. */
const partnerText = (p: Participant) =>
  p.partner === 'copresenter'
    ? `Co-relatore: ${p.partnerName || 'da indicare'}`
    : p.partner === 'witness'
      ? `Testimone: ${p.partnerName || 'da indicare'}`
      : 'Nessuno';

const modeTag: Record<string, string> = { slides: 'Slide', paper: 'Dal vivo', none: 'Pubblico' };
export const admissionLabel: Record<Admission, string> = {
  pending: 'In valutazione',
  admitted: 'Ammesso',
  reserve: 'In riserva',
};
const groups: [Admission, string][] = [
  ['admitted', 'Ammessi'],
  ['pending', 'In valutazione'],
  ['reserve', 'In riserva'],
];

/** Everyone who signed up, as mugshots. Others' titles stay secret until they present. */
export function Registry({ s, meId }: { s: State; meId?: string }) {
  const people = [...s.participants];
  const admOf = (p: Participant) => p.admission ?? 'pending';
  const count = (f: (p: Participant) => boolean) => people.filter(f).length;
  const stats: [string, number][] = [
    ['Richieste', people.length],
    ['Ammessi', count((p) => admOf(p) === 'admitted')],
    ['Testimoni', count((p) => p.partner === 'witness')],
    ['Co-relatori', count((p) => p.partner === 'copresenter')],
  ];
  const waiting = count((p) => admOf(p) === 'pending');
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
        <h2 id="registry-title">Registro delle richieste</h2>
      </header>
      <dl className="roster-stats">
        {stats.map(([label, n]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>
      {groups.map(([adm, title]) => {
        const list = people.filter((p) => admOf(p) === adm);
        if (!list.length) return null;
        return (
          <div className={'roster-group ' + adm} key={adm}>
            <h3>
              {title} <small>{list.length}</small>
            </h3>
            <ol className="roster-list">
              {list.map((p) => {
                const mine = p.id === meId;
                return (
                  <li key={p.id} className={'roster-row registry-row' + (mine ? ' me' : '')}>
                    <span className="roster-badge" aria-hidden="true">
                      {initials(p.name)}
                    </span>
                    <div className="roster-info">
                      <strong>
                        {p.name}
                        {mine && <small> (tu)</small>}
                      </strong>
                      <span>{mine ? `«${p.role || 'qualifica da indicare'}»` : '«Qualifica top secret»'}</span>
                      <span className="roster-tags">
                        {p.mode && p.mode !== 'none' && (
                          <em className="mode-tag">{modes.find((m) => m.key === p.mode)?.label}</em>
                        )}
                        {p.partner === 'witness' && <em className="mode-tag">+ testimone</em>}
                        {p.partner === 'copresenter' && (
                          <em className="mode-tag">+ co-relatore{p.partnerName ? `: ${p.partnerName}` : ''}</em>
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
      <p className="roster-foot">
        {waiting > 0
          ? 'I poteri forti stanno valutando. Gli esiti compaiono qui senza preavviso.'
          : 'Tutte le richieste sono state esaminate. Sospetto.'}
      </p>
    </section>
  );
}

/** GM tool: the invite link, ready to paste in a chat. Whoever has it can register. */
export function InvitePanel() {
  const [copied, setCopied] = useState(false);
  const link = location.origin + location.pathname;
  const message = `🕵️ Documento riservato. Siccome non cielo dicono, cielo diciamo noi: il ${EVENT_DAY} si riunisce il congresso dei ricercatori indipendenti. Richiedi l’ammissione prima che lo cancellino (i posti sono pochi): ${link}`;
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
