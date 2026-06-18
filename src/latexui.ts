import 'mathlive';
import { ButtonView, Plugin } from 'ckeditor5';

export default class LatexUI extends Plugin {
	public static get pluginName() {
		return 'LatexUI' as const;
	}

	public init(): void {
		const editor = this.editor;

		editor.on( 'ready', () => {
			editor.ui.view.editable.element?.addEventListener( 'dblclick', event => {
				const equationElement = ( event.target as HTMLElement | null )?.closest?.( '.latex-math' ) as HTMLElement | null;

				if ( !equationElement ) {
					return;
				}

				event.preventDefault();
				selectEquationElement( editor, equationElement );
				openLatexEditorDialog( {
					initialValue: equationElement.dataset.latex ?? '',
					onSubmit: latex => {
						editor.execute( 'insertLatex', { latex } );
						editor.editing.view.focus();
					}
				} );
			} );
		} );

		const createFormulaButton = ( locale: Parameters<typeof editor.ui.componentFactory.add>[1] extends ( locale: infer Locale ) => unknown ? Locale : never ) => {
			const button = new ButtonView( locale );

			button.set( {
				label: 'Formula',
				tooltip: true,
				withText: true
			} );

			button.on( 'execute', () => {
				openLatexEditorDialog( {
					initialValue: getSelectedLatex( editor ),
					onSubmit: latex => {
						editor.execute( 'insertLatex', { latex } );
						editor.editing.view.focus();
					}
				} );
			} );

			return button;
		};

		editor.ui.componentFactory.add( 'formula', createFormulaButton );
		editor.ui.componentFactory.add( 'latex', createFormulaButton );
	}
}

type LatexDialogOptions = {
	initialValue: string;
	onSubmit: ( latex: string ) => void;
};

type MathFieldElementLike = HTMLElement & {
	value?: string;
	mathVirtualKeyboardPolicy?: string;
	executeCommand?: ( command: string | unknown[] ) => boolean;
};

function openLatexEditorDialog( { initialValue, onSubmit }: LatexDialogOptions ): void {
	document.querySelector( '.ck-latex-editor-dialog' )?.remove();

	const backdrop = document.createElement( 'div' );
	backdrop.className = 'ck-latex-editor-dialog';
	backdrop.setAttribute( 'role', 'dialog' );
	backdrop.setAttribute( 'aria-modal', 'true' );
	backdrop.innerHTML = `
		<div class="ck-latex-editor-panel">
			<header class="ck-latex-editor-header">
				<strong>Equation editor</strong>
				<button type="button" class="ck-latex-close" aria-label="Close">×</button>
			</header>
			<div class="ck-latex-mathfield-host"></div>
			<div class="ck-latex-symbols" aria-label="Equation symbols"></div>
			<label class="ck-latex-source-label">LaTeX</label>
			<textarea class="ck-latex-source" spellcheck="false"></textarea>
			<footer class="ck-latex-actions">
				<button type="button" data-testid="latex-cancel">Cancel</button>
				<button type="button" data-testid="latex-insert">Insert equation</button>
			</footer>
		</div>
	`;

	const host = backdrop.querySelector( '.ck-latex-mathfield-host' ) as HTMLElement;
	const symbols = backdrop.querySelector( '.ck-latex-symbols' ) as HTMLElement;
	const textarea = backdrop.querySelector( 'textarea' ) as HTMLTextAreaElement;
	const mathfield = document.createElement( 'math-field' ) as MathFieldElementLike;
	let syncing = false;

	mathfield.setAttribute( 'virtual-keyboard-mode', 'manual' );
	mathfield.setAttribute( 'smart-fence', '' );
	mathfield.mathVirtualKeyboardPolicy = 'manual';
	mathfield.value = initialValue;
	textarea.value = initialValue;
	host.appendChild( mathfield );

	addSymbolButtons( symbols, mathfield, textarea );

	mathfield.addEventListener( 'input', () => {
		if ( syncing ) {
			return;
		}

		syncing = true;
		textarea.value = mathfield.value ?? '';
		syncing = false;
	} );

	textarea.addEventListener( 'input', () => {
		if ( syncing ) {
			return;
		}

		syncing = true;
		mathfield.value = textarea.value;
		syncing = false;
	} );

	backdrop.querySelector( '.ck-latex-close' )?.addEventListener( 'click', () => backdrop.remove() );
	backdrop.querySelector( '[data-testid="latex-cancel"]' )?.addEventListener( 'click', () => backdrop.remove() );
	backdrop.querySelector( '[data-testid="latex-insert"]' )?.addEventListener( 'click', () => {
		const latex = ( mathfield.value ?? textarea.value ).trim();

		if ( latex ) {
			onSubmit( latex );
		}

		backdrop.remove();
	} );

	document.body.appendChild( backdrop );
	setTimeout( () => mathfield.focus(), 0 );
}

function selectEquationElement( editor: LatexUI[ 'editor' ], equationElement: HTMLElement ): void {
	const viewElement = editor.editing.view.domConverter.domToView( equationElement );
	const modelElement = viewElement?.is( 'element' ) ? editor.editing.mapper.toModelElement( viewElement ) : null;

	if ( modelElement ) {
		editor.model.change( writer => {
			writer.setSelection( modelElement, 'on' );
		} );
	}
}

function addSymbolButtons( container: HTMLElement, mathfield: MathFieldElementLike, textarea: HTMLTextAreaElement ): void {
	const symbols = [
		{ label: 'Fraction', latex: '\\frac{#@}{#?}' },
		{ label: 'Square root', latex: '\\sqrt{#0}' },
		{ label: 'Power', latex: '#@^{#?}' },
		{ label: 'π', latex: '\\pi' },
		{ label: '±', latex: '\\pm' },
		{ label: '×', latex: '\\times' },
		{ label: '≤', latex: '\\le' },
		{ label: '≥', latex: '\\ge' },
		{ label: '∫', latex: '\\int' },
		{ label: 'Σ', latex: '\\sum' }
	];

	for ( const symbol of symbols ) {
		const button = document.createElement( 'button' );
		button.type = 'button';
		button.textContent = symbol.label;
		button.addEventListener( 'click', () => {
			if ( mathfield.executeCommand ) {
				mathfield.executeCommand( [ 'insert', symbol.latex ] );
			} else {
				mathfield.value = `${ mathfield.value ?? '' }${ symbol.latex }`;
			}

			textarea.value = mathfield.value ?? '';
			mathfield.dispatchEvent( new Event( 'input', { bubbles: true } ) );
			mathfield.focus();
		} );
		container.appendChild( button );
	}
}

function getSelectedLatex( editor: LatexUI[ 'editor' ] ): string {
	const selectedElement = editor.model.document.selection.getSelectedElement();

	if ( selectedElement?.is( 'element', 'latexInline' ) ) {
		return ( selectedElement.getAttribute( 'latex' ) as string | undefined ) ?? '';
	}

	return '';
}
