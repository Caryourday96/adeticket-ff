import express from "express";
import helmet from "helmet";
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { passwordVerifier } from "./password";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { Server } from "socket.io";
import { bankSchema, envelopeSchema, setupSchema } from "@naija/contracts";
import { starterBank, fastQuestions } from "@naija/content";
import { audience, createGame } from "@naija/game";
import { Store } from "./store";
import { Buzzers } from "./buzzers";
import { z } from "zod";
import { createRehearsal } from "./rehearsal";
export function createApplication(options: {
  database: string;
  password?: string;
  production?: boolean;
  origin?: string;
  webDir?: string;
}) {
  if (options.production && !options.password)
    throw new Error("HOST_PASSWORD is required in production.");
  if (options.production && !options.origin)
    throw new Error("APP_ORIGIN is required in production.");
  const store = new Store(options.database),
    app = express(),
    http = createServer(app);
  const buzzers = new Buzzers(store);
  const origins = new Set([
    options.origin ?? "http://localhost:3000",
    ...(!options.production
      ? ["http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:3000"]
      : []),
  ]);
  const originAllowed = (origin: string | undefined) => !origin || origins.has(origin);
  const io = new Server(http, {
    maxHttpBufferSize: 20000,
    allowRequest: (req, cb) => cb(null, originAllowed(req.headers.origin)),
  });
  app.disable("x-powered-by");
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
  const auth: express.RequestHandler = (req, res, next) => {
    if (!store.authorized(cookie(req.headers.cookie))) {
      res.status(401).json({ error: "Sign in to the host desk." });
      return;
    }
    next();
  };
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/clock", (_req, res) => res.json({ now: Date.now() }));
  app.get("/api/session", (req, res) =>
    res.json({
      authenticated: store.authorized(cookie(req.headers.cookie)),
      passwordRequired: !!options.password,
    }),
  );
  const verifyPassword = passwordVerifier(options.password);
  app.post("/api/login", loginLimiter, async (req, res) => {
    if (!(await verifyPassword(req.body?.password))) {
      res.status(401).json({ error: "Incorrect host passphrase." });
      return;
    }
    const token = store.session();
    res.setHeader(
      "Set-Cookie",
      "nf_host=" +
        token +
        "; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800" +
        (options.production ? "; Secure" : ""),
    );
    res.json({ ok: true });
  });
  app.post("/api/logout", auth, (req, res) => {
    store.revoke(cookie(req.headers.cookie)!);
    res.setHeader("Set-Cookie", "nf_host=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
    res.json({ ok: true });
  });
  app.get("/api/packs", auth, (_req, res) =>
    res.json([{ id: "starter", bank: starterBank }, ...store.packs()]),
  );
  app.post("/api/packs", auth, (req, res) => {
    const bank = bankSchema.parse(req.body);
    res.status(201).json({ id: store.addPack(bank) });
  });
  app.get("/api/games", auth, (_req, res) => res.json(store.list()));
  app.post("/api/rehearsals", auth, (req, res) => {
    const { scenario } = z.object({ scenario: z.enum(["round", "fast"]) }).parse(req.body);
    let id = randomBytes(3).toString("hex").toUpperCase();
    while (store.has(id)) id = randomBytes(3).toString("hex").toUpperCase();
    store.add(createRehearsal(id, scenario));
    res.status(201).json({ id });
  });
  app.post("/api/games", auth, (req, res) => {
    const setup = setupSchema.parse(req.body);
    const bank =
      setup.packId && setup.packId !== "starter" ? store.pack(setup.packId) : starterBank;
    if (!bank) throw new Error("Question pack not found.");
    const questions = setup.questionIds.map((id) => {
      const q = bank.questions.find((q) => q.id === id);
      if (!q) throw new Error("Unknown question: " + id);
      return q;
    });
    let id = randomBytes(3).toString("hex").toUpperCase();
    while (store.has(id)) id = randomBytes(3).toString("hex").toUpperCase();
    store.add(createGame(id, setup, questions, fastQuestions, bank.notice));
    res.status(201).json({ id });
  });
  app.get("/api/games/:id/host", auth, (req, res) => res.json(store.host(String(req.params.id))));
  app.get("/api/games/:id/audience", (req, res) =>
    res.json(audience(store.saved(req.params.id).state)),
  );
  const broadcast = (id: string) => {
    const state = store.host(id);
    const { canUndo: _canUndo, history: _history, ...game } = state;
    io.to(id + ":audience").emit("state", audience(game));
    io.to(id + ":audience").emit("buzzer", buzzers.public(id));
    let hostBuzzers: ReturnType<typeof buzzers.host> | undefined;
    for (const socketId of io.sockets.adapter.rooms.get(id + ":host") ?? []) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        if (store.authorized(cookie(socket.request.headers.cookie))) {
          socket.emit("state", state);
          socket.emit("buzzers", (hostBuzzers ??= buzzers.host(id)));
        } else socket.disconnect(true);
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
    const { revision } = z.object({ revision: z.number().int().min(0) }).parse(req.body);
    const id = String(req.params.id);
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
  app.post("/api/games/:id/buzzers", auth, (req, res) => {
    const body = z
      .object({
        action: z.enum(["arm", "lock", "approve", "remove"]),
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
    }),
  );
  app.post("/api/games/:id/player", (req, res) => {
    const body = z
      .object({
        team: z.union([z.literal(0), z.literal(1)]),
        member: z.number().int().min(0).max(11),
      })
      .parse(req.body);
    const id = String(req.params.id),
      token = buzzers.join(id, body.team, body.member, playerToken(req));
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
  const expireTimers = () => {
    for (const id of store.expiredFastGames()) {
      const s = store.host(id);
      store.apply(id, { id: randomUUID(), revision: s.revision, command: { type: "fastEndTurn" } });
      broadcast(id);
    }
  };
  const timerWorker = setInterval(expireTimers, 250);
  timerWorker.unref();
  app.post("/api/games/:id/commands", auth, (req, res) => {
    try {
      const state = store.apply(String(req.params.id), envelopeSchema.parse(req.body));
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
        const state = store.saved(input.id).state;
        for (const room of socket.rooms) if (room !== socket.id) socket.leave(room);
        if (input.role === "host") {
          if (!store.authorized(cookie(socket.request.headers.cookie)))
            throw new Error("Host access required.");
          socket.join(input.id + ":host");
          socket.emit("state", store.host(input.id));
          socket.emit("buzzers", buzzers.host(input.id));
        } else {
          socket.join(input.id + ":audience");
          socket.emit("state", audience(state));
          socket.emit("buzzer", buzzers.public(input.id));
        }
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ error: e instanceof Error ? e.message : "Could not join." });
      }
    });
  });
  const web = options.webDir ?? resolve(existsSync(resolve("web")) ? "web" : "dist/web");
  if (existsSync(web)) {
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
      res.sendFile(resolve(web, "index.html"));
    });
  }
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(400).json({ error: err.message || "Invalid request." });
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
        io.close(() => {
          store.close();
          resolve();
        });
      }),
  };
}
