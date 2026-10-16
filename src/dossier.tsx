import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Dices, MessageCircle, Pencil } from 'lucide-react';
import {
  dossierGaps,
  editBlocker,
  modes,
  presents,
  slidesUrlPattern,
  type Action,
  type Actor,
  type Mode,
  type Participant,
  type State,
} from './domain';
import { Button, Stamp, firstName } from './ui';

export const roleIdeas = [
  'Studioso dei finti uccelli',
  'Esperta di scie sospette',
  'Cartografo della Terra cava',
  'Decifratrice di scontrini',
  'Analista di piccioni governativi',
  'Archivista dei segreti condominiali',
  'Teorico del Wi-Fi telepatico',
  'Osservatrice di lune posticce',
  'Perito in allunaggi da studio',
  'Sommelier di acqua fluorata',
  'Consulente per rettiliani in incognito',
  'Ricercatrice indipendente di coincidenze',
  'Interprete dei cerchi nel grano',
  'Ispettore dei calzini spaiati',
  'Biografa non autorizzata dei gatti',
];

type Field = 'role' | 'mode' | 'title' | 'link';
const stepsFor = (mode: Mode | null): Field[] =>
  mode === 'slides'
    ? ['role', 'mode', 'title', 'link']
    : mode === 'paper'
      ? ['role', 'mode', 'title']
      : ['role', 'mode'];
const firstGap = (p: Participant): Field =>
  !p.role.trim()
    ? 'role'
    : !p.mode
      ? 'mode'
      : presents(p) && !p.title.trim()
        ? 'title'
        : p.mode === 'slides'
          ? 'link'
          : 'role';

