import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClassicEditor, Paragraph, type ButtonView, type ModelElement } from 'ckeditor5';
import { Equation } from '../src';

const editors: ClassicEditor[] = [];

afterEach( async () => {
	await Promise.all( editors.map( editor => editor.destroy() ) );
	editors.length = 0;
	document.body.innerHTML = '';
} );

async function createEditor( data = '' ): Promise<ClassicEditor> {
	const element = document.createElement( 'div' );
	element.innerHTML = data;
	document.body.appendChild( element );

	const editor = await ClassicEditor.create( element, {
		licenseKey: 'GPL',
		plugins: [ Paragraph, Equation ],
		toolbar: [ 'formula' ]
	} );

	editors.push( editor );
	return editor;
}

describe( 'Equation plugin', () => {
	it( 'registers insertLatex command', async () => {
		const editor = await createEditor();

		expect( editor.commands.get( 'insertLatex' ) ).toBeDefined();
	} );

	it( 'inserts inline LaTeX widget at selection and serializes to HTML', async () => {
		const editor = await createEditor( '<p>Formula: </p>' );

		editor.model.change( writer => {
			writer.setSelection( editor.model.document.getRoot()!.getChild( 0 )!, 'end' );
		} );
		editor.execute( 'insertLatex', { latex: 'E=mc^2' } );

		expect( editor.getData() ).toBe( '<p>Formula:<span class="latex-math" data-latex="E=mc^2">E=mc^2</span></p>' );
	} );

	it( 'upcasts LaTeX HTML span and preserves output', async () => {
		const editor = await createEditor( '<p><span class="latex-math" data-latex="\\frac{a}{b}">\\frac{a}{b}</span></p>' );

		expect( editor.getData() ).toBe( '<p><span class="latex-math" data-latex="\\frac{a}{b}">\\frac{a}{b}</span></p>' );
	} );

	it( 'updates selected LaTeX widget instead of inserting duplicate', async () => {
		const editor = await createEditor( '<p><span class="latex-math" data-latex="x+1">x+1</span></p>' );

		editor.model.change( writer => {
			const paragraph = editor.model.document.getRoot()!.getChild( 0 )! as ModelElement;
			const formula = paragraph.getChild( 0 )!;
			writer.setSelection( formula, 'on' );
		} );

		editor.execute( 'insertLatex', { latex: 'x^2+1' } );

		expect( editor.getData() ).toBe( '<p><span class="latex-math" data-latex="x^2+1">x^2+1</span></p>' );
	} );

	it( 'opens MathLive editor dialog from toolbar and inserts formula', async () => {
		vi.spyOn( window, 'prompt' ).mockImplementation( () => {
			throw new Error( 'prompt should not be used' );
		} );

		const editor = await createEditor( '<p></p>' );
		const button = editor.ui.componentFactory.create( 'formula' );

		button.fire( 'execute' );

		const dialog = document.querySelector( '.ck-latex-editor-dialog' ) as HTMLElement;
		expect( dialog ).toBeTruthy();
		expect( dialog.querySelector( 'math-field' ) ).toBeTruthy();
		expect( dialog.querySelector( '.ck-latex-symbols' ) ).toBeTruthy();

		const textarea = dialog.querySelector( 'textarea' ) as HTMLTextAreaElement;
		textarea.value = 'E=mc^2';
		textarea.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		( dialog.querySelector( '[data-testid="latex-insert"]' ) as HTMLButtonElement ).click();

		expect( editor.getData() ).toBe( '<p><span class="latex-math" data-latex="E=mc^2">E=mc^2</span></p>' );
	} );

	it( 'opens selected formula in editor dialog for editing', async () => {
		const editor = await createEditor( '<p><span class="latex-math" data-latex="a+b">a+b</span></p>' );

		editor.model.change( writer => {
			const paragraph = editor.model.document.getRoot()!.getChild( 0 )! as ModelElement;
			const formula = paragraph.getChild( 0 )!;
			writer.setSelection( formula, 'on' );
		} );

		const button = editor.ui.componentFactory.create( 'formula' );
		button.fire( 'execute' );

		const dialog = document.querySelector( '.ck-latex-editor-dialog' ) as HTMLElement;
		const textarea = dialog.querySelector( 'textarea' ) as HTMLTextAreaElement;
		expect( textarea.value ).toBe( 'a+b' );

		textarea.value = 'a-b';
		textarea.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		( dialog.querySelector( '[data-testid="latex-insert"]' ) as HTMLButtonElement ).click();

		expect( editor.getData() ).toBe( '<p><span class="latex-math" data-latex="a-b">a-b</span></p>' );
	} );

	it( 'registers Formula toolbar button', async () => {
		const editor = await createEditor();
		const button = editor.ui.componentFactory.create( 'formula' ) as ButtonView;

		expect( editor.ui.componentFactory.has( 'formula' ) ).toBe( true );
		expect( button.label ).toBe( 'Formula' );
	} );

	it( 'exposes about metadata with version and creator', () => {
		expect( Equation.about ).toEqual( {
			name: 'ilatex-editor',
			version: '0.1.0',
			creator: 'CDS'
		} );
	} );

	it( 'renders equation with MathLive static math-span in editor UI', async () => {
		const editor = await createEditor( '<p><span class="latex-math" data-latex="\\frac{a}{b}">\\frac{a}{b}</span></p>' );
		const editorElement = editor.ui.view.editable.element!;

		expect( editorElement.querySelector( '.latex-math math-span' )?.textContent ).toBe( '\\frac{a}{b}' );
	} );

	it( 'opens selected equation editor on double click without virtual keyboard', async () => {
		const editor = await createEditor( '<p><span class="latex-math" data-latex="a+b">a+b</span></p>' );
		const editorElement = editor.ui.view.editable.element!;
		const equation = editorElement.querySelector( '.latex-math' ) as HTMLElement;
		const event = new MouseEvent( 'dblclick', { bubbles: true, cancelable: true } );

		equation.dispatchEvent( event );

		const dialog = document.querySelector( '.ck-latex-editor-dialog' ) as HTMLElement;
		const textarea = dialog.querySelector( 'textarea' ) as HTMLTextAreaElement;
		const mathfield = dialog.querySelector( 'math-field' ) as HTMLElement & { mathVirtualKeyboardPolicy?: string };

		expect( event.defaultPrevented ).toBe( true );
		expect( textarea.value ).toBe( 'a+b' );
		expect( mathfield.getAttribute( 'virtual-keyboard-mode' ) ).toBe( 'manual' );
		expect( mathfield.mathVirtualKeyboardPolicy ).toBe( 'manual' );
	} );
} );
