import './styles.js';
import { renderLatexInDocument, type RenderLatexOptions } from './render.js';

/**
 * Auto-render entry point. Importing this module renders all LaTeX
 * (`[%...%]` shortcodes and `.latex-math` spans) in the document on load.
 *
 * Usage (bundled):
 *   import 'ilatex-editor/auto';
 *
 * Usage (script tag): load the built auto bundle; it self-runs.
 *
 * Re-render after dynamic DOM updates with the exported `renderLatexInDocument`.
 */
function autoRender( options?: RenderLatexOptions ): void {
	if ( typeof document === 'undefined' ) {
		return;
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', () => renderLatexInDocument( options ), { once: true } );
	} else {
		renderLatexInDocument( options );
	}
}

autoRender();

export { autoRender };
export { renderLatexInDocument, renderLatexInElement, renderLatexToMarkup } from './render.js';
