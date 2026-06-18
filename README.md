# ilatex-editor

CKEditor 5 Equation editor by CDS for inline LaTeX formulas.

## Features

- TypeScript CKEditor 5 plugin.
- Inline object widget: `latexInline`.
- Official package name: `ilatex-editor`.
- Creator: `CDS`.
- Repository: `git@github.com:cds-id/ilatex.git`.
- Plugin class: `Equation`.
- Toolbar/menu item: `formula`, labeled **Formula**.
- MS Word-like equation editor dialog using MathLive `<math-field>`.
- Visual equation editing, virtual keyboard support, symbol buttons, and raw LaTeX fallback textarea.
- Edit existing equation by selecting inline formula and clicking **Formula**.
- Double-click equation in editor to open edit dialog.
- MathLive virtual keyboard stays hidden by default.
- Command: `insertLatex`.
- HTML data format:

```html
<span class="latex-math" data-latex="E=mc^2">E=mc^2</span>
```

## Usage

```ts
import { ClassicEditor, Essentials, Paragraph } from 'ckeditor5';
import { Equation } from './src';

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

About metadata:

```ts
Equation.about;
// { name: 'ilatex-editor', version: '0.1.0', creator: 'CDS' }
```

## Demo

```bash
npm run demo
```

Open Vite URL. Click **Formula** toolbar button. Use MathLive field, symbol buttons, or LaTeX textarea. Select existing formula and click **Formula**, or double-click equation, to edit.

## Tests

```bash
npm test -- --run
npm run typecheck
npm run build
```

## Files

- `src/equation.ts` — master plugin and `about` metadata.
- `src/latex.ts` — compatibility export.
- `src/latexediting.ts` — schema, conversion, widget behavior.
- `src/latexui.ts` — toolbar button.
- `src/insertlatexcommand.ts` — insert command.
- `tests/latex-plugin.test.ts` — CKEditor integration tests.
- `sample/` — demo app.
