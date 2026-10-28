import React, { useEffect, useState, type ReactNode } from 'react';
import { Check, Stamp as StampIcon } from 'lucide-react';
import {
  activeRound,
  countVotes,
  displayName,
  emptyBallot,
  MAX_STAMPS,
  REVEAL_STEPS,
  ownerOf,
  presenter,
  stamp,
  stampCount,
  stamps,
  voterOf,
  voters,
  type Action,
  type Actor,
  type Ballot,
  type StampKey,
  type State,
} from './domain';
import {
  certificate,
  prizeOrder,
  revealMoment,
  revealOver,
  revealedPrizes,
  talks,
  verdict,
  type PrizeKey,
  type Talk,
} from './verdict';
import { Fit } from './fit';
import { Head, Kicker, Rule } from './slide';
import { ConfettiBurst, Laurel } from './ceremony';
import { Button, Mark } from './ui';

type Perform = (a: Action) => Promise<boolean>;
export const list = (names: string[]) =>
  names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1];
/** Everyone in a step, one name per line (speaker, then co-speaker), all at the same size. */
export function NameLines({
  step,
  as = 'strong',
  className = '',
  min = 0.4,
  empty = 'Insabbiato',
}: {
  step: Talk[];
  as?: 'h1' | 'strong' | 'p';
  className?: string;
  min?: number;
  empty?: string;
}) {
  const names = step.flatMap((t) => [
    t.presenter.name,
    ...(t.presenter.partner === 'copresenter' && t.presenter.partnerName ? [t.presenter.partnerName] : []),
  ]);
  if (!names.length)
    return (
      <Fit as={as} className={'name-lines ' + className} lines={1} min={min}>
        {empty}
      </Fit>
    );
  return (
    <Fit as={as} className={'name-lines ' + className} lines={names.length} min={min}>
      {names.map((n, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {n}
        </React.Fragment>
      ))}
    </Fit>
  );
}
const namesOf = (step: Talk[]) => list(step.map((t) => displayName(t.presenter)));

/** Prize names, reasons and the line that opens each one on the projector. */
export const prizes: Record<PrizeKey, { name: string; reason: string; opener: string; stamp?: StampKey }> = {
  qa: {
    name: stamp('qa').prize,
    reason: stamp('qa').reason,
    opener: 'Non sono un esperto, ma… alcune risposte sfidavano la gravità.',
    stamp: 'qa',
  },
  performance: {
    name: stamp('performance').prize,
    reason: stamp('performance').reason,
    opener: 'Non importa cosa ci ha detto. Importa che ci abbiamo creduto.',
    stamp: 'performance',
  },
  ricerca: {
    name: stamp('ricerca').prize,
    reason: stamp('ricerca').reason,
    opener: 'Ho fatto le mie ricerche. Qualcuno più di altri.',
    stamp: 'ricerca',
  },
  idea: {
    name: stamp('idea').prize,
    reason: stamp('idea').reason,
    opener: 'Ma sai che… certe idee non vengono da sole?',
    stamp: 'idea',
  },
  cappello: {
    name: 'Il Cappello di Stagnola d’Oro',
    reason: 'Per aver scalato i podi del Congresso fino a toccare le scie chimiche.',
    opener: 'Siccome non cielo dicono, cielo diciamo noi.',
  },
};

/** A rubber stamp: inked when pressed, a dashed ghost when not. Name always written: colour never alone. */
export function StampMark({
  k,
  on = true,
  small = false,
  className = '',
}: {
  k: StampKey | 'cappello';
  on?: boolean;
  small?: boolean;
  className?: string;
}) {
  const title = k === 'cappello' ? 'GRAN MAESTRO' : stamp(k).title;
  const ink = k === 'cappello' ? '#b8935a' : stamp(k).ink;
  return (
    <span
      className={'ink-stamp' + (on ? ' on' : ' off') + (small ? ' small' : '') + ' ' + className}
      style={{ '--ink': ink } as React.CSSProperties}
    >
      {title}
    </span>
  );
}

