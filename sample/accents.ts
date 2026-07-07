// styles pulls MathLive's static render CSS + fonts — the static CSS is what
// lays out complex structures (matrices, cases, aligned) produced by
// renderLatexToMarkup / convertLatexToMarkup.
import '../src/styles';
import './style.css';
import './accents.css';
import { MathfieldElement } from 'mathlive';
import { renderLatexToMarkup } from '../src/render';

// Bundler serves the KaTeX fonts via fonts.css @font-face; disable MathLive's
// runtime font probing (which resolves to a wrong path under Vite deps).
MathfieldElement.fontsDirectory = null;

// Every LaTeX accent / decoration this demo showcases.
const CASES: Array<{ latex: string; label: string }> = [
	{ latex: `a'`, label: 'prime' },
	{ latex: `a''`, label: 'double prime' },
	{ latex: `a^{\\prime}`, label: '\\prime' },
	{ latex: `\\acute{a}`, label: '\\acute' },
	{ latex: `\\bar{y}`, label: '\\bar' },
	{ latex: `\\breve{a}`, label: '\\breve' },
	{ latex: `\\check{a}`, label: '\\check' },
	{ latex: `\\dot{a}`, label: '\\dot' },
	{ latex: `\\ddot{a}`, label: '\\ddot' },
	{ latex: `\\grave{a}`, label: '\\grave' },
	{ latex: `\\hat{\\theta}`, label: '\\hat' },
	{ latex: `\\widehat{ac}`, label: '\\widehat' },
	{ latex: `\\mathring{g}`, label: '\\mathring' },
	{ latex: `\\tilde{a}`, label: '\\tilde' },
	{ latex: `\\widetilde{ac}`, label: '\\widetilde' },
	{ latex: `\\vec{F}`, label: '\\vec' },
	{ latex: `\\overline{AB}`, label: '\\overline' },
	{ latex: `\\underline{AB}`, label: '\\underline' },
	{ latex: `\\overleftarrow{AB}`, label: '\\overleftarrow' },
	{ latex: `\\underleftarrow{AB}`, label: '\\underleftarrow' },
	{ latex: `\\overleftrightarrow{AB}`, label: '\\overleftrightarrow' },
	{ latex: `\\underleftrightarrow{AB}`, label: '\\underleftrightarrow' },
	{ latex: `\\overrightarrow{AB}`, label: '\\overrightarrow' },
	{ latex: `\\underrightarrow{AB}`, label: '\\underrightarrow' },
	{ latex: `\\overbrace{AB}`, label: '\\overbrace' },
	{ latex: `\\underbrace{AB}`, label: '\\underbrace' }
];

// Matrix / array / cases / aligned environments.
const MATRIX_CASES: Array<{ latex: string; label: string }> = [
	{ latex: `\\begin{array}{l|l}\n  a & b \\\\\n  c & d\n\\end{array}`, label: 'array (l|l)' },
	{ latex: `\\begin{matrix}\n  a & b \\\\\n  c & d\n\\end{matrix}`, label: 'matrix' },
	{ latex: `\\begin{pmatrix}\n  a & b \\\\\n  c & d\n\\end{pmatrix}`, label: 'pmatrix' },
	{ latex: `\\begin{bmatrix}\n  a & b \\\\\n  c & d\n\\end{bmatrix}`, label: 'bmatrix' },
	{ latex: `\\begin{vmatrix}\n  a & b \\\\\n  c & d\n\\end{vmatrix}`, label: 'vmatrix' },
	{ latex: `\\begin{Vmatrix}\n  a & b \\\\\n  c & d\n\\end{Vmatrix}`, label: 'Vmatrix' },
	{ latex: `\\begin{Bmatrix}\n  a & b \\\\\n  c & d\n\\end{Bmatrix}`, label: 'Bmatrix' },
	{ latex: `x = \\begin{cases}\n  a &\\text{if } b \\\\\n  c &\\text{if } d\n\\end{cases}`, label: 'cases' },
	{ latex: `\\begin{aligned}\n  a&=b+c \\\\\n  d+e&=f\n\\end{aligned}`, label: 'aligned' }
];

const input = document.getElementById( 'latex-input' ) as HTMLTextAreaElement;
const mathField = document.getElementById( 'math-field' ) as MathfieldElement;
const preview = document.getElementById( 'preview' ) as HTMLElement;
const errorBox = document.getElementById( 'error' ) as HTMLElement;
const gallery = document.getElementById( 'gallery' ) as HTMLElement;
const matrixGallery = document.getElementById( 'matrix-gallery' ) as HTMLElement;
const collection = document.getElementById( 'collection' ) as HTMLElement;
const collectionEmpty = document.getElementById( 'collection-empty' ) as HTMLElement;
const addBtn = document.getElementById( 'add-btn' ) as HTMLButtonElement;
const clearBtn = document.getElementById( 'clear-btn' ) as HTMLButtonElement;

