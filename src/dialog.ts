// Editor-agnostic MathLive equation editor dialog.
//
// Pure DOM, no editor framework dependency. Shared by the CKEditor 5 plugin
// (`latexui.ts`) and the TinyMCE plugin (`tinymce.ts`). Importing this module
// pulls MathLive so the `<math-field>` custom element is registered.
import 'mathlive';

export type LatexDialogOptions = {
	initialValue: string;
	onSubmit: ( latex: string ) => void;
	/**
	 * Root class for the dialog backdrop. Defaults to `ck-latex-editor-dialog`
	 * to keep the existing CKEditor styling/tests working.
	 */
	dialogClass?: string;
};

type MathFieldElementLike = HTMLElement & {
	value?: string;
	mathVirtualKeyboardPolicy?: string;
	executeCommand?: ( command: string | unknown[] ) => boolean;
	getValue?: ( format?: string ) => string;
	setValue?: ( value: string ) => void;
};

const DEFAULT_DIALOG_CLASS = 'ck-latex-editor-dialog';
const STYLE_ELEMENT_ID = 'ilatex-dialog-styles';

// Self-contained dialog styles, injected once at runtime so consumers need no
// separate CSS import. Scoped under .ilatex-dialog (added to every backdrop)
// so it applies regardless of the configurable root class.
const DIALOG_CSS = `
.ilatex-dialog {
	position: fixed;
	inset: 0;
	z-index: 9999;
	display: grid;
	place-items: center;
	background: rgb(15 23 42 / 0.45);
}
.ilatex-dialog .ck-latex-editor-panel {
	box-sizing: border-box;
	width: min(720px, calc(100vw - 2rem));
	padding: 1rem;
	border-radius: 0.75rem;
	background: #fff;
	color: #0f172a;
	box-shadow: 0 24px 80px rgb(15 23 42 / 0.35);
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
.ilatex-dialog .ck-latex-editor-header,
.ilatex-dialog .ck-latex-actions {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
}
.ilatex-dialog .ck-latex-mathfield-host math-field {
	box-sizing: border-box;
	width: 100%;
	min-height: 4rem;
	margin: 1rem 0;
	padding: 0.75rem;
	border: 1px solid #cbd5e1;
	border-radius: 0.5rem;
	font-size: 1.4rem;
}
.ilatex-dialog .ck-latex-symbols {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4rem;
	margin-bottom: 1rem;
}
.ilatex-dialog .ck-latex-symbols button,
.ilatex-dialog .ck-latex-actions button,
.ilatex-dialog .ck-latex-close {
	padding: 0.4rem 0.7rem;
	border: 1px solid #cbd5e1;
	border-radius: 0.4rem;
	background: #f8fafc;
	color: #0f172a;
	cursor: pointer;
}
.ilatex-dialog .ck-latex-close {
	border: 0;
	background: transparent;
	font-size: 1.25rem;
	line-height: 1;
}
.ilatex-dialog [data-testid="latex-insert"] {
	background: #2563eb;
	border-color: #2563eb;
	color: #fff;
}
.ilatex-dialog .ck-latex-source-label {
	display: block;
	margin-bottom: 0.35rem;
	font-weight: 600;
}
.ilatex-dialog .ck-latex-source {
	box-sizing: border-box;
	width: 100%;
	min-height: 5rem;
	margin-bottom: 1rem;
	padding: 0.75rem;
	border: 1px solid #cbd5e1;
	border-radius: 0.5rem;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
`;

function injectDialogStyles(): void {
	if ( typeof document === 'undefined' || document.getElementById( STYLE_ELEMENT_ID ) ) {
		return;
	}

	const style = document.createElement( 'style' );
	style.id = STYLE_ELEMENT_ID;
	style.textContent = DIALOG_CSS;
	document.head.appendChild( style );
}

/**
 * Open the MathLive equation editor dialog. Calls `onSubmit` with the trimmed
 * LaTeX when the user inserts a non-empty formula.
 */
export function openLatexEditorDialog( { initialValue, onSubmit, dialogClass = DEFAULT_DIALOG_CLASS }: LatexDialogOptions ): void {
	injectDialogStyles();
	document.querySelector( `.${ dialogClass }` )?.remove();

	const backdrop = document.createElement( 'div' );
	backdrop.className = `ilatex-dialog ${ dialogClass }`;
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
	setMathFieldValue( mathfield, initialValue );
	textarea.value = initialValue;
	host.appendChild( mathfield );

	addSymbolButtons( symbols, mathfield, textarea );

	mathfield.addEventListener( 'input', () => {
		if ( syncing ) {
			return;
		}

		syncing = true;
		textarea.value = getMathFieldValue( mathfield );
		syncing = false;
	} );

	textarea.addEventListener( 'input', () => {
		if ( syncing ) {
			return;
		}

		syncing = true;
		setMathFieldValue( mathfield, textarea.value );
		syncing = false;
	} );

	backdrop.querySelector( '.ck-latex-close' )?.addEventListener( 'click', () => backdrop.remove() );
	backdrop.querySelector( '[data-testid="latex-cancel"]' )?.addEventListener( 'click', () => backdrop.remove() );
	backdrop.querySelector( '[data-testid="latex-insert"]' )?.addEventListener( 'click', () => {
		const latex = getMathFieldValue( mathfield, textarea.value ).trim();

		if ( latex ) {
			onSubmit( latex );
		}

		backdrop.remove();
	} );

	document.body.appendChild( backdrop );
	setTimeout( () => mathfield.focus(), 0 );
}

function getMathFieldValue( mathfield: MathFieldElementLike, fallback = '' ): string {
	return mathfield.getValue?.( 'latex' ) ?? mathfield.value ?? fallback;
}

function setMathFieldValue( mathfield: MathFieldElementLike, value: string ): void {
	if ( mathfield.setValue ) {
		mathfield.setValue( value );
	} else {
		mathfield.value = value;
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

			textarea.value = getMathFieldValue( mathfield );
			mathfield.dispatchEvent( new Event( 'input', { bubbles: true } ) );
			mathfield.focus();
		} );
		container.appendChild( button );
	}
}
