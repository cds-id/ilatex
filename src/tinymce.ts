// TinyMCE LaTeX equation plugin (MathLive-based). Works with TinyMCE 5, 6 and 7.
//
// Editor-agnostic dialog from `dialog.ts`. Stores LaTeX on a span that is also
// rendered in-place, so the same markup is shown in the editor iframe AND
// serialized for downstream rendering:
//
//   <span class="latex-math" data-latex="E=mc^2" contenteditable="false">
//     <MathLive rendered markup>
//   </span>
//
// `renderLatexInElement` (from this package) is idempotent and re-renders the
// same spans elsewhere, so authored content displays identically everywhere.
import { convertLatexToMarkup } from 'mathlive';
import { openLatexEditorDialog } from './dialog.js';
import { LATEX_MATH_CLASS, SHORTCODE_PATTERN } from './shortcode.js';

const TOOLBAR_BUTTON = 'formula';
const PLUGIN_NAME = 'latexequation';
const RENDERED_CLASS = 'latex-rendered';

/** Minimal subset of the TinyMCE editor API this plugin touches (v5–v7). */
export interface TinyMceEditorLike {
	ui: {
		registry: {
			addButton( name: string, spec: {
				text?: string;
				tooltip?: string;
				icon?: string;
				onAction(): void;
			} ): void;
		};
	};
	on( name: string, handler: ( event: { target?: Element; element?: Element; node?: Element; content?: string } & Event ) => void ): void;
	selection: {
		getNode(): Element;
	};
	insertContent( content: string ): void;
	getBody(): HTMLElement;
	contentDocument?: Document;
	getDoc?(): Document;
	fire?( name: string ): void;
	dispatch?( name: string ): void;
}

/** Minimal subset of the global TinyMCE PluginManager. */
export interface TinyMceLike {
	PluginManager: {
		add( name: string, callback: ( editor: TinyMceEditorLike ) => void ): void;
	};
}

