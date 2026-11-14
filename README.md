# Isomass

**[Open Isomass on GitHub Pages](https://wolfbreed1829.github.io/isomass-web/)**

**[Facebook challenge link](https://wolfbreed1829.github.io/isomass-web/challenge.html) · [Detailed explanation](https://wolfbreed1829.github.io/isomass-web/about.html)**

A conservation playground. Divide a capacity of 64 into smaller regions, explore their connections, and watch the combined wave change. No installation or sign-in required.

- Start from **Balanced**, **Cascade**, or **Contrast**, or divide the initial whole.
- Select an arc instantly, use the region picker, or step through regions with the arrow buttons.
- The edit preview explains how Divide and Rejoin will change the selected family.
- **Undo** and **Redo** include edits and opening examples or saved forms. Ctrl/Command Z also works.
- **Save this form** keeps a named copy in this browser. The collection supports up to 24 forms and undoing a removal.
- **Share** copies a link containing the current structure and focus. **Export image** downloads a PNG.
- **Compare forms** pins reference A while you edit B. Choose examples or saved forms for either panel, swap them, or pin B as the new reference. A comparison table reports sizes, connected regions, and exactly how many wave samples changed. Both plots use the same scale. Undo operates on B.
- Sharing a comparison preserves both forms and their selections. Export produces a PNG of both panels.
- **Guided challenges** teaches equal partitions, selecting a different family, and restoring connections. Each step checks the actual state, progress resumes after reload, and **Return to my form** restores your original workspace, including its reference.

## Hosting and development

The three challenges now record scores: 70 points for completion plus up to 30 for efficient edits, with a total of 300 from personal bests. Time does not affect points or rank. The scorebook includes recent attempts, Facebook results text, PNG score cards and CSV logs. Action histories resume after reload.

**Public leaderboard status:** The unique name/passphrase flow and shared backend are implemented and tested locally. Production name registration and submissions remain closed until a Supabase project is connected and deployed. The website displays this state and keeps local results separate from public standings. Scores earned now retain their action traces for later submission. See [backend deployment instructions](backend/README.md).

GitHub Pages publishes the `docs/` directory from the `master` branch. All asset paths are relative, so the app works under the repository path. `.nojekyll` keeps this a static deployment. The frontend stays on GitHub Pages; the shared database/API uses Supabase separately. Server credentials never belong in the frontend.

For local development, run `node server.mjs` and open the printed localhost URL. Run `npm test` for the model, challenges, scoring, replay verification and account/API checks. The browser has no package dependencies or build step. `npm run qa` starts a loopback-only test server with an explicitly temporary in-memory backend; its `?qaApi=1` override is ignored on public hosts. `npm run test:db` checks the actual SQL migration in an isolated temporary PostgreSQL 17 Docker container with no exposed ports or persistent data. `node scripts/prepare-edge.mjs` packages current shared rules for deployment. `python scripts/generate-social.py` regenerates the Facebook preview image (optional; requires Pillow and Segoe UI or DejaVu Sans).

The separate native desktop project uses Idris 2, Flix, and Bend. Its source remains private. This browser implementation uses JavaScript and runtime checks; the native proof does not verify this port. Isomass is a mathematical playground, not a physical simulation.

## Storage and sharing

The current form, comparison, named collection, challenge progress and score log live in browser storage. They do not sync automatically. Clearing site data removes them; share form links and download score logs first. Shared links contain forms and selections, not account credentials or score histories.

Once the backend is deployed, players choose a unique public alias protected by a private passphrase and explicitly submit their bests. The server replays recorded actions from fixed starts, computes points, and publishes name/rank/challenge bests. Equal totals share rank. A valid solution is not proof of unaided human play. Passphrases are hashed server-side; opaque sign-in tokens expire after 90 days. No email or account recovery is provided. The challenge page explains the public/private data and scoring rules.

## Validation

The 26 automated JavaScript checks cover conservation, all 256 field samples, challenge transitions, reload replay, points, best retention, safe exports, protected names, invalid submissions, duplicate attempts, ties, sessions, CORS and rate limits. The PostgreSQL test applies the actual migration and verifies score calculation, best updates, deduplication, ties, private permissions and RLS. Browser checks cover all three scored flows, reload recovery, name creation, submission, standings, PNG/CSV downloads, explicit disconnected state, and desktop/mobile layouts. Test entries are never published. Production API smoke testing remains part of backend deployment.
