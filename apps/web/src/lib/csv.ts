import { bankSchema, type Bank } from "@naija/contracts";
const columns = [
  "question_id",
  "category",
  "prompt",
  "host_notes",
  "answer_id",
  "answer",
  "points",
  "aliases",
];
export function toCsv(bank: Bank) {
  const cell = (s: string) => '"' + s.replaceAll('"', '""') + '"';
  return [
    columns,
    ...bank.questions.flatMap((q) =>
      q.answers.map((a) => [
        q.id,
        q.category,
        q.prompt,
        q.hostNotes,
        a.id,
        a.text,
        String(a.points),
        a.acceptedAlternatives.join("|"),
      ]),
    ),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
export function fromCsv(text: string): Bank {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  if (rows.shift()?.join(",") !== columns.join(","))
    throw new Error("Use the CSV export's column names and order.");
  const questions: Bank["questions"] = [];
  for (const [id, category, prompt, hostNotes, answerId, answer, points, aliases = ""] of rows) {
    let q = questions.find((q) => q.id === id);
    if (!q) {
      q = { id, category, prompt, hostNotes, answers: [] };
      questions.push(q);
    }
    q.answers.push({
      id: answerId,
      text: answer,
      points: Number(points),
      acceptedAlternatives: aliases.split("|").filter(Boolean),
    });
  }
  return bankSchema.parse({
    schemaVersion: 1,
    title: "Imported CSV pack",
    scoringSource: "illustrative",
    notice: "Imported values: sample points. Review provenance before using.",
    questions,
  });
}
