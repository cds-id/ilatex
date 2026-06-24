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
	on( name: string, handler: ( event: { target?: Element; element?: Element; node?: Element } & Event ) => void ): void;
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
.${ LATEX_MATH_CLASS } {
	display: inline-block;
	vertical-align: middle;
	cursor: pointer;
	user-select: all;
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
		existing.setAttribute( 'data-latex', trimmed );
		existing.classList.add( LATEX_MATH_CLASS, RENDERED_CLASS );
		existing.setAttribute( 'contenteditable', 'false' );
		existing.innerHTML = convertLatexToMarkup( trimmed );
		emitChange( editor );
		return;
	}

	editor.insertContent( buildLatexSpan( trimmed ) );
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
