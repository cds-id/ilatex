import {
	Plugin,
	Widget,
	toWidget,
	viewToModelPositionOutsideModelElement,
	type DowncastWriter as ViewDowncastWriter,
	type Element as ModelElement,
	type Text as ModelText,
	type Writer as ModelWriter,
	type ViewElement
} from 'ckeditor5';
import InsertLatexCommand from './insertlatexcommand.js';
import { SHORTCODE_PATTERN } from './shortcode.js';

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

		this._registerShortcodePostFixer();
	}

	private _registerShortcodePostFixer(): void {
		const model = this.editor.model;

		model.document.registerPostFixer( writer => convertShortcodes( model, writer ) );
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

function convertShortcodes( model: import('ckeditor5').Editor['model'], writer: ModelWriter ): boolean {
	let changed = false;

	for ( const root of model.document.getRoots() ) {
		const range = writer.createRangeIn( root );
		const textNodes: ModelText[] = [];

		for ( const item of range.getItems() ) {
			if ( item.is( '$textProxy' ) && item.data.includes( '[%' ) ) {
				textNodes.push( item.textNode );
			}
		}

		for ( const textNode of textNodes ) {
			if ( convertTextNode( model, writer, textNode ) ) {
				changed = true;
			}
		}
	}

	return changed;
}

function convertTextNode( model: import('ckeditor5').Editor['model'], writer: ModelWriter, textNode: ModelText ): boolean {
	const data = textNode.data;
	SHORTCODE_PATTERN.lastIndex = 0;
	const match = SHORTCODE_PATTERN.exec( data );

	if ( !match ) {
		return false;
	}

	const latex = match[ 1 ].trim();
	if ( !latex ) {
		return false;
	}

	const startOffset = ( textNode.startOffset ?? 0 ) + match.index;
	const endOffset = startOffset + match[ 0 ].length;
	const parent = textNode.parent;

	if ( !parent ) {
		return false;
	}

	if ( !model.schema.checkChild( parent as ModelElement, 'latexInline' ) ) {
		return false;
	}

	const start = writer.createPositionAt( parent as ModelElement, startOffset );
	const end = writer.createPositionAt( parent as ModelElement, endOffset );

	writer.remove( writer.createRange( start, end ) );
	writer.insertElement( 'latexInline', { latex }, parent as ModelElement, startOffset );

	return true;
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
