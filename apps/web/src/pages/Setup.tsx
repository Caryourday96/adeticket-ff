import { useEffect, useState } from "react";
import type { Bank, Team } from "@naija/contracts";
import { ArrowRight, Monitor, Users, Layers, Play, Shuffle } from "lucide-react";
import { api } from "../lib/api";
import { Layout } from "../components/Layout";
import { TeamEditor } from "../components/TeamEditor";
import { commandId } from "../lib/commandId";
import { gameOrigin } from "../lib/links";
export function Setup() {
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
  async function rehearse(scenario: "round" | "fast") {
    setBusy(true);
    setError("");
    try {
      const game = await api<{ id: string }>("/rehearsals", { scenario });
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
  const selectedFastPack = packs.find((p) => p.id === fastPackId)?.bank;
  const chosenFastIds = fastIds ?? selectedFastPack?.questions.slice(0, 5).map((q) => q.id) ?? [];
  const categories = [...new Set(selectedPack?.questions.map((q) => q.category) ?? [])];
  const requiredTotal = Object.values(required).reduce((n, v) => n + v, 0);
  useEffect(() => {
    Promise.all([api<typeof packs>("/packs"), api<typeof games>("/games")])
      .then(([p, g]) => {
        setPacks(p);
        setGames(g);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const ids = packs.find((p) => p.id === packId)!.bank.questions.map((q) => q.id);
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
        fastQuestionIds: chosenFastIds,
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
              Practice Fast Money
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
          <label>
            Fast Money pack
            <select
              aria-label="Fast Money pack"
              value={fastPackId}
              onChange={(e) => {
                setFastPackId(e.target.value);
                setFastIds(null);
              }}
            >
              {packs
                .filter((p) => p.bank.roundType === "fast-money")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.bank.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Five Fast Money questions
            <select
              multiple
              aria-label="Five Fast Money questions"
              size={5}
              value={chosenFastIds}
              onChange={(e) =>
                setFastIds(Array.from(e.target.selectedOptions, (option) => option.value))
              }
            >
              {selectedFastPack?.questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.prompt}
                </option>
              ))}
            </select>
          </label>
          <p className="host-note">
            Choose exactly five. This library is separate from your regular rounds. Hold Ctrl
            (Windows) or Command (Mac) to change multiple selections. The selected set must be able
            to reach 200 points with distinct answers.
          </p>
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
              const available = selectedPack!.questions.filter(
                (q) => q.category === category,
              ).length;
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
            disabled={busy || !packs.length || requiredTotal > 4 || chosenFastIds.length !== 5}
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
