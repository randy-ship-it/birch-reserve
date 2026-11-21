# Collaborating: giving someone (or their AI) access

Plain steps for Randy. Nobody gets access without Randy doing these steps himself.

## 1. GitHub (code)

Repo: `randy-ship-it/birch-reserve` (and, for the Scale side, `silverbirchgrowth/scalehealthnew`).

1. github.com/randy-ship-it/birch-reserve → **Settings → Collaborators** (on an organization repo: **Collaborators and
   teams**) → **Add people** → their GitHub username or email.
2. Pick the role:
   | Role | Use for |
   |---|---|
   | Read | Reviewers, advisors, an AI that only needs to read the code and docs |
   | Triage | Someone managing issues/PRs without pushing code |
   | Write | Developers and coding agents that open branches and PRs (default for builders) |
   | Maintain / Admin | Only people you'd trust with repo settings. Rarely needed |
   On a personal-account repo, every collaborator gets Write; use an organization repo if you need Read-only.
3. They accept the email invite. Their AI agent then works through *their* GitHub login or a token they create for
   themselves. Never give anyone your token.
4. Protect `main`: Settings → Branches → rule for `main` → require a pull request before merging. Merges to `main` go
   live, so you (or someone you name) approve them.
5. To remove someone: same screen → **Remove**.

## 2. Vercel (deploys, logs, env)

Most collaborators don't need Vercel: PRs get preview links automatically. Only add people who must read logs or manage
deploys.

1. vercel.com → team `sbg-516724e0` → **Settings → Members → Invite** → email.
2. Role: **Viewer** (see deploys/logs) for most; **Developer** (deploy previews, can't change production env) for
   builders; **Owner** only for you. Seats may cost money on the Pro plan.
3. Remove under the same screen.

## 3. Environment variables they'd need

To run the API locally they need their **own** values, not production's:

| Var | Local value |
|---|---|
| `DATABASE_URL` | their own local Postgres (or a Neon branch you create for them) |
| `SESSION_SECRET` | any random string they generate |
| `STRIPE_SECRET_KEY` | a Stripe **test** key (`sk_test_…`) from a test account, never live |
| `CLERK_SECRET_KEY`, `RESEND_API_KEY`, AI keys | only if they work on those features; use test/dev keys |

The full list is in `docs/VERCEL-ENV.md`. Most ad-system work needs none of these: the tests run on PGlite.

## 4. Never share secrets in chat

- Don't paste keys, tokens, passwords or `.env` files into Slack, email, texts, AI chats or GitHub issues.
- If a secret leaks: rotate it in the provider (Stripe, Resend, Vercel…), then update Vercel env. Assume it's burned.
- Give people their own keys (test mode) or Vercel access, not copies of yours.

## 5. Sharing the docs

- **Collaborators with repo access:** send `https://github.com/randy-ship-it/birch-reserve/blob/main/docs/README.md`
  and `AGENTS.md`. AI agents should read `AGENTS.md` first.
- **Outside teams (no repo access):** send public pages: https://birchreserve.net/ads/specs (creative specs),
  https://birchreserve.net/ads/hub-kit (hub drop-in kit, unlisted), https://birchreserve.net/ads/docs (embed + pixel).
- **Hub builders (Scale Health Connect team):** the hub kit link only. They don't need, and shouldn't get, write
  access to this repo, and we don't touch theirs.

## 6. Working agreement for new collaborators

- Branch from `main`, open a PR, keep it small, include tests for behaviour changes.
- Follow the rules in `AGENTS.md` (no secrets, no fake activity, don't touch ScaleHealth Connect or Align ops).
- Don't merge your own PR to `main` unless Randy said so for that change.
