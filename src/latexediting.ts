import {
	Plugin,
	Widget,
	toWidget,
	viewToModelPositionOutsideModelElement,
	type ViewDowncastWriter,
	type ModelElement,
	type ViewElement
} from 'ckeditor5';
import InsertLatexCommand from './insertlatexcommand';

export default class LatexEditing extends Plugin {
	public static get requires() {
		return [ Widget ] as const;
	}

	public static get pluginName() {
		return 'LatexEditing' as const;
	}

	public init(): void {
		this._defineSchema();
		this._defineConverters();
		this.editor.commands.add( 'insertLatex', new InsertLatexCommand( this.editor ) );

		this.editor.editing.mapper.on(
			'viewToModelPosition',
			viewToModelPositionOutsideModelElement( this.editor.model, viewElement => viewElement.hasClass( 'latex-math' ) )
		);
	}

	private _defineSchema(): void {
		this.editor.model.schema.register( 'latexInline', {
			allowWhere: '$text',
			isInline: true,
			isObject: true,
			allowAttributes: [ 'latex' ]
		} );
	}

	private _defineConverters(): void {
		const conversion = this.editor.conversion;

		conversion.for( 'upcast' ).elementToElement( {
			view: {
				name: 'span',
				classes: 'latex-math'
			},
			model: ( viewElement: ViewElement, { writer } ) => {
				const latex = viewElement.getAttribute( 'data-latex' ) as string | undefined;
				return writer.createElement( 'latexInline', { latex: latex ?? getViewText( viewElement ) } );
			}
		} );

		conversion.for( 'dataDowncast' ).elementToElement( {
			model: 'latexInline',
			view: ( modelElement: ModelElement, { writer } ) => createLatexView( modelElement, writer, false )
		} );

		conversion.for( 'editingDowncast' ).elementToElement( {
			model: 'latexInline',
			view: ( modelElement: ModelElement, { writer } ) => {
				const span = createLatexView( modelElement, writer, true );
				return toWidget( span, writer, { label: 'Equation formula' } );
			}
		} );
	}
}

function createLatexView( modelElement: ModelElement, writer: ViewDowncastWriter, renderMath: boolean ) {
	const latex = modelElement.getAttribute( 'latex' ) as string;
	const span = writer.createContainerElement( 'span', {
		class: 'latex-math',
		'data-latex': latex
	} );

	if ( renderMath ) {
		const mathSpan = writer.createContainerElement( 'math-span' );
		writer.insert( writer.createPositionAt( mathSpan, 0 ), writer.createText( latex ) );
		writer.insert( writer.createPositionAt( span, 0 ), mathSpan );
	} else {
		writer.insert( writer.createPositionAt( span, 0 ), writer.createText( latex ) );
	}

	return span;
}

function getViewText( viewElement: ViewElement ): string {
	let text = '';

	for ( const child of viewElement.getChildren() ) {
		if ( child.is( '$text' ) ) {
			text += child.data;
		}
	}

	return text;
}
