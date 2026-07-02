// Minimal, dependency-free Markdown -> HTML converter for the VIEW/RENDER path
// only. It is intentionally small (no CommonMark edge cases) and is designed to
// coexist with LaTeX: `.latex-math` spans and `[%...%]` shortcodes are masked
// out before parsing and restored afterwards, so math is never mangled by the
// Markdown pass. The editor never uses this module.

const ESCAPE_MAP: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

function escapeHtml( text: string ): string {
	return text.replace( /[&<>"']/g, ch => ESCAPE_MAP[ ch ] );
}

/** Inline: code spans, bold, italic, strikethrough, links, images. */
function renderInline( text: string ): string {
	// Inline code first (protect its contents from other inline rules).
	const codeTokens: string[] = [];
	let out = text.replace( /`([^`]+)`/g, ( _m, code: string ) => {
		codeTokens.push( `<code>${ escapeHtml( code ) }</code>` );
		return `\u0000C${ codeTokens.length - 1 }\u0000`;
	} );

	out = escapeHtml( out );

	// Images: ![alt](url)
	out = out.replace( /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
		( _m, alt: string, url: string, title?: string ) =>
			`<img src="${ url }" alt="${ alt }"${ title ? ` title="${ title }"` : '' }>` );

	// Links: [text](url)
	out = out.replace( /\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
		( _m, label: string, url: string, title?: string ) =>
			`<a href="${ url }"${ title ? ` title="${ title }"` : '' }>${ label }</a>` );

	// Bold then italic then strikethrough.
	out = out.replace( /\*\*([^*]+)\*\*/g, '<strong>$1</strong>' );
	out = out.replace( /__([^_]+)__/g, '<strong>$1</strong>' );
	out = out.replace( /(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>' );
	out = out.replace( /(^|[^_])_([^_\s][^_]*?)_/g, '$1<em>$2</em>' );
	out = out.replace( /~~([^~]+)~~/g, '<del>$1</del>' );

	// Restore inline code.
	out = out.replace( /\u0000C(\d+)\u0000/g, ( _m, i: string ) => codeTokens[ Number( i ) ] );

	return out;
}

interface ListState {
	type: 'ul' | 'ol';
	items: string[];
}

/**
 * Convert a Markdown string to an HTML string. Block support: ATX headings
 * (`#`..`######`), fenced code (``` ```), blockquotes, unordered (`-`/`*`/`+`)
 * and ordered (`1.`) lists, horizontal rules (`---`), and paragraphs. Inline
 * support: code, bold, italic, strikethrough, links, images.
 */
export function markdownToHtml( source: string ): string {
	const lines = source.replace( /\r\n?/g, '\n' ).split( '\n' );
	const blocks: string[] = [];

	let list: ListState | null = null;
	let paragraph: string[] = [];
	let inFence = false;
	let fenceLang = '';
	let fenceLines: string[] = [];

	const flushParagraph = () => {
		if ( paragraph.length ) {
			blocks.push( `<p>${ renderInline( paragraph.join( ' ' ) ) }</p>` );
			paragraph = [];
		}
	};

	const flushList = () => {
		if ( list ) {
			const items = list.items.map( item => `<li>${ renderInline( item ) }</li>` ).join( '' );
			blocks.push( `<${ list.type }>${ items }</${ list.type }>` );
			list = null;
		}
	};

	for ( const rawLine of lines ) {
		const line = rawLine;

		// Fenced code block.
		const fenceMatch = /^\s*```(.*)$/.exec( line );

		if ( inFence ) {
			if ( fenceMatch ) {
				const cls = fenceLang ? ` class="language-${ fenceLang }"` : '';
				blocks.push( `<pre><code${ cls }>${ escapeHtml( fenceLines.join( '\n' ) ) }</code></pre>` );
				inFence = false;
				fenceLang = '';
				fenceLines = [];
			} else {
				fenceLines.push( line );
			}
			continue;
		}

		if ( fenceMatch ) {
			flushParagraph();
			flushList();
			inFence = true;
			fenceLang = fenceMatch[ 1 ].trim();
			continue;
		}

		// Blank line: close paragraph and list.
		if ( /^\s*$/.test( line ) ) {
			flushParagraph();
			flushList();
			continue;
		}

		// Horizontal rule.
		if ( /^\s*([-*_])(\s*\1){2,}\s*$/.test( line ) ) {
			flushParagraph();
			flushList();
			blocks.push( '<hr>' );
			continue;
		}

		// Heading.
		const heading = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec( line );

		if ( heading ) {
			flushParagraph();
			flushList();
			const level = heading[ 1 ].length;
			blocks.push( `<h${ level }>${ renderInline( heading[ 2 ] ) }</h${ level }>` );
			continue;
		}

		// Blockquote.
		const quote = /^\s*>\s?(.*)$/.exec( line );

		if ( quote ) {
			flushParagraph();
			flushList();
			blocks.push( `<blockquote>${ renderInline( quote[ 1 ] ) }</blockquote>` );
			continue;
		}

		// List item (unordered or ordered).
		const ul = /^\s*[-*+]\s+(.*)$/.exec( line );
		const ol = /^\s*\d+[.)]\s+(.*)$/.exec( line );

		if ( ul || ol ) {
			flushParagraph();
			const type = ul ? 'ul' : 'ol';
			const content = ( ul ?? ol )![ 1 ];

			if ( !list || list.type !== type ) {
				flushList();
				list = { type, items: [] };
			}

			list.items.push( content );
			continue;
		}

		// Otherwise: paragraph text.
		flushList();
		paragraph.push( line.trim() );
	}

	if ( inFence ) {
		// Unterminated fence: emit what we have.
		const cls = fenceLang ? ` class="language-${ fenceLang }"` : '';
		blocks.push( `<pre><code${ cls }>${ escapeHtml( fenceLines.join( '\n' ) ) }</code></pre>` );
	}

	flushParagraph();
	flushList();

	return blocks.join( '\n' );
}