const STORAGE_KEY = 'ilatex-collection';

let syncing = false;

function renderPreview( latex: string ): void {
	try {
		preview.innerHTML = renderLatexToMarkup( latex );
		errorBox.hidden = true;
	} catch ( err ) {
		errorBox.hidden = false;
		errorBox.textContent = `Render error: ${ ( err as Error ).message }`;
	}
}

function setLatex( latex: string, source: 'input' | 'mathfield' | 'external' ): void {
	if ( syncing ) {
		return;
	}
	syncing = true;

	if ( source !== 'input' ) {
		input.value = latex;
	}
	if ( source !== 'mathfield' ) {
		mathField.value = latex;
	}
	renderPreview( latex );

	syncing = false;
}

input.addEventListener( 'input', () => setLatex( input.value, 'input' ) );
mathField.addEventListener( 'input', () => setLatex( mathField.value, 'mathfield' ) );

function buildGallery(
	container: HTMLElement,
	cases: Array<{ latex: string; label: string }>
): void {
	for ( const { latex, label } of cases ) {
		const card = document.createElement( 'button' );
		card.type = 'button';
		card.className = 'acc-card';
		card.title = `Load: ${ latex }`;

		const rendered = document.createElement( 'div' );
		rendered.className = 'acc-card-render';
		rendered.innerHTML = renderLatexToMarkup( latex );

		const code = document.createElement( 'code' );
		code.className = 'acc-card-code';
		code.textContent = latex;

		const name = document.createElement( 'span' );
		name.className = 'acc-card-label';
		name.textContent = label;

		card.append( rendered, code, name );
		card.addEventListener( 'click', () => setLatex( latex, 'external' ) );
		container.appendChild( card );
	}
}

buildGallery( gallery, CASES );
buildGallery( matrixGallery, MATRIX_CASES );

// --- Collection: add / remove formulas like a normal playground ---------

function loadCollection(): string[] {
	try {
		const raw = localStorage.getItem( STORAGE_KEY );
		const parsed = raw ? JSON.parse( raw ) : [];
		return Array.isArray( parsed ) ? parsed.filter( ( x ): x is string => typeof x === 'string' ) : [];
	} catch {
		return [];
	}
}

function saveCollection( items: string[] ): void {
	try {
		localStorage.setItem( STORAGE_KEY, JSON.stringify( items ) );
	} catch {
		/* ignore storage failures (private mode, quota) */
	}
}

let collectionItems: string[] = loadCollection();

function renderCollection(): void {
	collection.textContent = '';
	collectionEmpty.hidden = collectionItems.length > 0;
	clearBtn.hidden = collectionItems.length === 0;

	collectionItems.forEach( ( latex, index ) => {
		const card = document.createElement( 'div' );
		card.className = 'acc-card acc-card-collection';

		const remove = document.createElement( 'button' );
		remove.type = 'button';
		remove.className = 'acc-remove';
		remove.title = 'Remove';
		remove.setAttribute( 'aria-label', 'Remove' );
		remove.textContent = '✕';
		remove.addEventListener( 'click', event => {
			event.stopPropagation();
			removeItem( index );
		} );

		const rendered = document.createElement( 'div' );
		rendered.className = 'acc-card-render';
		rendered.innerHTML = renderLatexToMarkup( latex );

		const code = document.createElement( 'code' );
		code.className = 'acc-card-code';
		code.textContent = latex;

		const load = document.createElement( 'button' );
		load.type = 'button';
		load.className = 'acc-card-load';
		load.textContent = 'Load into editor';
		load.addEventListener( 'click', () => setLatex( latex, 'external' ) );

		card.append( remove, rendered, code, load );
		collection.appendChild( card );
	} );
}

function addItem( latex: string ): void {
	const value = latex.trim();
	if ( !value ) {
		return;
	}
	collectionItems = [ ...collectionItems, value ];
	saveCollection( collectionItems );
	renderCollection();
}

function removeItem( index: number ): void {
	collectionItems = collectionItems.filter( ( _, i ) => i !== index );
	saveCollection( collectionItems );
	renderCollection();
}

addBtn.addEventListener( 'click', () => addItem( input.value ) );
clearBtn.addEventListener( 'click', () => {
	collectionItems = [];
	saveCollection( collectionItems );
	renderCollection();
} );

renderCollection();

// Seed the editor with the initial textarea content.
setLatex( input.value, 'external' );
