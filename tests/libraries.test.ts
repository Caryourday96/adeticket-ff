import { describe, it, expect } from "vitest";
import { bankSchema } from "@naija/contracts";
import { starterBank, fastBank } from "@naija/content";
import { toCsv, fromCsv } from "../apps/web/src/lib/csv";
import { createApplication } from "../apps/server/src/app";

describe("separate question libraries", () => {
  it("keeps legacy JSON and CSV regular while preserving Fast Money types", () => {
    expect(bankSchema.parse({ ...starterBank, roundType: undefined }).roundType ?? "regular").toBe(
      "regular",
    );
    expect(fromCsv(toCsv(fastBank)).roundType).toBe("fast-money");
    const legacy = toCsv(starterBank)
      .split("\r\n")
      .map((row) => row.replace(/,"(?:regular|round_type)"$/, ""))
      .join("\r\n");
    expect(fromCsv(legacy).roundType).toBe("regular");
    expect(() => bankSchema.parse({ ...starterBank, roundType: "unknown" })).toThrow();
  });
  it("selects custom Fast Money questions and rejects crossed libraries or duplicate IDs", async () => {
    const server = createApplication({ database: ":memory:", password: "test-password" });
    await new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + (server.http.address() as { port: number }).port;
    let cookie = "";
    const post = (path: string, data: unknown) =>
      fetch(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(data),
      });
    try {
      const login = await post("/api/login", { password: "test-password" });
      cookie = login.headers.get("set-cookie")!.split(";")[0];
      const custom = {
        ...fastBank,
        title: "Custom Fast Money",
        questions: fastBank.questions.map((q) => ({ ...q, prompt: "Custom " + q.prompt })),
      };
      const pack = await (await post("/api/packs", custom)).json();
      const setup = {
        teams: [
          { name: "One", members: ["A", "B"], captain: 0 },
          { name: "Two", members: ["C", "D"], captain: 0 },
        ],
        packId: "starter",
        questionIds: starterBank.questions.map((q) => q.id),
        fastPackId: pack.id,
        fastQuestionIds: custom.questions.map((q) => q.id),
      };
      const created = await post("/api/games", setup);
      expect(created.status).toBe(201);
      const game = await created.json();
      const host = await fetch(base + "/api/games/" + game.id + "/host", {
        headers: { Cookie: cookie },
      }).then((r) => r.json());
      expect(host.fastQuestions[0].prompt).toBe(custom.questions[0].prompt);
      expect(host.questions[0].prompt).toBe(starterBank.questions[0].prompt);
      expect(
        (
          await post("/api/games", {
            ...setup,
            packId: pack.id,
            questionIds: custom.questions.map((q) => q.id),
          })
        ).status,
      ).toBe(400);
      expect((await post("/api/games", { ...setup, fastPackId: "starter" })).status).toBe(400);
      expect(
        (
          await post("/api/games", {
            ...setup,
            fastQuestionIds: Array(5).fill(custom.questions[0].id),
          })
        ).status,
      ).toBe(400);
    } finally {
      await server.close();
    }
  });
});
