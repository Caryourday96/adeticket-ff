import { scoreGroups, playableSurveyGroups, groupSurveyVariants } from "@naija/contracts";
import type { DatabaseSync } from "node:sqlite";
import { randomBytes, createHash } from "node:crypto";
import { bankSchema, surveyCreateSchema, type Survey, type SurveyResults } from "@naija/contracts";
import { z } from "zod";

const normalize = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const reviewSchema = z.object({
  revision: z.number().int(),
  grouping: z.record(z.string(), z.record(z.string(), z.string().trim().min(1).max(100))),
  reviewed: z.array(z.string()).max(30),
});

export class Surveys {
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS surveys(id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS survey_responses(survey TEXT NOT NULL, respondent TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(survey,respondent));`);
  }
  create(input: unknown) {
    const data = surveyCreateSchema.parse(input);
    const survey: Survey = {
      ...data,
      id: randomBytes(10).toString("hex"),
      questions: data.questions.map((q, i) => ({ ...q, id: `q${i + 1}` })),
      open: true,
      createdAt: new Date().toISOString(),
      revision: 0,
      grouping: {},
      reviewed: [],
    };
    this.db.prepare("INSERT INTO surveys VALUES (?,?)").run(survey.id, JSON.stringify(survey));
    return survey;
  }
  get(id: string): Survey {
    const row = this.db.prepare("SELECT body FROM surveys WHERE id=?").get(id) as
      { body: string } | undefined;
    if (!row) throw new Error("Survey not found.");
    return JSON.parse(row.body);
  }
  list() {
    return (
      this.db.prepare("SELECT body FROM surveys ORDER BY rowid DESC").all() as { body: string }[]
    ).map((row) => {
      const s = JSON.parse(row.body) as Survey;
      return {
        id: s.id,
        title: s.title,
        roundType: s.roundType,
        open: s.open,
        createdAt: s.createdAt,
        responseCount: this.count(s.id),
      };
    });
  }
  count(id: string) {
    return Number(
      this.db.prepare("SELECT COUNT(*) AS n FROM survey_responses WHERE survey=?").get(id)!.n,
    );
  }
  private hash(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
  submitted(id: string, token: string) {
    return !!this.db
      .prepare("SELECT 1 FROM survey_responses WHERE survey=? AND respondent=?")
      .get(id, this.hash(token));
  }
  private save(s: Survey) {
    this.db.prepare("UPDATE surveys SET body=? WHERE id=?").run(JSON.stringify(s), s.id);
  }
  submit(id: string, token: string, input: unknown) {
    const body = z
      .object({ answers: z.record(z.string(), z.string().trim().max(100)) })
      .parse(input);
    const s = this.get(id);
    if (!s.open) throw new Error("This survey is closed.");
    if (this.submitted(id, token)) return;
    if (this.count(id) >= 2000) throw new Error("This survey has reached its response limit.");
    if (Object.keys(body.answers).some((key) => !s.questions.some((q) => q.id === key)))
      throw new Error("Unknown survey question.");
    if (!Object.values(body.answers).some((answer) => answer.trim()))
      throw new Error("Answer at least one question.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("INSERT INTO survey_responses VALUES (?,?,?)")
        .run(id, this.hash(token), JSON.stringify(body.answers));
      s.revision++;
      s.reviewed = [];
      this.save(s);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  setOpen(id: string, open: boolean, revision: number) {
    const s = this.get(id);
    if (s.revision !== revision) throw new Error("Responses changed. Refresh the survey first.");
    s.open = open;
    s.revision++;
    s.reviewed = [];
    this.save(s);
    return this.results(id);
  }
  results(id: string): SurveyResults {
    const s = this.get(id);
    const responses = (
      this.db.prepare("SELECT body FROM survey_responses WHERE survey=?").all(id) as {
        body: string;
      }[]
    ).map((r) => JSON.parse(r.body) as Record<string, string>);
    return {
      ...s,
      responseCount: responses.length,
      results: s.questions.map((q) => {
        const variants = new Map<string, { key: string; text: string; count: number }>();
        for (const response of responses) {
          const text = response[q.id]?.trim();
          if (!text) continue;
          const key = normalize(text),
            existing = variants.get(key);
          if (existing) existing.count++;
          else variants.set(key, { key, text, count: 1 });
        }
        const answered = [...variants.values()].reduce((n, v) => n + v.count, 0);
        const groups = groupSurveyVariants([...variants.values()], s.grouping[q.id] ?? {});
        return {
          id: q.id,
          prompt: q.prompt,
          answered,
          variants: [...variants.values()].sort((a, b) => b.count - a.count),
          groups: scoreGroups(groups),
        };
      }),
    };
  }
  review(id: string, input: unknown) {
    const body = reviewSchema.parse(input),
      s = this.get(id);
    if (s.open) throw new Error("Close the survey before reviewing answer groups.");
    if (s.revision !== body.revision) throw new Error("The survey changed. Refresh before saving.");
    const results = this.results(id);
    for (const [qid, mapping] of Object.entries(body.grouping)) {
      const question = results.results.find((q) => q.id === qid);
      if (
        !question ||
        Object.keys(mapping).some((k) => !question.variants.some((v) => v.key === k))
      )
        throw new Error("Unknown answer variation.");
    }
    if (body.reviewed.some((id) => !s.questions.some((q) => q.id === id)))
      throw new Error("Unknown reviewed question.");
    s.grouping = body.grouping;
    s.reviewed = body.reviewed;
    s.revision++;
    this.save(s);
    return this.results(id);
  }
  export(id: string) {
    const s = this.results(id);
    if (s.open || s.questions.some((q) => !s.reviewed.includes(q.id)))
      throw new Error("Close the survey and review every question before exporting.");
    const questions = s.results.map((q) => {
      const top = playableSurveyGroups(q.groups);
      if (top.length < 2) throw new Error(`At least two answer groups are required: ${q.prompt}`);
      const shown = top.reduce((sum, group) => sum + group.count, 0);
      return {
        id: `survey-${s.id}-${q.id}`,
        category: "survey",
        prompt: q.prompt,
        hostNotes: `Survey ${s.id}. ${q.answered} nonblank responses. ${s.responseCount - q.answered} skipped. Shown answer groups cover ${shown} of ${q.answered} nonblank responses. Points are rounded shares of responses in the shown groups, with at least one point per group and 100 points total. Counts: ${top.map((g) => `${g.text}: ${g.count}`).join("; ")}`,
        answers: top.map((g, i) => ({
          id: `a${i + 1}`,
          text: g.text,
          points: g.points,
          acceptedAlternatives: [
            ...new Set(g.alternatives.filter((a) => normalize(a) !== normalize(g.text))),
          ].slice(0, 30),
        })),
      };
    });
    return bankSchema.parse({
      schemaVersion: 1,
      title: s.title,
      roundType: s.roundType,
      scoringSource: "collected-survey",
      notice: `Collected survey: ${s.responseCount} submissions, not verified unique people. Duplicate protection is browser-cookie based; clearing cookies or using another browser can allow another submission. Convenience sample; not population-representative. Each question shows up to eight answer groups. Points total 100 and are based on the response counts of the groups shown. See each question's notes for coverage and original counts.`,
      questions,
    });
  }
}
