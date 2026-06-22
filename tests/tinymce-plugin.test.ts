import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
	setupLatexEquation,
	registerLatexEquationPlugin,
	buildLatexSpan,
	LATEX_EQUATION_PLUGIN_NAME,
	LATEX_EQUATION_TOOLBAR_BUTTON,
	type TinyMceEditorLike
} from '../src/tinymce';

type ButtonSpec = Parameters<TinyMceEditorLike[ 'ui' ][ 'registry' ][ 'addButton' ]>[ 1 ];
type DblHandler = ( event: { target?: Element } & Event ) => void;

function createFakeEditor( selectedNode: Element ) {
	const buttons = new Map<string, ButtonSpec>();
	const handlers = new Map<string, DblHandler>();
	const inserted: string[] = [];

	const editor = {
		ui: {
			registry: {
				addButton: ( name: string, spec: ButtonSpec ) => {
					buttons.set( name, spec );
				}
			}
		},
		on: ( name: string, handler: DblHandler ) => {
			handlers.set( name, handler );
		},
		selection: {
			getNode: () => selectedNode,
			getContent: () => ''
		},
		insertContent: ( content: string ) => {
			inserted.push( content );
		},
		dom: {
			setAttrib: ( element: Element, attr: string, value: string ) => {
				element.setAttribute( attr, value );
			},
			setHTML: ( element: Element, html: string ) => {
				element.innerHTML = html;
			}
		},
		fire: vi.fn()
	} satisfies TinyMceEditorLike;

	return { editor, buttons, handlers, inserted };
}

function getDialog(): HTMLElement {
	return document.querySelector( '.tinymce-latex-editor-dialog' ) as HTMLElement;
}

describe( 'TinyMCE LaTeX equation plugin', () => {
	beforeEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'exposes plugin + toolbar button names', () => {
		expect( LATEX_EQUATION_PLUGIN_NAME ).toBe( 'latexequation' );
		expect( LATEX_EQUATION_TOOLBAR_BUTTON ).toBe( 'formula' );
	} );

	it( 'builds an escaped latex-math span', () => {
		expect( buildLatexSpan( 'a<b&c' ) ).toBe(
			'<span class="latex-math" data-latex="a&lt;b&amp;c">a&lt;b&amp;c</span>'
		);
	} );

	it( 'registers a Formula toolbar button', () => {
		const { editor, buttons } = createFakeEditor( document.createElement( 'p' ) );

		setupLatexEquation( editor );

		const button = buttons.get( 'formula' );
		expect( button ).toBeDefined();
		expect( button!.text ).toBe( 'Formula' );
	} );

	it( 'inserts a latex-math span when toolbar button submits', () => {
		const { editor, buttons, inserted } = createFakeEditor( document.createElement( 'p' ) );

		setupLatexEquation( editor );
		buttons.get( 'formula' )!.onAction();

		const dialog = getDialog();
		expect( dialog ).toBeTruthy();

		const textarea = dialog.querySelector( 'textarea' ) as HTMLTextAreaElement;
		textarea.value = 'E=mc^2';
		textarea.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		( dialog.querySelector( '[data-testid="latex-insert"]' ) as HTMLButtonElement ).click();

		expect( inserted ).toEqual( [ '<span class="latex-math" data-latex="E=mc^2">E=mc^2</span>' ] );
		expect( getDialog() ).toBeFalsy();
	} );

	it( 'prefills latex from a selected equation and updates it in place', () => {
		const equation = document.createElement( 'span' );
		equation.className = 'latex-math';
		equation.setAttribute( 'data-latex', 'a+b' );
		equation.textContent = 'a+b';
		document.body.appendChild( equation );

		const { editor, buttons, inserted } = createFakeEditor( equation );

		setupLatexEquation( editor );
		buttons.get( 'formula' )!.onAction();

		const dialog = getDialog();
		const textarea = dialog.querySelector( 'textarea' ) as HTMLTextAreaElement;
		expect( textarea.value ).toBe( 'a+b' );

		textarea.value = 'a-b';
		textarea.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		( dialog.querySelector( '[data-testid="latex-insert"]' ) as HTMLButtonElement ).click();

		// Updated in place, no new insert.
		expect( inserted ).toEqual( [] );
		expect( equation.getAttribute( 'data-latex' ) ).toBe( 'a-b' );
		expect( equation.innerHTML ).toBe( 'a-b' );
	} );

	it( 'opens edit dialog on double click of an equation', () => {
		const equation = document.createElement( 'span' );
		equation.className = 'latex-math';
		equation.setAttribute( 'data-latex', 'x^2' );
		equation.textContent = 'x^2';
		document.body.appendChild( equation );

		const { editor, handlers } = createFakeEditor( equation );
		setupLatexEquation( editor );

		const event = { target: equation, preventDefault() { ( this as { defaultPrevented?: boolean } ).defaultPrevented = true; }, defaultPrevented: false };
		handlers.get( 'dblclick' )!( event as never );

		expect( event.defaultPrevented ).toBe( true );
		const textarea = getDialog().querySelector( 'textarea' ) as HTMLTextAreaElement;
		expect( textarea.value ).toBe( 'x^2' );
	} );

	it( 'ignores double click outside an equation', () => {
		const para = document.createElement( 'p' );
		const { editor, handlers } = createFakeEditor( para );
		setupLatexEquation( editor );

		const event = { target: para, preventDefault() { ( this as { defaultPrevented?: boolean } ).defaultPrevented = true; }, defaultPrevented: false };
		handlers.get( 'dblclick' )!( event as never );

		expect( event.defaultPrevented ).toBe( false );
		expect( getDialog() ).toBeFalsy();
	} );

	it( 'registers via PluginManager', () => {
		const add = vi.fn();
		registerLatexEquationPlugin( { PluginManager: { add } } );

		expect( add ).toHaveBeenCalledWith( 'latexequation', setupLatexEquation );
	} );
} );
