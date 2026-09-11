# Architecture and maintenance

## Dependency direction

The web and server consume shared contracts. The server consumes the game engine and question content. The game engine consumes only contracts. The browser bundle never imports the seed question banks.

```text
apps/web ────────> packages/contracts
    │               ▲
    └─ host preview ─┤
                 packages/game <── apps/server ──> packages/content
                                      │
                                    SQLite
```

## Data flow

A host command carries a UUID and expected revision. The server authenticates the session, validates its schema, rejects stale revisions, and applies a pure game transition. A SQLite transaction saves the new snapshot, undo history, and command ID before publishing state.

Repeated command IDs return the existing state. Every accepted action increments the revision, including undo. Audience clients receive an explicit projection with hidden texts and points replaced by null; private questions, aliases, and notes are excluded. Tests cover both HTTP and Socket.IO delivery.

The UI never awards points locally. Socket reconnection rejoins the room and receives a full current snapshot. The browser can refresh without losing the game. Timer deadlines live on the server, and late submissions are rejected there.

## Modules

- `contracts`: Zod validation at boundaries; shared discriminated commands and state types.
- `game`: deterministic phase transitions plus audience projection. It takes time as a parameter for testability.
- `content`: seed data and validation. Questions are snapshotted into each game.
- `store`: SQLite and command transactions, undo snapshots, session tokens hashed at rest.
- `app`: transport and authentication. Does not calculate scores.
- `useGame`: initial fetch, live connection, revision-aware updates, and command submission.

## Authentication boundary

One shared host passphrase authenticates trusted organizers. Production requires a passphrase and exact public origin. Sessions last seven days and use HttpOnly, SameSite=Strict cookies, plus Secure in production. No host token is placed in the QR code or URL.

All authenticated hosts can manage all games. Room codes are public-viewing locators, not private audience credentials. Individual host accounts, role delegation, and private audience rooms are future work.

## Persistence and scale

The initial store is SQLite with DELETE journaling and a five-second busy timeout. Use a single application process and a filesystem with compatible locking. Up to 100 prior states are retained for undo. Question packs and sessions are also persisted.

Before Azure deployment, confirm a durable storage choice. Do not assume an arbitrary shared network mount is suitable for SQLite. A managed-database adapter is the next step if the hosting filesystem is unsuitable or multiple instances are required.

## Extension points

Add source provenance to question packs without putting extraction logic in the game server. The future YouTube/X project exports reviewed JSON to this schema.

A new scoring preset belongs in shared rules and transition tests. A different skin belongs in the web components/styles. A new database implementation should preserve atomic command IDs and revisions.

## Deliberate limits

- No automatic voice recognition.
- Host adjudication is required for semantic aliases and off-board duplicates.
- Fast Money uses one sample set; repeated games repeat those five questions.
- A game never repeats questions. If a custom pack runs out before the winning target, the host receives an error; select a larger pack or lower target before starting.
- Optional sound is currently on the host device, not synchronized to every audience phone.

## Buzzer implementation

Phone registrations are persisted in SQLite with hashed random credentials. HttpOnly cookies are scoped to the specific game API path. Approval and removal require host authorization. The public player response contains its own registration and buzzer status, with no private question data. Socket broadcasts contain only public buzzer status; the host stream includes registrations without credentials.

Buzzer gates are in memory and bound to game revisions and fresh UUID epochs. The synchronous server handler validates approval, roster identity, active contestant, phase, pause state, and epoch before applying the first buzz. A state change invalidates the gate; explicit rearming rejects delayed packets from previous attempts. Keep a single application process. Multi-instance hosting requires a shared atomic buzzer coordinator.

## Required-category scheduling

Optional setup.requiredGroups contains category/count pairs. createGame calls the shared scheduleQuestions function so the server enforces availability, distinct categories, and a four-question reservation limit. Reserved questions lead the persisted question snapshot without duplicates. minimumRounds records the required prefix length; older saves omit it and default to one. Awarding points checks this minimum before declaring a champion, compares scores if either team has reached the target, and continues ties.
