import { convertLatexToMarkup } from 'mathlive';
import { SHORTCODE_PATTERN, LATEX_MATH_CLASS } from './shortcode.js';

export interface RenderLatexOptions {
	/**
	 * When true, replace `[%...%]` shortcodes found in text nodes with rendered math.
	 * Default: true.
	 */
	shortcodes?: boolean;
	/**
	 * When true, render existing `.latex-math[data-latex]` spans (the editor's HTML output).
	 * Default: true.
	 */
	mathSpans?: boolean;
	/**
	 * CSS class used to mark already-rendered hosts so re-runs are idempotent.
	 * Default: 'latex-rendered'.
	 */
	renderedClass?: string;
}

const DEFAULT_RENDERED_CLASS = 'latex-rendered';

/**
 * Render a single LaTeX string to static HTML markup (MathLive, no editor).
 */
export function renderLatexToMarkup( latex: string ): string {
	return convertLatexToMarkup( latex );
}

/**
 * Render all LaTeX in a DOM subtree, in place, without a CKEditor instance.
 *
 * Handles two sources:
 *  - `[%...%]` shortcodes inside text nodes (same syntax the editor auto-parses).
 *  - `.latex-math[data-latex]` spans (the HTML the editor serializes).
 *
 * Safe to call multiple times: rendered hosts are marked and skipped.
 */
export function renderLatexInElement(
	root: HTMLElement | string,
	options: RenderLatexOptions = {}
): void {
	const element = typeof root === 'string'
		? ( document.querySelector( root ) as HTMLElement | null )
		: root;

	if ( !element ) {
		return;
	}

	const {
		shortcodes = true,
		mathSpans = true,
		renderedClass = DEFAULT_RENDERED_CLASS
	} = options;

	if ( mathSpans ) {
		renderMathSpans( element, renderedClass );
	}

	if ( shortcodes ) {
		renderShortcodes( element, renderedClass );
	}
}

/**
 * Render LaTeX across the whole document body.
 */
export function renderLatexInDocument( options: RenderLatexOptions = {} ): void {
	if ( typeof document === 'undefined' || !document.body ) {
		return;
	}

	renderLatexInElement( document.body, options );
}

function renderMathSpans( root: HTMLElement, renderedClass: string ): void {
	const spans = root.querySelectorAll<HTMLElement>( `.${ LATEX_MATH_CLASS }[data-latex]` );

	spans.forEach( span => {
		if ( span.classList.contains( renderedClass ) ) {
			return;
		}

		const latex = span.getAttribute( 'data-latex' ) ?? '';
		span.innerHTML = convertLatexToMarkup( latex );
		span.classList.add( renderedClass );
	} );
}

function renderShortcodes( root: HTMLElement, renderedClass: string ): void {
	const walker = document.createTreeWalker( root, NodeFilter.SHOW_TEXT, {
		acceptNode( node ) {
			const parent = node.parentElement;

			if ( !parent ) {
				return NodeFilter.FILTER_REJECT;
			}

			// Skip script/style and already-rendered math hosts.
			const tag = parent.tagName;
			if ( tag === 'SCRIPT' || tag === 'STYLE' ) {
				return NodeFilter.FILTER_REJECT;
			}

			if ( parent.closest( `.${ LATEX_MATH_CLASS }, .${ renderedClass }` ) ) {
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

	targets.forEach( textNode => replaceShortcodesInTextNode( textNode, renderedClass ) );
}

function replaceShortcodesInTextNode( textNode: Text, renderedClass: string ): void {
	const data = textNode.nodeValue ?? '';
	SHORTCODE_PATTERN.lastIndex = 0;

	if ( !SHORTCODE_PATTERN.test( data ) ) {
		return;
	}

	SHORTCODE_PATTERN.lastIndex = 0;
	const fragment = document.createDocumentFragment();
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ( ( match = SHORTCODE_PATTERN.exec( data ) ) !== null ) {
		const latex = match[ 1 ].trim();

		if ( match.index > lastIndex ) {
			fragment.appendChild( document.createTextNode( data.slice( lastIndex, match.index ) ) );
		}

		if ( latex ) {
			const span = document.createElement( 'span' );
			span.className = `${ LATEX_MATH_CLASS } ${ renderedClass }`;
			span.setAttribute( 'data-latex', latex );
			span.innerHTML = convertLatexToMarkup( latex );
			fragment.appendChild( span );
		} else {
			fragment.appendChild( document.createTextNode( match[ 0 ] ) );
		}

		lastIndex = match.index + match[ 0 ].length;
	}

	if ( lastIndex < data.length ) {
		fragment.appendChild( document.createTextNode( data.slice( lastIndex ) ) );
	}

	textNode.parentNode?.replaceChild( fragment, textNode );
}
