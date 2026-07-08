import { convertLatexToMarkup } from 'mathlive';
import { SHORTCODE_PATTERN, LATEX_MATH_CLASS } from './shortcode.js';
import { markdownToHtml } from './markdown.js';

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
	return convertLatexToMarkup( normalizeRenderLatex( latex ) );
}

function normalizeRenderLatex( latex: string ): string {
	let normalized = normalizeColorboxMath( latex );

	if (
		!/^\s*\\begin\{/.test( normalized ) &&
		( /\\\\/.test( normalized ) || /\\cr\b/.test( normalized ) )
	) {
		normalized = `\\begin{aligned}${ normalized.replace( /\\cr\b/g, '\\\\' ) }\\end{aligned}`;
	}

	return normalized;
}

function normalizeColorboxMath( latex: string ): string {
	return latex.replace( /\\colorbox\{([^{}]+)\}\{([^{}]*)\}/g, ( match, color: string, body: string ) => {
		const trimmed = body.trim();

		if ( /^\$[\s\S]*\$$/.test( trimmed ) || /^\\\([\s\S]*\\\)$/.test( trimmed ) ) {
			return match;
		}

		return `\\colorbox{${ color }}{$${ body }$}`;
	} );
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
 * Convert a Markdown string that may contain LaTeX (`.latex-math` spans or
 * `[%...%]` shortcodes) into rendered HTML, VIEW-ONLY.
 *
 * Pipeline: mask any existing `.latex-math` spans and `[%...%]` shortcodes so
 * the Markdown pass cannot mangle their LaTeX -> run Markdown -> unmask ->
 * render the math to MathLive markup. The result is a static HTML string; it
 * does not touch any editor instance.
 *
 * Requires a DOM (browser or jsdom) because math rendering runs on elements.
 */
export function renderMarkdownWithLatex(
	source: string,
	options: RenderLatexOptions = {}
): string {
	if ( typeof document === 'undefined' ) {
		return markdownToHtml( source );
	}

	// 1. Mask latex-math spans and [%...%] shortcodes to opaque placeholders so
	//    Markdown inline rules (e.g. `_`, `*`, `[`) never corrupt LaTeX bodies.
	const masks: string[] = [];
	const mask = ( original: string ): string => {
		masks.push( original );
		return `\u0000M${ masks.length - 1 }\u0000`;
	};

	let masked = source.replace(
		/<span\b[^>]*class="[^"]*\blatex-math\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi,
		m => mask( m )
	);

	SHORTCODE_PATTERN.lastIndex = 0;
	masked = masked.replace( SHORTCODE_PATTERN, m => mask( m ) );

	// 2. Markdown -> HTML.
	let html = markdownToHtml( masked );

	// 3. Unmask (placeholders survive HTML escaping since they are U+0000-wrapped).
	html = html.replace( /\u0000M(\d+)\u0000/g, ( _m, i: string ) => masks[ Number( i ) ] );

	// 4. Render the math in the resulting HTML.
	const holder = document.createElement( 'div' );
	holder.innerHTML = html;
	renderLatexInElement( holder, options );

	return holder.innerHTML;
}

/**
 * Render Markdown-with-LaTeX from `source` into `target` (element or selector),
 * VIEW-ONLY. Sets the target's innerHTML to the fully rendered HTML.
 */
export function renderMarkdownInElement(
	target: HTMLElement | string,
	source: string,
	options: RenderLatexOptions = {}
): void {
	const element = typeof target === 'string'
		? ( document.querySelector( target ) as HTMLElement | null )
		: target;

	if ( !element ) {
		return;
	}

	element.innerHTML = renderMarkdownWithLatex( source, options );
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
		span.innerHTML = renderLatexToMarkup( latex );
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
			span.innerHTML = renderLatexToMarkup( latex );
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
