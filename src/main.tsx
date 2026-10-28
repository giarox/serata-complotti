import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import {
  Eye,
  Radio,
  Users,
  Monitor,
  Trophy,
  ArrowRight,
  ArrowUpRight,
  LockKeyhole,
  Check,
  X,
  Plus,
  Pencil,
  FileText,
  CircleHelp,
  Download,
  LogOut,
  Maximize,
  ArrowLeft,
  ChevronRight,
  Vote as VoteIcon,
  MessageCircle,
  Play,
  Settings2,
  LockKeyholeOpen,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  activeRound,
  countVotes,
  defaultSettings,
  displayName,
  dossierGaps,
  modes,
  phaseNames,
  REVEAL_STEPS,
  presenter,
  voteBlocker,
  voterOf,
  ownerOf,
  type Action,
  type Admission,
  type Actor,
  type Ballot,
  type Participant,
  type Settings,
  type State,
} from './domain';
import * as api from './api';
import '@fontsource/antonio/600.css';
import '@fontsource/antonio/700.css';
import '@fontsource/special-elite/400.css';
import '@fontsource/geist/400.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/600.css';
import './style.css';
import { Button, Mark, Stamp } from './ui';
import { Entry } from './invite';
import { Fit } from './fit';
import { Head, Kicker, OnStage, Rule } from './slide';
import {
  ActiveFile,
  GuestReveal,
  GuestStage,
  nextStepLabel,
  Toast,
  nowLabel,
  RevealedList,
  RevealSlide,
  ReviewBoard,
  ReviewSlide,
  reviewTally,
  RulesSummary,
  StampBallot,
  VotingSlide,
} from './stamps';
import { DossierHome } from './dossier';
import { Overview, RequestsBoard, SlideRemote, TestLab, GuestMirror } from './regia';
import {
  defaultMock,
  edgeMock,
  mockHash,
  mockState,
  previewScreens,
  readMock,
  type Mock,
  type PreviewScreen,
} from './mock';
const blank: Participant = {
  id: '',
  name: '',
  role: '',
  title: '',
  deckUrl: '',
  mode: null,
  spectator: false,
};
const iconSize = 19;
function App() {
  const [actor, setActor] = useState<Actor | null>(null),
    [state, setState] = useState<State | null>(null),
    [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('regia'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Participant | null>(null),
    [selected, setSelected] = useState<Participant | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null),
    [connected, setConnected] = useState(navigator.onLine);
  const [screen, setScreen] = useState(new URLSearchParams(location.search).get('view') === 'screen');
  useEffect(() => {
    api
      .restoreActor()
      .then((a) => {
        setActor(a);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  const refresh = useCallback(async () => {
    if (!actor) return;
    try {
      const s = await api.getState(actor);
      setState((prev) => (!prev || s.revision >= prev.revision ? s : prev));
      setConnected(navigator.onLine);
    } catch (e) {
      setConnected(false);
      setError((e as Error).message);
    }
  }, [actor]);
  useEffect(() => {
    void refresh();
    return api.watch(() => void refresh());
  }, [refresh]);
  useEffect(() => {
    const off = () => setConnected(false);
    window.addEventListener('offline', off);
    return () => window.removeEventListener('offline', off);
  }, []);
  async function perform(a: Action): Promise<boolean> {
    if (!actor || busy) return false;
    setBusy(true);
    setError('');
    try {
      await api.action(actor, a);
      await refresh();
      setSelected(null);
      setEditing(null);
      setConfirm(null);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function enter(a: Actor) {
    api.saveActor(a);
    setActor(a);
    setState(null);
    setError('');
  }
  async function logout() {
    await api.leave();
    setActor(null);
    setState(null);
    setScreen(false);
  }
  const s = state;
  const round = s ? activeRound(s) : undefined,
    person = s ? presenter(s) : undefined;
  if (loading)
    return (
      <div className="loading">
        <Mark />
        <p>Apertura del fascicolo…</p>
      </div>
    );
  const testBanner = api.sandbox && (
    <div className="sandbox-banner" role="note">
      <strong>Serata di prova</strong> Quello che succede qui non tocca la serata vera.
    </div>
  );
  if (!actor)
    return (
      <>
        {testBanner}
        <Entry onEnter={enter} />
      </>
    );
  if (!s)
    return (
      <div className="loading">
        <Mark />
        <p>{error || 'Collegamento al congresso…'}</p>
        <Button secondary onClick={() => void logout()}>
          Torna all’ingresso
        </Button>
      </div>
    );
  function download() {
    if (!s) return;
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'complotti-risultati.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const completed = s.rounds.filter((r) => r.closed && !r.cancelled).length;
  const left = s.participants.filter(
    (p) => !p.spectator && !s.rounds.some((r) => r.presenterId === p.id && !r.cancelled),
  );
  const allDone = s.phase === 'waiting' && completed > 0 && left.length === 0;
  const lastRound = [...s.rounds].reverse().find((r) => !r.cancelled);
  const lastPresenter = lastRound ? s.participants.find((p) => p.id === lastRound.presenterId) : undefined;
  const backLabel =
    s.phase === 'questions'
      ? 'Torna alla presentazione'
      : s.phase === 'voting'
        ? 'Torna al question time'
        : s.phase === 'results'
          ? 'Esci dal reveal (riapre la revisione)'
          : s.phase === 'review'
            ? 'Chiudi la revisione senza verdetto'
            : s.phase === 'waiting' && lastRound?.closed
              ? `Riapri il voto${lastPresenter ? ' per ' + displayName(lastPresenter) : ''}`
              : '';
  const me = s.participants.find((p) => p.id === actor.participantId);
  return (
    <>
      {testBanner}
      <div className={screen ? 'app screen-mode' : 'app'}>
        {!screen && actor.role === 'gm' && (
          <aside className="sidebar">
            <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
              <Mark />
              <div>
                SERATA
                <br />
                COMPLOTTI<span>CONGRESSO N. 001</span>
              </div>
            </a>
            <div className="sidebar-label">IL QUARTIER GENERALE</div>
            <nav>
              {[
                ['regia', Radio, 'Regia della serata'],
                ['fascicoli', Users, 'I fascicoli'],
                ['premi', Trophy, 'Il verdetto'],
                ['anteprime', Eye, 'Anteprime schermate'],
              ].map(([id, Icon, label]) => (
                <button key={String(id)} className={tab === id ? 'nav-active' : ''} onClick={() => setTab(String(id))}>
                  {React.createElement(Icon as typeof Radio, { size: iconSize })}
                  {String(label)}
                  {id === 'regia' && <i className="dot" />}
                </button>
              ))}
              <button onClick={() => setScreen(true)}>
                <Monitor size={iconSize} />
                Vista proiettore
                <ArrowUpRight size={15} />
              </button>
            </nav>
            <div className="sidebar-bottom">
              <div className="mini-dossier">
                <LockKeyhole size={20} />
                <span>
                  Accesso riservato
                  <br />
                  <strong>Solo per menti aperte.</strong>
                </span>
              </div>
              <button className="logout" onClick={() => void logout()}>
                <LogOut size={16} /> Esci dalla regia
              </button>
              <span className="edition">EDIZIONE ALPHA / 2026</span>
            </div>
          </aside>
        )}
        <div className="workspace">
          <header className="topbar">
            <span className="breadcrumb">
              {screen ? 'Sala proiezione' : actor.role === 'gm' ? 'Quartier generale' : '1° Congresso'}{' '}
              <ChevronRight size={13} />{' '}
              <strong>
                {screen
                  ? 'Schermo'
                  : actor.role === 'gm'
                    ? tab === 'fascicoli'
                      ? 'I fascicoli'
                      : tab === 'premi'
                        ? 'Il verdetto'
                        : tab === 'anteprime'
                          ? 'Anteprime'
                          : 'Regia della serata'
                    : s.participants.find((p) => p.id === actor.participantId)?.name}
              </strong>
            </span>
            <div className="top-actions">
              <span className={'connection ' + (!connected ? 'disconnected' : '')}>
                <i className="dot" />
                {!api.live ? 'Demo locale' : connected ? 'Collegato' : 'Riconnessione…'}
              </span>
              {screen ? (
                <button
                  className="icon-button"
                  aria-label="Esci dalla vista proiettore"
                  onClick={() => setScreen(false)}
                >
                  <X size={18} />
                </button>
              ) : actor.role === 'guest' ? (
                <button className="icon-button" aria-label="Esci" onClick={() => void logout()}>
                  <LogOut size={18} />
                </button>
              ) : (
                <>
                  <span className="avatar" title={me ? 'Regia · ' + me.name : 'Solo regia'}>
                    {me ? me.name.slice(0, 2).toUpperCase() : 'GM'}
                  </span>
                  <button className="icon-button" aria-label="Esci dalla regia" onClick={() => void logout()}>
                    <LogOut size={18} />
                  </button>
                </>
              )}
            </div>
          </header>
          {!api.live && (
            <div className="demo-bar">
              <span>
                <strong>LABORATORIO DEMO</strong> Dati salvati in questo browser · nessuna connessione Supabase
              </span>
              <div>
                <button
                  onClick={() => {
                    const a: Actor = { role: 'gm', participantId: 'gianluca' };
                    enter(a);
                    setScreen(false);
                  }}
                >
                  Regia
                </button>
                <select
                  aria-label="Prova un partecipante"
                  value={actor.participantId ?? ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      enter({ role: 'guest', participantId: e.target.value });
                      setScreen(false);
                    }
                  }}
                >
                  <option value="">Prova un partecipante</option>
                  {s.participants.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {error && (
            <div role="alert" className="alert">
              {error}
              <button aria-label="Chiudi avviso" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button aria-label="Chiudi messaggio" onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </div>
          )}
          <main className={actor.role === 'guest' ? 'content guest-content' : 'content'}>
            {screen ? (
              <Projector s={s} />
            ) : actor.role === 'guest' ? (
              <Guest s={s} actor={actor} busy={busy} perform={perform} />
            ) : (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">
                      <span /> ACCESSO LIVELLO: REGIA
                    </p>
                    <h1>
                      {tab === 'fascicoli'
                        ? 'Ogni teoria ha un volto.'
                        : tab === 'premi'
                          ? 'La verità viene a galla.'
                          : tab === 'anteprime'
                            ? 'Prove generali, senza pubblico.'
                            : 'Tieni insieme il complotto.'}
                    </h1>
                    <p>
                      {tab === 'fascicoli'
                        ? 'Prepara i ricercatori, le prove e i loro fascicoli.'
                        : tab === 'premi'
                          ? 'Cinque premi. Nessuno alla normalità.'
                          : tab === 'anteprime'
                            ? 'Le schermate della serata con dati inventati. Le stesse che vedrà la sala.'
                            : 'Tu conduci la serata. Loro mettono in dubbio tutto il resto.'}
                    </p>
                  </div>
                  <Stamp sub="Strettamente confidenziale">Top secret</Stamp>
                </div>
                <div className="mobile-nav">
                  <button onClick={() => setTab('regia')}>Regia</button>
                  <button onClick={() => setTab('fascicoli')}>Fascicoli</button>
                  <button onClick={() => setTab('premi')}>Verdetto</button>
                  <button onClick={() => setTab('anteprime')}>Anteprime</button>
                  <button onClick={() => setScreen(true)}>Schermo</button>
                </div>
                {tab === 'regia' && (
                  <>
                    <section className="stat-strip">
                      <div>
                        <Users />
                        <span>
                          Al congresso
                          <strong>
                            {(s.participants.length + s.participants.filter((p) => p.plusOne).length)
                              .toString()
                              .padStart(2, '0')}{' '}
                            <small>persone ({s.participants.filter((p) => p.plusOne).length} accompagnatori)</small>
                          </strong>
                        </span>
                      </div>
                      <div>
                        <FileText />
                        <span>
                          Fascicoli discussi
                          <strong>
                            {completed.toString().padStart(2, '0')}{' '}
                            <small>su {s.participants.filter((p) => !p.spectator).length}</small>
                          </strong>
                        </span>
                      </div>
                      <div>
                        <LockKeyhole />
                        <span>
                          Il verdetto
                          <strong className="word-stat">{s.phase === 'results' ? 'Svelato' : 'Top secret'}</strong>
                        </span>
                      </div>
                    </section>
                    <section className="live-panel">
                      <div className="section-top">
                        <span className="eyebrow">
                          <i className="dot" /> IL PUNTO DELLA SITUAZIONE
                        </span>
                        <span className="phase-badge">{phaseNames[s.phase]}</span>
                      </div>
                      <div className="live-body">
                        <div className="live-copy">
                          <span className="mono">
                            {round
                              ? 'FASCICOLO ATTIVO / ' + String(s.rounds.length).padStart(3, '0')
                              : 'NESSUN FASCICOLO APERTO'}
                          </span>
                          <h2>
                            {person
                              ? person.role || displayName(person)
                              : s.phase === 'results'
                                ? 'Ci sono delle conclusioni.'
                                : s.phase === 'review'
                                  ? 'Revisione dei fascicoli.'
                                  : allDone
                                    ? 'Tutti hanno parlato.'
                                    : 'La parola al prossimo sospettato.'}
                          </h2>
                          <p>
                            {person ? (
                              <>
                                <strong>{displayName(person)}</strong>
                                {person.role ? ` · ${person.role}` : ''}
                              </>
                            ) : s.phase === 'results' ? (
                              'Il congresso ha parlato. Il reveal si guida da Il verdetto, un passo alla volta.'
                            ) : s.phase === 'review' ? (
                              `${reviewTally(s).confirmed} su ${reviewTally(s).voters} votanti hanno confermato. Quando sei pronto, chiudi e vai al verdetto.`
                            ) : allDone ? (
                              'Le presentazioni sono finite. Apri la revisione: ognuno potrà ricontrollare i suoi timbri prima del verdetto.'
                            ) : completed > 0 ? (
                              `Scegli il prossimo ricercatore (ne mancano ${left.length}), oppure chiudi i turni e passa al verdetto.`
                            ) : (
                              'Scegli chi vuole presentare. L’ordine lo decide la serata.'
                            )}
                          </p>
                          <div className="primary-actions">
                            {s.phase === 'presenting' && person?.mode === 'slides' && <SlideRemote actor={actor} />}
                            {s.phase === 'presenting' && (
                              <Button
                                disabled={busy || !connected}
                                onClick={() => void perform({ type: 'phase', phase: 'questions', roundId: round!.id })}
                              >
                                Passa al question time <MessageCircle size={18} />
                              </Button>
                            )}
                            {s.phase === 'questions' && (
                              <Button
                                disabled={busy || !connected}
                                onClick={() => setConfirm({ type: 'phase', phase: 'voting', roundId: round!.id })}
                              >
                                Apri il voto per {person ? displayName(person) : ''}
                                <ArrowRight size={18} />
                              </Button>
                            )}
                            {s.phase === 'voting' && (
                              <>
                                <Button
                                  disabled={busy || !connected}
                                  onClick={() => setConfirm({ type: 'phase', phase: 'waiting', roundId: round!.id })}
                                >
                                  Chiudi la votazione <LockKeyhole size={18} />
                                </Button>
                                <span className="vote-tally">Schede consegnate: {countVotes(s)}</span>
                                {api.sandbox && (
                                  <Button secondary disabled={busy} onClick={() => void perform({ type: 'botVotes' })}>
                                    Fai timbrare i tester
                                  </Button>
                                )}
                              </>
                            )}
                            {s.phase === 'waiting' && !allDone && (
                              <a className="button" href="#relatori">
                                Scegli un ricercatore
                                <ArrowRight size={18} />
                              </a>
                            )}
                            {s.phase === 'waiting' && allDone && (
                              <Button disabled={busy || !connected} onClick={() => setConfirm({ type: 'review' })}>
                                Apri la revisione
                                <ArrowRight size={18} />
                              </Button>
                            )}
                            {s.phase === 'waiting' && completed > 0 && (
                              <Button secondary onClick={() => setConfirm({ type: 'reveal' })}>
                                Vai al verdetto
                                <Trophy size={18} />
                              </Button>
                            )}
                            {s.phase === 'review' && (
                              <>
                                <Button disabled={busy || !connected} onClick={() => setConfirm({ type: 'reveal' })}>
                                  Chiudi la revisione e vai al verdetto <Trophy size={18} />
                                </Button>
                                {api.sandbox && (
                                  <Button secondary disabled={busy} onClick={() => void perform({ type: 'botVotes' })}>
                                    Fai rivedere i tester
                                  </Button>
                                )}
                              </>
                            )}
                            {s.phase === 'results' && (
                              <Button onClick={() => setTab('premi')}>
                                Vai al verdetto
                                <Trophy size={18} />
                              </Button>
                            )}
                          </div>
                          <div className="secondary-actions">
                            {backLabel && (
                              <button
                                className="text-button"
                                disabled={busy || !connected}
                                onClick={() => void perform({ type: 'back' })}
                              >
                                <ArrowLeft size={15} /> {backLabel}
                              </button>
                            )}
                            {round && (
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() => setConfirm({ type: 'cancel', roundId: round.id })}
                              >
                                Annulla questo turno
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="dossier-art" aria-hidden="true">
                          <div className="art-paper">
                            <span>ARCHIVIO RISERVATO</span>
                            <Eye strokeWidth={1} />
                            <strong>
                              Non è una
                              <br />
                              coincidenza.
                            </strong>
                            <div className="art-lines" />
                            <em>PROVA 001</em>
                          </div>
                          <div className="art-tape" />
                          <span className="art-cross">chi c’era davvero?</span>
                          <svg className="art-strings" viewBox="0 0 248 208" preserveAspectRatio="none">
                            <line x1="74" y1="34" x2="196" y2="48" />
                            <line x1="74" y1="34" x2="150" y2="158" />
                            <line x1="196" y1="48" x2="150" y2="158" />
                            <circle cx="74" cy="34" r="5" />
                            <circle cx="196" cy="48" r="5" />
                            <circle cx="150" cy="158" r="5" />
                          </svg>
                        </div>
                      </div>
                      <div className="phase-track">
                        {(['presenting', 'questions', 'voting', 'waiting'] as const).map((phase, i) => (
                          <div key={phase} className={s.phase === phase ? 'current' : ''}>
                            <span>{String(i + 1).padStart(2, '0')}</span>
                            {['Presentazione', 'Question time', 'Votazione', 'Prossimo turno'][i]}
                            {i < 3 && <ChevronRight size={14} />}
                          </div>
                        ))}
                      </div>
                    </section>
                    {me && <GmOwnTurn s={s} actor={actor} busy={busy} perform={perform} />}
                    <div className="lower-grid">
                      <section className="panel" id="relatori">
                        <div className="panel-heading">
                          <div>
                            <p className="eyebrow">CHI HA QUALCOSA DA DIRE?</p>
                            <h2>I ricercatori</h2>
                          </div>
                          <button className="text-button" onClick={() => setTab('fascicoli')}>
                            Tutti i fascicoli <ArrowUpRight size={16} />
                          </button>
                        </div>
                        <People s={s} onSelect={setSelected} onEdit={setEditing} />
                      </section>
                      <aside className="side-notes">
                        <div className="note-card">
                          <span className="note-number">PROMEMORIA N. 01</span>
                          <CircleHelp size={26} />
                          <h3>
                            Prima le domande.
                            <br />
                            Poi i giudizi.
                          </h3>
                          <p>Il question time è dal vivo. Quando è finito, apri tu la votazione.</p>
                        </div>
                        <div className="quiet-card">
                          <Monitor size={22} />
                          <div>
                            <h3>La sala è pronta?</h3>
                            <p>Apri lo schermo del congresso sul proiettore.</p>
                            <button className="text-button" onClick={() => setScreen(true)}>
                              Apri vista proiettore <ArrowUpRight size={15} />
                            </button>
                          </div>
                        </div>
                        <div className="integration-note">
                          <span className="dot amber" /> Slides: avvia l'helper sul Mac del proiettore.
                        </div>
                      </aside>
                    </div>
                  </>
                )}
                {tab === 'fascicoli' && <Overview s={s} />}
                {tab === 'fascicoli' && (
                  <RequestsBoard
                    s={s}
                    busy={busy}
                    onAdmit={(p, admission) => void perform({ type: 'participant', participant: { ...p, admission } })}
                    onEdit={setEditing}
                    onRemove={(p) => setConfirm({ type: 'remove', participantId: p.id })}
                    onRelease={(p) => setConfirm({ type: 'release', participantId: p.id })}
                    onAdd={() => setEditing({ ...blank, id: crypto.randomUUID() })}
                    isPresenting={(p) => presenter(s)?.id === p.id}
                  />
                )}
                {tab === 'fascicoli' && <GuestMirror s={s} />}
                {tab === 'anteprime' && <Previews />}
                {tab === 'premi' && (
                  <>
                    <section className="panel verdict-panel">
                      <div className="panel-heading">
                        <div>
                          <p className="eyebrow">{phaseNames[s.phase]}</p>
                          <h2>
                            {s.phase === 'results'
                              ? 'Il reveal, un passo alla volta'
                              : s.phase === 'review'
                                ? 'Revisione in corso'
                                : 'Prima del verdetto'}
                          </h2>
                        </div>
                      </div>
                      {s.phase === 'results' ? (
                        <>
                          <p className="verdict-now">{nowLabel(s)}</p>
                          <p className="verdict-next">{nextStepLabel(s)}</p>
                          <div className="result-actions">
                            {s.revealed < REVEAL_STEPS && (
                              <Button disabled={busy} onClick={() => void perform({ type: 'nextAward' })}>
                                Avanti <ArrowRight size={18} />
                              </Button>
                            )}
                            <Button
                              secondary
                              disabled={busy}
                              onClick={() => void perform(s.revealed > 1 ? { type: 'prevAward' } : { type: 'back' })}
                            >
                              <ArrowLeft size={17} /> {s.revealed > 1 ? 'Indietro' : 'Riapri la revisione'}
                            </Button>
                            <Button secondary onClick={download}>
                              <Download size={17} /> Esporta risultati
                            </Button>
                          </div>
                        </>
                      ) : s.phase === 'review' ? (
                        <>
                          <p className="verdict-now">
                            <strong>{reviewTally(s).confirmed}</strong> su {reviewTally(s).voters} votanti hanno
                            confermato le timbrature. Chi non conferma: valgono i timbri come sono.
                          </p>
                          <div className="result-actions">
                            <Button disabled={busy} onClick={() => setConfirm({ type: 'reveal' })}>
                              Chiudi la revisione e vai al verdetto <Trophy size={18} />
                            </Button>
                            {api.sandbox && (
                              <Button secondary disabled={busy} onClick={() => void perform({ type: 'botVotes' })}>
                                Fai rivedere i tester
                              </Button>
                            )}
                            <Button secondary disabled={busy} onClick={() => void perform({ type: 'back' })}>
                              <ArrowLeft size={17} /> Chiudi la revisione senza verdetto
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="verdict-now">
                            {completed
                              ? 'Quando tutti hanno parlato apri la revisione: ognuno potrà ricontrollare i suoi timbri prima del verdetto.'
                              : 'Il verdetto arriva dopo almeno un talk con il voto chiuso.'}
                          </p>
                          <div className="result-actions">
                            <Button
                              disabled={busy || !completed || s.phase !== 'waiting'}
                              onClick={() => setConfirm({ type: 'review' })}
                            >
                              Apri la revisione <ArrowRight size={18} />
                            </Button>
                            <Button
                              secondary
                              disabled={busy || !completed || s.phase !== 'waiting'}
                              onClick={() => setConfirm({ type: 'reveal' })}
                            >
                              Salta la revisione e vai al verdetto
                            </Button>
                          </div>
                        </>
                      )}
                    </section>
                    {s.phase === 'results' && <RevealedList s={s} />}
                    {s.phase !== 'results' && <RulesSummary />}
                  </>
                )}
                {tab === 'regia' && <TestLab s={s} busy={busy} perform={perform} />}
                {(tab === 'regia' || tab === 'premi') && (
                  <section className="panel reset-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Prove generali</p>
                        <h2>Ricomincia la serata</h2>
                      </div>
                    </div>
                    <p className="footnote">
                      Hai fatto un giro di prova? Azzera turni, voti e verdetto: le richieste e le ammissioni restano.
                      Per partire da zero puoi svuotare anche il registro.
                    </p>
                    <div className="result-actions">
                      <Button secondary disabled={busy} onClick={() => setConfirm({ type: 'reset', everyone: false })}>
                        Azzera turni e voti
                      </Button>
                      <Button secondary disabled={busy} onClick={() => setConfirm({ type: 'reset', everyone: true })}>
                        Svuota anche il registro
                      </Button>
                    </div>
                  </section>
                )}
                <footer>
                  <span>LA VERITÀ È QUI DENTRO. FORSE.</span>
                  <span>SERATA COMPLOTTI / N. 001</span>
                  {!api.live && (
                    <button
                      onClick={() => {
                        if (window.confirm('Cancellare tutti i turni e i voti della demo?')) {
                          api.resetDemo();
                          setTab('regia');
                        }
                      }}
                    >
                      Ricomincia la demo
                    </button>
                  )}
                </footer>
              </>
            )}
          </main>
        </div>
        {selected && (
          <Modal title="Apriamo questo fascicolo?" onClose={() => setSelected(null)}>
            <p className="eyebrow">IL PROSSIMO RELATORE</p>
            <h3 className="modal-talk">{displayName(selected)}</h3>
            <p>{selected.role || 'Titolo da ricercatore non pervenuto'}</p>
            <p className="footnote">
              {selected.mode === 'paper'
                ? 'Presentazione dal vivo: niente slide, sul proiettore restano nome e titolo.'
                : selected.mode === 'slides' && selected.deckUrl
                  ? 'Presentazione con slide. Per ora il deck si apre a mano sul computer del proiettore.'
                  : selected.mode === 'slides'
                    ? 'Ha scelto le slide ma non ha lasciato il link: fatti dare il deck prima di iniziare.'
                    : 'Non ha ancora detto come presenta. Chiediglielo prima di iniziare.'}
            </p>
            {dossierGaps(selected).length > 0 && (
              <p className="award-reason">Fascicolo incompleto: manca {dossierGaps(selected).join(', ')}.</p>
            )}
            <Button disabled={busy} onClick={() => void perform({ type: 'start', participantId: selected.id })}>
              Inizia con {displayName(selected)}
              <Play size={17} />
            </Button>
          </Modal>
        )}
        {editing && (
          <Editor
            participant={editing}
            busy={busy}
            onClose={() => setEditing(null)}
            onSave={(p) => void perform({ type: 'participant', participant: p })}
          />
        )}
        {confirm && (
          <Modal
            title={
              confirm.type === 'cancel'
                ? 'Annullare il turno?'
                : confirm.type === 'release'
                  ? 'Liberare questo nome?'
                  : confirm.type === 'remove'
                    ? 'Eliminare questa persona?'
                    : confirm.type === 'reset'
                      ? confirm.everyone
                        ? 'Svuotare tutto?'
                        : 'Azzerare la serata?'
                      : confirm.type === 'review'
                        ? 'Aprire la revisione?'
                        : confirm.type === 'reveal'
                          ? 'È il momento della verità?'
                          : confirm.type === 'phase' && confirm.phase === 'voting'
                            ? 'Aprire la votazione?'
                            : 'Chiudere la votazione?'
            }
            onClose={() => setConfirm(null)}
          >
            <p>
              {confirm.type === 'cancel'
                ? 'Il turno e gli eventuali voti verranno esclusi. Il ricercatore tornerà disponibile.'
                : confirm.type === 'reset'
                  ? confirm.everyone
                    ? `Spariscono turni, voti, verdetto e tutte le ${s.participants.length} richieste; i telefoni degli ospiti vengono scollegati. Non si può annullare.`
                    : `Spariscono turni, voti e verdetto. Le ${s.participants.length} richieste e le ammissioni restano. Non si può annullare.`
                  : confirm.type === 'remove'
                    ? `${s.participants.find((p) => p.id === confirm.participantId)?.name} sparirà dal registro, con i suoi turni e voti, e il suo telefono verrà scollegato. Non si può annullare.`
                    : confirm.type === 'release'
                      ? `Il telefono che ha scelto ${s.participants.find((p) => p.id === confirm.participantId)?.name} verrà scollegato. I voti già dati restano salvati; la persona giusta potrà rientrare con questo nome.`
                      : confirm.type === 'review'
                        ? left.length
                          ? `Mancano ancora ${left.length} relatori. Dopo la revisione si va al verdetto.`
                          : 'Dal telefono tutti potranno annullare e rimettere i timbri su ogni talk, poi controfirmare. Chiudi tu.'
                        : confirm.type === 'reveal'
                          ? s.phase === 'review'
                            ? 'La revisione si chiude: da qui in poi i timbri sono bloccati. Parte il reveal.'
                            : 'Salti la revisione: i timbri restano come sono e si bloccano. Parte il reveal.'
                          : confirm.type === 'phase' && confirm.phase === 'voting'
                            ? `Si voterà per ${person ? displayName(person) : ''}.`
                            : 'Dopo la chiusura non sarà più possibile inviare o modificare i voti.'}
            </p>
            <Button disabled={busy} onClick={() => void perform(confirm)}>
              Conferma
              <Check size={18} />
            </Button>
          </Modal>
        )}
      </div>
    </>
  );
}
function People({
  s,
  onSelect,
  onEdit,
  onRelease,
  onAdmit,
  onRemove,
  all = false,
}: {
  s: State;
  onSelect: (p: Participant) => void;
  onEdit: (p: Participant) => void;
  onRelease?: (p: Participant) => void;
  onRemove?: (p: Participant) => void;
  onAdmit?: (p: Participant, a: Admission) => void;
  all?: boolean;
}) {
  return (
    <div className="people-list">
      {s.participants
        .filter((p) => all || !p.spectator)
        .map((p, i) => {
          const done = s.rounds.some((r) => r.presenterId === p.id && r.closed && !r.cancelled),
            active = presenter(s)?.id === p.id,
            used = s.rounds.some((r) => r.presenterId === p.id && !r.cancelled);
          return (
            <article className={'person-row ' + (done ? 'person-done' : '')} key={p.id}>
              <div className={'person-avatar color-' + (i % 4)}>{p.name.slice(0, 1)}</div>
              <div className="person-info">
                <h3>
                  {p.name}
                  {active && <span className="tiny-status">In corso</span>}
                  {done && <Check size={14} />}
                </h3>
                <p>{p.role || 'Titolo da ricercatore mancante'}</p>
                <span>
                  {p.mode === 'none' ? 'Solo pubblico' : ''}
                  {p.mode && p.mode !== 'none' && (
                    <em className="mode-tag">{modes.find((m) => m.key === p.mode)?.short}</em>
                  )}
                  {p.partner === 'copresenter' && <em className="mode-tag">In coppia con {p.partnerName || '?'}</em>}
                  {p.partner === 'witness' && <em className="mode-tag">+1 testimone</em>}
                  {dossierGaps(p).length > 0 && <em className="mode-tag todo">Fascicolo incompleto</em>}
                </span>
                {onAdmit && (
                  <select
                    className={'admit-select ' + (p.admission ?? 'pending')}
                    aria-label={'Ammissione di ' + p.name}
                    value={p.admission ?? 'pending'}
                    onChange={(e) => onAdmit(p, e.target.value as Admission)}
                  >
                    <option value="pending">In attesa</option>
                    <option value="admitted">Ammesso</option>
                    <option value="reserve">Riserva</option>
                  </select>
                )}
              </div>
              {all ? (
                <div className="row-actions">
                  {onRelease && s.claimed?.includes(p.id) && (
                    <button className="choose-button" aria-label={'Libera ' + p.name} onClick={() => onRelease(p)}>
                      <LockKeyholeOpen size={14} /> Libera
                    </button>
                  )}
                  {onRemove && (
                    <button
                      className="icon-button"
                      aria-label={'Elimina ' + p.name}
                      disabled={presenter(s)?.id === p.id}
                      onClick={() => onRemove(p)}
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label={'Modifica ' + p.name}
                    disabled={s.phase === 'results' || presenter(s)?.id === p.id}
                    onClick={() => onEdit(p)}
                  >
                    <Pencil size={17} />
                  </button>
                </div>
              ) : (
                <button
                  className="choose-button"
                  disabled={used || p.spectator || s.phase !== 'waiting'}
                  onClick={() => onSelect(p)}
                >
                  {done ? 'Concluso' : active ? 'In corso' : 'Scegli'}
                  {!used && <ArrowRight size={15} />}
                </button>
              )}
            </article>
          );
        })}
    </div>
  );
}
function Guest({
  s,
  actor,
  busy,
  perform,
}: {
  s: State;
  actor: Actor;
  busy: boolean;
  perform: (a: Action) => Promise<boolean>;
}) {
  const r = activeRound(s),
    me = s.participants.find((p) => p.id === actor.participantId),
    voter = voterOf(s, actor.participantId),
    onStage = !!r && !!voter && ownerOf(voter.id) === r.presenterId,
    [reopen, setReopen] = useState(''),
    [toast, setToast] = useState('');
  const closeToast = useCallback(() => setToast(''), []);
  const toastEl = toast ? <Toast text={toast} onClose={closeToast} /> : null;
  if (s.phase === 'results') return <GuestReveal s={s} actor={actor} />;
  if (s.phase === 'review') return <ReviewBoard s={s} actor={actor} busy={busy} perform={perform} />;
  const blocker = voteBlocker(s, actor.participantId),
    saved = !!r && s.votes.some((v) => v.roundId === r.id && v.voterId === actor.participantId);
  if (s.phase === 'voting' && r && !blocker && (!saved || reopen === r.id))
    return (
      <StampBallot
        key={r.id}
        s={s}
        actor={actor}
        busy={busy}
        perform={perform}
        onDone={() => {
          setReopen('');
          setToast('Fascicolo timbrato e consegnato. Potrai cambiarlo prima del verdetto.');
        }}
      />
    );
  // Before the first talk the page is the guest's registration dossier (companions get a short welcome).
  if (s.phase === 'waiting' && s.rounds.length === 0)
    return voter?.companion ? (
      <GuestStage
        tag="Sala d’attesa"
        title={`Benvenuto, ${voter.name}.`}
        flavor={`Sei ${voter.owner.partner === 'copresenter' ? 'co-relatore' : 'testimone'} di ${voter.owner.name}. Durante la serata timbrerai i fascicoli degli altri da questo telefono. Il vostro, no.`}
      />
    ) : (
      <DossierHome s={s} actor={actor} busy={busy} perform={perform} />
    );
  const paper = me?.mode === 'paper' || !!voter?.companion;
  if (s.phase === 'presenting' && onStage)
    return (
      <GuestStage
        tag="Sei sul palco"
        title="Tocca a te. Svegliali."
        flavor={
          paper
            ? 'Niente slide: tutto carisma. Sul proiettore ci sono il tuo nome e il tuo titolo.'
            : 'Avanti e indietro da qui: un tocco, un passo. Animazioni comprese.'
        }
      >
        {!paper && <SlideRemote actor={actor} />}
      </GuestStage>
    );
  if (s.phase === 'presenting')
    return (
      <GuestStage
        tag="Presentazione in corso"
        title="Ascolta."
        flavor="Ascolta e metti tutto in dubbio, da buon ricercatore."
      >
        <ActiveFile s={s} next="Dopo le domande il fascicolo passa a te: potrai timbrarlo." />
      </GuestStage>
    );
  if (s.phase === 'questions')
    return onStage ? (
      <GuestStage
        tag="Sotto interrogatorio"
        title="Difenditi."
        flavor="Ogni domanda scomoda è un’occasione. Arrampicati con stile: c’è un timbro apposta."
      />
    ) : (
      <GuestStage
        tag="Question time"
        title="Fatti delle domande."
        flavor="Poi falle ad alta voce: alza la mano, le domande scomode sono le uniche ammesse."
      >
        <ActiveFile s={s} next="Tra poco il fascicolo arriva qui, pronto da timbrare." />
      </GuestStage>
    );
  if (s.phase === 'voting')
    return onStage ? (
      <GuestStage
        tag="Timbratura in corso"
        title="Il Congresso sta timbrando il tuo fascicolo."
        flavor="Nessun indizio sui timbri: lo scoprirai al verdetto. Respira."
      />
    ) : (
      <>
        {toastEl}
        <GuestStage
          tag="Fascicolo consegnato"
          title="Timbri consegnati."
          flavor={blocker ?? 'Ora tocca agli altri. Aspetta che la regia chiuda il turno.'}
        >
          <ActiveFile s={s} next="Prima del verdetto potrai rivedere tutti i tuoi timbri." />
          {!blocker && (
            <button type="button" className="text-button stage-reopen" onClick={() => r && setReopen(r.id)}>
              Ho cambiato idea: riapri il fascicolo
            </button>
          )}
        </GuestStage>
      </>
    );
  return (
    <>
      {toastEl}
      <GuestStage
        tag="Fascicolo archiviato"
        title="Prossimo fascicolo in arrivo."
        flavor="Non serve aggiornare la pagina: lo fa da sola. Non chiederci come fa a sapere quando."
      >
        <p className="stage-next">Quando il prossimo relatore sale sul palco, qui comparirà il suo fascicolo.</p>
      </GuestStage>
    </>
  );
}
/** Shown in the GM view when the GM also has a name: their ballot, or their presenter controls. */
function GmOwnTurn({
  s,
  actor,
  busy,
  perform,
}: {
  s: State;
  actor: Actor;
  busy: boolean;
  perform: (a: Action) => Promise<boolean>;
}) {
  const r = activeRound(s),
    me = s.participants.find((p) => p.id === actor.participantId)!;
  if (s.phase === 'voting' && r && !voteBlocker(s, me.id))
    return (
      <section className="panel gm-own-turn">
        <StampBallot key={r.id} s={s} actor={actor} busy={busy} perform={perform} />
      </section>
    );
  if (s.phase === 'review')
    return (
      <section className="panel gm-own-turn">
        <ReviewBoard s={s} actor={actor} busy={busy} perform={perform} />
      </section>
    );
  if (s.phase === 'presenting' && r?.presenterId === me.id)
    return (
      <section className="panel gm-own-turn">
        <p className="eyebrow">STAI PRESENTANDO TU, {displayName(me).toUpperCase()}</p>
        <SlideRemote actor={actor} />
      </section>
    );
  return null;
}
/** The projector: one slide per moment of the evening, read from afar, never scrolling. */
function Projector({ s }: { s: State }) {
  // A new key per moment: the slide remounts and plays its entrance (and its spotlights, stamps, confetti).
  const k = [s.phase, s.activeRoundId ?? '', s.rounds.length, s.phase === 'results' ? s.revealed : ''].join(':');
  return <ProjectorSlide key={k} s={s} />;
}
function ProjectorSlide({ s }: { s: State }) {
  const p = presenter(s),
    held = s.rounds.filter((r) => !r.cancelled),
    fasc = 'FASC. ' + String(Math.max(held.length, 1)).padStart(3, '0'),
    last = [...held].reverse().find((r) => r.closed),
    lastP = last && s.participants.find((x) => x.id === last.presenterId);
  const top = (
    <div className="projector-top">
      <span className="mono">SERATA COMPLOTTI / 1° CONGRESSO DEI RICERCATORI INDIPENDENTI</span>
      <button
        className="icon-button"
        aria-label="Schermo intero"
        onClick={() => void document.documentElement.requestFullscreen().catch(() => {})}
      >
        <Maximize size={20} />
      </button>
    </div>
  );
  if (s.phase === 'results') return <RevealSlide s={s} top={top} />;
  if (s.phase === 'review') return <ReviewSlide s={s} top={top} />;
  if (s.phase === 'voting') return <VotingSlide s={s} top={top} />;
  // A presenter on stage: the lines follow how the host announces them.
  if (p && (s.phase === 'presenting' || s.phase === 'questions')) {
    const slide =
      s.phase === 'presenting'
        ? {
            code: 'PRESENTAZIONE',
            kicker: 'Presenta il fascicolo',
            sub: null,
            foot:
              p.mode === 'paper'
                ? 'Presentazione dal vivo. Guardate il ricercatore, non lo schermo: lo schermo vi guarda già.'
                : 'Le slide vanno in onda tra un attimo. Se non partono, sono stati loro.',
          }
        : {
            code: 'QUESTION TIME',
            kicker: 'Il pubblico interroga',
            sub: 'Fatevi delle domande. Poi fatele ad alta voce.',
            foot: 'Alzate la mano. Le domande scomode sono le uniche ammesse.',
          };
    return (
      <div className={'projector pj-stage pj-' + s.phase}>
        {top}
        <Head left={fasc} right={slide.code} />
        <Kicker>{slide.kicker}</Kicker>
        <OnStage p={p} />
        {slide.sub && <p className="pj-sub">{slide.sub}</p>}
        <p className="pj-foot">{slide.foot}</p>
        <Rule />
      </div>
    );
  }
  // Between two talks.
  if (held.length > 0)
    return (
      <div className="projector pj-break">
        {top}
        <Head left={fasc} right="ARCHIVIATO" large />
        <Kicker>Fascicolo archiviato</Kicker>
        <h1 className="pj-title">Nessuno saprà mai niente.</h1>
        <Rule />
        <p className="pj-sub">Sgranchitevi le gambe, ma non allontanatevi troppo: vi teniamo d’occhio.</p>
        <p className="pj-foot">
          {lastP ? 'Ultimo relatore: ' + displayName(lastP) + ' · ' : ''}Fascicoli discussi:{' '}
          {held.filter((r) => r.closed).length}
        </p>
      </div>
    );
  // Before the first talk.
  return (
    <div className="projector pj-open">
      {top}
      <Stamp sub="Non divulgare">Top secret</Stamp>
      <Head left="ACCOGLIENZA" right="RISERVATO" large />
      <Kicker>1° Congresso dei ricercatori indipendenti</Kicker>
      <h1 className="pj-title">
        Siccome non cielo dicono,
        <br />
        cielo diciamo noi.
      </h1>
      <Rule />
      <p className="pj-sub">
        Benvenuti cari ricercatori,
        <br />
        il congresso sta per cominciare.
      </p>
      <p className="pj-aside">Tenete i telefoni accesi: vi serviranno. Tanto vi ascoltano lo stesso.</p>
      <p className="pj-foot">Tranquilli: il Palacomplotti è stato bonificato da cima a fondo. Niente cimici, forse.</p>
    </div>
  );
}
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button autoFocus className="modal-close icon-button" aria-label="Chiudi" onClick={onClose}>
          <X size={20} />
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
function Editor({
  participant,
  busy,
  onClose,
  onSave,
}: {
  participant: Participant;
  busy: boolean;
  onClose: () => void;
  onSave: (p: Participant) => void;
}) {
  const [p, setP] = useState(participant);
  return (
    <Modal title="Il fascicolo personale" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(p);
        }}
      >
        <label>
          Nome
          <input required value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </label>
        <label>
          Titolo da ricercatore
          <input value={p.role} onChange={(e) => setP({ ...p, role: e.target.value })} />
        </label>
        <label>
          Come presenta
          <select
            value={p.mode ?? ''}
            onChange={(e) => setP({ ...p, mode: (e.target.value || null) as Participant['mode'] })}
          >
            <option value="">Non ancora deciso</option>
            {modes.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {p.mode === 'slides' && (
          <label>
            Link Google Slides
            <input type="url" value={p.deckUrl} onChange={(e) => setP({ ...p, deckUrl: e.target.value })} />
          </label>
        )}
        <label>
          Accompagnatore
          <select
            value={p.partner ?? ''}
            onChange={(e) => {
              const partner = (e.target.value || null) as Participant['partner'];
              setP({ ...p, partner, plusOne: partner !== null });
            }}
          >
            <option value="">Viene da solo</option>
            <option value="witness">Porta un testimone</option>
            <option value="copresenter">Presenta con un co-relatore</option>
          </select>
        </label>
        {p.partner && (
          <label>
            {p.partner === 'copresenter' ? 'Nome del co-relatore' : 'Nome del testimone'}
            <input value={p.partnerName ?? ''} onChange={(e) => setP({ ...p, partnerName: e.target.value })} />
          </label>
        )}
        <Button type="submit" disabled={busy}>
          Salva fascicolo
          <Check size={17} />
        </Button>
      </form>
    </Modal>
  );
}
const previewId = new URLSearchParams(location.search).get('anteprima');
createRoot(document.getElementById('root')!).render(previewId ? <PreviewPage id={previewId} /> : <App />);

/** One screen of the evening, rendered by the real components with invented data (inside the regia's previews). */
function PreviewPage({ id }: { id: string }) {
  const [mock, setMock] = useState<Mock>(() => readMock(location.hash));
  useEffect(() => {
    const on = () => setMock(readMock(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const screenDef = previewScreens.find((p) => p.id === id);
  if (!screenDef) return <p className="board-empty">Anteprima sconosciuta.</p>;
  const { s, actor } = mockState(id, mock);
  // Previews accept taps but send nothing anywhere.
  const perform = async () => true;
  const projector = screenDef.kind === 'projector';
  return (
    <div className={projector ? 'app screen-mode preview-app' : 'app preview-app'}>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            {projector ? 'Sala proiezione' : '1° Congresso'} <ChevronRight size={13} />{' '}
            <strong>{projector ? 'Schermo' : s.participants.find((p) => p.id === actor.participantId)?.name}</strong>
          </span>
          <div className="top-actions">
            <span className="connection">
              <i className="dot" />
              Collegato
            </span>
          </div>
        </header>
        <main className={projector ? 'content' : 'content guest-content'}>
          {projector ? (
            <Projector s={s} />
          ) : (
            // Only the ballot reacts to taps; everything else is look-only (the remote would send real commands).
            <div inert={!['g-voto', 'g-votato', 'g-revisione'].includes(id)}>
              <Guest key={id + JSON.stringify(mock)} s={s} actor={actor} busy={false} perform={perform} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/** A real-size page scaled down to the card's width. */
function Scaled({ src, w, h, title }: { src: string; w: number; h: number; title: string }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null),
    [k, setK] = useState(0.3);
  useEffect(() => {
    if (!box) return;
    const ro = new ResizeObserver(() => setK(box.clientWidth / w));
    ro.observe(box);
    return () => ro.disconnect();
  }, [box, w]);
  return (
    <div className="scaled" ref={setBox} style={{ height: h * k }}>
      <iframe title={title} src={src} width={w} height={h} style={{ transform: `scale(${k})` }} />
    </div>
  );
}

/** Regia tab: every screen that appears only at precise moments, fed with editable invented data. */
function Previews() {
  const [mock, setMock] = useState<Mock>(defaultMock),
    [kind, setKind] = useState<PreviewScreen['kind']>('projector');
  const base = location.origin + location.pathname + '?anteprima=';
  const set = (patch: Partial<Mock>) => setMock({ ...mock, ...patch });
  const shown = previewScreens.filter((p) => p.kind === kind);
  return (
    <>
      <section className="panel preview-mock">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Dati finti</p>
            <h2>Chi presenta, chi guarda</h2>
          </div>
          <span className="mock-actions">
            <button className="text-button" onClick={() => setMock({ ...mock, ...edgeMock })}>
              Prova i casi limite
            </button>
            <button className="text-button" onClick={() => setMock(defaultMock)}>
              Ripristina
            </button>
          </span>
        </div>
        <div className="mock-grid">
          <label>
            Nome del relatore
            <input value={mock.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label>
            Co-relatore (facoltativo)
            <input value={mock.partnerName} onChange={(e) => set({ partnerName: e.target.value })} />
          </label>
          <label className="wide">
            Qualifica
            <input value={mock.role} onChange={(e) => set({ role: e.target.value })} />
          </label>
          <label>
            Modalità
            <select value={mock.mode} onChange={(e) => set({ mode: e.target.value as Mock['mode'] })}>
              <option value="slides">Con tecnologia</option>
              <option value="paper">Senza tecnologia</option>
            </select>
          </label>
          <label>
            Chi guarda dal telefono
            <input value={mock.viewer} onChange={(e) => set({ viewer: e.target.value })} />
          </label>
          <label>
            Premio da vedere nel verdetto
            <select value={mock.award} onChange={(e) => set({ award: Number(e.target.value) })}>
              {[
                'La Ventosa d’Oro',
                'Il Pifferaio Magico',
                'Il Faldone d’Oro',
                'Premio Illuminato',
                'Il Cappello di Stagnola d’Oro',
              ].map((name, i) => (
                <option key={name} value={i + 1}>
                  {i + 1}. {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="footnote">
          Nessun dato reale, niente viene salvato. Le schermate sono quelle vere della serata: se le cambiamo qui,
          cambiano anche lì.
        </p>
      </section>
      <div className="board-tabs preview-tabs" role="tablist" aria-label="Quali schermate">
        {(
          [
            ['projector', 'Proiettore'],
            ['phone', 'Telefoni in sala'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            className={kind === k ? 'on' : ''}
            onClick={() => setKind(k)}
          >
            {label} <span>{previewScreens.filter((p) => p.kind === k).length}</span>
          </button>
        ))}
      </div>
      <div className={'preview-grid ' + kind}>
        {shown.map((p) => {
          const src = base + p.id + mockHash(mock);
          return (
            <figure className="preview-card" key={p.id}>
              <figcaption>
                <strong>{p.label}</strong>
                <span>{p.note}</span>
                <a className="text-button" href={src} target="_blank" rel="noreferrer">
                  Apri a tutta pagina <ArrowUpRight size={14} />
                </a>
              </figcaption>
              <Scaled
                src={src}
                title={p.label}
                w={p.kind === 'projector' ? 1920 : 390}
                h={p.kind === 'projector' ? 1080 : 844}
              />
            </figure>
          );
        })}
      </div>
    </>
  );
}
