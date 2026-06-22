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

function createFakeEditor( selectedNode: Element, body?: HTMLElement ) {
	const buttons = new Map<string, ButtonSpec>();
	const handlers = new Map<string, DblHandler>();
	const inserted: string[] = [];
	const editorBody = body ?? document.createElement( 'div' );

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
			getNode: () => selectedNode
		},
		insertContent: ( content: string ) => {
			inserted.push( content );
			editorBody.insertAdjacentHTML( 'beforeend', content );
		},
		getBody: () => editorBody,
		getDoc: () => document,
		contentDocument: document,
		dispatch: vi.fn(),
		fire: vi.fn()
	} satisfies TinyMceEditorLike;

	return { editor, buttons, handlers, inserted, editorBody };
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

	it( 'builds a rendered, round-trippable latex-math span', () => {
		const html = buildLatexSpan( 'a<b&c' );
		expect( html ).toContain( 'class="latex-math latex-rendered"' );
		expect( html ).toContain( 'data-latex="a&lt;b&amp;c"' );
		expect( html ).toContain( 'contenteditable="false"' );
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

		expect( inserted.length ).toBe( 1 );
		expect( inserted[ 0 ] ).toContain( 'data-latex="E=mc^2"' );
		expect( inserted[ 0 ] ).toContain( 'class="latex-math latex-rendered"' );
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
		expect( equation.classList.contains( 'latex-rendered' ) ).toBe( true );
		expect( equation.getAttribute( 'contenteditable' ) ).toBe( 'false' );
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

	it( 'converts [% %] shortcodes in the body on init', () => {
		const body = document.createElement( 'div' );
		body.innerHTML = '<p>before [%a+b%] after</p>';
		const { editor, handlers } = createFakeEditor( body, body );

		setupLatexEquation( editor );
		handlers.get( 'init' )!( {} as never );

		const span = body.querySelector( '.latex-math[data-latex]' );
		expect( span ).toBeTruthy();
		expect( span!.getAttribute( 'data-latex' ) ).toBe( 'a+b' );
		expect( body.textContent ).not.toContain( '[%' );
	} );

	it( 'strips rendered markup on PreProcess so serialized HTML is clean', () => {
		const { editor, handlers } = createFakeEditor( document.createElement( 'p' ) );
		setupLatexEquation( editor );

		const node = document.createElement( 'div' );
		node.innerHTML = buildLatexSpan( 'E=mc^2' );
		expect( node.innerHTML ).toContain( 'ML__' );

		handlers.get( 'PreProcess' )!( { node } as never );

		const span = node.querySelector( '.latex-math' )!;
		expect( span.getAttribute( 'data-latex' ) ).toBe( 'E=mc^2' );
		expect( span.classList.contains( 'latex-rendered' ) ).toBe( false );
		expect( span.hasAttribute( 'contenteditable' ) ).toBe( false );
		expect( span.innerHTML ).toBe( 'E=mc^2' );
		expect( node.innerHTML ).not.toContain( 'ML__' );
	} );

	it( 'registers via PluginManager', () => {
		const add = vi.fn();
		registerLatexEquationPlugin( { PluginManager: { add } } );

		expect( add ).toHaveBeenCalledWith( 'latexequation', setupLatexEquation );
	} );
} );
