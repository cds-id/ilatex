import { describe, expect, it } from 'vitest';
import { markdownToHtml } from '../src/markdown';
import { renderMarkdownWithLatex, renderMarkdownInElement } from '../src/render';

describe( 'markdownToHtml', () => {
	it( 'renders ATX headings', () => {
		expect( markdownToHtml( '# Title' ) ).toBe( '<h1>Title</h1>' );
		expect( markdownToHtml( '### Sub' ) ).toBe( '<h3>Sub</h3>' );
	} );

	it( 'renders paragraphs', () => {
		expect( markdownToHtml( 'hello world' ) ).toBe( '<p>hello world</p>' );
	} );

	it( 'renders bold, italic, strikethrough', () => {
		expect( markdownToHtml( '**b**' ) ).toBe( '<p><strong>b</strong></p>' );
		expect( markdownToHtml( '_i_' ) ).toBe( '<p><em>i</em></p>' );
		expect( markdownToHtml( '~~s~~' ) ).toBe( '<p><del>s</del></p>' );
	} );

	it( 'renders inline code and escapes its contents', () => {
		expect( markdownToHtml( '`a<b>`' ) ).toBe( '<p><code>a&lt;b&gt;</code></p>' );
	} );

	it( 'renders unordered and ordered lists', () => {
		expect( markdownToHtml( '- a\n- b' ) ).toBe( '<ul><li>a</li><li>b</li></ul>' );
		expect( markdownToHtml( '1. a\n2. b' ) ).toBe( '<ol><li>a</li><li>b</li></ol>' );
	} );

	it( 'renders fenced code blocks with language class', () => {
		expect( markdownToHtml( '```js\nconst x = 1;\n```' ) )
			.toBe( '<pre><code class="language-js">const x = 1;</code></pre>' );
	} );

	it( 'renders blockquotes and horizontal rules', () => {
		expect( markdownToHtml( '> quote' ) ).toBe( '<blockquote>quote</blockquote>' );
		expect( markdownToHtml( '---' ) ).toBe( '<hr>' );
	} );

	it( 'renders links and images', () => {
		expect( markdownToHtml( '[x](http://a.b)' ) ).toBe( '<p><a href="http://a.b">x</a></p>' );
		expect( markdownToHtml( '![alt](http://a.b/i.png)' ) )
			.toBe( '<p><img src="http://a.b/i.png" alt="alt"></p>' );
	} );

	it( 'escapes raw HTML in plain text', () => {
		expect( markdownToHtml( 'a < b & c' ) ).toBe( '<p>a &lt; b &amp; c</p>' );
	} );
} );

describe( 'renderMarkdownWithLatex', () => {
	it( 'preserves a latex-math span through the markdown pass and renders it', () => {
		const html = renderMarkdownWithLatex(
			'Given <span class="latex-math" data-latex="E=mc^2">E=mc^2</span> we get **energy**.'
		);
		expect( html ).toContain( '<strong>energy</strong>' );
		const span = new DOMParser().parseFromString( html, 'text/html' ).querySelector( '.latex-math' );
		expect( span ).toBeTruthy();
		expect( span!.getAttribute( 'data-latex' ) ).toBe( 'E=mc^2' );
		// Rendered to MathLive markup, not left as raw latex.
		expect( span!.innerHTML ).toContain( 'ML__' );
	} );

	it( 'renders a [%...%] shortcode inside markdown', () => {
		const html = renderMarkdownWithLatex( '# Formula\n\nvalue [%a+b%] end' );
		expect( html ).toContain( '<h1>Formula</h1>' );
		const span = new DOMParser().parseFromString( html, 'text/html' ).querySelector( '.latex-math' );
		expect( span ).toBeTruthy();
		expect( span!.getAttribute( 'data-latex' ) ).toBe( 'a+b' );
	} );

	it( 'does not let markdown inline rules corrupt latex bodies', () => {
		// underscores in LaTeX (x_1) must survive, not become <em>.
		const html = renderMarkdownWithLatex( 'eq [%x_1 + y_2%] done' );
		const span = new DOMParser().parseFromString( html, 'text/html' ).querySelector( '.latex-math' );
		expect( span!.getAttribute( 'data-latex' ) ).toBe( 'x_1 + y_2' );
	} );
} );

describe( 'renderMarkdownInElement', () => {
	it( 'sets innerHTML of the target element', () => {
		const el = document.createElement( 'div' );
		renderMarkdownInElement( el, '**hi**' );
		expect( el.innerHTML ).toContain( '<strong>hi</strong>' );
	} );

	it( 'accepts a selector string', () => {
		const el = document.createElement( 'div' );
		el.id = 'md-target';
		document.body.appendChild( el );
		renderMarkdownInElement( '#md-target', '# H' );
		expect( el.innerHTML ).toContain( '<h1>H</h1>' );
		el.remove();
	} );
} );
