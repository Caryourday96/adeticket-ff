import { useEffect, useRef, useState } from "react";
import { Search, Download, Upload, Music2, ArrowUpRight, X, Plus } from "lucide-react";
import { bankSchema, type Bank, type Question } from "@naija/contracts";
import { api, download } from "../lib/api";
import { fromCsv, toCsv } from "../lib/csv";
import { Layout } from "../components/Layout";
export function Library() {
  const [packs, setPacks] = useState<{ id: string; bank: Bank }[]>([]),
    [packId, setPackId] = useState("starter"),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [edit, setEdit] = useState<Question | null>(null),
    [draft, setDraft] = useState<Bank | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    api<typeof packs>("/packs")
      .then(setPacks)
      .catch((e) => setError(e.message));
  }, []);
  const bank = packs.find((p) => p.id === packId)?.bank;
  async function save(pack: Bank) {
    setBusy(true);
    setError("");
    try {
      const valid = bankSchema.parse(pack);
      const { id } = await api<{ id: string }>("/packs", valid);
      setPacks((p) => [...p, { id, bank: valid }]);
      setPackId(id);
      setDraft(null);
      setEdit(null);
      setMessage("Saved as a new pack. Existing games keep their original questions.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Layout active="library">
      <main className="page">
        <div className="host-heading">
          <div>
            <div className="eyebrow">THE GOOD STUFF</div>
            <h1>A little Naija knowledge.</h1>
            <p>Food, music, family and everything in between.</p>
          </div>
          <button className="button primary" onClick={() => input.current?.click()}>
            <Upload size={16} />
            Import a pack
          </button>
        </div>
        <input
          hidden
          ref={input}
          type="file"
          accept=".json,.csv"
          onChange={async (e) => {
            try {
              setError("");
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              setDraft(
                file.name.endsWith(".csv") ? fromCsv(text) : bankSchema.parse(JSON.parse(text)),
              );
            } catch (e) {
              setError((e as Error).message);
            }
            e.target.value = "";
          }}
        />
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {message && (
          <div className="success" role="status">
            {message}
          </div>
        )}
        {bank && (
          <>
            <div className="library-banner">
              <Music2 size={34} />
              <div>
                <span className="section-eyebrow">READY FOR GAME NIGHT</span>
                <h2>{bank.questions.length} questions. Plenty of wahala.</h2>
                <p>{bank.notice}</p>
              </div>
              <span className="pill">{bank.scoringSource}</span>
            </div>
            <div className="library-toolbar">
              <select
                aria-label="Question pack"
                value={packId}
                onChange={(e) => setPackId(e.target.value)}
              >
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.bank.title}
                  </option>
                ))}
              </select>
              <div className="search-box">
                <Search size={16} />
                <input
                  aria-label="Search questions"
                  value={search}
                  placeholder="Search questions…"
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                className="button small"
                onClick={() => download("questions.json", JSON.stringify(bank, null, 2))}
              >
                <Download size={14} />
                JSON
              </button>
              <button
                className="button small"
                onClick={() => download("questions.csv", toCsv(bank), "text/csv")}
              >
                <Download size={14} />
                CSV
              </button>
            </div>
            <div className="category-tabs">
              {["all", ...new Set(bank.questions.map((q) => q.category))].map((c) => (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="question-cards">
              {bank.questions
                .filter(
                  (q) =>
                    (category === "all" || q.category === category) &&
                    q.prompt.toLowerCase().includes(search.toLowerCase()),
                )
                .map((q) => (
                  <button
                    className="question-card"
                    key={q.id}
                    onClick={() => {
                      setEdit(structuredClone(q));
                      setError("");
                    }}
                  >
                    <span className="section-eyebrow">{q.category}</span>
                    <h3>{q.prompt}</h3>
                    <div>
                      <span>
                        {q.answers.length} answers ·{" "}
                        {q.answers.reduce((sum, a) => sum + a.points, 0)} sample points
                      </span>
                      <ArrowUpRight size={18} />
                    </div>
                  </button>
                ))}
              <button
                className="question-card add-question"
                onClick={() =>
                  setEdit({
                    id: "custom-" + Date.now(),
                    category: "everyday",
                    prompt: "",
                    hostNotes: "",
                    answers: [
                      { id: "a1", text: "", points: 35, acceptedAlternatives: [] },
                      { id: "a2", text: "", points: 25, acceptedAlternatives: [] },
                    ],
                  })
                }
              >
                <Plus />
                Add a question
              </button>
            </div>
          </>
        )}
        {draft && (
          <div className="modal-backdrop">
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label="Review imported pack"
            >
              <h2>Review your import</h2>
              <label>
                Pack title
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <p>
                {draft.questions.length} questions · {draft.scoringSource}
              </p>
              <p>{draft.notice}</p>
              <div className="import-preview">
                {draft.questions.map((q) => (
                  <p key={q.id}>
                    {q.prompt} <small>({q.answers.length} answers)</small>
                  </p>
                ))}
              </div>
              {error && <p className="error">{error}</p>}
              <div className="button-row">
                <button className="button" onClick={() => setDraft(null)}>
                  Cancel
                </button>
                <button className="button primary" disabled={busy} onClick={() => save(draft)}>
                  Import as a new pack
                </button>
              </div>
            </section>
          </div>
        )}
        {edit && bank && (
          <div className="modal-backdrop">
            <section
              className="modal editor-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Edit question"
            >
              <button
                className="modal-close icon-button"
                aria-label="Close editor"
                onClick={() => setEdit(null)}
              >
                <X />
              </button>
              <div className="section-eyebrow">QUESTION EDITOR</div>
              <h2>Make the board your own.</h2>
              <label>
                Question
                <input
                  value={edit.prompt}
                  onChange={(e) => setEdit({ ...edit, prompt: e.target.value })}
                />
              </label>
              <label>
                Category
                <input
                  value={edit.category}
                  onChange={(e) => setEdit({ ...edit, category: e.target.value })}
                />
              </label>
              <label>
                Host clarification notes
                <textarea
                  value={edit.hostNotes}
                  onChange={(e) => setEdit({ ...edit, hostNotes: e.target.value })}
                />
              </label>
              <div className="edit-answer-list">
                {edit.answers.map((a, i) => (
                  <div key={a.id}>
                    <label>
                      Answer {i + 1}
                      <input
                        value={a.text}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            answers: edit.answers.map((a, n) =>
                              n === i ? { ...a, text: e.target.value } : a,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Points
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={a.points}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            answers: edit.answers.map((a, n) =>
                              n === i ? { ...a, points: Number(e.target.value) } : a,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Aliases (separate with |)
                      <input
                        value={a.acceptedAlternatives.join("|")}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            answers: edit.answers.map((a, n) =>
                              n === i
                                ? { ...a, acceptedAlternatives: e.target.value.split("|") }
                                : a,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      className="icon-button"
                      aria-label={"Remove answer " + (i + 1)}
                      disabled={edit.answers.length <= 2}
                      onClick={() =>
                        setEdit({ ...edit, answers: edit.answers.filter((_, n) => n !== i) })
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="text-button"
                disabled={edit.answers.length >= 8}
                onClick={() =>
                  setEdit({
                    ...edit,
                    answers: [
                      ...edit.answers,
                      { id: "a" + Date.now(), text: "", points: 5, acceptedAlternatives: [] },
                    ],
                  })
                }
              >
                <Plus size={15} />
                Add answer
              </button>
              {error && (
                <div role="alert" className="error">
                  {error}
                </div>
              )}
              <div className="button-row">
                <button className="button" onClick={() => setEdit(null)}>
                  Cancel
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => {
                    const clean = {
                      ...edit,
                      answers: edit.answers
                        .map((a) => ({
                          ...a,
                          acceptedAlternatives: a.acceptedAlternatives
                            .map((s) => s.trim())
                            .filter(Boolean),
                        }))
                        .sort((a, b) => b.points - a.points),
                    };
                    save({
                      ...bank,
                      title: bank.title.slice(0, 75) + " · edited",
                      questions: bank.questions.some((q) => q.id === clean.id)
                        ? bank.questions.map((q) => (q.id === clean.id ? clean : q))
                        : [...bank.questions, clean],
                    });
                  }}
                >
                  Save as a new pack
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    </Layout>
  );
}
