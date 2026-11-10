import express from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { Platform, PlatformError, type Principal } from "./platform";

export function createPlatformRouter(
  platform: Platform,
  options: {
    authenticate(req: express.Request): Principal | null;
    onAuthorizationChanged(): void;
    production: boolean;
  },
) {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  const invitationLimiter = rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    message: { error: "Too many invitation attempts. Please wait a minute." },
  });
  const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
  router.post("/invitation-info", invitationLimiter, (req, res) => {
    const body = z.object({ token: tokenSchema }).parse(req.body);
    res.json(platform.invitationInfo(body.token));
  });
  router.post("/invitations/accept", invitationLimiter, async (req, res) => {
    const body = z
      .object({ token: tokenSchema, email: z.string().max(254), password: z.string().max(128) })
      .parse(req.body);
    const token = await platform.acceptInvitation(body.token, body.email, body.password);
    res.setHeader(
      "Set-Cookie",
      `nf_host=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${options.production ? "; Secure" : ""}`,
    );
    options.onAuthorizationChanged();
    res.json({ ok: true });
  });
  router.use((req, res, next) => {
    const p = options.authenticate(req);
    if (!p) {
      res.status(401).json({ error: "Sign in to your administrator account." });
      return;
    }
    res.locals.principal = p;
    next();
  });
  const principal = (res: express.Response) => res.locals.principal as Principal;
  router.get("/me", (_req, res) => {
    const user = principal(res);
    res.json({
      user,
      groups: platform.groups(user),
      ...(user.superAdmin ? { stats: platform.stats(user) } : {}),
    });
  });
  router.post("/groups", (req, res) => {
    const body = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
    res.status(201).json(platform.createGroup(principal(res), body.name));
  });
  router.get("/groups/:id", (req, res) => {
    const p = principal(res),
      id = String(req.params.id),
      group = platform.groups(p).find((g) => g.id === id);
    if (!group) throw new PlatformError("Group not found.", 404);
    if (!p.superAdmin) platform.assertActiveGroup(id);
    const manage = platform.canManageGroup(p, id);
    res.json({
      group,
      members: manage ? platform.members(p, id) : [],
      invitations: manage ? platform.invitations(p, id) : [],
      resources: {
        games: platform
          .resourceIds("game", id)
          .filter((game) => manage || platform.canReadResource(p, "game", game)),
        packs: manage ? platform.resourceIds("pack", id) : [],
        surveys: manage ? platform.resourceIds("survey", id) : [],
      },
      hosts: manage ? platform.hosts(p, id) : [],
      audit: manage ? platform.auditLog(p, id) : [],
    });
  });
  router.post("/groups/:id", (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        suspended: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    platform.updateGroup(principal(res), String(req.params.id), body);
    options.onAuthorizationChanged();
    res.json({ ok: true });
  });
  router.post("/groups/:id/members", (req, res) => {
    const body = z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "host"]),
        remove: z.boolean().optional(),
      })
      .parse(req.body);
    platform.setMember(principal(res), String(req.params.id), body.userId, body.role, body.remove);
    options.onAuthorizationChanged();
    res.json({ ok: true });
  });
  router.post("/groups/:id/invitations", (req, res) => {
    const body = z
      .object({ email: z.string().email().max(254), role: z.enum(["admin", "host"]) })
      .parse(req.body);
    res
      .status(201)
      .json(platform.invite(principal(res), String(req.params.id), body.email, body.role));
  });
  router.post("/invitations/:id/revoke", (req, res) => {
    platform.revokeInvitation(principal(res), String(req.params.id));
    res.json({ ok: true });
  });
  router.get("/users", (_req, res) => res.json(platform.users(principal(res))));
  router.post("/users/:id/suspension", (req, res) => {
    const body = z.object({ suspended: z.boolean() }).parse(req.body);
    platform.suspendUser(principal(res), String(req.params.id), body.suspended);
    options.onAuthorizationChanged();
    res.json({ ok: true });
  });
  router.get("/audit", (req, res) => {
    const groupId = z.string().optional().parse(req.query.groupId);
    res.json(platform.auditLog(principal(res), groupId));
  });
  router.post("/games/:id/hosts", (req, res) => {
    const body = z
      .object({ userId: z.string().uuid(), remove: z.boolean().optional() })
      .parse(req.body);
    platform.assignHost(principal(res), String(req.params.id), body.userId, body.remove);
    options.onAuthorizationChanged();
    res.json({ ok: true });
  });
  router.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof PlatformError) res.status(error.status).json({ error: error.message });
      else if (error instanceof z.ZodError)
        res.status(400).json({ error: error.issues[0]?.message ?? "Check the submitted fields." });
      else
        res
          .status(500)
          .json({ error: "The account operation could not be completed. Please try again." });
    },
  );
  return router;
}