function escapeHtml( value: string ): string {
	return value
		.replace( /&/g, '&amp;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' )
		.replace( /"/g, '&quot;' );
}

/**
 * Build the rendered, round-trippable LaTeX span HTML. `data-latex` keeps the
 * source for editing; the inner markup is the MathLive render shown in-editor.
 */
export function buildLatexSpan( latex: string ): string {
	const safe = escapeHtml( latex );
	const markup = convertLatexToMarkup( latex );
	return `<span class="${ LATEX_MATH_CLASS } ${ RENDERED_CLASS }" data-latex="${ safe }" contenteditable="false">${ markup }</span>`;
}

function closestLatexElement( node: Element | null ): HTMLElement | null {
	return ( node?.closest?.( `.${ LATEX_MATH_CLASS }` ) as HTMLElement | null ) ?? null;
}

function getEditorDoc( editor: TinyMceEditorLike ): Document | null {
	return editor.contentDocument ?? editor.getDoc?.() ?? editor.getBody?.()?.ownerDocument ?? null;
}

/**
 * Inject MathLive static CSS into the editor iframe document head.
 *
 * The iframe has its own document, so MathLive's static render CSS (loaded in
 * the parent page, e.g. `import 'mathlive/mathlive-static.css'`) does not apply
 * inside it. We clone any MathLive-related stylesheet rules from the parent
 * document into the iframe. Bundler-agnostic: no CSS import in this module.
 */
function injectMathliveCss( editor: TinyMceEditorLike ): void {
	const doc = getEditorDoc( editor );

	if ( !doc || typeof document === 'undefined' || doc.getElementById( 'mathlive-static-css' ) ) {
		return;
	}

	const css = collectMathliveCssFromParent();

	if ( !css ) {
		return;
	}

	const style = doc.createElement( 'style' );
	style.id = 'mathlive-static-css';
	style.textContent = css + `
body#tinymce, body {
	padding-top: 0.6em;
	padding-bottom: 0.6em;
}
.${ LATEX_MATH_CLASS } {
	display: inline-block;
	vertical-align: middle;
	line-height: normal;
	cursor: pointer;
	user-select: all;
}
.${ LATEX_MATH_CLASS } .ML__latex {
	line-height: normal;
}
/* Give lines that contain math enough height so tall formulas
   (sums / integrals with limits, stacked fractions) are not clipped. */
p:has(> .${ LATEX_MATH_CLASS }),
li:has(> .${ LATEX_MATH_CLASS }),
div:has(> .${ LATEX_MATH_CLASS }) {
	line-height: 2.2;
}
.${ LATEX_MATH_CLASS }[data-mce-selected] {
	outline: 2px solid #2563eb;
	outline-offset: 1px;
	border-radius: 2px;
}
.mce-offscreen-selection {
	position: absolute !important;
	left: -9999999px !important;
	max-width: 1000000px;
}
`;
	doc.head.appendChild( style );
}

/** Gather MathLive CSS rule text from the parent document's stylesheets. */
function collectMathliveCssFromParent(): string {
	const chunks: string[] = [];

	for ( const sheet of Array.from( document.styleSheets ) ) {
		let rules: CSSRuleList | undefined;

		try {
			rules = sheet.cssRules;
		} catch {
			// Cross-origin stylesheet; skip.
			continue;
		}

		if ( !rules ) {
			continue;
		}

		const base = sheet.href ?? document.baseURI;

		for ( const rule of Array.from( rules ) ) {
			const text = rule.cssText;

			if ( text.includes( 'ML__' ) || text.includes( 'KaTeX' ) || text.includes( 'mathlive' ) ) {
				// Resolve relative url() against the source sheet so @font-face fonts
				// still load once the CSS is moved into the editor iframe document.
				chunks.push( absolutizeCssUrls( text, base ) );
			}
		}
	}

	return chunks.join( '\n' );
}

/**
 * Rewrite relative `url(...)` references in a CSS rule to absolute URLs resolved
 * against `base`, so @font-face fonts still resolve after the rule text is moved
 * into another document (the editor iframe). Leaves absolute/data/blob URLs.
 */
function absolutizeCssUrls( cssText: string, base: string ): string {
	return cssText.replace( /url\(\s*(['"]?)([^'")]+)\1\s*\)/g, ( whole, quote: string, url: string ) => {
		const trimmed = url.trim();

		if ( /^(data:|blob:|https?:|\/\/|#)/.test( trimmed ) ) {
			return whole;
		}

		try {
			return `url("${ new URL( trimmed, base ).href }")`;
		} catch {
			return whole;
		}
	} );
}

/** Render any `.latex-math[data-latex]` spans inside the editor body that are not yet rendered. */
function renderEditorBody( editor: TinyMceEditorLike ): void {
	const body = editor.getBody?.();

	if ( !body ) {
		return;
	}

	body.querySelectorAll<HTMLElement>( `.${ LATEX_MATH_CLASS }[data-latex]` ).forEach( span => {
		if ( span.classList.contains( RENDERED_CLASS ) && span.childElementCount > 0 ) {
			return;
		}

		const latex = span.getAttribute( 'data-latex' ) ?? '';
		span.innerHTML = convertLatexToMarkup( latex );
		span.classList.add( RENDERED_CLASS );
		span.setAttribute( 'contenteditable', 'false' );
	} );
}

function emitChange( editor: TinyMceEditorLike ): void {
	try {
		( editor.dispatch ?? editor.fire )?.( 'change' );
	} catch {
		// Editor may not be ready (e.g. during init); ignore.
	}
}

/**
 * Wire the LaTeX equation feature into a TinyMCE editor. Registers a `formula`
 * toolbar button, double-click-to-edit, injects MathLive CSS into the iframe,
 * and renders existing equations on load.
 *
 * Use as the editor `setup` callback: `init={{ setup: setupLatexEquation }}`.
 */
export function setupLatexEquation( editor: TinyMceEditorLike ): void {
	editor.ui.registry.addButton( TOOLBAR_BUTTON, {
		text: 'Formula',
		tooltip: 'Insert equation',
		onAction: () => {
			const existing = closestLatexElement( editor.selection.getNode() );
			openLatexEditorDialog( {
				initialValue: existing?.dataset.latex ?? '',
				dialogClass: 'tinymce-latex-editor-dialog',
				onSubmit: latex => updateOrInsert( editor, existing, latex )
			} );
		}
	} );

	editor.on( 'dblclick', event => {
		const equationElement = closestLatexElement( ( event.target as Element ) ?? null );

		if ( !equationElement ) {
			return;
		}

		event.preventDefault();
		openLatexEditorDialog( {
			initialValue: equationElement.dataset.latex ?? '',
			dialogClass: 'tinymce-latex-editor-dialog',
			onSubmit: latex => updateOrInsert( editor, equationElement, latex )
		} );
	} );

	editor.on( 'init', () => {
		injectMathliveCss( editor );
		convertShortcodesInBody( editor );
		renderEditorBody( editor );
	} );

	// Re-render after programmatic / paste content changes (loaded data, undo, etc).
	editor.on( 'SetContent', () => {
		convertShortcodesInBody( editor );
		renderEditorBody( editor );
	} );

	// Intercept paste (incl. PowerPaste): convert pasted math — MathType / WIRIS
	// `<math>` + `<img>` formulas — into clean `.latex-math[data-latex]` spans so
	// they are NOT kept as images. Runs on the pasted fragment before it lands.
	editor.on( 'PastePreProcess', event => {
		if ( typeof event.content !== 'string' ) {
			return;
		}

		const doc = getEditorDoc( editor ) ?? ( typeof document !== 'undefined' ? document : null );

		if ( !doc ) {
			return;
		}

		const holder = doc.createElement( 'div' );
		holder.innerHTML = event.content;

		if ( convertPastedMath( holder ) ) {
			event.content = holder.innerHTML;
		}
	} );

	editor.on( 'PastePostProcess', event => {
		if ( event.node && convertPastedMath( event.node ) ) {
			// rendering happens via the SetContent handler that follows paste
		}
	} );

	// Convert [% ... %] shortcodes as the user types/pastes.
	editor.on( 'input', () => {
		if ( convertShortcodesInBody( editor ) ) {
			renderEditorBody( editor );
		}
	} );

	// Serialize clean spans: strip the rendered MathLive markup so stored HTML is
	// `<span class="latex-math" data-latex="...">latex</span>` (same as CKEditor
	// output, render-on-read via renderLatexInElement). Prevents storage bloat and
	// double-rendering downstream.
	editor.on( 'PreProcess', event => {
		const node = event.node;

		if ( !node ) {
			return;
		}

		node.querySelectorAll<HTMLElement>( `.${ LATEX_MATH_CLASS }[data-latex]` ).forEach( span => {
			const latex = span.getAttribute( 'data-latex' ) ?? '';
			span.classList.remove( RENDERED_CLASS );
			span.removeAttribute( 'contenteditable' );
			span.textContent = latex;
		} );
	} );
}

/**
 * Convert pasted math into clean `.latex-math[data-latex]` spans so it is not
 * kept as an image. Handles, in priority order:
 *  - WIRIS / MathType `<img>` carrying LaTeX (`data-latex`) or MathML
 *    (`data-mathml` / WIRIS `<img class="Wirisformula">`);
 *  - MathML `<math>` with a TeX annotation (`<annotation encoding="...tex">`);
 *  - existing `.latex-math[data-latex]` spans (normalized to unrendered);
 *  - `[% ... %]` shortcodes inside the fragment.
 * Returns true if anything was converted. Resulting spans are unrendered;
 * renderEditorBody (via the post-paste SetContent) renders them.
 */
function convertPastedMath( root: Element ): boolean {
	const doc = root.ownerDocument;
	let changed = false;

	// 1. MathType / WIRIS images.
	root.querySelectorAll<HTMLImageElement>( 'img' ).forEach( img => {
		const latex = extractLatexFromImg( img );

		if ( latex ) {
			img.replaceWith( createLatexSpan( doc, latex ) );
			changed = true;
		}
	} );

	// 2. MathML <math> blocks with a TeX annotation.
	root.querySelectorAll( 'math' ).forEach( math => {
		const latex = extractTexAnnotation( math );

		if ( latex ) {
			math.replaceWith( createLatexSpan( doc, latex ) );
			changed = true;
		}
	} );

	// 3. Existing .latex-math spans — normalize to unrendered (strip pasted markup).
	root.querySelectorAll<HTMLElement>( `.${ LATEX_MATH_CLASS }[data-latex]` ).forEach( span => {
		const latex = span.getAttribute( 'data-latex' ) ?? '';
		span.classList.remove( RENDERED_CLASS );
		span.removeAttribute( 'contenteditable' );
		span.textContent = latex;
	} );

	// 4. [% ... %] shortcodes in text nodes.
	const walker = doc.createTreeWalker( root, NodeFilter.SHOW_TEXT, {
		acceptNode( node ) {
			const parent = ( node as Text ).parentElement;

			if ( !parent || parent.closest( `.${ LATEX_MATH_CLASS }` ) ) {
				return NodeFilter.FILTER_REJECT;
			}

			return node.nodeValue && node.nodeValue.includes( '[%' )
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_REJECT;
		}
	} );

	const textNodes: Text[] = [];
	let current = walker.nextNode();

	while ( current ) {
		textNodes.push( current as Text );
		current = walker.nextNode();
	}

	for ( const textNode of textNodes ) {
		if ( replaceShortcodesInTextNode( doc, textNode ) ) {
			changed = true;
		}
	}

	return changed;
}

function createLatexSpan( doc: Document, latex: string ): HTMLElement {
	const span = doc.createElement( 'span' );
	span.className = LATEX_MATH_CLASS;
	span.setAttribute( 'data-latex', latex );
	span.textContent = latex;
	return span;
}

/** Pull LaTeX out of a WIRIS / MathType image, if present. */
function extractLatexFromImg( img: HTMLImageElement ): string | null {
	// MathType/WIRIS often store LaTeX directly.
	const dataLatex = img.getAttribute( 'data-latex' );

	if ( dataLatex ) {
		return cleanWirisLatex( dataLatex );
	}

	// WIRIS images: alt usually holds the LaTeX (or a math description).
	const isWiris = img.classList.contains( 'Wirisformula' ) || /wiris|mathtype/i.test( img.getAttribute( 'data-mathml' ) ?? '' );
	const mathml = img.getAttribute( 'data-mathml' );

	if ( mathml ) {
		const fromMathml = extractTexFromMathmlString( mathml );

		if ( fromMathml ) {
			return fromMathml;
		}
	}

	const alt = img.getAttribute( 'alt' );

	if ( isWiris && alt && alt.trim() ) {
		return cleanWirisLatex( alt );
	}

	return null;
}

/** Extract a TeX annotation from a MathML <math> element. */
function extractTexAnnotation( math: Element ): string | null {
	const annotation = Array.from( math.querySelectorAll( 'annotation' ) ).find( node => {
		const enc = node.getAttribute( 'encoding' ) ?? '';
		return /tex/i.test( enc );
	} );

	const tex = annotation?.textContent?.trim();
	return tex ? cleanWirisLatex( tex ) : null;
}

/** Parse a MathML string (e.g. from data-mathml) and pull its TeX annotation. */
function extractTexFromMathmlString( mathml: string ): string | null {
	if ( typeof DOMParser === 'undefined' ) {
		return null;
	}

	// WIRIS sometimes HTML-escapes the MathML (« math » style); normalize.
	const normalized = mathml
		.replace( /«/g, '<' )
		.replace( /»/g, '>' )
		.replace( /§/g, '&' );

	try {
		const parsed = new DOMParser().parseFromString( normalized, 'text/html' );
		const math = parsed.querySelector( 'math' );
		return math ? extractTexAnnotation( math ) : null;
	} catch {
		return null;
	}
}

/** Strip common WIRIS LaTeX wrappers like `$$...$$` / `\(...\)`. */
function cleanWirisLatex( latex: string ): string {
	return latex
		.trim()
		.replace( /^\$\$?([\s\S]*?)\$\$?$/, '$1' )
		.replace( /^\\\(([\s\S]*?)\\\)$/, '$1' )
		.replace( /^\\\[([\s\S]*?)\\\]$/, '$1' )
		.trim();
}

/**
 * Convert `[% ... %]` shortcodes in the editor body into unrendered
 * `.latex-math[data-latex]` spans (renderEditorBody then renders them).
 * Returns true if any conversion happened.
 */
function convertShortcodesInBody( editor: TinyMceEditorLike ): boolean {
	const body = editor.getBody?.();
	const doc = getEditorDoc( editor );

	if ( !body || !doc ) {
		return false;
	}

	const walker = doc.createTreeWalker( body, NodeFilter.SHOW_TEXT, {
		acceptNode( node ) {
			const parent = ( node as Text ).parentElement;

			if ( !parent || parent.closest( `.${ LATEX_MATH_CLASS }` ) ) {
				return NodeFilter.FILTER_REJECT;
			}

			return node.nodeValue && node.nodeValue.includes( '[%' )
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_REJECT;
		}
	} );

	const targets: Text[] = [];
	let current = walker.nextNode();

	while ( current ) {
		targets.push( current as Text );
		current = walker.nextNode();
	}

	let changed = false;

	for ( const textNode of targets ) {
		if ( replaceShortcodesInTextNode( doc, textNode ) ) {
			changed = true;
		}
	}

	if ( changed ) {
		emitChange( editor );
	}

	return changed;
}

function replaceShortcodesInTextNode( doc: Document, textNode: Text ): boolean {
	const data = textNode.nodeValue ?? '';
	SHORTCODE_PATTERN.lastIndex = 0;

	if ( !SHORTCODE_PATTERN.test( data ) ) {
		return false;
	}

	SHORTCODE_PATTERN.lastIndex = 0;
	const fragment = doc.createDocumentFragment();
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	let replaced = false;

	while ( ( match = SHORTCODE_PATTERN.exec( data ) ) !== null ) {
		const latex = match[ 1 ].trim();

		if ( match.index > lastIndex ) {
			fragment.appendChild( doc.createTextNode( data.slice( lastIndex, match.index ) ) );
		}

		if ( latex ) {
			const span = doc.createElement( 'span' );
			span.className = LATEX_MATH_CLASS;
			span.setAttribute( 'data-latex', latex );
			span.textContent = latex;
			fragment.appendChild( span );
			replaced = true;
		} else {
			fragment.appendChild( doc.createTextNode( match[ 0 ] ) );
		}

		lastIndex = match.index + match[ 0 ].length;
	}

	if ( lastIndex < data.length ) {
		fragment.appendChild( doc.createTextNode( data.slice( lastIndex ) ) );
	}

	if ( replaced ) {
		textNode.parentNode?.replaceChild( fragment, textNode );
	}

	return replaced;
}

function updateOrInsert( editor: TinyMceEditorLike, existing: HTMLElement | null, latex: string ): void {
	const trimmed = latex.trim();

	if ( !trimmed ) {
		return;
	}

	if ( existing ) {
		renderSpan( existing, trimmed );
		emitChange( editor );
		return;
	}

	// Insert a clean, marker-only span through TinyMCE's parser (rendered MathLive
	// markup uses inline styles that strict editor configs strip, leaving the
	// equation half-rendered). Then render it directly in the DOM, bypassing the
	// content filter, and re-select it so the caret lands after the equation.
	const id = `ilatex-${ Date.now() }-${ Math.floor( Math.random() * 1e6 ) }`;
	const safe = escapeHtml( trimmed );
	editor.insertContent(
		`<span id="${ id }" class="${ LATEX_MATH_CLASS }" data-latex="${ safe }">${ safe }</span>`
	);

	const doc = getEditorDoc( editor );
	const inserted = doc?.getElementById( id ) ?? editor.getBody?.()?.querySelector( `#${ id }` ) ?? null;

	if ( inserted ) {
		inserted.removeAttribute( 'id' );
		renderSpan( inserted, trimmed );
	}

	emitChange( editor );
}

/** Render (or re-render) a `.latex-math` span in place with MathLive markup. */
function renderSpan( span: Element, latex: string ): void {
	span.setAttribute( 'data-latex', latex );
	span.classList.add( LATEX_MATH_CLASS, RENDERED_CLASS );
	span.setAttribute( 'contenteditable', 'false' );
	span.innerHTML = convertLatexToMarkup( latex );
}

/**
 * Register the equation feature as a named TinyMCE plugin. For self-hosted
 * TinyMCE where you control `plugins` in the init config.
 *
 *   registerLatexEquationPlugin( window.tinymce );
 *   // init={{ plugins: 'latexequation', toolbar: 'formula' }}
 */
export function registerLatexEquationPlugin( tinymce: TinyMceLike, name: string = PLUGIN_NAME ): void {
	tinymce.PluginManager.add( name, setupLatexEquation );
}

export { PLUGIN_NAME as LATEX_EQUATION_PLUGIN_NAME, TOOLBAR_BUTTON as LATEX_EQUATION_TOOLBAR_BUTTON };
