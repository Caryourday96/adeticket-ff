import { useEffect, useState } from "react";
import type { Bank, PublicSurvey, SurveyResults } from "@naija/contracts";
import { Layout } from "../components/Layout";
import { Brand } from "../components/Brand";
import { api, download } from "../lib/api";
import { QRCodeSVG } from "qrcode.react";
import { parseCustomQuestions, surveyDraftError } from "../lib/surveyDraft";
import { AlphaNotice } from "../components/AlphaNotice";
import { gameOrigin } from "../lib/links";

export function SurveyForm({ id }: { id: string }) {
  const [survey, setSurvey] = useState<PublicSurvey | null>(null),
    [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<PublicSurvey>(`/surveys/${id}`)
      .then(setSurvey)
      .catch((e) => setError(e.message));
  }, [id]);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api(`/surveys/${id}/responses`, { answers });
      setSurvey((s) => (s ? { ...s, submitted: true } : s));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page survey-public">
      <Brand />
      <AlphaNotice />
      <h1>{survey?.title ?? "Game-night survey"}</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {survey?.submitted ? (
        <section className="entry-card">
          <h2>Thank you!</h2>
          <p>Your answers have been recorded.</p>
        </section>
      ) : survey && !survey.open ? (
        <p>This survey is closed. Thank you for your interest.</p>
      ) : survey ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p>
            Give your first answer to each question. One answer per question; you can skip any
            question. Please do not include personal or sensitive information.
          </p>
          <p className="muted">
            No name or email is requested. Answers are stored for the host to review and use in a
            game. Please submit once; this browser remembers your submission.
          </p>
          {survey.questions.map((q, i) => (
            <label className="settings-card" key={q.id}>
              {i + 1}. {q.prompt}
              <input
                aria-label={q.prompt}
                maxLength={100}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((old) => ({ ...old, [q.id]: e.target.value }))}
                placeholder="Your first answer"
              />
            </label>
          ))}
          <button
            className="button primary"
            disabled={busy || !Object.values(answers).some((a) => a.trim())}
          >
            {busy ? "Submitting…" : "Submit answers"}
          </button>
        </form>
      ) : (
        !error && <p>Loading survey…</p>
      )}
    </main>
  );
}

