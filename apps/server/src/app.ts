import express from "express";
import helmet from "helmet";
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { passwordVerifier } from "./password";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { advertisingConfig, advertisingDocument, type AdvertisingConfig } from "./advertising";
import { Server } from "socket.io";
import { attachBibleBlitz } from "bible-blitz/server";
import {
  bankSchema,
  envelopeSchema,
  setupSchema,
  eligibleQuestions,
  questionKey,
  type Question,
} from "@naija/contracts";
import { starterBank, fastBank, birthdayBank, validateFastSet } from "@naija/content";
import { audience, createGame } from "@naija/game";
import { Store } from "./store";
import { Buzzers } from "./buzzers";
import { z } from "zod";
import { createRehearsal } from "./rehearsal";
import { PlatformError, type Principal } from "./platform";
import { createPlatformRouter } from "./platformRoutes";
export function createApplication(options: {
  database: string;
  password?: string;
  production?: boolean;
  origin?: string;
  webDir?: string;
  advertising?: AdvertisingConfig;
  castAppId?: string;
}) {
  if (options.production && !options.origin)
    throw new Error("APP_ORIGIN is required in production.");
  const store = new Store(options.database),
    app = express(),
    http = createServer(app);
  if (options.production && !options.password && !store.platform.enabled()) {
    store.close();
    throw new Error(
      "Provision an owner account or configure HOST_PASSWORD before starting production.",
    );
  }
  const buzzers = new Buzzers(store);
  const origins = new Set([
    ...(options.origin ?? "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    ...(!options.production
      ? ["http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:3000"]
      : []),
  ]);
  const originAllowed = (origin: string | undefined) => !origin || origins.has(origin);
  const legacyGameHosts = new Set(["ff.kayodeadetunji.com", "naijafeud.kayodeadetunji.com"]);
  const io = new Server(http, {
    maxHttpBufferSize: 20000,
    allowRequest: (req, cb) => cb(null, originAllowed(req.headers.origin)),
  });
  const bibleBlitz = attachBibleBlitz(http, {
    origins: [
      "https://adeticket.com",
      ...(!options.production ? ["http://localhost:3000", "http://127.0.0.1:3000"] : []),
    ],
  });
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    if (legacyGameHosts.has(req.hostname.toLowerCase())) {
      res.redirect(308, `https://ff.adeticket.com${req.originalUrl}`);
      return;
    }
    next();
  });
  const ads = options.advertising ?? advertisingConfig({});
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "connect-src": ["'self'", "ws:", "wss:"],
        },
      },
      strictTransportSecurity: options.production ? undefined : false,
    }),
  );
  // Only host and receiver documents need the Google Cast SDK.
  const castHeaders = (receiver: boolean) =>
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'", "https://www.gstatic.com", "https://www.google.com"],
          "frame-src": receiver ? ["https://adeticket.com"] : ["'self'"],
          "connect-src": [
            "'self'",
            "ws:",
            "wss:",
            "https://www.gstatic.com",
            "https://www.google.com",
          ],
        },
      },
      strictTransportSecurity: options.production ? undefined : false,
    });
  app.use("/host", castHeaders(false));
  app.use("/cast", castHeaders(true));
  // Generous shared-IP budget allows phones on one venue Wi-Fi. Do not trust caller-supplied forwarding headers.
  const apiLimiter = rateLimit({
    windowMs: 60000,
    limit: 6000,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    message: { error: "Too many requests. Please wait a minute." },
  });
  const loginLimiter = rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    message: { error: "Too many sign-in attempts. Please wait a minute." },
  });
  app.use("/api", apiLimiter);
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use((req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !originAllowed(req.headers.origin)) {
      res.status(403).json({ error: "Origin not allowed." });
      return;
    }
    next();
  });
  const cookie = (header: string | undefined) =>
    header
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("nf_host="))
      ?.slice(8);
  const principal = (header: string | undefined): Principal | null => {
    const token = cookie(header);
    if (store.platform.enabled()) return store.platform.principal(token);
    return store.authorized(token) ? { id: "legacy-host", email: "", superAdmin: true } : null;
  };
  const canHost = (header: string | undefined, id: string) => {
    const user = principal(header);
    return (
      !!user &&
      (!store.platform.enabled() ||
        (store.platform.activeResource("game", id) &&
          store.platform.canReadResource(user, "game", id)))
    );
  };
  const forbidden = (res: express.Response) =>
    res.status(403).json({ error: "You do not have access to this resource." });
  const auth: express.RequestHandler = (req, res, next) => {
    const user = principal(req.headers.cookie);
    if (!user) {
      res.status(401).json({ error: "Sign in to the host desk." });
      return;
    }
    res.locals.user = user;
    if (store.platform.enabled() && req.params.id) {
      const kind = req.path.startsWith("/api/surveys/") ? "survey" : "game";
      if (
        !store.platform.activeResource(kind, String(req.params.id)) ||
        !store.platform.canReadResource(user, kind, String(req.params.id))
      ) {
        forbidden(res);
        return;
      }
      if (
        req.path.endsWith("/delete") &&
        !store.platform.canManageGroup(
          user,
          store.platform.resourceGroup(kind, String(req.params.id)),
        )
      ) {
        forbidden(res);
        return;
      }
    }
    next();
  };
  const selectedGroup = (req: express.Request, user: Principal) => {
    if (!store.platform.enabled()) return "legacy";
    const requested = req.get("X-Group-Id") ?? req.query.group;
    if (typeof requested === "string" && requested.length <= 100) return requested;
    if (user.superAdmin) return "legacy";
    const groups = store.platform.groups(user).filter((group) => !group.suspended);
    if (groups.length === 1) return groups[0].id;
    throw new Error("Choose a group from your dashboard first.");
  };
  const groupAdmin: express.RequestHandler = (req, res, next) => {
    const groupId = selectedGroup(req, res.locals.user);
    if (store.platform.enabled()) {
      if (groupId === "global") {
        if (
          !res.locals.user.superAdmin ||
          !["/api/packs", "/api/question-usage"].includes(req.path)
        )
          return void forbidden(res);
      } else {
        store.platform.assertActiveGroup(groupId);
        if (!store.platform.canManageGroup(res.locals.user, groupId)) return void forbidden(res);
      }
    }
    res.locals.groupId = groupId;
    next();
  };
  const resourceVisible = (
    req: express.Request,
    kind: "game" | "pack" | "survey",
    id: string,
    group?: string,
  ) => {
    if (!store.platform.enabled()) return true;
    const user = principal(req.headers.cookie);
    return (
      !!user &&
      store.platform.activeResource(kind, id) &&
      (!group ||
        store.platform.resourceGroup(kind, id) === group ||
        (kind === "pack" && store.platform.resourceGroup(kind, id) === "global")) &&
      store.platform.canReadResource(user, kind, id)
    );
  };
  const accessiblePack = (req: express.Request, id: string) => {
    if (!resourceVisible(req, "pack", id, selectedGroup(req, principal(req.headers.cookie)!)))
      throw new Error("Question pack not found or not available to this group.");
    return store.pack(id);
  };
  // Suspension also stops public participation and existing streams, without exposing membership.
  const revokeStreams = () => {
    for (const socket of io.sockets.sockets.values()) {
      const room = socket.data.gameId as string | undefined;
      if (
        room &&
        ((store.platform.enabled() && !store.platform.activeResource("game", room)) ||
          (socket.data.role === "host" && !canHost(socket.request.headers.cookie, room)))
      ) {
        socket.emit("accessRevoked");
        socket.disconnect(true);
      }
    }
  };
  app.use(
    "/api/platform",
    createPlatformRouter(store.platform, {
      authenticate: (req) => (store.platform.enabled() ? principal(req.headers.cookie) : null),
      onAuthorizationChanged: revokeStreams,
      production: !!options.production,
    }),
  );
  app.use(["/api/games/:id", "/api/surveys/:id"], (req, res, next) => {
    if (store.platform.enabled()) {
      const kind = req.originalUrl.startsWith("/api/surveys/") ? "survey" : "game";
      if (!store.platform.activeResource(kind, String(req.params.id))) {
        res.status(404).json({ error: "This room is unavailable." });
        return;
      }
    }
    next();
  });
  app.get("/api/config", (_req, res) =>
    res.json({
      castAppId: /^[A-Fa-f0-9]{8}$/.test(options.castAppId?.trim() ?? "")
        ? options.castAppId?.trim().toUpperCase()
        : null,
    }),
  );
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  const tvPairLimiter = rateLimit({
    windowMs: 60000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const tvRegisterLimiter = rateLimit({
    windowMs: 60000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const tvCredentials = z.object({
    deviceId: z.string().uuid(),
    deviceSecret: z.string().regex(/^[a-f0-9]{64}$/),
  });
  app.post("/api/tv/register", tvRegisterLimiter, (req, res) => {
    const body = tvCredentials
      .extend({ name: z.string().trim().min(1).max(40), renew: z.boolean().optional() })
      .parse(req.body);
    res.json(store.tvRegister(body.deviceId, body.deviceSecret, body.name, body.renew));
  });
  app.post("/api/tv/poll", (req, res) => {
    const body = tvCredentials.parse(req.body);
    const result = store.tvPoll(body.deviceId, body.deviceSecret);
    res.json(
      result.room && store.platform.enabled() && !store.platform.activeResource("game", result.room)
        ? { ...result, room: null }
        : result,
    );
  });
  app.post("/api/tv/pair", tvPairLimiter, (req, res) => {
    const body = z.object({ pairingCode: z.string().regex(/^[A-F0-9]{8}$/) }).parse(req.body);
    res.json(store.tvPair(body.pairingCode));
  });
  app.post("/api/tv/show", (req, res) => {
    const body = z
      .object({
        deviceId: z.string().uuid(),
        controllerToken: z.string().regex(/^[a-f0-9]{64}$/),
        room: z.string().regex(/^[A-F0-9]{6}$/),
      })
      .parse(req.body);
    if (
      !store.has(body.room) ||
      (store.platform.enabled() && !store.platform.activeResource("game", body.room))
    ) {
      res.status(404).json({ error: "Game not found." });
      return;
    }
    res.json(store.tvSend(body.deviceId, body.controllerToken, body.room));
  });
  app.get("/ads.txt", (_req, res) => {
    res.type("text/plain").setHeader("Cache-Control", "public, max-age=300");
    if (!ads.publisher) {
      res.status(404).send("Advertising is not configured.\n");
      return;
    }
    res.send(`google.com, ${ads.publisher.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);
  });
  app.get("/api/surveys", auth, groupAdmin, (req, res) =>
    res.json(
      store.surveys
        .list()
        .filter((survey) => resourceVisible(req, "survey", survey.id, res.locals.groupId)),
    ),
  );
  app.post("/api/surveys", auth, groupAdmin, (req, res) => {
    const survey = store.withResource("survey", res.locals.groupId, () => {
      const value = store.surveys.create(req.body);
      return { id: value.id, value };
    });
    res.status(201).json(survey);
  });
  app.get("/api/surveys/:id/manage", auth, (req, res) =>
    res.json(store.surveys.results(String(req.params.id))),
  );
  app.post("/api/surveys/:id/status", auth, (req, res) => {
    const body = z.object({ open: z.boolean(), revision: z.number().int() }).parse(req.body);
    res.json(store.surveys.setOpen(String(req.params.id), body.open, body.revision));
  });
  app.post("/api/surveys/:id/review", auth, (req, res) =>
    res.json(store.surveys.review(String(req.params.id), req.body)),
  );
  app.get("/api/surveys/:id/export", auth, (req, res) =>
    res.json(store.surveys.export(String(req.params.id))),
  );
  const respondentToken = (req: express.Request) =>
    req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`nf_survey_${req.params.id}=`))
      ?.split("=")[1];
  app.get("/api/surveys/:id", (req, res) => {
    const s = store.surveys.get(String(req.params.id));
    let token = respondentToken(req);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      token = randomBytes(32).toString("hex");
      res.setHeader(
        "Set-Cookie",
        `nf_survey_${s.id}=${token}; HttpOnly; SameSite=Strict; Path=/api/surveys/${s.id}; Max-Age=2592000${options.production ? "; Secure" : ""}`,
      );
    }
    res.json({
      id: s.id,
      title: s.title,
      roundType: s.roundType,
      questions: s.questions,
      open: s.open,
      submitted: store.surveys.submitted(s.id, token),
    });
  });
  const surveyLimiter = rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    message: { error: "Please wait a minute before submitting again." },
  });
  app.post("/api/surveys/:id/responses", surveyLimiter, (req, res) => {
    const token = respondentToken(req);
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new Error("Open the survey form before submitting.");
    store.surveys.submit(String(req.params.id), token, req.body);
    res.json({ ok: true });
  });
  app.get("/api/clock", (_req, res) => res.json({ now: Date.now() }));
  app.get("/api/session", (req, res) => {
    const user = principal(req.headers.cookie);
    res.json({
      authenticated: !!user,
      passwordRequired: !!options.password || store.platform.enabled(),
      multiTenant: store.platform.enabled(),
      user: store.platform.enabled() ? user : null,
      groups: user && store.platform.enabled() ? store.platform.groups(user) : [],
    });
  });
  const verifyPassword = passwordVerifier(options.password);
  app.post("/api/login", loginLimiter, async (req, res) => {
    const token = store.platform.enabled()
      ? await store.platform.login(req.body?.email, req.body?.password)
      : (await verifyPassword(req.body?.password))
        ? store.session()
        : null;
    if (!token) {
      res
        .status(401)
        .json({
          error: store.platform.enabled()
            ? "Email or password is incorrect, or access is unavailable."
            : "Incorrect host passphrase.",
        });
      return;
    }
    res.setHeader(
      "Set-Cookie",
      "nf_host=" +
        token +
        "; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800" +
        (options.production ? "; Secure" : ""),
    );
    res.json({ ok: true });
  });
  app.post("/api/logout", (req, res) => {
    const token = cookie(req.headers.cookie);
    if (token) {
      store.revoke(token);
      store.platform.logout(token);
    }
    revokeStreams();
    res.setHeader(
      "Set-Cookie",
      `nf_host=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${options.production ? "; Secure" : ""}`,
    );
    res.json({ ok: true });
  });
  app.get("/api/packs", auth, groupAdmin, (req, res) =>
    res.json([
      { id: "starter", bank: starterBank },
      { id: "fast-starter", bank: fastBank },
      { id: "ihechi-birthday", bank: birthdayBank },
      ...store.packs().filter((pack) => resourceVisible(req, "pack", pack.id, res.locals.groupId)),
    ]),
  );
  app.post("/api/packs", auth, groupAdmin, (req, res) => {
    const bank = bankSchema.parse(req.body);
    const id = store.withResource("pack", res.locals.groupId, () => {
      const id = store.addPack(bank);
      return { id, value: id };
    });
    res.status(201).json({ id });
  });
  app.get("/api/games", auth, (req, res) => {
    const groupId = store.platform.enabled() ? selectedGroup(req, res.locals.user) : undefined;
    res.json(
      store
        .list()
        .filter((game) => resourceVisible(req, "game", game.id, groupId))
        .map((game) => {
          const state = store.saved(game.id).state;
          return {
            ...game,
            scores: state.scores,
            winner: state.winner,
            lobby: state.lobby ?? false,
            groupId: store.platform.resourceGroup("game", game.id),
          };
        }),
    );
  });
  app.get("/api/question-usage", auth, groupAdmin, (req, res) =>
    res.json(
      store
        .questionUsage()
        .filter((use) =>
          resourceVisible(
            req,
            "game",
            use.game,
            res.locals.groupId === "global" ? undefined : res.locals.groupId,
          ),
        ),
    ),
  );
  app.post("/api/rehearsals", auth, groupAdmin, (req, res) => {
    const { scenario, packId, questionIds } = z
      .object({
        scenario: z.enum(["round", "fast"]),
        packId: z.string().optional(),
        questionIds: z.array(z.string()).length(5).optional(),
      })
      .parse(req.body);
    let selected: Question[] | undefined;
    if (packId !== undefined || questionIds !== undefined) {
      if (scenario !== "fast" || !packId || !questionIds)
        throw new Error("Choose a pack and five questions for a Fast Money rehearsal.");
      const bank =
        packId === "starter"
          ? starterBank
          : packId === "fast-starter"
            ? fastBank
            : packId === "ihechi-birthday"
              ? birthdayBank
              : accessiblePack(req, packId);
      if (!bank) throw new Error("Question pack not found.");
      const found = questionIds.map((id) => bank.questions.find((q) => q.id === id));
      if (new Set(questionIds).size !== 5 || found.some((q) => !q))
        throw new Error("Choose five different questions from this pack.");
      selected = found.filter((q): q is Question => Boolean(q));
      if (new Set(selected.map((q) => questionKey(q.prompt))).size !== 5)
        throw new Error("Choose five different question prompts.");
      validateFastSet(selected);
    }
    let id = randomBytes(3).toString("hex").toUpperCase();
    while (store.has(id)) id = randomBytes(3).toString("hex").toUpperCase();
    store.withResource("game", res.locals.groupId, () => {
      store.add(createRehearsal(id, scenario, selected));
      return { id, value: id };
    });
    res.status(201).json({ id });
  });
  app.post("/api/games", auth, groupAdmin, (req, res) => {
    const setup = setupSchema.parse(req.body);
    const reuseFrom = z
      .string()
      .regex(/^[A-F0-9]{6}$/)
      .optional()
      .parse(req.body.reuseFrom);
    if (reuseFrom) {
      if (!resourceVisible(req, "game", reuseFrom, res.locals.groupId)) return void forbidden(res);
      const previous = store.host(reuseFrom);
      if (previous.phase !== "finished" || previous.rehearsal)
        throw new Error("Finish the previous real game before reusing its teams and phones.");
      const existing = store.nextGame(reuseFrom);
      if (existing) {
        if (!resourceVisible(req, "game", existing, res.locals.groupId)) return void forbidden(res);
        return void res.json({ id: existing });
      }
      setup.teams = previous.teams;
    }
    const bank =
      setup.packId === "ihechi-birthday"
        ? birthdayBank
        : setup.packId && setup.packId !== "starter"
          ? accessiblePack(req, setup.packId)
          : starterBank;
    if (!bank) throw new Error("Question pack not found.");
    if ((bank.roundType ?? "regular") !== "regular")
      throw new Error("Choose a regular-round pack for regular rounds.");
    const fastPack = setup.sharedQuestionBank
      ? bank
      : !setup.fastPackId || setup.fastPackId === "fast-starter"
        ? fastBank
        : accessiblePack(req, setup.fastPackId);
    if (!fastPack || (!setup.sharedQuestionBank && fastPack.roundType !== "fast-money"))
      throw new Error("Choose a Fast Money pack for Fast Money.");
    const usage = store
      .questionUsage()
      .filter((use) => resourceVisible(req, "game", use.game, res.locals.groupId));
    const availableRegular = eligibleQuestions(bank.questions, usage, setup.excludeAfterUses);
    const availableFast = eligibleQuestions(fastPack.questions, usage, setup.excludeAfterUses);
    const fastIds = setup.fastQuestionIds ?? fastPack.questions.slice(0, 5).map((q) => q.id);
    const selectedFast = fastIds.map((id) => {
      const question = availableFast.find((q) => q.id === id);
      if (!question)
        throw new Error("Fast Money question unavailable or excluded by usage limit: " + id);
      return question;
    });
    validateFastSet(selectedFast);
    const reservedFast = new Set(selectedFast.map((q) => questionKey(q.prompt)));
    const questions = setup.questionIds
      .map((id) => {
        const q = availableRegular.find((q) => q.id === id);
        if (!q) throw new Error("Question unavailable or excluded by usage limit: " + id);
        return q;
      })
      .filter((q) => !setup.sharedQuestionBank || !reservedFast.has(questionKey(q.prompt)));
    let id = randomBytes(3).toString("hex").toUpperCase();
    while (store.has(id)) id = randomBytes(3).toString("hex").toUpperCase();
    const created = createGame(id, setup, questions, selectedFast, bank.notice);
    if (store.platform.enabled()) created.lobby = true;
    if (reuseFrom) store.addWithPlayers(created, reuseFrom, res.locals.groupId);
    else
      store.withResource("game", res.locals.groupId, () => {
        store.add(created);
        return { id, value: id };
      });
    res.status(201).json({ id });
  });
  app.get("/api/games/:id/host", auth, (req, res) => res.json(store.host(String(req.params.id))));
  app.get("/api/games/:id/audience", (req, res) =>
    res.json(audience(store.saved(req.params.id).state)),
  );
  const broadcast = (id: string) => {
    if (store.platform.enabled() && !store.platform.activeResource("game", id)) {
      revokeStreams();
      return;
    }
    const state = store.host(id);
    const { canUndo: _canUndo, history: _history, ...game } = state;
    io.to(id + ":audience").emit("state", audience(game));
    io.to(id + ":audience").emit("buzzer", buzzers.public(id));
    let hostBuzzers: ReturnType<typeof buzzers.host> | undefined;
    for (const socketId of io.sockets.adapter.rooms.get(id + ":host") ?? []) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        if (canHost(socket.request.headers.cookie, id)) {
          socket.emit("state", state);
          socket.emit("buzzers", (hostBuzzers ??= buzzers.host(id)));
        } else {
          socket.emit("accessRevoked");
          socket.disconnect(true);
        }
      }
    }
  };
  const playerToken = (req: express.Request) =>
    req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("nf_player_" + req.params.id + "="))
      ?.split("=")[1];
  app.post("/api/games/:id/rehearsal/buzz", auth, (req, res) => {
    const { team, epoch } = z
      .object({ team: z.union([z.literal(0), z.literal(1)]), epoch: z.string().uuid() })
      .parse(req.body);
    buzzers.simulate(String(req.params.id), team, epoch);
    broadcast(String(req.params.id));
    res.json({ ok: true });
  });
  app.post("/api/games/:id/delete", auth, (req, res) => {
    const { revision, endedOnly } = z
      .object({ revision: z.number().int().min(0), endedOnly: z.boolean().optional() })
      .parse(req.body);
    const id = String(req.params.id);
    if (endedOnly && store.host(id).phase !== "finished")
      throw new Error("This game is active. End it before bulk cleanup.");
    const players = store.players(id).map((p) => p.id);
    store.remove(id, revision);
    buzzers.forget(id, players);
    io.to(id + ":audience")
      .to(id + ":host")
      .emit("gameDeleted");
    io.in(id + ":audience").disconnectSockets(true);
    io.in(id + ":host").disconnectSockets(true);
    res.json({ ok: true });
  });
  app.get("/api/games/:id/buzzers", auth, (req, res) =>
    res.json(buzzers.host(String(req.params.id))),
  );
  app.get("/api/games/:id/diagnostics", auth, (req, res) => {
    const id = String(req.params.id);
    const host = store.host(id);
    const players = store.players(id);
    res.json({
      serverTime: Date.now(),
      revision: host.revision,
      phase: host.phase,
      hostConnections: io.sockets.adapter.rooms.get(id + ":host")?.size ?? 0,
      audienceConnections: io.sockets.adapter.rooms.get(id + ":audience")?.size ?? 0,
      registeredPlayers: players.length,
      approvedPlayers: players.filter((p) => p.approved).length,
    });
  });
  app.post("/api/games/:id/buzzers", auth, (req, res) => {
    const body = z
      .object({
        action: z.enum(["arm", "lock", "approve", "remove", "removeAll", "stage", "bench"]),
        playerId: z.string().uuid().optional(),
      })
      .parse(req.body);
    buzzers.control(String(req.params.id), body.action, body.playerId);
    broadcast(String(req.params.id));
    res.json(buzzers.host(String(req.params.id)));
  });
  app.get("/api/games/:id/player", (req, res) =>
    res.json({
      player: store.player(req.params.id, playerToken(req)),
      buzzer: buzzers.public(req.params.id),
      nextGame: store.player(req.params.id, playerToken(req))?.approved
        ? store.nextGame(req.params.id)
        : null,
    }),
  );
  app.post("/api/games/:id/player/continue", (req, res) => {
    const source = String(req.params.id),
      token = playerToken(req),
      target = store.nextGame(source);
    if (
      !token ||
      !target ||
      !store.player(source, token)?.approved ||
      !store.player(target, token)?.approved ||
      (store.platform.enabled() && !store.platform.activeResource("game", target))
    )
      return void res.status(403).json({
        error:
          "This phone is not approved for the next game. Ask the host to check your registration.",
      });
    res.setHeader(
      "Set-Cookie",
      `nf_player_${target}=${token}; HttpOnly; SameSite=Strict; Path=/api/games/${target}; Max-Age=604800${options.production ? "; Secure" : ""}`,
    );
    res.json({ id: target });
  });
  app.post("/api/games/:id/player", (req, res) => {
    const body = z
      .object({
        team: z.union([z.literal(0), z.literal(1)]),
        member: z.number().int().min(0).max(11).optional(),
        name: z.string().trim().min(1).max(100).optional(),
      })
      .parse(req.body);
    const id = String(req.params.id),
      token =
        body.name !== undefined
          ? buzzers.register(id, body.team, body.name, playerToken(req))
          : buzzers.join(id, body.team, body.member ?? -1, playerToken(req));
    res.setHeader(
      "Set-Cookie",
      `nf_player_${id}=${token}; HttpOnly; SameSite=Strict; Path=/api/games/${id}; Max-Age=604800${options.production ? "; Secure" : ""}`,
    );
    broadcast(id);
    res.json({ player: store.player(id, token), buzzer: buzzers.public(id) });
  });
  app.post("/api/games/:id/player/buzz", (req, res) => {
    const { epoch } = z.object({ epoch: z.string().uuid() }).parse(req.body);
    buzzers.buzz(String(req.params.id), playerToken(req), epoch);
    broadcast(String(req.params.id));
    res.json({ ok: true });
  });
  app.post("/api/games/:id/player/heartbeat", (req, res) => {
    const { visible } = z.object({ visible: z.boolean() }).parse(req.body);
    buzzers.heartbeat(String(req.params.id), playerToken(req), visible);
    res.json({ ok: true });
  });
  app.get("/api/games/:id/player/answer", (req, res) => {
    res.json(store.remotePlay.playerView(String(req.params.id), playerToken(req)));
  });
  app.post("/api/games/:id/player/answer", (req, res) => {
    res.json(store.remotePlay.submit(String(req.params.id), playerToken(req), req.body));
  });
  app.get("/api/games/:id/answers", auth, (req, res) => {
    res.json(store.remotePlay.hostView(String(req.params.id)));
  });
  const expireTimers = () => {
    for (const id of store.expiredFastGames()) {
      if (store.platform.enabled() && !store.platform.activeResource("game", id)) continue;
      const s = store.host(id);
      store.apply(id, { id: randomUUID(), revision: s.revision, command: { type: "fastEndTurn" } });
      broadcast(id);
    }
  };
  const timerWorker = setInterval(expireTimers, 250);
  timerWorker.unref();
  // Expired/recovered accounts must lose existing streams even when the room is idle.
  const authorizationWorker = setInterval(revokeStreams, 1000);
  authorizationWorker.unref();
  app.post("/api/games/:id/commands", auth, (req, res) => {
    try {
      const state = store.apply(
        String(req.params.id),
        envelopeSchema.parse(req.body),
        res.locals.user.id,
      );
      broadcast(String(req.params.id));
      res.json(state);
    } catch (e) {
      res.status(409).json({ error: e instanceof Error ? e.message : "Command failed." });
    }
  });
  io.on("connection", (socket) => {
    socket.on("join", (input: { id?: string; role?: string }, ack?: (r: unknown) => void) => {
      try {
        if (
          !input ||
          typeof input.id !== "string" ||
          !["host", "audience"].includes(input.role ?? "")
        )
          throw new Error("Invalid room.");
        if (store.platform.enabled() && !store.platform.activeResource("game", input.id))
          throw new Error("This room is unavailable.");
        const state = store.saved(input.id).state;
        for (const room of socket.rooms) if (room !== socket.id) socket.leave(room);
        if (input.role === "host") {
          if (!canHost(socket.request.headers.cookie, input.id))
            throw new Error("Host access required.");
          socket.join(input.id + ":host");
          socket.emit("state", store.host(input.id));
          socket.emit("buzzers", buzzers.host(input.id));
        } else {
          socket.join(input.id + ":audience");
          socket.emit("state", audience(state));
          socket.emit("buzzer", buzzers.public(input.id));
        }
        socket.data.gameId = input.id;
        socket.data.role = input.role;
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ error: e instanceof Error ? e.message : "Could not join." });
      }
    });
  });
  const web = options.webDir ?? resolve(existsSync(resolve("web")) ? "web" : "dist/web");
  if (existsSync(web)) {
    const staticSites = resolve(web, "../sites");
    app.use((req, res, next) => {
      const hostname = (req.hostname || "").toLowerCase();
      const site =
        hostname === "play.adeticket.com"
          ? "catalogue"
          : hostname === "kayodeadetunji.com"
            ? "portfolio"
            : hostname === "adeticket.com"
              ? "adeticket"
              : undefined;
      if (!site || req.path !== "/" || !existsSync(resolve(staticSites, site, "index.html"))) {
        next();
        return;
      }
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.sendFile(resolve(staticSites, site, "index.html"));
    });
    app.use((req, res, next) => {
      const hostname = (req.hostname || "").toLowerCase();
      const site =
        hostname === "play.adeticket.com"
          ? "catalogue"
          : hostname === "kayodeadetunji.com"
            ? "portfolio"
            : hostname === "adeticket.com"
              ? "adeticket"
              : undefined;
      if (!site || !req.path.startsWith("/site-assets/")) {
        next();
        return;
      }
      const asset = req.path.slice("/site-assets/".length);
      res.sendFile(resolve(staticSites, site, asset), (error) => error && next());
    });
    app.get("/rules", (_req, res, next) => {
      if (!ads.enabled) {
        next();
        return;
      }
      const document = advertisingDocument(readFileSync(resolve(web, "index.html"), "utf8"), ads);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Security-Policy", document.csp);
      res.type("html").send(document.html);
    });
    // Static assets and SPA navigation share a separate budget from API polling.
    app.use(
      rateLimit({
        windowMs: 60000,
        limit: 6000,
        standardHeaders: true,
        legacyHeaders: false,
        validate: { xForwardedForHeader: false },
        skip: (req) => req.path === "/api" || req.path.startsWith("/api/"),
        message: "Too many page requests. Please wait a minute.",
      }),
    );
    app.use(
      express.static(web, {
        setHeaders: (res, path) => {
          // Vite fingerprints built assets; HTML must revalidate after each deployment.
          const fingerprinted = /[\\/]assets[\\/][^\\/]+-[\w-]{8,}\.[\w]+$/.test(path);
          res.setHeader(
            "Cache-Control",
            fingerprinted
              ? "public, max-age=31536000, immutable"
              : "public, max-age=0, must-revalidate",
          );
        },
      }),
    );
    app.get("/{*path}", (req, res) => {
      if (req.path.startsWith("/api/")) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.sendFile("index.html", { root: web });
    });
  }
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res
        .status(err instanceof PlatformError ? err.status : 400)
        .json({ error: err.message || "Invalid request." });
    },
  );
  return {
    app,
    http,
    io,
    store,
    buzzers,
    expireTimers,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(timerWorker);
        clearInterval(authorizationWorker);
        bibleBlitz.dispose();
        io.close(() => {
          store.close();
          resolve();
        });
      }),
  };
}
