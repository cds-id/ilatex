# ilatex-editor

<p align="center">
  <a href="https://www.ciptadusa.com">
    <img src="https://www.ciptadusa.com/logo-only.png" alt="Cipta Dua Saudara logo" height="80" >
  </a>
</p>


CKEditor 5 Equation editor by CDS for inline LaTeX formulas.

Part of **Open CDS** — open-source programs by [Cipta Dua Saudara](https://www.ciptadusa.com).

## Features

- TypeScript CKEditor 5 plugin.
- Inline object widget: `latexInline`.
- Official package name: `@cds.id/ilatex-editor`.
- Creator: `CDS` / [Cipta Dua Saudara](https://www.ciptadusa.com).
- Program: **Open CDS** open-source programs.
- Repository: `git@github.com:cds-id/ilatex.git`.
- Plugin class: `Equation`.
- Toolbar/menu item: `formula`, labeled **Formula**.
- MS Word-like equation editor dialog using MathLive `<math-field>`.
- Visual equation editing, virtual keyboard support, symbol buttons, and raw LaTeX fallback textarea.
- Edit existing equation by selecting inline formula and clicking **Formula**.
- Double-click equation in editor to open edit dialog.
- MathLive virtual keyboard stays hidden by default.
- `[% ... %]` shortcode auto-parsing on load, paste, and typing.
- Standalone render utilities to display LaTeX outside the editor (React, SSR, plain DOM).
- Command: `insertLatex`.
- HTML data format:

```html
<span class="latex-math" data-latex="E=mc^2">E=mc^2</span>
```

## Install

```bash
npm install @cds.id/ilatex-editor
```

Peer runtime: `ckeditor5` (for the editor plugin) and `mathlive` (rendering) ship as
dependencies, so a plain install pulls everything. Works with any bundler that
handles CSS imports (Vite, Webpack, Next.js, Rollup).

Package entry points:

| Import | Use |
| --- | --- |
| `@cds.id/ilatex-editor` | CKEditor 5 `Equation` plugin + render utils |
| `@cds.id/ilatex-editor/render` | SSR-safe render utilities (no CKEditor, no CSS) |
| `@cds.id/ilatex-editor/auto` | Zero-config: renders the whole page on load |
| `@cds.id/ilatex-editor/tinymce` | TinyMCE 5 equation plugin (no CKEditor) |
| `@cds.id/ilatex-editor/styles` | MathLive static + font CSS (bundler only) |

## Usage in CKEditor 5

```ts
import 'ckeditor5/ckeditor5.css';
import 'mathlive/fonts.css';
import { ClassicEditor, Essentials, Paragraph } from 'ckeditor5';
import { MathfieldElement } from 'mathlive';
import { Equation } from '@cds.id/ilatex-editor';

// Required: disable MathLive's runtime font probing. Bundlers serve the fonts
// via fonts.css @font-face; the runtime probe resolves to a wrong path and
// makes equations fall back to a system font.
MathfieldElement.fontsDirectory = null;

ClassicEditor.create( document.querySelector( '#editor' )!, {
	licenseKey: 'GPL',
	plugins: [ Essentials, Paragraph, Equation ],
	toolbar: [ 'formula' ]
} );
```

Programmatic insert:

```ts
editor.execute( 'insertLatex', { latex: 'E=mc^2' } );
```

### Shortcode auto-parsing

The editor recognizes `[% ... %]` inline-math shortcodes on load, paste, and
live typing — they convert to rendered formulas automatically:

```
[%x\lt2%]                  ->  x < 2
[%16\Large\frac{1}{3}%]     ->  16 ¹⁄₃
```

No configuration needed; type `[%...%]` anywhere in the editor.

About metadata:

```ts
Equation.about;
// { name: 'ilatex-editor', version: '0.2.0', creator: 'CDS' }
```

## Rendering outside the editor

Render the same LaTeX (both `[%...%]` shortcodes and `.latex-math[data-latex]`
spans produced by the editor) anywhere — no editor instance required.

### Zero-config: render the whole page

```ts
import '@cds.id/ilatex-editor/auto';
```

Importing this once renders all LaTeX in the document on `DOMContentLoaded`.
It also pulls the required MathLive CSS + fonts. Re-render after dynamic DOM
updates with the exported `renderLatexInDocument()`.

### Manual: render a subtree or a string

```ts
import '@cds.id/ilatex-editor/styles';
import {
	renderLatexInElement,
	renderLatexInDocument,
	renderLatexToMarkup
} from '@cds.id/ilatex-editor/render';

// Render every formula inside a container (idempotent, safe to re-run).
renderLatexInElement( '#article' );
renderLatexInElement( document.querySelector( '#article' )! );

// Render the whole page.
renderLatexInDocument();

// Render a single LaTeX string to static HTML markup (SSR-safe, no DOM).
const html = renderLatexToMarkup( 'x\\lt2' );
```

`renderLatexInElement` options:

```ts
renderLatexInElement( root, {
	shortcodes: true,      // convert [%...%] in text nodes (default true)
	mathSpans: true,       // render .latex-math[data-latex] spans (default true)
	renderedClass: 'latex-rendered' // marker class for idempotency
} );
```

### Use in React

```tsx
import { useEffect, useRef } from 'react';
import { renderLatexInElement } from '@cds.id/ilatex-editor/render';
import '@cds.id/ilatex-editor/styles';

export function Article( { html }: { html: string } ) {
	const ref = useRef<HTMLDivElement>( null );

	useEffect( () => {
		if ( ref.current ) {
			renderLatexInElement( ref.current );
		}
	}, [ html ] );

	return <div ref={ ref } dangerouslySetInnerHTML={ { __html: html } } />;
}
```

`renderLatexToMarkup` is SSR-safe (pure string, no CSS import), so you can also
render on the server and ship static markup; load `@cds.id/ilatex-editor/styles` on the
client for fonts.

### Markdown viewer (view-only)

Render Markdown that contains LaTeX for **display** (never in the editor). The
Markdown pass masks `.latex-math` spans and `[%...%]` shortcodes before parsing
so LaTeX bodies (e.g. `x_1`) are never mangled by Markdown inline rules, then
renders the math. Dependency-free Markdown (headings, bold/italic/strikethrough,
inline + fenced code, lists, blockquotes, links, images, `---`).

```tsx
import { useEffect, useRef } from 'react';
import { renderMarkdownInElement } from '@cds.id/ilatex-editor/render';
import '@cds.id/ilatex-editor/styles';

export function MarkdownView( { markdown }: { markdown: string } ) {
	const ref = useRef<HTMLDivElement>( null );

	useEffect( () => {
		if ( ref.current ) {
			renderMarkdownInElement( ref.current, markdown );
		}
	}, [ markdown ] );

	return <div ref={ ref } />;
}
```

Or get the HTML string directly:

```ts
import { renderMarkdownWithLatex, markdownToHtml } from '@cds.id/ilatex-editor/render';

renderMarkdownWithLatex( '# Energy\n\n[%E=mc^2%] is **famous**.' );
// -> "<h1>Energy</h1>\n<p><span class=\"latex-math ...\">...</span> is <strong>famous</strong>.</p>"

markdownToHtml( '**just markdown**' ); // no math step, pure string (SSR-safe)
```

This lives on the render/view path only. The CKEditor and TinyMCE editors are
unchanged — they still store the same clean `<span class="latex-math" ...>` HTML.

## Usage in TinyMCE 5

The TinyMCE plugin is CKEditor-free: `@cds.id/ilatex-editor/tinymce` only pulls
MathLive + the shared dialog. Works with TinyMCE 5, 6 and 7. It:

- renders equations **inside the editor iframe** (injects MathLive CSS there);
- inserts equations as a clean marker span then renders them in the DOM, so
  strict editor configs (`valid_elements` / `verify_html`) cannot strip the
  rendered markup and leave equations half-rendered;
- intercepts paste (incl. PowerPaste): pasted **MathType / WIRIS** formulas
  (`<math>` with a TeX annotation, or WIRIS `<img>`) are converted to
  `.latex-math` spans instead of being kept as images;
- auto-converts `[% ... %]` shortcodes as you type, paste, or load content;
- serializes **clean** HTML — `<span class="latex-math" data-latex="...">latex</span>`
  (rendered markup is stripped on save), the same format the CKEditor plugin
  emits, so stored content renders identically via `renderLatexInElement`;
- ships its own dialog styles (no extra CSS import for the editor UI).

Simplest integration is the `setup` callback (works with cloud-loaded TinyMCE,
no `PluginManager` registration needed):

```jsx
import { Editor } from '@tinymce/tinymce-react';
import { setupLatexEquation } from '@cds.id/ilatex-editor/tinymce';
// MathLive fonts for the in-editor render + dialog math-field:
import 'mathlive/mathlive-static.css';
import 'mathlive/mathlive-fonts.css';

<Editor
  apiKey={ process.env.REACT_APP_TINYMCE_FREE }
  init={ {
    setup: setupLatexEquation,
    toolbar: 'bold italic | formula'
  } }
/>;
```

Click **Formula** to insert/edit; double-click an existing equation to edit it.
Stored HTML is rendered for display with `renderLatexInElement` (e.g. inside a
React `LatexContent` component — see *Use in React* above).

Self-hosted TinyMCE can register a named plugin instead:

```ts
import { registerLatexEquationPlugin } from '@cds.id/ilatex-editor/tinymce';

registerLatexEquationPlugin( window.tinymce );
// init={{ plugins: 'latexequation', toolbar: 'formula' }}
```

### Webpack 4 / CRA 4 (e.g. pnpm strict)

Webpack 4 ignores package `exports` maps, so:

- Import the **physical** built file. Most CRA4 setups resolve
  `@cds.id/ilatex-editor/tinymce` to `dist/tinymce.js` via `main`-style lookup; if
  not, import `@cds.id/ilatex-editor/dist/tinymce.js` directly.
- Use MathLive's **physical** CSS filenames: `mathlive/mathlive-static.css` and
  `mathlive/mathlive-fonts.css` (not the `exports` aliases `mathlive/static.css` /
  `mathlive/fonts.css`).
- Declare `mathlive` as a **direct** dependency so pnpm hoists it to
  `node_modules/mathlive`; otherwise the bare CSS specifier is a phantom dep and
  fails to resolve.

## Fonts

MathLive ships KaTeX woff2 fonts. In a bundler, import the CSS so `@font-face`
URLs resolve correctly:

- Editor: `import 'mathlive/fonts.css'` + `MathfieldElement.fontsDirectory = null`.
- Render utils: `import '@cds.id/ilatex-editor/styles'` (or `@cds.id/ilatex-editor/auto`, which
  imports it for you).

If you see `OTS parsing error: invalid sfntVersion` or equations in a fallback
font, the runtime font probe is hitting a wrong path — apply the imports above.

## Demo

```bash
npm run demo
```

- `/` — editor demo. Click **Formula**, use the MathLive field / symbol buttons /
  LaTeX textarea, or type a `[%...%]` shortcode. Double-click an equation to edit.
- `/render-demo.html` — standalone render (no editor) of shortcodes and
  `.latex-math` spans.

## Tests

```bash
npm test -- --run
npm run typecheck
npm run build
```

## Files

- `src/equation.ts` — master plugin and `about` metadata.
- `src/latex.ts` — compatibility export.
- `src/latexediting.ts` — schema, conversion, widget behavior, `[%...%]` post-fixer.
- `src/latexui.ts` — toolbar button.
- `src/insertlatexcommand.ts` — insert command.
- `src/shortcode.ts` — shared `[%...%]` pattern (editor + renderer).
- `src/render.ts` — standalone render utilities (no editor).
- `src/auto.ts` — zero-config auto-render entry point.
- `src/styles.ts` — MathLive CSS + fonts side-effect import.
- `tests/latex-plugin.test.ts` — CKEditor integration tests.
- `tests/render.test.ts` — render utility tests.
- `sample/` — demo app (`/` editor, `/render-demo.html` standalone render).