type Summary = {
  id: string;
  title: string;
  roundType: string;
  open: boolean;
  responseCount: number;
};
export function Surveys() {
  const [packs, setPacks] = useState<{ id: string; bank: Bank }[]>([]),
    [list, setList] = useState<Summary[]>([]);
  const [packId, setPackId] = useState("starter"),
    [selected, setSelected] = useState<string[] | null>(null);
  const [title, setTitle] = useState("Nigerian game-night survey"),
    [custom, setCustom] = useState("");
  const [source, setSource] = useState<"preset" | "custom">("preset");
  const [kind, setKind] = useState<"regular" | "fast-money">("regular");
  const [active, setActive] = useState<SurveyResults | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const bank = packs.find((p) => p.id === packId)?.bank;
  const ids = selected ?? bank?.questions.slice(0, 5).map((q) => q.id) ?? [];
  const customQuestions = parseCustomQuestions(custom);
  const questionCount = source === "custom" ? customQuestions.length : ids.length;
  const draftError = surveyDraftError({ title, kind, questionCount });
  async function refresh() {
    setList(await api<Summary[]>("/surveys"));
  }
  useEffect(() => {
    void Promise.all([api<typeof packs>("/packs"), api<Summary[]>("/surveys")])
      .then(([p, s]) => {
        setPacks(p);
        setList(s);
        const first = p.find((pack) => (pack.bank.roundType ?? "regular") === "regular") ?? p[0];
        if (first) setPackId(first.id);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    setActive(await api<SurveyResults>(`/surveys/${id}/manage`));
  }
  async function create() {
    if (draftError) throw new Error(draftError);
    const questions =
      source === "custom"
        ? customQuestions.map((prompt) => ({ prompt }))
        : (bank?.questions.filter((q) => ids.includes(q.id)).map((q) => ({ prompt: q.prompt })) ??
          []);
    const s = await api<{ id: string }>("/surveys", {
      title: title.trim(),
      roundType: kind,
      questions,
    });
    await refresh();
    await open(s.id);
  }
  async function exportBank(importIt = false) {
    if (!active) return;
    const saved = await api<SurveyResults>(`/surveys/${active.id}/review`, {
      revision: active.revision,
      grouping: active.grouping,
      reviewed: active.reviewed,
    });
    setActive(saved);
    const pack = await api<Bank>(`/surveys/${active.id}/export`);
    if (importIt) {
      await api("/packs", pack);
      setMessage("Question bank saved in the question library.");
    } else download(`survey-${active.id}-${active.roundType}.json`, JSON.stringify(pack, null, 2));
  }
  return (
    <Layout active="surveys">
      <main className="page survey-host">
        <h1>Survey questions</h1>
        <p>
          Collect real answers, review equivalent wording, then build a regular-round or Fast Money
          bank.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
        {!active ? (
          <>
            <section className="settings-card">
              <h2>Create a survey</h2>
              <label>
                Survey title
                <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label>
                Survey type
                <select
                  aria-label="Survey type"
                  value={kind}
                  onChange={(e) => {
                    const k = e.target.value as typeof kind;
                    setKind(k);
                    setSelected(null);
                    setPackId(packs.find((p) => (p.bank.roundType ?? "regular") === k)?.id ?? "");
                  }}
                >
                  <option value="regular">Regular rounds</option>
                  <option value="fast-money">Fast Money</option>
                </select>
              </label>
              <label>
                Source pack
                <select
                  aria-label="Source pack"
                  value={packId}
                  disabled={
                    source === "custom" ||
                    !packs.some((p) => (p.bank.roundType ?? "regular") === kind)
                  }
                  onChange={(e) => {
                    setPackId(e.target.value);
                    setSelected(null);
                  }}
                >
                  {packs
                    .filter((p) => (p.bank.roundType ?? "regular") === kind)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.bank.title}
                      </option>
                    ))}
                </select>
              </label>
              <fieldset>
                <legend>Question source</legend>
                <label className="survey-choice">
                  <input
                    type="radio"
                    checked={source === "preset"}
                    onChange={() => setSource("preset")}
                  />
                  Use questions from the selected library ({ids.length} selected)
                </label>
                <label className="survey-choice">
                  <input
                    type="radio"
                    checked={source === "custom"}
                    onChange={() => setSource("custom")}
                  />
                  Enter questions manually ({customQuestions.length} ready)
                </label>
              </fieldset>
              {source === "preset" && (
                <details>
                  <summary>Choose preset questions ({ids.length} selected)</summary>
                  {bank?.questions.map((q) => (
                    <label key={q.id} className="survey-choice">
                      <input
                        type="checkbox"
                        checked={ids.includes(q.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked ? [...ids, q.id] : ids.filter((id) => id !== q.id),
                          )
                        }
                      />
                      {q.prompt}
                    </label>
                  ))}
                </details>
              )}
              <label>
                Manual questions, one per line
                <textarea
                  rows={5}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  disabled={source !== "custom"}
                  placeholder="Choose manual entry above, then add one question per line"
                />
              </label>
              <p>
                {kind === "fast-money"
                  ? "Fast Money requires exactly 5 questions."
                  : "Choose 5–30 questions."}{" "}
                Respondents see questions only, never the existing game answers. Questions stay
                fixed once created.
              </p>
              {draftError && (
                <p role="alert" className="error">
                  {draftError}
                </p>
              )}
              <button
                className="button primary"
                disabled={busy || Boolean(draftError)}
                onClick={() => void run(create)}
              >
                Create survey
              </button>
            </section>
            <h2>Your surveys</h2>
            <button className="button" disabled={busy} onClick={() => void run(refresh)}>
              Refresh surveys
            </button>
            <div className="saved-grid">
              {list.map((s) => (
                <article key={s.id} className="saved-game-card">
                  <h3>{s.title}</h3>
                  <p>
                    {s.open ? "Collecting answers" : "Closed"} · {s.responseCount} submissions ·{" "}
                    {s.roundType}
                  </p>
                  <button className="button" onClick={() => void run(() => open(s.id))}>
                    Manage {s.title}
                  </button>
                </article>
              ))}
            </div>
          </>
        ) : (
          <>
            <button className="button" disabled={busy} onClick={() => setActive(null)}>
              Back to surveys
            </button>
            <h2>{active.title}</h2>
            <section className="settings-card">
              <p>
                {active.responseCount} submissions ·{" "}
                {active.open ? "Open for responses" : "Closed for review"}
              </p>
              <a href={`${gameOrigin()}/survey/${active.id}`} target="_blank" rel="noreferrer">
                Open respondent form
              </a>
              <input
                aria-label="Survey share link"
                readOnly
                value={`${gameOrigin()}/survey/${active.id}`}
                onFocus={(e) => e.target.select()}
              />
              <QRCodeSVG value={`${gameOrigin()}/survey/${active.id}`} size={160} marginSize={3} />
              <div className="button-row">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void run(() => open(active.id))}
                >
                  Refresh results
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setActive(
                        await api<SurveyResults>(`/surveys/${active.id}/status`, {
                          open: !active.open,
                          revision: active.revision,
                        }),
                      );
                      await refresh();
                    })
                  }
                >
                  {active.open ? "Close survey for review" : "Reopen survey"}
                </button>
              </div>
            </section>
            <p>
              Close collection before grouping. Give equivalent answers the same group label;
              different answers stay separate. Only case and whitespace are grouped automatically.
              Reopening clears review approvals.
            </p>
            <p>
              Points are percentages of nonblank answers for each question, rounded across all
              groups to total 100. Export includes up to eight positive-point groups. Small samples
              are labelled honestly; aim for 100 respondents. One-browser submission protection is
              not proof of unique people.
            </p>
            {active.results.map((q) => (
              <section className="settings-card" key={q.id}>
                <h3>{q.prompt}</h3>
                <p>
                  {q.answered} answered · {active.responseCount - q.answered} skipped
                </p>
                {q.variants.map((v) => (
                  <label key={v.key} className="survey-choice">
                    <span>
                      {v.text} ({v.count}) → Group
                    </span>
                    <input
                      aria-label={`Group ${q.id} ${v.text}`}
                      disabled={active.open || busy}
                      maxLength={100}
                      value={active.grouping[q.id]?.[v.key] ?? v.text}
                      onChange={(e) =>
                        setActive({
                          ...active,
                          reviewed: active.reviewed.filter((id) => id !== q.id),
                          grouping: {
                            ...active.grouping,
                            [q.id]: { ...active.grouping[q.id], [v.key]: e.target.value },
                          },
                        })
                      }
                    />
                  </label>
                ))}
                <p>
                  Saved groups:{" "}
                  {q.groups
                    .map((g) => `${g.text}: ${g.count} responses / ${g.points} points`)
                    .join(" · ") || "No answers yet"}
                </p>
                <label>
                  <input
                    type="checkbox"
                    disabled={active.open || busy || !q.answered}
                    checked={active.reviewed.includes(q.id)}
                    onChange={(e) =>
                      setActive({
                        ...active,
                        reviewed: e.target.checked
                          ? [...active.reviewed, q.id]
                          : active.reviewed.filter((id) => id !== q.id),
                      })
                    }
                  />{" "}
                  I reviewed this question’s answer groups
                </label>
              </section>
            ))}
            <div className="button-row">
              <button
                className="button primary"
                disabled={busy || active.open}
                onClick={() =>
                  void run(async () => {
                    setActive(
                      await api<SurveyResults>(`/surveys/${active.id}/review`, {
                        revision: active.revision,
                        grouping: active.grouping,
                        reviewed: active.reviewed,
                      }),
                    );
                    setMessage("Review saved. Group counts and points recalculated.");
                  })
                }
              >
                Save grouping and review
              </button>
              <button
                className="button"
                disabled={busy || active.open}
                onClick={() => void run(() => exportBank())}
              >
                Download question bank JSON
              </button>
              <button
                className="button"
                disabled={busy || active.open}
                onClick={() => void run(() => exportBank(true))}
              >
                Save bank to question library
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  void run(async () =>
                    download(
                      `survey-${active.id}-results.json`,
                      JSON.stringify(
                        await api<SurveyResults>(`/surveys/${active.id}/manage`),
                        null,
                        2,
                      ),
                    ),
                  )
                }
              >
                Download saved response counts
              </button>
            </div>
          </>
        )}
      </main>
    </Layout>
  );
}
