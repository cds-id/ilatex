// TinyMCE 5 LaTeX equation plugin (MathLive-based).
//
// Editor-agnostic dialog from `dialog.ts`; emits the same HTML the CKEditor
// plugin and the render utilities use:
//   <span class="latex-math" data-latex="E=mc^2">E=mc^2</span>
//
// So content authored here renders identically via `renderLatexInElement`.
//
// Two integration styles:
//   1. setup callback (no global TinyMCE needed — best for cloud/lazy loads):
//        <Editor init={{ setup: setupLatexEquation }} toolbar="... formula" />
//   2. Named plugin registration (self-hosted TinyMCE):
//        registerLatexEquationPlugin( window.tinymce );
//        <Editor init={{ plugins: 'latexequation', toolbar: '... formula' }} />
import { openLatexEditorDialog } from './dialog.js';
import { LATEX_MATH_CLASS } from './shortcode.js';

/** Minimal subset of the TinyMCE 5 editor API this plugin touches. */
export interface TinyMceEditorLike {
	ui: {
		registry: {
			addButton( name: string, spec: {
				text?: string;
				tooltip?: string;
				icon?: string;
				onAction( ): void;
			} ): void;
		};
	};
	on( name: string, handler: ( event: { target?: Element } & Event ) => void ): void;
	selection: {
		getNode(): Element;
		getContent( args?: { format?: string } ): string;
	};
	insertContent( content: string ): void;
	dom: {
		setAttrib( element: Element, name: string, value: string ): void;
		setHTML( element: Element, html: string ): void;
	};
	fire?( name: string ): void;
}

/** Minimal subset of the global TinyMCE PluginManager. */
export interface TinyMceLike {
	PluginManager: {
		add( name: string, callback: ( editor: TinyMceEditorLike ) => void ): void;
	};
}

const TOOLBAR_BUTTON = 'formula';
const PLUGIN_NAME = 'latexequation';

function escapeHtml( value: string ): string {
	return value
		.replace( /&/g, '&amp;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' )
		.replace( /"/g, '&quot;' );
}

/** Build the LaTeX inline span HTML the renderer understands. */
export function buildLatexSpan( latex: string ): string {
	const safe = escapeHtml( latex );
	return `<span class="${ LATEX_MATH_CLASS }" data-latex="${ safe }">${ safe }</span>`;
}

function closestLatexElement( node: Element | null ): HTMLElement | null {
	return ( node?.closest?.( `.${ LATEX_MATH_CLASS }` ) as HTMLElement | null ) ?? null;
}

function getSelectedLatex( editor: TinyMceEditorLike ): string {
	return closestLatexElement( editor.selection.getNode() )?.dataset.latex ?? '';
}

/**
 * Wire the LaTeX equation feature into a TinyMCE editor instance. Registers a
 * `formula` toolbar button and double-click-to-edit on existing equations.
 *
 * Use directly as the editor `setup` callback:
 *   <Editor init={{ setup: setupLatexEquation }} />
 */
export function setupLatexEquation( editor: TinyMceEditorLike ): void {
	editor.ui.registry.addButton( TOOLBAR_BUTTON, {
		text: 'Formula',
		tooltip: 'Insert equation',
		onAction: () => {
			const existing = closestLatexElement( editor.selection.getNode() );
			openLatexEditorDialog( {
				initialValue: getSelectedLatex( editor ),
				dialogClass: 'tinymce-latex-editor-dialog',
				onSubmit: latex => updateOrInsert( editor, existing, latex )
			} );
		}
	} );

	editor.on( 'dblclick', event => {
		const equationElement = closestLatexElement( ( event.target as Element ) ?? null );

		if ( !equationElement ) {
			return;
		}

		event.preventDefault();
		openLatexEditorDialog( {
			initialValue: equationElement.dataset.latex ?? '',
			dialogClass: 'tinymce-latex-editor-dialog',
			onSubmit: latex => updateOrInsert( editor, equationElement, latex )
		} );
	} );
}

function updateOrInsert( editor: TinyMceEditorLike, existing: HTMLElement | null, latex: string ): void {
	const trimmed = latex.trim();

	if ( !trimmed ) {
		return;
	}

	if ( existing ) {
		const safe = escapeHtml( trimmed );
		editor.dom.setAttrib( existing, 'data-latex', trimmed );
		editor.dom.setHTML( existing, safe );
		editor.fire?.( 'change' );
		return;
	}

	editor.insertContent( buildLatexSpan( trimmed ) );
}

/**
 * Register the equation feature as a named TinyMCE plugin. For self-hosted
 * TinyMCE where you control `plugins` in the init config.
 *
 *   registerLatexEquationPlugin( window.tinymce );
 *   // then: init={{ plugins: 'latexequation', toolbar: 'formula' }}
 */
export function registerLatexEquationPlugin( tinymce: TinyMceLike, name: string = PLUGIN_NAME ): void {
	tinymce.PluginManager.add( name, setupLatexEquation );
}

export { PLUGIN_NAME as LATEX_EQUATION_PLUGIN_NAME, TOOLBAR_BUTTON as LATEX_EQUATION_TOOLBAR_BUTTON };
