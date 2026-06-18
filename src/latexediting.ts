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

		conversion.for( 'upcast' ).elementToElement( {
			view: 'math',
			model: ( viewElement: ViewElement, { writer } ) => {
				const latex = getMathMLTeXAnnotation( viewElement ) ?? mathMLToLatex( viewElement );
				return writer.createElement( 'latexInline', { latex } );
			}
		} );

		conversion.for( 'upcast' ).elementToElement( {
			view: 'm:oMath',
			model: ( viewElement: ViewElement, { writer } ) => {
				return writer.createElement( 'latexInline', { latex: ommlToLatex( viewElement ) } );
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

function getMathMLTeXAnnotation( viewElement: ViewElement ): string | null {
	for ( const child of getElementChildren( viewElement ) ) {
		if ( child.name === 'annotation' && child.getAttribute( 'encoding' ) === 'application/x-tex' ) {
			return getViewTextDeep( child ).trim();
		}

		const nested = getMathMLTeXAnnotation( child );
		if ( nested ) {
			return nested;
		}
	}

	return null;
}

function mathMLToLatex( viewElement: ViewElement ): string {
	const children = getElementChildren( viewElement );
	const name = viewElement.name;

	if ( name === 'math' || name === 'mrow' || name === 'semantics' ) {
		return children.map( mathMLToLatex ).join( '' ) || getViewText( viewElement );
	}

	if ( name === 'mi' || name === 'mn' || name === 'mo' ) {
		return getViewText( viewElement );
	}

	if ( name === 'mfrac' ) {
		return `\\frac{${ mathMLToLatex( children[ 0 ] ) }}{${ mathMLToLatex( children[ 1 ] ) }}`;
	}

	if ( name === 'msqrt' ) {
		return `\\sqrt{${ children.map( mathMLToLatex ).join( '' ) }}`;
	}

	if ( name === 'msup' ) {
		return `${ mathMLToLatex( children[ 0 ] ) }^{${ mathMLToLatex( children[ 1 ] ) }}`;
	}

	if ( name === 'msub' ) {
		return `${ mathMLToLatex( children[ 0 ] ) }_{${ mathMLToLatex( children[ 1 ] ) }}`;
	}

	return children.map( mathMLToLatex ).join( '' ) || getViewText( viewElement );
}

function ommlToLatex( viewElement: ViewElement ): string {
	const children = getElementChildren( viewElement );
	const name = viewElement.name;

	if ( name === 'm:oMath' || name === 'm:r' || name === 'm:e' || name === 'm:num' || name === 'm:den' || name === 'm:sup' || name === 'm:sub' || name === 'm:deg' ) {
		return children.map( ommlToLatex ).join( '' ) || getViewText( viewElement );
	}

	if ( name === 'm:t' ) {
		return getViewText( viewElement );
	}

	if ( name === 'm:f' ) {
		const numerator = children.find( child => child.name === 'm:num' );
		const denominator = children.find( child => child.name === 'm:den' );
		return `\\frac{${ numerator ? ommlToLatex( numerator ) : '' }}{${ denominator ? ommlToLatex( denominator ) : '' }}`;
	}

	if ( name === 'm:rad' ) {
		const radicand = children.find( child => child.name === 'm:e' );
		return `\\sqrt{${ radicand ? ommlToLatex( radicand ) : '' }}`;
	}

	if ( name === 'm:sSup' ) {
		const base = children.find( child => child.name === 'm:e' );
		const superscript = children.find( child => child.name === 'm:sup' );
		return `${ base ? ommlToLatex( base ) : '' }^{${ superscript ? ommlToLatex( superscript ) : '' }}`;
	}

	if ( name === 'm:sSub' ) {
		const base = children.find( child => child.name === 'm:e' );
		const subscript = children.find( child => child.name === 'm:sub' );
		return `${ base ? ommlToLatex( base ) : '' }_{${ subscript ? ommlToLatex( subscript ) : '' }}`;
	}

	return children.map( ommlToLatex ).join( '' ) || getViewText( viewElement );
}

function getElementChildren( viewElement: ViewElement ): ViewElement[] {
	const children: ViewElement[] = [];

	for ( const child of viewElement.getChildren() ) {
		if ( child.is( 'element' ) ) {
			children.push( child );
		}
	}

	return children;
}

function getViewTextDeep( viewElement: ViewElement ): string {
	let text = getViewText( viewElement );

	for ( const child of getElementChildren( viewElement ) ) {
		text += getViewTextDeep( child );
	}

	return text;
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