/* ------------------------------------------------------------------ phones ------------------------------------------------------------------ */

/** The ballot: four stamps, at most two. The vote is valid only once the server confirms it. */
export function StampBallot({
  s,
  actor,
  busy,
  perform,
  onDone,
}: {
  s: State;
  actor: Actor;
  busy: boolean;
  perform: Perform;
  /** Called once the server has the ballot: the phone moves on to the waiting screen. */
  onDone?: () => void;
}) {
  const r = activeRound(s)!,
    p = presenter(s)!,
    saved = s.votes.find((v) => v.roundId === r.id && v.voterId === actor.participantId);
  const [draft, setDraft] = useState<Ballot>(() => (saved ? pick(saved) : emptyBallot())),
    [dirty, setDirty] = useState(false),
    [full, setFull] = useState(false),
    [askEmpty, setAskEmpty] = useState(false);
  const n = stampCount(draft);
  function toggle(k: StampKey) {
    if (!draft[k] && n >= MAX_STAMPS) {
      setFull(true);
      navigator.vibrate?.(60);
      window.setTimeout(() => setFull(false), 600);
      return;
    }
    setDraft({ ...draft, [k]: !draft[k] });
    setDirty(true);
    setAskEmpty(false);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (n === 0 && !askEmpty) return setAskEmpty(true);
    if (await perform({ type: 'vote', roundId: r.id, ballot: draft })) {
      setDirty(false);
      setAskEmpty(false);
      onDone?.();
    }
  }
  return (
    <form className="voting-form stamp-ballot" onSubmit={submit}>
      <p className="eyebrow">TIMBRATURA RISERVATA</p>
      <h1 className="ballot-title">Il fascicolo è nelle tue mani ora.</h1>
      <div className="ballot-person">
        <span className="mono">FASCICOLO DI</span>
        <strong>{displayName(p)}</strong>
        {p.role && <em>«{p.role}»</em>}
      </div>
      <div className="ballot-question">
        <h2>Il Congresso vuole sapere: cosa ti ha colpito?</h2>
        <p>
          Ogni timbro premia un punto forte della presentazione: <strong>scegline al massimo due</strong>. Nessuno ti ha
          convinto? Consegna il fascicolo senza timbri.
        </p>
        <strong className={'stamp-count' + (full ? ' full' : '')}>Timbri: {n}/2</strong>
      </div>
      <div className={'stamp-grid' + (full ? ' shake' : '')} role="group" aria-label="I timbri">
        {stamps.map((c) => (
          <button
            key={c.key}
            type="button"
            className={'stamp-choice' + (draft[c.key] ? ' pressed' : '')}
            aria-pressed={draft[c.key]}
            onClick={() => toggle(c.key)}
          >
            <StampMark k={c.key} on={draft[c.key]} />
            <span className="stamp-line">{c.line}</span>
            <span className="stamp-joke">{c.joke}</span>
          </button>
        ))}
      </div>
      {full && (
        <p role="alert" className="field-error">
          Due timbri al massimo. Toglierne uno per cambiare idea.
        </p>
      )}
      {saved && (
        <p className="saved-banner" role="status">
          <Check size={17} />
          {dirty
            ? 'Fascicolo già consegnato. Hai modifiche da consegnare.'
            : 'Fascicolo consegnato. Puoi ancora cambiare i timbri.'}
        </p>
      )}
      {askEmpty && (
        <p className="footnote" role="status">
          Nessun timbro? Va bene, anche il silenzio è una presa di posizione.
        </p>
      )}
      <Button type="submit" disabled={busy || (!!saved && !dirty && !askEmpty)}>
        {busy
          ? 'Consegna in corso…'
          : askEmpty
            ? 'Consegna senza timbri'
            : saved
              ? 'Consegna le modifiche'
              : 'Consegna il fascicolo timbrato'}
        <Check size={18} />
      </Button>
      <p className="ballot-later">Niente panico: prima del verdetto potrai rivedere i tuoi timbri.</p>
    </form>
  );
}
const pick = (b: Ballot): Ballot => ({
  idea: !!b.idea,
  ricerca: !!b.ricerca,
  performance: !!b.performance,
  qa: !!b.qa,
});

