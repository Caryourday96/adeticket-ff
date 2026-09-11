import { useEffect, useState } from "react";
import type { Bank, Team } from "@naija/contracts";
import { ArrowRight, Monitor, Users, Layers, Play, Shuffle } from "lucide-react";
import { api } from "../lib/api";
import { Layout } from "../components/Layout";
import { TeamEditor } from "../components/TeamEditor";
export function Setup() {
  const [teams, setTeams] = useState<[Team, Team]>([
    { name: "The Jollof Squad", members: ["Ada", "Chidi", "Tobi"], captain: 0 },
    { name: "The Suya Crew", members: ["Zainab", "Emeka", "Femi"], captain: 0 },
  ]);
  const [packs, setPacks] = useState<{ id: string; bank: Bank }[]>([]),
    [packId, setPackId] = useState("starter"),
    [games, setGames] = useState<{ id: string; teams: string[]; phase: string; round: number }[]>(
      [],
    );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [shuffle, setShuffle] = useState(true),
    [steal, setSteal] = useState(false),
    [target, setTarget] = useState(300);
  const [required, setRequired] = useState<Record<string, number>>({});
  const selectedPack = packs.find((p) => p.id === packId)?.bank;
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
        teams,
        packId,
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
        <div className="section-title">
          <h2>Who's in the family?</h2>
          <span>Make it personal. Set your lineup.</span>
        </div>
        <div className="team-editors">
          {teams.map((t, i) => (
            <TeamEditor
              key={i}
              index={i}
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
              {packs.map((p) => (
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
              Include steal answer points
            </label>
          </div>
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
            disabled={busy || !packs.length || requiredTotal > 4}
            onClick={start}
          >
            {busy ? "Preparing your board…" : "Create game"}
            <ArrowRight size={19} />
          </button>
        </div>
        {!!games.length && (
          <section className="saved-section">
            <div className="section-title">
              <h2>Pick up where you left off</h2>
              <span>Saved automatically</span>
            </div>
            <div className="saved-grid">
              {games.slice(0, 6).map((g) => (
                <a className="saved-game" key={g.id} href={"/host/" + g.id}>
                  <div>
                    <small>
                      {g.id} · ROUND {g.round}
                    </small>
                    <strong>{g.teams.join(" vs ")}</strong>
                    <span>{g.phase}</span>
                  </div>
                  <Play size={18} />
                </a>
              ))}
            </div>
          </section>
        )}
      </main>
    </Layout>
  );
}
