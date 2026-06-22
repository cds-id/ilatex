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
- Official package name: `ilatex-editor`.
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
npm install ilatex-editor
```

Peer runtime: `ckeditor5` (for the editor plugin) and `mathlive` (rendering) ship as
dependencies, so a plain install pulls everything. Works with any bundler that
handles CSS imports (Vite, Webpack, Next.js, Rollup).

Package entry points:

| Import | Use |
| --- | --- |
| `ilatex-editor` | CKEditor 5 `Equation` plugin + render utils |
| `ilatex-editor/render` | SSR-safe render utilities (no CKEditor, no CSS) |
| `ilatex-editor/auto` | Zero-config: renders the whole page on load |
| `ilatex-editor/styles` | MathLive static + font CSS (bundler only) |

## Usage in CKEditor 5

```ts
import 'ckeditor5/ckeditor5.css';
import 'mathlive/fonts.css';
import { ClassicEditor, Essentials, Paragraph } from 'ckeditor5';
import { MathfieldElement } from 'mathlive';
import { Equation } from 'ilatex-editor';

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
// { name: 'ilatex-editor', version: '0.1.0', creator: 'CDS' }
```

## Rendering outside the editor

Render the same LaTeX (both `[%...%]` shortcodes and `.latex-math[data-latex]`
spans produced by the editor) anywhere — no editor instance required.

### Zero-config: render the whole page

```ts
import 'ilatex-editor/auto';
```

Importing this once renders all LaTeX in the document on `DOMContentLoaded`.
It also pulls the required MathLive CSS + fonts. Re-render after dynamic DOM
updates with the exported `renderLatexInDocument()`.

### Manual: render a subtree or a string

```ts
import 'ilatex-editor/styles';
import {
	renderLatexInElement,
	renderLatexInDocument,
	renderLatexToMarkup
} from 'ilatex-editor/render';

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
import { renderLatexInElement } from 'ilatex-editor/render';
import 'ilatex-editor/styles';

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
render on the server and ship static markup; load `ilatex-editor/styles` on the
client for fonts.

## Fonts

MathLive ships KaTeX woff2 fonts. In a bundler, import the CSS so `@font-face`
URLs resolve correctly:

- Editor: `import 'mathlive/fonts.css'` + `MathfieldElement.fontsDirectory = null`.
- Render utils: `import 'ilatex-editor/styles'` (or `ilatex-editor/auto`, which
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