/** The review: every finished talk, your stamps on each, saved at every tap. */
export function ReviewBoard({ s, actor, busy, perform }: { s: State; actor: Actor; busy: boolean; perform: Perform }) {
  const me = actor.participantId ?? '',
    all = talks(s),
    confirmed = (s.reviewed ?? []).includes(me);
  const [draft, setDraft] = useState<Record<string, Ballot>>({});
  const ballotOf = (roundId: string) => {
    const v = s.votes.find((x) => x.roundId === roundId && x.voterId === me);
    return draft[roundId] ?? (v ? pick(v) : emptyBallot());
  };
  const [full, setFull] = useState('');
  async function toggle(roundId: string, k: StampKey) {
    const b = ballotOf(roundId);
    if (!b[k] && stampCount(b) >= MAX_STAMPS) {
      setFull(roundId);
      navigator.vibrate?.(60);
      window.setTimeout(() => setFull(''), 600);
      return;
    }
    const next = { ...b, [k]: !b[k] };
    setDraft({ ...draft, [roundId]: next });
    const ok = await perform({ type: 'vote', roundId, ballot: next });
    if (!ok)
      setDraft((d) => {
        const rest = { ...d };
        delete rest[roundId];
        return rest;
      });
  }
  // Server state wins once it catches up.
  useEffect(() => setDraft({}), [s.revision]);
  return (
    <section className="review-board">
      <p className="eyebrow">REVISIONE DEI TIMBRI</p>
      <h1>Ricontrolla i tuoi timbri.</h1>
      <p className="review-lede">
        Ora che hai visto tutti i fascicoli, puoi modificare i tuoi timbri un’ultima volta. Massimo due per fascicolo.
      </p>
      <ol className="review-list">
        {all.map((t) => {
          const mine = ownerOf(me) === t.presenter.id,
            b = ballotOf(t.round.id);
          return (
            <li
              key={t.round.id}
              className={'review-row' + (mine ? ' mine' : '') + (full === t.round.id ? ' shake' : '')}
            >
              <div className="review-who">
                <span className="mono">{String(t.order).padStart(2, '0')}</span>
                <div>
                  <strong>{displayName(t.presenter)}</strong>
                  {t.presenter.role && <small>{t.presenter.role}</small>}
                </div>
                <em className="review-count">{mine ? 'Il tuo fascicolo' : `${stampCount(b)}/2`}</em>
              </div>
              {!mine && (
                <div className="review-stamps" role="group" aria-label={'Timbri per ' + displayName(t.presenter)}>
                  {stamps.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={b[c.key]}
                      className={'stamp-chip' + (b[c.key] ? ' pressed' : '')}
                      disabled={busy && !b[c.key]}
                      onClick={() => void toggle(t.round.id, c.key)}
                    >
                      <StampMark k={c.key} on={b[c.key]} small />
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="review-confirm">
        {confirmed ? (
          <p className="saved-banner" role="status">
            <Check size={17} /> Controfirmato. Puoi ancora ritoccare finché la regia non chiude.
          </p>
        ) : (
          <Button disabled={busy} onClick={() => void perform({ type: 'confirmReview' })}>
            Controfirmo i miei timbri <Check size={18} />
          </Button>
        )}
      </div>
    </section>
  );
}

/**
 * The phone between actions: a small eye, a tag saying what is going on, a big white line and the flavour
 * text — together never more than half the screen — then what matters (the active file, the remote…).
 */
export function GuestStage({
  tag,
  title,
  flavor,
  children,
}: {
  tag: string;
  title: string;
  flavor?: string;
  children?: ReactNode;
}) {
  return (
    <section className="guest-stage v2">
      <div className="stage-top">
        <Mark />
        <span className="stage-tag">{tag}</span>
        <h1>{title}</h1>
        {flavor && <p className="stage-flavor">{flavor}</p>}
      </div>
      {children}
    </section>
  );
}
/** The talk on stage, made obvious, and what comes next for you. */
export function ActiveFile({ s, next }: { s: State; next?: string }) {
  const p = presenter(s);
  if (!p) return null;
  return (
    <>
      <div className="active-file">
        <span className="mono">FASCICOLO ATTIVO · SUL PALCO ORA</span>
        <strong>{displayName(p)}</strong>
        {p.role && <em>«{p.role}»</em>}
      </div>
      {next && (
        <p className="stage-next">
          <StampIcon size={17} /> {next}
        </p>
      )}
    </>
  );
}
/** A confirmation that slides in and leaves by itself. */
export function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(t);
  }, [text, onClose]);
  return (
    <div className="toast" role="status" onClick={onClose}>
      <Check size={18} /> <span>{text}</span>
    </div>
  );
}

/** During the reveal the phone asks you to look up; at the end it hands you your certificate. */
export function GuestReveal({ s, actor }: { s: State; actor: Actor }) {
  if (!revealOver(s))
    return (
      <GuestStage
        tag="Verdetto in corso"
        title="Guarda il proiettore."
        flavor="Il telefono potrebbe essere intercettato. E comunque ti sta già guardando."
      />
    );
  return <Certificate s={s} actor={actor} />;
}

/** A private certificate: name, title, prizes or mentions, stamp counts. Only for your own talk. */
export function Certificate({ s, actor }: { s: State; actor: Actor }) {
  const v = voterOf(s, actor.participantId);
  const witness = v?.companion && v.owner.partner === 'witness';
  const c = v && !witness ? certificate(s, v.owner.id) : null;
  const name = v ? (v.companion ? v.name : displayName(v.owner)) : '';
  const placeOf = (k: PrizeKey) => (c?.prizes.includes(k) ? 1 : (c?.mentions.find((m) => m.prize === k)?.place ?? 0));
  const crown = c ? placeOf('cappello') : 0,
    pair = !!c && c.talk.presenter.partner === 'copresenter' && !!c.talk.presenter.partnerName;
  const won = c ? c.prizes.map((k) => prizes[k].name) : [];
  async function share() {
    const text = won.length
      ? `Al 1° Congresso dei ricercatori indipendenti ho vinto: ${list(won)}. Siccome non cielo dicono…`
      : 'Ho partecipato al 1° Congresso dei ricercatori indipendenti. Ho visto troppo.';
    try {
      await navigator.share?.({ title: 'Attestato · Serata Complotti', text });
    } catch {
      /* the guest closed the sheet */
    }
  }
  return (
    <>
      <article className={'certificate v2' + (crown === 1 ? ' crowned' : '')}>
        <div className="cert-frame">
          <span className="cert-corner tl" aria-hidden="true" />
          <span className="cert-corner tr" aria-hidden="true" />
          <span className="cert-corner bl" aria-hidden="true" />
          <span className="cert-corner br" aria-hidden="true" />
          <p className="cert-kicker">Palacomplotti · 31 ottobre 2026</p>
          <Mark />
          <p className="cert-type">Attestato</p>
          <p className="cert-of">del 1° Congresso dei ricercatori indipendenti</p>
          <p className="cert-given">Si certifica che</p>
          {c ? <NameLines as="h1" step={[c.talk]} className="cert-name" min={0.45} /> : <h1>{name}</h1>}
          {c?.talk.presenter.role && <p className="cert-role">«{c.talk.presenter.role}»</p>}
          {!c ? (
            <p className="cert-lead">
              ha assistito ai lavori come {witness ? 'testimone oculare' : 'membro del pubblico'}. Ha visto tutto e non
              dirà niente. Il Congresso ringrazia per la vigilanza.
            </p>
          ) : (
            <>
              <p className="cert-lead">
                {pair ? 'hanno presentato il loro fascicolo' : 'ha presentato il suo fascicolo'} al 1° Congresso dei
                ricercatori indipendenti, dove è stato valutato così.
              </p>
              {crown === 1 && (
                <div className="cert-crown">
                  <StampMark k="cappello" />
                  <strong>{prizes.cappello.name}</strong>
                  <span>{prizes.cappello.reason}</span>
                </div>
              )}
              {stampKeysWith(c.talk).length ? (
                <ul className="cert-rows">
                  <li className="cert-rows-head">Piazzamento nei premi e timbri ricevuti</li>
                  {stamps.map((x) => {
                    const n = c.talk.counts[x.key],
                      place = placeOf(x.key);
                    return (
                      <li key={x.key} className={'p' + place + (place === 1 ? ' won' : '')}>
                        <span className="cert-place">
                          {place ? `${place}° posto per il premio` : 'Fuori dal podio per il premio'}
                        </span>
                        <strong className="cert-prize-name">{prizes[x.key].name}</strong>
                        <span className="cert-times">
                          <StampMark k={x.key} small on={n > 0} />
                          {n ? `${n} ${n === 1 ? 'timbro ricevuto' : 'timbri ricevuti'}` : 'nessun timbro'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="cert-lead">
                  Nessun timbro: il fascicolo è così segreto che nemmeno il pubblico ha osato toccarlo.
                </p>
              )}
              {crown > 1 && (
                <p className="cert-mention">
                  {crown}° posto · {prizes.cappello.name}
                </p>
              )}
            </>
          )}
          <div className="cert-sign">
            <span className="cert-seal" aria-hidden="true">
              <Mark />
            </span>
            <div>
              <i className="cert-autograph">N. Omissis</i>
              <small>Il Comitato Invisibile</small>
            </div>
          </div>
          <p className="cert-protocol">Prot. n. 001/2026 · Copia conforme · Non divulgare (o sì)</p>
        </div>
      </article>
      <p className="cert-foot">
        Fai uno screenshot e condividilo: tanto lo sanno già.
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button type="button" className="text-button" onClick={() => void share()}>
            Condividi
          </button>
        )}
      </p>
    </>
  );
}
const stampKeysWith = (t: Talk) => stamps.filter((x) => t.counts[x.key] > 0);

/* ---------------------------------------------------------------- projector ---------------------------------------------------------------- */

/** Vote open: who is being judged, and what each stamp means (in big type, for the first talk above all). */
export function VotingSlide({ s, top }: { s: State; top: ReactNode }) {
  const p = presenter(s),
    r = activeRound(s),
    co = p?.partner === 'copresenter' && p.partnerName ? p.partnerName : '';
  // Time pressure: how many ballots are in, out of everyone who can stamp this file.
  const can = r ? voters(s).filter((v) => ownerOf(v.id) !== r.presenterId).length : 0,
    got = r ? countVotes(s) : 0; // live guests and screens get a count, not the ballots
  return (
    <div className="projector pj-stage pj-vote">
      {top}
      <Head left="VOTAZIONE APERTA" right="TIMBRATE DAL TELEFONO" />
      {p && (
        <p className="pj-vote-who">
          <span className="pj-label">Relatore</span> <b>{p.name}</b>
          {co && (
            <>
              {' '}
              <span className="pj-label">&amp; co-relatore</span> <b>{co}</b>
            </>
          )}
        </p>
      )}
      <h1 className="pj-title pj-question">
        Il Congresso vuole sapere:
        <br />
        cosa vi ha colpito?
      </h1>
      <p className="pj-foot pj-vote-limit">Nessun timbro, uno o al massimo due. L’inchiostro costa.</p>
      <div className="pj-stamps">
        {stamps.map((c, i) => (
          <div key={c.key} className="pj-stamp-card" style={{ '--i': i } as React.CSSProperties}>
            <StampMark k={c.key} />
            <span>{c.line}</span>
            <em>{c.joke}</em>
          </div>
        ))}
      </div>
      {can > 0 && (
        <div className="pj-ballots" style={{ '--p': Math.min(1, got / can) } as React.CSSProperties}>
          <span>
            Schede consegnate <b>{Math.min(got, can)}</b> su {can}
          </span>
          <i aria-hidden="true" />
          <em>
            {got >= can ? 'Tutte dentro. Si chiude.' : 'La regia chiude a breve. I ritardatari verranno schedati.'}
          </em>
        </div>
      )}
    </div>
  );
}

export function ReviewSlide({ s, top }: { s: State; top: ReactNode }) {
  const { confirmed, voters: all } = reviewTally(s);
  return (
    <div className="projector pj-break pj-review">
      {top}
      <Head left="REVISIONE" right="RISERVATO" />
      <Kicker>Revisione dei timbri</Kicker>
      <h1 className="pj-title">Ultima occasione per ripensarci.</h1>
      <p className="pj-sub">
        Ora che avete visto tutti i fascicoli, rivedete i vostri timbri dal telefono: magari qualcuno merita più di
        quanto pensavate. Poi si delibera.
      </p>
      <div className="pj-tally">
        <strong>
          {confirmed} <small>su</small> {all}
        </strong>
        <span>partecipanti del congresso hanno controfirmato i loro timbri</span>
      </div>
      <Rule />
    </div>
  );
}

/** The reveal: per prize open → 3rd → 2nd → 1st (with confetti); interlude; the Cappello; the Registro. */
export function RevealSlide({ s, top }: { s: State; top: ReactNode }) {
  const m = revealMoment(s);
  if (!m) return <div className="projector">{top}</div>;
  if (m.kind === 'interlude')
    return (
      <div className="projector pj-break pj-interlude">
        {top}
        <Head left="GRAN FINALE" right="RISERVATO" large />
        <Kicker>Resta un’ultima busta</Kicker>
        <h1 className="pj-title">
          Ora, per il gran finale<span className="pj-dots">…</span>
        </h1>
        <Rule />
        <p className="pj-sub">Nessuno sa cosa c’è dentro. Nemmeno noi.</p>
      </div>
    );
  if (m.kind === 'registro') return <ClosingSlide s={s} top={top} />;
  const v = verdict(s)[m.prize],
    info = prizes[m.prize],
    number = m.prize === 'cappello' ? 'PREMIO SPECIALE' : `PREMIO 0${prizeOrder.indexOf(m.prize as never) + 1} DI 04`;
  if (m.kind === 'open')
    return (
      <div className={'projector pj-stage pj-open-prize' + (m.prize === 'cappello' ? ' gold' : '')}>
        {top}
        <Head left={number} right="BUSTA SIGILLATA" />
        <Kicker>{m.prize === 'cappello' ? 'E ora il premio più ambito' : 'E il prossimo premio è'}</Kicker>
        <h1 className="pj-title">{info.name}</h1>
        <p className="pj-sub pj-reason">{info.reason}</p>
        <div className="pj-big-stamp">
          <StampMark k={info.stamp ?? 'cappello'} />
        </div>
        <p className="pj-link">
          {m.prize === 'cappello'
            ? 'Consegnato al relatore salito più in alto sui quattro podi della serata.'
            : `Consegnato al relatore che ha collezionato più timbri ${stamp(info.stamp!).title}.`}
        </p>
        <Rule />
      </div>
    );
  // Podium: 3rd and 2nd under a spotlight, then the winner with the confetti.
  const place = m.place,
    done = place === 1,
    first = v.podium[1],
    shown = (n: 1 | 2 | 3) => (n === 3 ? true : n === 2 ? place <= 2 : place === 1);
  const featured = v.podium[place],
    one = featured.length === 1 ? featured[0].presenter : null;
  const step = (n: 2 | 3) => (
    <div className={'pj-step pj-step-' + n + (shown(n) ? ' open' : ' sealed') + (place === n ? ' lit' : '')}>
      <Fit as="span" className="pj-step-name" lines={3} min={0.6}>
        {!shown(n) ? '?' : v.podium[n].length ? namesOf(v.podium[n]) : '—'}
      </Fit>
      <b>{n}°</b>
    </div>
  );
  return (
    <div className={'projector pj-stage pj-award ' + m.prize + (done ? ' done' : ' suspense')}>
      {top}
      {done && first.length > 0 && <ConfettiBurst key={m.prize} delay={1300} gold={m.prize === 'cappello'} />}
      {done && first.length > 0 && m.prize === 'cappello' && <ConfettiBurst key="second" delay={2900} gold />}
      {done && m.prize === 'cappello' && <div className="pj-rays" aria-hidden="true" />}
      <Head left={number} right={info.name.toUpperCase()} />
      {done ? (
        <div className="pj-wreath">
          <Laurel />
          <div className="pj-wreath-in">
            <Kicker>
              {first.length
                ? m.prize === 'cappello'
                  ? v.shared
                    ? 'Gran Maestri del Congresso, pari merito'
                    : 'Il Gran Maestro del Congresso è'
                  : v.shared
                    ? 'Pari merito'
                    : `${info.name} va a`
                : info.name}
            </Kicker>
            <NameLines as="h1" className="pj-name" step={first} empty="Premio insabbiato." />
            {first.length === 1 && first[0].presenter.role && <Fit className="pj-role">{first[0].presenter.role}</Fit>}
            <p className="pj-sub">{first.length ? info.reason : 'Il Congresso nega che sia mai esistito.'}</p>
            {first.length > 0 && info.stamp && (
              <div className="pj-stamp-drop">
                <StampMark k={info.stamp} />
              </div>
            )}
            {first.length > 0 && m.prize === 'cappello' && v.placements && (
              // The Cappello's infographic: where the winner landed on the four podiums. No points shown.
              <div className="pj-medals">
                {first.map((t) => (
                  <ul key={t.round.id} aria-label={'Piazzamenti di ' + displayName(t.presenter)}>
                    {first.length > 1 && <li className="pj-medals-who">{displayName(t.presenter)}</li>}
                    {(v.placements![t.round.id] ?? []).map((pl) => (
                      <li key={pl.prize}>
                        <b>{pl.place}°</b>
                        <StampMark k={pl.prize} small />
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            )}
          </div>
          <Laurel right />
        </div>
      ) : (
        <div className="pj-feature" key={place}>
          <Kicker>
            {place}° posto{featured.length > 1 ? ' · pari merito' : ''}
          </Kicker>
          <Fit as="h1" className="pj-name" lines={2}>
            {featured.length ? namesOf(featured) : 'Posto vacante.'}
          </Fit>
          {one?.role && <Fit className="pj-role">{one.role}</Fit>}
          {!featured.length && <p className="pj-sub">Nessuno sul gradino. Sospetto.</p>}
        </div>
      )}
      {m.prize !== 'cappello' && (
        <div className="pj-podium-steps">
          {step(2)}
          <div className={'pj-step pj-step-1' + (done ? ' open lit' : ' sealed')}>
            <b>1°</b>
          </div>
          {step(3)}
        </div>
      )}
    </div>
  );
}

/** The closing slide: four small awards in a row, the Cappello below, thanks, and a sequel nobody promised. */
export function ClosingSlide({ s, top }: { s: State; top: ReactNode }) {
  const v = verdict(s);
  return (
    <div className="projector pj-closing">
      {top}
      <Head left="FASCICOLI CHIUSI" right="CONGRESSO N. 001" />
      <Kicker>Il Congresso ha parlato (e si è esposto)</Kicker>
      <ol className="pj-recap">
        {stamps.map((c, i) => (
          <li key={c.key} className="pj-mini-award" style={{ '--i': i } as React.CSSProperties}>
            <Laurel />
            <div className="pj-mini-in">
              <NameLines step={v[c.key].podium[1]} className="pj-mini-name" min={0.5} />
              <StampMark k={c.key} small />
              <span className="pj-prize-name">{prizes[c.key].name}</span>
            </div>
            <Laurel right />
          </li>
        ))}
      </ol>
      <div className="pj-mini-award crown">
        <Laurel />
        <div className="pj-mini-in">
          <NameLines step={v.cappello.podium[1]} className="pj-mini-name" min={0.45} />
          <StampMark k="cappello" small />
          <span className="pj-prize-name">{prizes.cappello.name}</span>
        </div>
        <Laurel right />
      </div>
      <p className="pj-thanks">
        Grazie a ricercatori, co-relatori, testimoni e pubblico. Avete visto troppo: ora siete dei nostri.
      </p>
      <p className="pj-tbc">To be continued</p>
    </div>
  );
}

/* ------------------------------------------------------------------ regia ------------------------------------------------------------------ */

/** What the next tap shows on the projector — never the names, so the GM enjoys the surprise too. */
export function nextStepLabel(s: State) {
  const next = revealMoment({ phase: 'results', revealed: s.revealed + 1 });
  if (!next || s.revealed >= REVEAL_STEPS) return 'Fine: la chiusura con i premi è sul proiettore.';
  if (next.kind === 'interlude') return 'Prossimo: il gran finale';
  if (next.kind === 'registro') return 'Prossimo: la chiusura con il riepilogo dei premi';
  const name = prizes[next.prize].name;
  if (next.kind === 'place' && next.prize === 'cappello') return `Prossimo: il vincitore · ${name}`;
  return next.kind === 'open' ? `Prossimo: apertura · ${name}` : `Prossimo: ${next.place}° posto · ${name}`;
}
export function nowLabel(s: State) {
  const m = revealMoment(s);
  if (!m) return '';
  if (m.kind === 'interlude') return 'Sul proiettore: il passaggio al gran finale.';
  if (m.kind === 'registro')
    return 'Sul proiettore: la chiusura. Ognuno ha l’attestato sul telefono (non l’abbiamo detto: è una sorpresa).';
  const name = prizes[m.prize].name;
  if (m.kind === 'place' && m.prize === 'cappello') return `Sul proiettore: il vincitore · ${name}.`;
  return m.kind === 'open' ? `Sul proiettore: apertura · ${name}.` : `Sul proiettore: ${m.place}° posto · ${name}.`;
}

/** The fixed rules, in short, where the provisional settings used to be. */
export function RulesSummary() {
  return (
    <section className="panel rules-summary">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">LE REGOLE DEL VERDETTO</p>
          <h2>Timbri, revisione, cinque premi</h2>
        </div>
      </div>
      <ul className="rules-list">
        <li>Dopo ogni talk ognuno dà da 0 a 2 timbri. Mai sul proprio fascicolo.</li>
        <li>Prima del verdetto c’è la revisione dei timbri: su ogni talk si può annullare un timbro e rimetterlo.</li>
        <li>
          Quattro premi-timbro, uno a testa: chi ha già vinto “scala” e il premio va al successivo con più timbri. Due
          pari in testa lo condividono; se non resta nessuno libero, il primo vince un secondo premio.
        </li>
        <li>
          Il <strong>Cappello di Stagnola d’Oro</strong> va al miglior medagliere sui podi (1° 3 punti, 2° 2, 3° 1) e si
          può sommare a un altro premio.
        </li>
        <li>Sul proiettore niente numeri: solo podi, 3° → 2° → 1°.</li>
      </ul>
      <div className="stamp-legend">
        {stamps.map((c) => (
          <span key={c.key}>
            <StampMark k={c.key} small /> {c.prize}
          </span>
        ))}
      </div>
    </section>
  );
}

/** Regia, after the reveal: the prizes already on the projector (nothing ahead of it). */
export function RevealedList({ s }: { s: State }) {
  const done = revealedPrizes(s);
  if (!done.length) return null;
  const v = verdict(s);
  return (
    <section className="panel revealed-list">
      <p className="eyebrow">GIÀ SVELATI</p>
      <ul>
        {done.map((k) => (
          <li key={k}>
            <strong>{prizes[k].name}</strong>
            <span>{v[k].podium[1].length ? namesOf(v[k].podium[1]) : 'Insabbiato'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** How many voters exist, and how many confirmed the review. */
export function reviewTally(s: State) {
  return { confirmed: (s.reviewed ?? []).length, voters: voters(s).length };
}