/** The guest's own dossier: a checklist before the evening, plus a guided editor. */
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
  const [editing, setEditing] = useState<Field | null>(null);
  if (!me) return null;
  const gaps = dossierGaps(me),
    blocker = editBlocker(s, actor, me.id),
    complete = gaps.length === 0;
  if (editing && !blocker)
    return <DossierWizard me={me} start={editing} busy={busy} perform={perform} onDone={() => setEditing(null)} />;
  const mode = modes.find((m) => m.key === me.mode);
  const rows: { field: Field; label: string; value: string; ok: boolean }[] = [
    { field: 'role', label: 'Titolo da congresso', value: me.role || 'da inventare', ok: !!me.role.trim() },
    { field: 'mode', label: 'Presenti?', value: mode ? mode.label : 'da decidere', ok: !!me.mode },
  ];
  if (presents(me))
    rows.push({
      field: 'title',
      label: 'La tua rivelazione',
      value: me.title || 'senza titolo',
      ok: !!me.title.trim(),
    });
  if (me.mode === 'slides')
    rows.push({
      field: 'link',
      label: 'Link Google Slides',
      value: me.deckUrl ? 'collegato' : 'manca',
      ok: !!me.deckUrl,
    });
  return (
    <section className={'dossier-home ' + (compact ? 'compact' : '')}>
      {!compact && (
        <>
          <p className="eyebrow">Iscrizione ricevuta</p>
          <h1>Benvenuto nel registro, {firstName(me.name)}.</h1>
          <p className="dossier-lede">
            {complete
              ? 'Il tuo fascicolo è completo. Ora devi solo presentarti alla serata e fingere di non sapere niente.'
              : 'Ci serve ancora qualche informazione prima della serata. Puoi farlo adesso o più tardi: questa pagina ti aspetta.'}
          </p>
        </>
      )}
      <article className="dossier-sheet">
        {complete ? (
          <Stamp className="ok" sub="Fascicolo completo">
            Ammesso
          </Stamp>
        ) : (
          <span className="pending-label">Pratica incompleta</span>
        )}
        <span className="mono">FASCICOLO PERSONALE</span>
        <h2>{me.name}</h2>
        <p className="dossier-role">{me.role || 'Titolo da congresso non ancora assegnato'}</p>
        <ul className="checklist">
          <li className="ok">
            <Check size={18} />
            <span>
              <small>Nome e cognome</small>
              {me.name}
            </span>
          </li>
          {rows.map((row) => (
            <li key={row.field} className={row.ok ? 'ok' : 'todo'}>
              {row.ok ? <Check size={18} /> : <span className="box" />}
              <span>
                <small>{row.label}</small>
                {row.value}
              </span>
              {!blocker && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={'Modifica: ' + row.label}
                  onClick={() => setEditing(row.field)}
                >
                  <Pencil size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {blocker ? (
          <p className="footnote">{blocker}</p>
        ) : (
          <Button className="dossier-cta" onClick={() => setEditing(complete ? 'role' : firstGap(me))} disabled={busy}>
            {complete ? 'Modifica il fascicolo' : 'Completa il fascicolo'}
            <ArrowRight size={18} />
          </Button>
        )}
      </article>
      {!compact && (
        <div className="what-next">
          <h3>E adesso?</h3>
          <p>
            Il giorno della serata riapri questa pagina, sullo stesso telefono. Quando il congresso inizia, qui vedrai
            chi sta presentando e, al momento giusto, la scheda per votare.
          </p>
          <p>Consiglio da agente: salva il link nei preferiti. O tienilo in chat, che tanto non lo legge nessuno.</p>
        </div>
      )}
    </section>
  );
}

function DossierWizard({
  me,
  start,
  busy,
  perform,
  onDone,
}: {
  me: Participant;
  start: Field;
  busy: boolean;
  perform: (a: Action) => Promise<boolean>;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Participant>(me),
    [field, setField] = useState<Field>(start),
    [error, setError] = useState(''),
    [idea, setIdea] = useState(0);
  const steps = stepsFor(draft.mode),
    index = Math.max(0, steps.indexOf(field)),
    last = index === steps.length - 1;
  const shuffled = useMemo(() => [...roleIdeas].sort(() => Math.random() - 0.5), []);

  async function save(next: Participant, moveOn: boolean) {
    setError('');
    if (field === 'link' && next.deckUrl && !slidesUrlPattern.test(next.deckUrl.trim()))
      return setError(
        'Quello non sembra un link di Google Slides. Deve iniziare con https://docs.google.com/presentation/',
      );
    if (field === 'role' && !next.role.trim()) return setError('Serve un titolo. Anche brutto. Soprattutto brutto.');
    if (field === 'mode' && !next.mode) return setError('Scegli una delle tre strade.');
    if (field === 'title' && !next.title.trim()) return setError('La tua rivelazione merita un titolo.');
    // perform shows its own error banner and returns false on failure.
    if (!(await perform({ type: 'participant', participant: next }))) return;
    if (!moveOn) return;
    const nextSteps = stepsFor(next.mode);
    const i = nextSteps.indexOf(field);
    if (i < nextSteps.length - 1) setField(nextSteps[i + 1]);
    else onDone();
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    void save(draft, true);
  }
  return (
    <form className="wizard" onSubmit={submit}>
      <div className="wizard-progress" aria-label={`Passo ${index + 1} di ${steps.length}`}>
        {steps.map((s, i) => (
          <span key={s} className={i < index ? 'done' : i === index ? 'current' : ''} />
        ))}
        <small>
          Passo {index + 1} di {steps.length}
        </small>
      </div>
      {field === 'role' && (
        <fieldset>
          <legend>Il tuo titolo da congresso</legend>
          <p>
            Il tuo ruolo da esperto autoproclamato. Comparirà accanto al tuo nome, per esempio:{' '}
            <em>
              {me.name}, {(draft.role || shuffled[0]).toLowerCase()}
            </em>
            .
          </p>
          <label>
            Titolo
            <input
              autoFocus
              maxLength={80}
              placeholder={shuffled[0]}
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="button secondary inspire"
            onClick={() => {
              setDraft({ ...draft, role: shuffled[idea % shuffled.length] });
              setIdea(idea + 1);
            }}
          >
            <Dices size={18} /> Ispirami
          </button>
        </fieldset>
      )}
      {field === 'mode' && (
        <fieldset>
          <legend>Presenti qualcosa alla serata?</legend>
          <p>Nessun obbligo. Puoi anche cambiare idea più tardi.</p>
          <div className="mode-choices" role="radiogroup" aria-label="Come presenti">
            {modes.map((m) => (
              <button
                type="button"
                role="radio"
                aria-checked={draft.mode === m.key}
                key={m.key}
                className={'mode-choice ' + (draft.mode === m.key ? 'chosen' : '')}
                onClick={() => setDraft({ ...draft, mode: m.key })}
              >
                <strong>{m.label}</strong>
                <span>{m.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {field === 'title' && (
        <fieldset>
          <legend>Il titolo della tua rivelazione</legend>
          <p>Quello che apparirà enorme sul proiettore. Meglio se in maiuscolo e vagamente allarmante.</p>
          <label>
            Titolo
            <input
              autoFocus
              maxLength={120}
              placeholder="PICCIONI FBI"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          {draft.mode === 'paper' && (
            <p className="hint">
              Presenti alla vecchia maniera: porta fogli, cartelloni o oggetti. Mentre parli, sul proiettore resterà il
              tuo titolo.
            </p>
          )}
        </fieldset>
      )}
      {field === 'link' && (
        <fieldset>
          <legend>Il link della tua presentazione</legend>
          <p>Così la apriamo noi sul proiettore e tu la puoi modificare fino all’ultimo secondo.</p>
          <ol className="howto">
            <li>Apri la tua presentazione su Google Slides.</li>
            <li>
              Tocca <strong>Condividi</strong>.
            </li>
            <li>
              In “Accesso generale” scegli <strong>Chiunque abbia il link</strong>.
            </li>
            <li>
              Tocca <strong>Copia link</strong> e incollalo qui sotto.
            </li>
          </ol>
          <label>
            Link Google Slides
            <input
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://docs.google.com/presentation/…"
              value={draft.deckUrl}
              onChange={(e) => setDraft({ ...draft, deckUrl: e.target.value })}
            />
          </label>
          <p className="hint">Se non è condiviso così, sul proiettore comparirà solo un lucchetto. Molto sospetto.</p>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Archiviazione…' : last ? 'Salva il fascicolo' : 'Avanti'}
        {last ? <Check size={18} /> : <ArrowRight size={18} />}
      </Button>
      <div className="wizard-secondary">
        {index > 0 ? (
          <button type="button" className="text-button" onClick={() => setField(steps[index - 1])}>
            <ArrowLeft size={14} /> Indietro
          </button>
        ) : (
          <button type="button" className="text-button" onClick={onDone}>
            <ArrowLeft size={14} /> Torna al fascicolo
          </button>
        )}
        {field === 'link' && (
          <button type="button" className="text-button" onClick={() => void save({ ...draft, deckUrl: '' }, true)}>
            Lo aggiungo più tardi
          </button>
        )}
      </div>
    </form>
  );
}

/** GM tool: build the invite link with the event password inside, ready to paste in a chat. */
export function InvitePanel() {
  const [code, setCode] = useState(''),
    [copied, setCopied] = useState(false);
  const base = location.origin + location.pathname;
  const link = code.trim() ? `${base}#invito=${encodeURIComponent(code.trim())}` : '';
  const message = `Sei stato selezionato. Apri questo link e non dirlo a nessuno: ${link}`;
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
        Scrivi la password degli ospiti: il link la contiene già, così i tuoi amici non devono digitare niente.
      </p>
      <label>
        Password degli ospiti
        <input
          autoCapitalize="none"
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
