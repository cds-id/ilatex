import { describe, expect, it, beforeEach } from 'vitest';
import { renderLatexInElement, renderLatexInDocument, renderLatexToMarkup } from '../src';

describe( 'renderLatex utils', () => {
	beforeEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'renders a single LaTeX string to markup', () => {
		const markup = renderLatexToMarkup( 'x\\lt2' );

		expect( markup ).toContain( '<' );
		expect( markup.length ).toBeGreaterThan( 0 );
	} );

	it( 'converts [% %] shortcodes in a text node', () => {
		const host = document.createElement( 'div' );
		host.innerHTML = '<p>Area is [%16\\Large\\frac{1}{3}%] units</p>';
		document.body.appendChild( host );

		renderLatexInElement( host );

		const span = host.querySelector( '.latex-math' );
		expect( span ).toBeTruthy();
		expect( span!.getAttribute( 'data-latex' ) ).toBe( '16\\Large\\frac{1}{3}' );
		expect( span!.innerHTML.length ).toBeGreaterThan( 0 );
		expect( host.textContent ).not.toContain( '[%' );
		expect( host.querySelector( 'p' )!.childNodes.length ).toBe( 3 );
	} );

	it( 'renders existing .latex-math[data-latex] spans', () => {
		const host = document.createElement( 'div' );
		host.innerHTML = '<p><span class="latex-math" data-latex="E=mc^2">E=mc^2</span></p>';
		document.body.appendChild( host );

		renderLatexInElement( host );

		const span = host.querySelector( '.latex-math' )!;
		expect( span.classList.contains( 'latex-rendered' ) ).toBe( true );
		expect( span.innerHTML ).not.toBe( 'E=mc^2' );
	} );

	it( 'is idempotent on repeated calls', () => {
		const host = document.createElement( 'div' );
		host.innerHTML = '<p>[%a+b%]</p>';
		document.body.appendChild( host );

		renderLatexInElement( host );
		const firstHtml = host.innerHTML;
		renderLatexInElement( host );

		expect( host.innerHTML ).toBe( firstHtml );
		expect( host.querySelectorAll( '.latex-math' ).length ).toBe( 1 );
	} );

	it( 'handles multiple shortcodes in one text node', () => {
		const host = document.createElement( 'div' );
		host.innerHTML = '<p>[%x%] and [%y%]</p>';
		document.body.appendChild( host );

		renderLatexInElement( host );

		expect( host.querySelectorAll( '.latex-math' ).length ).toBe( 2 );
		expect( host.textContent ).toContain( ' and ' );
	} );

	it( 'skips script and style content', () => {
		const host = document.createElement( 'div' );
		host.innerHTML = '<style>.x{content:"[%z%]"}</style><p>[%z%]</p>';
		document.body.appendChild( host );

		renderLatexInElement( host );

		expect( host.querySelector( 'style' )!.textContent ).toContain( '[%z%]' );
		expect( host.querySelectorAll( '.latex-math' ).length ).toBe( 1 );
	} );

	it( 'accepts a selector string', () => {
		const host = document.createElement( 'div' );
		host.id = 'content';
		host.innerHTML = '<p>[%x^2%]</p>';
		document.body.appendChild( host );

		renderLatexInElement( '#content' );

		expect( host.querySelector( '.latex-math' ) ).toBeTruthy();
	} );

	it( 'renders across the whole document', () => {
		document.body.innerHTML = '<p>[%n+1%]</p>';

		renderLatexInDocument();

		expect( document.body.querySelector( '.latex-math' ) ).toBeTruthy();
	} );
} );
