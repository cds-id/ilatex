import { ButtonView, Plugin, type Element as ModelElement } from 'ckeditor5';
import { openLatexEditorDialog } from './dialog.js';

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
				const modelElement = selectEquationElement( editor, equationElement );
				openLatexEditorDialog( {
					initialValue: equationElement.dataset.latex ?? '',
					onSubmit: latex => {
						if ( modelElement && modelElement.root.rootName !== '$graveyard' ) {
							editor.model.change( writer => {
								writer.setSelection( modelElement, 'on' );
							} );
						}
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

function selectEquationElement( editor: LatexUI[ 'editor' ], equationElement: HTMLElement ): ModelElement | null {
	const viewElement = editor.editing.view.domConverter.domToView( equationElement );
	const modelElement = viewElement?.is( 'element' ) ? editor.editing.mapper.toModelElement( viewElement ) ?? null : null;

	if ( modelElement ) {
		editor.model.change( writer => {
			writer.setSelection( modelElement, 'on' );
		} );
	}

	return modelElement;
}

function getSelectedLatex( editor: LatexUI[ 'editor' ] ): string {
	const selectedElement = editor.model.document.selection.getSelectedElement();

	if ( selectedElement?.is( 'element', 'latexInline' ) ) {
		return ( selectedElement.getAttribute( 'latex' ) as string | undefined ) ?? '';
	}

	return '';
}
