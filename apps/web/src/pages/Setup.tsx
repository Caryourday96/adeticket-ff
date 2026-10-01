import { useEffect, useState } from "react";
import {
  eligibleQuestions,
  questionKey,
  questionUseCounts,
  type QuestionUse,
  type Bank,
  type Team,
} from "@naija/contracts";
import { ArrowRight, Monitor, Users, Layers, Play, Shuffle } from "lucide-react";
import { api } from "../lib/api";
import { Layout } from "../components/Layout";
import { TeamEditor } from "../components/TeamEditor";
import { commandId } from "../lib/commandId";
import { gameOrigin } from "../lib/links";
export function Setup() {
  const [sharedQuestionBank, setSharedQuestionBank] = useState(false);
  const [excludeAfterUses, setExcludeAfterUses] = useState<number | undefined>();
  const [usage, setUsage] = useState<QuestionUse[]>([]);
  const [usageReady, setUsageReady] = useState(false);
  const [selfJoin, setSelfJoin] = useState(true);
  const [fastPackId, setFastPackId] = useState("fast-starter");
  const [fastIds, setFastIds] = useState<string[] | null>(null);
  const [teams, setTeams] = useState<[Team, Team]>([
    { name: "The Jollof Squad", members: ["Ada", "Chidi", "Tobi"], captain: 0 },
    { name: "The Suya Crew", members: ["Zainab", "Emeka", "Femi"], captain: 0 },
  ]);
  const [packs, setPacks] = useState<{ id: string; bank: Bank }[]>([]),
    [packId, setPackId] = useState("starter"),
    [games, setGames] = useState<
      {
        id: string;
        teams: string[];
        phase: string;
        round: number;
        revision: number;
        rehearsal: boolean;
      }[]
    >([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [shuffle, setShuffle] = useState(true),
    [steal, setSteal] = useState(true),
    [target, setTarget] = useState(300);
  const [showAllGames, setShowAllGames] = useState(false);
  const [gameFilter, setGameFilter] = useState("all");
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [cleanupMessage, setCleanupMessage] = useState("");
  const filteredGames = games.filter(
    (g) =>
      gameFilter === "all" ||
      (gameFilter === "live"
        ? !g.rehearsal && g.phase !== "finished"
        : gameFilter === "ended"
          ? g.phase === "finished"
          : g.rehearsal),
  );
  const visibleGames = showAllGames ? filteredGames : filteredGames.slice(0, 6);
  async function deleteSelectedGames() {
    const chosen = games.filter((g) => selectedGames.includes(g.id) && g.phase === "finished");
    if (
      !chosen.length ||
      !window.confirm(
        `Permanently delete these ${chosen.length} ended games?\n${chosen.map((g) => `${g.id}: ${g.teams.join(" vs ")}`).join("\n")}\nScores, history and phone registrations will be removed. This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setCleanupMessage("");
    let deleted = 0;
    const failures: string[] = [];
    try {
      for (const game of chosen) {
        try {
          await api(`/games/${game.id}/delete`, { revision: game.revision, endedOnly: true });
          deleted++;
        } catch (e) {
          failures.push(`${game.id}: ${(e as Error).message}`);
        }
      }
      setCleanupMessage(`${deleted} ended game${deleted === 1 ? "" : "s"} deleted.`);
      setSelectedGames([]);
      if (failures.length) setError(failures.join(" · "));
      setGames(await api<typeof games>("/games"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function rehearse(scenario: "round" | "fast", useSelection = false) {
    setBusy(true);
    setError("");
    try {
      const game = await api<{ id: string }>("/rehearsals", {
        scenario,
        ...(useSelection
          ? {
              packId: sharedQuestionBank ? packId : fastPackId,
              questionIds: fastPool.filter((q) => chosenFastIds.includes(q.id)).map((q) => q.id),
            }
          : {}),
      });
      location.href = "/host/" + game.id;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function manage(game: (typeof games)[number], action: "end" | "delete") {
    const name = game.teams.join(" vs ") + " (" + game.id + ")";
    if (
      !window.confirm(
        action === "delete"
          ? `Permanently delete ${name}? Saved scores, history and phone registrations will be removed. This cannot be undone.`
          : `End ${name}? Scores will be saved and any running timer stopped. Unfinished round points will not be awarded.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (action === "delete") await api(`/games/${game.id}/delete`, { revision: game.revision });
      else
        await api(`/games/${game.id}/commands`, {
          id: commandId(),
          revision: game.revision,
          command: { type: "endGame" },
        });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      try {
        setGames(await api<typeof games>("/games"));
      } catch (e) {
        setError((e as Error).message);
      }
      setBusy(false);
    }
  }
  const [required, setRequired] = useState<Record<string, number>>({});
  const selectedPack = packs.find((p) => p.id === packId)?.bank;
  const selectedFastPack = sharedQuestionBank
    ? selectedPack
    : packs.find((p) => p.id === fastPackId)?.bank;
  const regularPool = eligibleQuestions(selectedPack?.questions ?? [], usage, excludeAfterUses);
  const fastPool = eligibleQuestions(selectedFastPack?.questions ?? [], usage, excludeAfterUses);
  const chosenFastIds =
    fastIds?.filter((id) => fastPool.some((q) => q.id === id)) ??
    fastPool.slice(0, 5).map((q) => q.id);
  const reservedPrompts = new Set(
    fastPool.filter((q) => chosenFastIds.includes(q.id)).map((q) => questionKey(q.prompt)),
  );
  const regularQuestions = regularPool.filter(
    (q) => !sharedQuestionBank || !reservedPrompts.has(questionKey(q.prompt)),
  );
  const useCounts = questionUseCounts(usage);
  const excludedQuestions = (selectedPack?.questions ?? []).filter(
    (q) =>
      excludeAfterUses !== undefined &&
      (useCounts.get(questionKey(q.prompt)) ?? 0) >= excludeAfterUses,
  );
  const excludedFastQuestions = (selectedFastPack?.questions ?? []).filter(
    (q) =>
      excludeAfterUses !== undefined &&
      (useCounts.get(questionKey(q.prompt)) ?? 0) >= excludeAfterUses,
  );
  const attainable = fastPool
    .filter((q) => chosenFastIds.includes(q.id))
    .reduce((sum, q) => sum + q.answers[0].points + q.answers[1].points, 0);
  const selectionError = Object.entries(required).some(
    ([category, count]) => count > regularQuestions.filter((q) => q.category === category).length,
  )
    ? "A required group has too few remaining questions. Reduce its quota or change the selection."
    : excludeAfterUses !== undefined &&
        (!Number.isInteger(excludeAfterUses) || excludeAfterUses < 1 || excludeAfterUses > 1000)
      ? "Use a whole-number limit from 1 to 1000, or leave blank."
      : chosenFastIds.length !== 5
        ? "Choose exactly five eligible Fast Money questions."
        : attainable < 200
          ? "These Fast Money questions cannot reach 200 with distinct answers. Choose another set."
          : regularQuestions.length < 5
            ? "At least five regular questions must remain after reserving Fast Money and applying the usage limit."
            : "";
  function rotateFastQuestions() {
    const candidates = [...fastPool];
    for (let attempt = 0; attempt < 50; attempt++) {
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      const picked = candidates.slice(0, 5);
      if (
        picked.length === 5 &&
        picked.reduce((sum, q) => sum + q.answers[0].points + q.answers[1].points, 0) >= 200 &&
        picked.some((q) => !chosenFastIds.includes(q.id))
      ) {
        setFastIds(picked.map((q) => q.id));
        setRequired({});
        setError("");
        return;
      }
    }
    candidates.sort(
      (a, b) =>
        b.answers[0].points + b.answers[1].points - (a.answers[0].points + a.answers[1].points),
    );
    const picked = candidates.slice(0, 5);
    if (
      picked.length !== 5 ||
      picked.reduce((sum, q) => sum + q.answers[0].points + q.answers[1].points, 0) < 200
    )
      setError(
        "Not enough eligible answers for a valid Fast Money set. Change the bank or usage limit.",
      );
    else {
      setFastIds(picked.map((q) => q.id));
      setError("");
    }
  }
  const categories = [...new Set(selectedPack?.questions.map((q) => q.category) ?? [])];
  const requiredTotal = Object.values(required).reduce((n, v) => n + v, 0);
  useEffect(() => {
    Promise.all([
      api<typeof packs>("/packs"),
      api<typeof games>("/games"),
      api<QuestionUse[]>("/question-usage"),
    ])
      .then(([p, g, u]) => {
        setUsage(u);
        setUsageReady(true);
        setPacks(p);
        setGames(g);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function start() {
    setBusy(true);
    setError("");
    try {
      if (selectionError) throw new Error(selectionError);
      const ids = regularQuestions.map((q) => q.id);
      if (shuffle)
        for (let i = ids.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [ids[i], ids[j]] = [ids[j], ids[i]];
        }
      const result = await api<{ id: string }>("/games", {
        teams: selfJoin
          ? teams.map((t) => ({
              ...t,
              members: ["Waiting for players"],
              captain: 0,
              awaitingPlayers: true,
            }))
          : teams,
        packId,
        fastPackId,
        sharedQuestionBank,
        excludeAfterUses,
        fastQuestionIds: fastPool.filter((q) => chosenFastIds.includes(q.id)).map((q) => q.id),
        requiredGroups: Object.entries(required)
          .filter(([, count]) => count > 0)
          .map(([category, count]) => ({ category, count })),
        questionIds: ids,
        rules: { target, multipliers: [1, 1, 2, 3], includeStealAnswer: steal },
      });
      location.href = "/host/" + result.id;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Layout>
      <main className="page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">GOOD PEOPLE. GREAT GAME NIGHT.</div>
            <h1>
              Bring the family.
              <br />
              <em>Bring the heat.</em>
            </h1>
            <p>Two teams. A board full of answers. One very loud winner.</p>
          </div>
          <div className="setup-art" aria-hidden="true">
            <div className="art-ring" />
            <div className="art-card">
              <span>THE BOARD IS YOURS</span>
              <strong>
                LET'S
                <br />
                PLAY.
              </strong>
              <div className="art-slots">
                <i>1</i>
                <i>2</i>
                <i>3</i>
              </div>
            </div>
            <span className="art-spark">✦</span>
          </div>
        </div>
        <div className="steps-strip">
          <span>
            <Users size={17} />
            <b>01</b> Name your teams
          </span>
          <span>
            <Layers size={17} />
            <b>02</b> Pick your questions
          </span>
          <span>
            <Monitor size={17} />
            <b>03</b> Open the big screen
          </span>
        </div>
        <section className="rehearsal-panel" aria-label="Start a rehearsal">
          <div className="eyebrow">FIRST TIME HOSTING?</div>
          <h2>Try a rehearsal.</h2>
          <p>
            Practice with ready-made teams and simulated contestants. Use the real host controls
            with a guided coach; no phones are needed.
          </p>
          <div className="button-row">
            <button className="button" disabled={busy} onClick={() => void rehearse("round")}>
              Practice a round
            </button>
            <button className="button" disabled={busy} onClick={() => void rehearse("fast")}>
              Practice sample Fast Money
            </button>
          </div>
        </section>
        <div className="section-title">
          <h2>Who's in the family?</h2>
          <span>Make it personal. Set your lineup.</span>
        </div>
        <label>
          <input
            type="checkbox"
            checked={selfJoin}
            onChange={(e) => setSelfJoin(e.target.checked)}
          />
          Players enter their own names
        </label>
        <p>
          Set the team names, create the game, then share {gameOrigin()}/play and the game code.
          Approve players in Phone buzzers.
        </p>
        <div className="team-editors">
          {teams.map((t, i) => (
            <TeamEditor
              key={i}
              index={i}
              namesOnly={selfJoin}
              team={t}
              onChange={(value) => setTeams((old) => (i === 0 ? [value, old[1]] : [old[0], value]))}
            />
          ))}
        </div>
        <section className="settings-card">
          <div>
            <div className="section-eyebrow">SET THE STAGE</div>
            <h3>Your game, ready to go.</h3>
            <p>Four rounds, then sudden death if needed. Finish with Fast Money.</p>
          </div>
          <label>
            Question pack
            <select
              value={packId}
              onChange={(e) => {
                setPackId(e.target.value);
                setRequired({});
                setFastIds(null);
              }}
            >
              {packs
                .filter((p) => (p.bank.roundType ?? "regular") === "regular")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.bank.title} · {p.bank.questions.length} questions
                  </option>
                ))}
            </select>
          </label>
          <label>
            Winning target
            <select value={target} onChange={(e) => setTarget(Number(e.target.value))}>
              <option value={300}>300 points</option>
              <option value={200}>200 points · shorter game</option>
              <option value={500}>500 points · extended game</option>
            </select>
          </label>
          <div className="checks">
            <label>
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
              />
              <Shuffle size={14} /> Shuffle questions
            </label>
            <label>
              <input type="checkbox" checked={steal} onChange={(e) => setSteal(e.target.checked)} />
              Add the stealing answer’s points to a successful steal
            </label>
          </div>
        </section>
        <section className="settings-card">
          <label className="survey-choice">
            <input
              type="checkbox"
              checked={sharedQuestionBank}
              onChange={(e) => {
                setSharedQuestionBank(e.target.checked);
                setFastIds(null);
                setRequired({});
              }}
            />
            Use the regular question bank for Fast Money too
          </label>
          <p>
            Reserve five questions for Fast Money. In shared-bank mode, these are excluded from
            every regular round, including sudden death.
          </p>
          <label>
            Exclude questions after this many recorded uses
            <input
              type="number"
              min={1}
              max={1000}
              value={excludeAfterUses ?? ""}
              placeholder="No limit"
              onChange={(e) => {
                const n = Number(e.target.value);
                setExcludeAfterUses(e.target.value ? n : undefined);
                setFastIds(null);
                setRequired({});
              }}
            />
          </label>
          <p className="host-note">
            Leave blank for no limit. Counts combine regular and Fast Money use across matching
            saved-game prompts; rehearsals are excluded. Deleted games and undone uses no longer
            count.
          </p>
          <p>
            {regularQuestions.length} regular questions available · {fastPool.length} eligible for
            Fast Money.
          </p>
          <label>
            Fast Money pack
            <select
              aria-label="Fast Money pack"
              disabled={sharedQuestionBank}
              value={sharedQuestionBank ? packId : fastPackId}
              onChange={(e) => {
                setFastPackId(e.target.value);
                setFastIds(null);
              }}
            >
              {packs
                .filter((p) =>
                  sharedQuestionBank ? p.id === packId : p.bank.roundType === "fast-money",
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.bank.title}
                  </option>
                ))}
            </select>
          </label>
          <details>
            <summary>Choose Fast Money questions ({chosenFastIds.length} of 5 selected)</summary>
            <fieldset>
              <legend>Five Fast Money questions</legend>
              {fastPool.map((q) => (
                <label className="survey-choice" key={q.id}>
                  <input
                    type="checkbox"
                    checked={chosenFastIds.includes(q.id)}
                    onChange={(e) => {
                      setFastIds(
                        e.target.checked
                          ? [...chosenFastIds, q.id]
                          : chosenFastIds.filter((id) => id !== q.id),
                      );
                      setRequired({});
                    }}
                  />
                  {q.prompt}
                </label>
              ))}
            </fieldset>
          </details>
          <p className="host-note">
            Choose exactly five, or use “Mix Fast Money questions” to rotate a suitable set. Tap the
            checkboxes to change selections. The selected set must be able to reach 200 points with
            distinct answers.
          </p>
          <button
            type="button"
            className="button"
            disabled={busy || fastPool.length < 5}
            onClick={rotateFastQuestions}
          >
            Mix Fast Money questions
          </button>
          <details>
            <summary>Preview the question mix</summary>
            <h4>Regular-round pool ({regularQuestions.length})</h4>
            <p>
              {shuffle ? "This pool is shuffled when you create the game." : "Pack order is used."}{" "}
              Required groups fill the opening slots. Only questions reached during play are used;
              the rest remain available for sudden death.
            </p>
            <ol>
              {regularQuestions.map((q) => (
                <li key={q.id}>
                  {q.prompt} <small>· {q.category}</small>
                </li>
              ))}
            </ol>
            <h4>Fast Money ({chosenFastIds.length} of 5)</h4>
            <ol>
              {fastPool
                .filter((q) => chosenFastIds.includes(q.id))
                .map((q) => (
                  <li key={q.id}>{q.prompt}</li>
                ))}
            </ol>
            <p>
              {sharedQuestionBank
                ? "These five are reserved and will not appear in regular rounds."
                : "These come from the separate Fast Money pack."}
            </p>
            <h4>Excluded by the usage limit ({excludedQuestions.length})</h4>
            {excludedQuestions.length ? (
              <ul>
                {excludedQuestions.map((q) => (
                  <li key={q.id}>
                    {q.prompt} · {useCounts.get(questionKey(q.prompt))} recorded games
                  </li>
                ))}
              </ul>
            ) : (
              <p>No regular-bank questions excluded by this limit.</p>
            )}
            {!sharedQuestionBank && (
              <>
                <h4>Fast Money pack exclusions ({excludedFastQuestions.length})</h4>
                {excludedFastQuestions.length ? (
                  <ul>
                    {excludedFastQuestions.map((q) => (
                      <li key={q.id}>
                        {q.prompt} · {useCounts.get(questionKey(q.prompt))} recorded games
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No Fast Money questions excluded by this limit.</p>
                )}
              </>
            )}
            <p className="host-note">
              Usage reflects saved history at the last refresh; the server checks it again when
              creating a game. Previewing does not record a use.
            </p>
          </details>
          <button
            type="button"
            className="button"
            disabled={busy || !usageReady || chosenFastIds.length !== 5 || attainable < 200}
            onClick={() => void rehearse("fast", true)}
          >
            Rehearse these five Fast Money questions
          </button>
          <p className="host-note">
            Creates a separate practice game. Rehearsals never count toward question-use limits.
          </p>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setUsage(await api<QuestionUse[]>("/question-usage"));
                setUsageReady(true);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Refresh question history
          </button>
          {selectionError && (
            <p role="alert" className="error">
              {selectionError}
            </p>
          )}
        </section>
        <section className="required-groups settings-card">
          <div>
            <div className="section-eyebrow">YOUR MUST-PLAY GROUPS</div>
            <h3>Guarantee your favourites.</h3>
            <p>
              Reserve up to four opening questions. Required rounds are played before a winner can
              be declared, even if a team reaches the target early. The higher score then wins; a
              tie continues play.
            </p>
          </div>
          <div className="group-options">
            {categories.map((category) => {
              const available = regularQuestions.filter((q) => q.category === category).length;
              return (
                <label className="group-quota" key={category}>
                  <span>
                    {category}
                    <small>{available} available</small>
                  </span>
                  <select
                    aria-label={category + " required questions"}
                    value={required[category] ?? 0}
                    onChange={(e) =>
                      setRequired((old) => ({ ...old, [category]: Number(e.target.value) }))
                    }
                  >
                    <option value={0}>Optional</option>
                    {Array.from({ length: Math.min(4, available) }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1} required
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          <p
            className={requiredTotal > 4 ? "error" : "host-note"}
            role={requiredTotal > 4 ? "alert" : undefined}
          >
            {requiredTotal > 4
              ? "Choose at most four required questions in total."
              : `${requiredTotal} of 4 opening slots reserved. ${shuffle ? "Questions within each group and the remaining queue are shuffled." : "Pack order is used within each group and the remaining queue."}`}
          </p>
        </section>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <div className="start-row">
          <span>
            <span className="status-dot" />
            The host sees all answers. Your audience sees the magic.
          </span>
          <button
            className="button primary"
            disabled={
              busy || !usageReady || !packs.length || requiredTotal > 4 || Boolean(selectionError)
            }
            onClick={start}
          >
            {busy ? "Preparing your board…" : "Create game"}
            <ArrowRight size={19} />
          </button>
        </div>
        {!!games.length && (
          <section className="saved-section">
            <div className="section-title">
              <h2>Your games</h2>
              <span>Saved automatically</span>
            </div>
            <div className="game-list-tools">
              <label>
                Show games
                <select
                  aria-label="Show games"
                  value={gameFilter}
                  disabled={busy}
                  onChange={(e) => {
                    setGameFilter(e.target.value);
                    setShowAllGames(false);
                    setSelectedGames([]);
                  }}
                >
                  <option value="all">All games ({games.length})</option>
                  <option value="live">
                    Live games ({games.filter((g) => !g.rehearsal && g.phase !== "finished").length}
                    )
                  </option>
                  <option value="ended">
                    Ended games ({games.filter((g) => g.phase === "finished").length})
                  </option>
                  <option value="rehearsal">
                    Rehearsals ({games.filter((g) => g.rehearsal).length})
                  </option>
                </select>
              </label>
              <button
                className="button small"
                disabled={busy || !visibleGames.some((g) => g.phase === "finished")}
                onClick={() =>
                  setSelectedGames(
                    visibleGames.filter((g) => g.phase === "finished").map((g) => g.id),
                  )
                }
              >
                Select visible ended games
              </button>
              <button
                className="button small"
                disabled={busy || !selectedGames.length}
                onClick={() => void deleteSelectedGames()}
              >
                Delete selected ended games ({selectedGames.length})
              </button>
              {!!selectedGames.length && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setSelectedGames([])}
                >
                  Clear selection
                </button>
              )}
            </div>
            {cleanupMessage && <p role="status">{cleanupMessage}</p>}
            {!filteredGames.length && <p>No games in this view.</p>}
            <div className="saved-grid">
              {visibleGames.map((g) => (
                <article className="saved-game-card" key={g.id}>
                  {g.phase === "finished" && (
                    <label className="game-cleanup-selection">
                      <input
                        type="checkbox"
                        aria-label={`Select ended game ${g.id}`}
                        disabled={busy}
                        checked={selectedGames.includes(g.id)}
                        onChange={(e) =>
                          setSelectedGames((ids) =>
                            e.target.checked ? [...ids, g.id] : ids.filter((id) => id !== g.id),
                          )
                        }
                      />{" "}
                      Select for cleanup
                    </label>
                  )}
                  <a className="saved-game" href={"/host/" + g.id}>
                    <div>
                      <small>
                        {g.rehearsal ? "REHEARSAL · " : ""}
                        {g.id} · ROUND {g.round}
                      </small>
                      <strong>{g.teams.join(" vs ")}</strong>
                      <span>
                        {g.phase === "finished"
                          ? "Ended · view results"
                          : `${g.rehearsal ? "Practice" : "Live"} · ${g.phase}`}
                      </span>
                    </div>
                    <Play size={18} />
                  </a>
                  <div className="button-row">
                    {g.phase !== "finished" && (
                      <button
                        className="button small"
                        disabled={busy}
                        onClick={() => void manage(g, "end")}
                        aria-label={`End game ${g.id}`}
                      >
                        End game
                      </button>
                    )}
                    <button
                      className="button small"
                      disabled={busy}
                      onClick={() => void manage(g, "delete")}
                      aria-label={`Delete game ${g.id}`}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {filteredGames.length > 6 && (
              <button className="button" onClick={() => setShowAllGames(!showAllGames)}>
                {showAllGames ? "Show recent games" : `Show all ${filteredGames.length} games`}
              </button>
            )}
          </section>
        )}
      </main>
    </Layout>
  );
}
