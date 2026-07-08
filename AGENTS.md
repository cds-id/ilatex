# AGENTS.md

## Cursor Cloud specific instructions

`ilatex-editor` is a TypeScript CKEditor 5 plugin + standalone LaTeX render
utilities (MathLive). Node 22 / npm; `npm ci` installs everything (including
`wrangler` for deploys). Standard commands live in `package.json` scripts and
`README.md` — prefer those:

- Dev server: `npm run demo` (Vite, binds `0.0.0.0:5173`). Pages: `/` CKEditor
  demo, `/accents.html` accents/decorations/matrices playground, and
  `/render-demo.html` static render.
- Checks: `npm run typecheck`, `npm test -- --run`, `npm run build` (build emits
  the library to `dist/` and the demo site to `dist-demo/`).

Non-obvious gotchas:

- MathLive static markup from `renderLatexToMarkup` / `convertLatexToMarkup`
  needs MathLive's **static** CSS to lay out 2D structures (matrices, `cases`,
  `aligned`). Import `ilatex-editor/styles` (i.e. `src/styles`, which pulls
  `mathlive/static.css` + `mathlive/fonts.css`). Importing only
  `mathlive/fonts.css` renders simple accents but silently flattens matrices
  into a single line (e.g. a pmatrix shows as `(acbd)`).
- Set `MathfieldElement.fontsDirectory = null` in bundler apps so MathLive does
  not probe a wrong runtime font path (equations fall back to a system font
  otherwise).

Deploy (Cloudflare Pages):

- `npm run deploy` builds the demo and runs
  `wrangler pages deploy dist-demo --project-name ilatex-demo` (config in
  `wrangler.toml`).
- Requires `CLOUDFLARE_API_TOKEN` (and `CLOUDFLARE_ACCOUNT_ID`) in the env.
  Wrangler is non-interactive here, so the token must be set.
- The CDS custom domain is attached to the `ilatex-demo` Pages project in the
  Cloudflare dashboard (Pages → project → Custom domains); DNS for the CDS zone
  lives in Cloudflare.
