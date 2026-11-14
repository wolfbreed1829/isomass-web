# Isomass

**[Open Isomass on GitHub Pages](https://wolfbreed1829.github.io/isomass-web/)**

A conservation playground. Divide a capacity of 64 into smaller regions, explore their connections, and watch the combined wave change. No installation or sign-in required.

- Start from **Balanced**, **Cascade**, or **Contrast**, or divide the initial whole.
- Select an arc instantly, use the region picker, or step through regions with the arrow buttons.
- The edit preview explains how Divide and Rejoin will change the selected family.
- **Undo** and **Redo** include edits and opening examples or saved forms. Ctrl/Command Z also works.
- **Save this form** keeps a named copy in this browser. The collection supports up to 24 forms and undoing a removal.
- **Share** copies a link containing the current structure and focus. **Export image** downloads a PNG.

## Hosting and development

GitHub Pages publishes the `docs/` directory from the `master` branch. All asset paths are relative, so the app works under the repository path. `.nojekyll` keeps this a static deployment. No build service, server, or GPT hosting is needed to use the app.

For local development, run `node server.mjs` and open the printed localhost URL. Run `npm test` to check the mathematical model. There are no package dependencies or build steps.

The separate native desktop project uses Idris 2, Flix, and Bend. Its source remains private. This browser implementation uses JavaScript and runtime checks; the native proof does not verify this port. Isomass is a mathematical playground, not a physical simulation.

## Storage and sharing

The current form and named collection live in browser storage. They do not sync between devices. Clearing site data removes them; share a link to keep a structure elsewhere. Shared links contain the partition and focus, not collection names. The application uses no third-party scripts or application backend.

## Validation

Model checks cover serialization, conservation, depth limits, coupling, reflection, and all 256 field samples. Browser checks cover presets, immediate selection, region navigation, edit previews, keyboard history, saved-form persistence and removal recovery, shared-state restoration, image export, dialogs, and desktop/mobile layouts.
