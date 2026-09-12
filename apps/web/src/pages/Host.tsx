import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  ExternalLink,
  Pause,
  Play,
  RotateCcw,
  Search,
  Users,
  Volume2,
  VolumeX,
  X,
  ArrowRight,
  Radio,
} from "lucide-react";
import type { HostState, Side, Team } from "@naija/contracts";
import { audience, currentQuestion } from "@naija/game";
import { useGame } from "../hooks/useGame";
import { Board } from "../components/Board";
import { Layout } from "../components/Layout";
import { TeamEditor } from "../components/TeamEditor";
import { FastControls } from "../components/FastControls";
import { BuzzerControls } from "../components/BuzzerControls";
import { CastControls } from "../components/CastControls";
export function Host({ id }: { id: string }) {
  const { state: s, connected, error, busy, send, clockOffset } = useGame<HostState>(id, "host");
  const [search, setSearch] = useState(""),
    [share, setShare] = useState(false),
    [copied, setCopied] = useState(false),
    [rosters, setRosters] = useState<[Team, Team] | null>(null),
    [sound, setSound] = useState(false),
    [players, setPlayers] = useState<[number, number]>([0, 1]);
  const audio = useRef<AudioContext | null>(null),
    previous = useRef(0);
  useEffect(() => setSearch(""), [s?.round]);
  useEffect(() => {
    if (!s) return;
    if (previous.current && s.revision > previous.current && sound && audio.current) {
      const o = audio.current.createOscillator(),
        g = audio.current.createGain();
      o.connect(g);
      g.connect(audio.current.destination);
      o.frequency.value = s.message.startsWith("Strike") ? 150 : 660;
      g.gain.setValueAtTime(0.035, audio.current.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.current.currentTime + 0.25);
      o.start();
      o.stop(audio.current.currentTime + 0.25);
    }
    previous.current = s.revision;
  }, [s, sound]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(e.target.tagName)
      )
        return;
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.repeat ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;
      if (e.key === "Escape") setShare(false);
      if (share || rosters) return;
      if (
        s &&
        !s.paused &&
        !busy &&
        /^[1-8]$/.test(e.key) &&
        ["faceoff", "play", "steal"].includes(s.phase)
      ) {
        const answer = currentQuestion(s).answers[Number(e.key) - 1];
        if (
          answer &&
          (s.phase === "faceoff" ? s.face.first !== null : !s.revealed.includes(answer.id))
        ) {
          e.preventDefault();
          void send({ type: "answer", answerId: answer.id });
        }
      }
      if (e.key === "x" && s && ["play", "steal", "faceoff"].includes(s.phase))
        void send({ type: "miss" });
      if (e.key === "u") void send({ type: "undo" });
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [send, s, share, rosters, busy]);
  if (!s)
    return (
      <Layout>
        <main className="page">
          <h1>Opening the host desk…</h1>
          {error && <p role="alert">{error}</p>}
        </main>
      </Layout>
    );
  const q = currentQuestion(s),
    url = location.origin + "/audience/" + id;
  const judging = ["faceoff", "play", "steal"].includes(s.phase);
  const active: Side =
    s.phase === "steal"
      ? s.control === 0
        ? 1
        : 0
      : s.phase === "faceoff"
        ? s.face.current
        : s.control;
  const toggleSound = () => {
    if (!sound) {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    }
    setSound(!sound);
  };
  return (
    <Layout>
      <main className="page host-page">
        <div className="host-heading">
          <div>
            <div className="eyebrow">LIVE GAME · {id}</div>
            <h1>You're running the show.</h1>
            <p>Keep the energy up. We've got the scoreboard.</p>
          </div>
          <button className="button primary" onClick={() => setShare(true)}>
            <ExternalLink size={16} />
            Audience screen
          </button>
        </div>
        <CastControls id={id} />
        <div className="game-toolbar">
          <span className={"connection " + (connected ? "online" : "offline")}>
            <Radio size={13} />
            {connected ? "Connected live" : "Reconnecting…"}
          </span>
          <span className="pill">{s.round >= 4 ? "Sudden death" : "Round " + (s.round + 1)}</span>
          <span className="phase-label">{s.phase.replace("faceoff", "Face-off")}</span>
          <div className="host-score-strip">
            {s.teams.map((t, i) => (
              <span key={i}>
                {t.name}
                <b>{s.scores[i]}</b>
              </span>
            ))}
            <span>
              Bank<b>{s.bank}</b>
            </span>
            <span aria-label={`${s.strikes} strikes`}>
              Strikes<b>{s.strikes} / 3</b>
            </span>
          </div>
          <div className="toolbar-actions">
            <button
              className="icon-button"
              aria-label={sound ? "Mute sounds" : "Enable sounds"}
              onClick={toggleSound}
            >
              {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <button
              className="button small"
              disabled={busy}
              onClick={() => send({ type: "pause" })}
            >
              {s.paused ? <Play size={14} /> : <Pause size={14} />} {s.paused ? "Resume" : "Pause"}
            </button>
            <button
              className="button small"
              disabled={busy || !s.canUndo}
              onClick={() => send({ type: "undo" })}
            >
              <RotateCcw size={14} />
              Undo
            </button>
          </div>
        </div>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <div className="host-grid">
          <div className="board-column">
            <div className="live-message" aria-live="polite">
              <span className="status-dot" />
              {s.message}
            </div>
            {s.fast ? (
              <FastControls
                state={s}
                send={send}
                busy={busy || s.paused || !connected}
                clockOffset={clockOffset}
              />
            ) : (
              <section className="answer-controls">
                <div className="host-question">
                  <span className="section-eyebrow">
                    PRIVATE QUESTION · {q.category} · {s.rules.multipliers[s.round] ?? 3}× POINTS
                  </span>
                  <h2>{q.prompt}</h2>
                  {(s.minimumRounds ?? 1) > s.round + 1 && (
                    <p className="host-note">
                      {s.minimumRounds! - s.round - 1} required round(s) remain after this board.
                    </p>
                  )}
                </div>
                <div className="section-title">
                  <div>
                    <span className="section-eyebrow">FOR YOUR EYES ONLY</span>
                    <h3>
                      The answers <small>Keys 1–{q.answers.length}</small>
                    </h3>
                  </div>
                  <div className="search-box">
                    <Search size={16} />
                    <input
                      aria-label="Find an answer or alias"
                      placeholder="Find an answer or alias…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <p className="host-note">{q.hostNotes}</p>
                <div className="host-answer-grid">
                  {q.answers
                    .filter((a) =>
                      [a.text, ...a.acceptedAlternatives]
                        .join(" ")
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((a) => (
                      <button
                        className={"host-answer " + (s.revealed.includes(a.id) ? "already" : "")}
                        key={a.id}
                        disabled={
                          busy ||
                          s.paused ||
                          !judging ||
                          (s.phase !== "faceoff" && s.revealed.includes(a.id)) ||
                          (s.phase === "faceoff" && s.face.first === null)
                        }
                        onClick={() => send({ type: "answer", answerId: a.id })}
                      >
                        <span className="host-rank">{q.answers.indexOf(a) + 1}</span>
                        <div>
                          <strong>{a.text}</strong>
                          <small>
                            {a.acceptedAlternatives.length
                              ? a.acceptedAlternatives.join(" · ")
                              : "Accept equivalent meanings"}
                          </small>
                        </div>
                        <b>{a.points}</b>
                      </button>
                    ))}
                </div>
              </section>
            )}
            <details className="audience-preview">
              <summary>
                <MonitorIcon /> Audience preview · expand when needed
              </summary>
              <p className="host-note">Only revealed answers appear here.</p>
              <Board state={audience(s)} compact />
            </details>
          </div>
          <aside className="control-column">
            {s.phase === "fast" ? (
              <section className="answer-controls fast-reference">
                <div className="section-eyebrow">PRIVATE FAST MONEY REFERENCE</div>
                <h2>Your five questions</h2>
                {s.fastQuestions.map((question) => (
                  <details key={question.id}>
                    <summary>{question.prompt}</summary>
                    <p>{question.answers.map((a) => a.text + " · " + a.points).join(" / ")}</p>
                  </details>
                ))}
              </section>
            ) : (
              <section className="control-card">
                <div className="section-eyebrow">NEXT UP</div>
                <h3>
                  {s.phase === "champion" || s.phase === "finished"
                    ? "Your champions"
                    : s.teams[active].name}
                </h3>
                {judging && (
                  <div className="active-player">
                    <span>
                      {
                        s.teams[active].members[
                          s.phase === "steal" ? s.teams[active].captain : s.turns[active]
                        ]
                      }
                    </span>
                    <small>{s.phase === "steal" ? "TEAM CAPTAIN" : "AT THE MIC"}</small>
                  </div>
                )}
                {s.phase === "faceoff" && s.face.first === null && (
                  <>
                    <p>Open the phone buzzers below, or select a team manually.</p>
                    <details className="manual-buzz">
                      <summary>Manual buzzer fallback</summary>
                      {s.teams.map((t, i) => (
                        <button
                          className="button wide"
                          key={i}
                          disabled={busy || s.paused}
                          onClick={() => send({ type: "buzz", team: i as Side })}
                        >
                          {t.name}
                          <ArrowRight size={15} />
                        </button>
                      ))}
                    </details>
                  </>
                )}
                {s.phase === "choice" && (
                  <>
                    <p>Will they play the board or pass?</p>
                    <button
                      className="button primary wide"
                      disabled={busy || s.paused}
                      onClick={() => send({ type: "choice", pass: false })}
                    >
                      Play the board
                    </button>
                    <button
                      className="button wide"
                      disabled={busy || s.paused}
                      onClick={() => send({ type: "choice", pass: true })}
                    >
                      Pass to the other team
                    </button>
                  </>
                )}
                {judging && !(s.phase === "faceoff" && s.face.first === null) && (
                  <>
                    <p>
                      {s.phase === "steal"
                        ? "One final guess. Select a hidden answer, or mark the steal unsuccessful."
                        : "Select a matching answer on the left. Ask for clarification if needed."}
                    </p>
                    <button
                      className="button danger-button wide"
                      disabled={busy || s.paused}
                      onClick={() => send({ type: "miss" })}
                    >
                      <X size={18} />
                      {s.phase === "steal"
                        ? "Steal unsuccessful"
                        : s.phase === "faceoff"
                          ? "No matching answer"
                          : "Add a strike"}
                      <kbd>X</kbd>
                    </button>
                  </>
                )}
                {s.phase === "settled" && (
                  <>
                    <p>{s.message}</p>
                    <button
                      className="button wide"
                      disabled={busy || s.paused || s.showAll}
                      onClick={() => send({ type: "showAll" })}
                    >
                      Reveal the remaining answers
                    </button>
                    <button
                      className="button primary wide"
                      disabled={busy || s.paused}
                      onClick={() => send({ type: "next" })}
                    >
                      {s.winner !== null ? "Meet the champions" : "Next round"}
                      <ArrowRight size={16} />
                    </button>
                  </>
                )}
                {s.phase === "champion" && (
                  <>
                    <p>{s.teams[s.winner!].name} won. Pick two members for Fast Money.</p>
                    {[0, 1].map((i) => (
                      <label key={i}>
                        Player {i + 1}
                        <select
                          value={players[i]}
                          onChange={(e) =>
                            setPlayers((p) =>
                              i === 0
                                ? [Number(e.target.value), p[1]]
                                : [p[0], Number(e.target.value)],
                            )
                          }
                        >
                          {s.teams[s.winner!].members.map((m, n) => (
                            <option key={n} value={n}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <button
                      className="button primary wide"
                      disabled={
                        busy ||
                        s.paused ||
                        s.teams[s.winner!].members.length < 2 ||
                        players[0] === players[1]
                      }
                      onClick={() => send({ type: "fastStart", players })}
                    >
                      Start Fast Money
                    </button>
                    <button className="text-button" onClick={() => send({ type: "finish" })}>
                      Skip bonus & finish
                    </button>
                  </>
                )}
                {s.phase === "finished" && (
                  <a className="button primary wide" href="/">
                    Set up another game
                  </a>
                )}
              </section>
            )}
            <BuzzerControls state={s} />
            <details className="control-card roster-summary">
              <summary>Team lineup & roster changes</summary>
              <div className="section-title">
                <h3>The lineup</h3>
                <button
                  className="icon-button"
                  aria-label="Edit team rosters"
                  disabled={["fast", "finished"].includes(s.phase)}
                  onClick={() => setRosters(structuredClone(s.teams))}
                >
                  <Users size={17} />
                </button>
              </div>
              {s.teams.map((t, i) => (
                <div key={i}>
                  <h4>
                    <span className={"team-dot team-" + i} />
                    {t.name}
                    <b>{s.scores[i]}</b>
                  </h4>
                  {t.members.map((m, n) => (
                    <button
                      key={n}
                      className={"lineup-member " + (s.turns[i] === n ? "current" : "")}
                      disabled={s.phase !== "play" || s.control !== i || busy || s.paused}
                      onClick={() => send({ type: "turn", member: n })}
                    >
                      <span>{String(n + 1).padStart(2, "0")}</span>
                      {m}
                      {t.captain === n && <small>C</small>}
                    </button>
                  ))}
                </div>
              ))}
            </details>
            <details className="history">
              <summary>Recent host actions</summary>
              {s.history.map((h, i) => (
                <p key={i}>{h}</p>
              ))}
            </details>
          </aside>
        </div>
        {share && (
          <div className="modal-backdrop" onClick={() => setShare(false)}>
            <section
              className="modal share-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Audience screen"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close icon-button"
                aria-label="Close"
                onClick={() => setShare(false)}
              >
                <X />
              </button>
              <div className="section-eyebrow">EVERYONE'S INVITED</div>
              <h2>Put the game on the big screen.</h2>
              <p>Scan to join this game's audience. Viewing only.</p>
              <div className="qr">
                <QRCodeSVG value={url} size={190} level="M" marginSize={3} />
              </div>
              <div className="room-code">{id}</div>
              <p>Or enter this room code on the Join screen.</p>
              <div className="button-row">
                <button
                  className="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(url)
                      .then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      })
                      .catch(() => setCopied(false));
                  }}
                >
                  <Copy size={15} />
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <a className="button primary" href={url} target="_blank" rel="noreferrer">
                  Open audience
                  <ExternalLink size={15} />
                </a>
              </div>
              <input
                aria-label="Audience link"
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
              />
              {["localhost", "127.0.0.1"].includes(location.hostname) && (
                <p className="muted">
                  For phone scanning, open the host desk using the server's network address or
                  deployed subdomain first. A localhost link works only on this computer.
                </p>
              )}
            </section>
          </div>
        )}
        {rosters && (
          <div className="modal-backdrop">
            <section
              className="modal roster-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Edit rosters"
            >
              <h2>Edit the lineup</h2>
              <p>
                Removing an active member moves their turn to the nearest remaining slot. Previous
                actions stay in history.
              </p>
              <div className="team-editors">
                {rosters.map((t, i) => (
                  <TeamEditor
                    key={i}
                    team={t}
                    index={i}
                    onChange={(v) => setRosters((old) => (i === 0 ? [v, old![1]] : [old![0], v]))}
                  />
                ))}
              </div>
              <div className="button-row">
                <button className="button" onClick={() => setRosters(null)}>
                  Cancel
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    void send({ type: "roster", teams: rosters });
                    setRosters(null);
                  }}
                >
                  Save lineup
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    </Layout>
  );
}
function MonitorIcon() {
  return <span aria-hidden="true">▣</span>;
}
