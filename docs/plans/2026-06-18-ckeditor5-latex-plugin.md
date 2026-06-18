# CKEditor 5 LaTeX Plugin Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Build both a reusable CKEditor 5 TypeScript plugin package for LaTeX inline widgets and a Vite demo app consuming it.

**Architecture:** Package exposes `Latex` plugin composed from editing + UI plugins. Editing layer defines inline object `latexInline`, command `insertLatex`, and HTML conversion to/from `<span class="latex-math" data-latex="...">...</span>`. UI layer adds toolbar button that prompts for LaTeX and executes command. Demo app imports plugin from package source and renders CKEditor ClassicEditor sample.

**Tech Stack:** TypeScript, CKEditor 5 v48, Vite, Vitest, jsdom, vanilla HTML/CSS.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`
- Create: `sample/index.html`
- Create: `sample/main.ts`
- Create: `sample/style.css`

**Step 1: Write package/test config**
Create npm scripts: `test`, `build`, `typecheck`, `demo`.

**Step 2: Install deps**
Run: `npm install`
Expected: deps installed.

**Step 3: Commit**
```bash
git add package.json package-lock.json tsconfig.json tsconfig.build.json vitest.config.ts src sample docs/plans/2026-06-18-ckeditor5-latex-plugin.md
git commit -m "chore: scaffold ckeditor latex plugin package"
```

### Task 2: RED tests for model + command

**Files:**
- Create: `tests/latex-plugin.test.ts`

**Step 1: Write failing tests**
Tests:
- plugin registers `insertLatex` command
- command inserts inline LaTeX widget at selection
- `editor.getData()` outputs `<span class="latex-math" data-latex="E=mc^2">E=mc^2</span>`
- upcast existing HTML span into model then preserves data output

**Step 2: Run failing tests**
Run: `npm test -- --run tests/latex-plugin.test.ts`
Expected: FAIL because plugin implementation missing.

### Task 3: GREEN editing plugin

**Files:**
- Create: `src/latex.ts`
- Create: `src/latexediting.ts`
- Create: `src/insertlatexcommand.ts`
- Modify: `src/index.ts`

**Step 1: Implement minimal editing layer**
- schema: `latexInline`, inline object allowed where text allowed, attr `latex`
- command inserts `latexInline`
- conversion:
  - data downcast to `span.latex-math[data-latex]` with text child
  - editing downcast to widget span
  - upcast from same span using `data-latex` or text content
- mapper: `viewToModelPositionOutsideModelElement`

**Step 2: Run tests**
Run: `npm test -- --run tests/latex-plugin.test.ts`
Expected: PASS.

**Step 3: Commit**
```bash
git add src tests
git commit -m "feat: add ckeditor latex editing plugin"
```

### Task 4: RED/GREEN UI plugin tests

**Files:**
- Modify: `tests/latex-plugin.test.ts`
- Create: `src/latexuiplugin.ts`

**Step 1: Write failing test**
Test toolbar component factory has `latex` button.

**Step 2: Run failing test**
Run: `npm test -- --run tests/latex-plugin.test.ts`
Expected: FAIL because UI component missing.

**Step 3: Implement UI plugin**
Button label: `LaTeX`, tooltip true, withText true. On execute prompt for formula, run `insertLatex` command.

**Step 4: Run tests**
Run: `npm test -- --run tests/latex-plugin.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src tests
git commit -m "feat: add ckeditor latex toolbar button"
```

### Task 5: Demo app

**Files:**
- Modify: `sample/index.html`
- Modify: `sample/main.ts`
- Modify: `sample/style.css`

**Step 1: Wire ClassicEditor**
Use `ClassicEditor` from `ckeditor5`, package plugin from `../src`, toolbar includes `latex`, sample HTML includes formulas.

**Step 2: Smoke build**
Run: `npm run build`
Expected: TS compile + Vite sample build succeeds.

**Step 3: Commit**
```bash
git add sample package.json tsconfig.build.json
git commit -m "feat: add ckeditor latex demo app"
```

### Task 6: Final verification

**Files:**
- Modify: `README.md`

**Step 1: Add usage docs**
Include install/use snippet, HTML output format, dev commands.

**Step 2: Verify**
Run:
```bash
npm test -- --run
npm run typecheck
npm run build
```
Expected: all pass.

**Step 3: Commit**
```bash
git add README.md
git commit -m "docs: document ckeditor latex plugin"
```
