# Shared leaderboard deployment

The frontend remains on GitHub Pages. Supabase provides a Postgres database and one Edge Function. A connected Supabase account/project is required; no production backend is configured yet.

1. Create or select a Supabase project.
2. Apply `supabase/migrations/202611140001_isomass_leaderboard.sql`.
3. Run `node scripts/prepare-edge.mjs`.
4. Deploy `supabase/functions/isomass-leaderboard` with JWT verification disabled (`supabase functions deploy isomass-leaderboard --project-ref PROJECT_REF --no-verify-jwt`). Public reads/signup are intentionally open; the handler checks its own opaque bearer sessions for submissions.
5. Set only the public function URL in `docs/leaderboard-config.js`, for example `https://PROJECT_REF.supabase.co/functions/v1/isomass-leaderboard`.
6. Verify health, signup, login, a replayed submission, standings from another session, CORS and denied direct anonymous table access. Remove test players through the database (foreign-key cascades remove their scores).
7. Commit/push the frontend and confirm the Pages build.

Supabase supplies the server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables. Never put service credentials in docs, git, browser storage, or command output. The deployed function uses REST directly; there are no third-party runtime dependencies.

Names are normalized, case-insensitive and unique. Passwords use PBKDF2-SHA256 with 120,000 iterations and random per-player salts. Random 256-bit sessions are stored hashed, expire in 90 days, and can be revoked by sign-out. Public output contains name, rank and challenge points. Anonymous/authenticated database roles have no table/view/RPC access. Service-role access is server-only.

The server replays at most 1,000 actions, computes points and stores a trace hash, not a client-supplied score. This checks a rule-consistent solution, not human play or anti-bot proof. Signup/login/submission requests are rate limited. The proxy's x-forwarded-for header is used for account limits. No email or account recovery is provided; players keep their passphrase.

For moderation, look up a specific player by name, confirm the record, then delete that player's row through the database to remove the entry and sessions. This is an operator action, not a public endpoint. For a reset, export needed records first and announce the change; do not silently change version-1 rules.

## Local verification

`npm test` tests the actual replay verifier, handler and REST adapter. `node tests/dev-api.mjs` starts a loopback-only server with an explicitly temporary in-memory store for browser QA. Its URL includes `?qaApi=1`; that override is ignored on public hosts. Test data never reaches a public database.

The generated Edge lib files are ignored by git; regenerate before deployment so the browser and server use identical model/rule code.

Configuration references: [Supabase function authentication](https://supabase.com/docs/guides/functions/auth) and [server environment variables](https://supabase.com/docs/guides/functions/secrets). The custom handler owns account/session authentication; disabling the platform JWT check does not bypass its submission checks.
