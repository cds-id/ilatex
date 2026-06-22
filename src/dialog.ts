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

/**
 * Open the MathLive equation editor dialog. Calls `onSubmit` with the trimmed
 * LaTeX when the user inserts a non-empty formula.
 */
export function openLatexEditorDialog( { initialValue, onSubmit, dialogClass = DEFAULT_DIALOG_CLASS }: LatexDialogOptions ): void {
	document.querySelector( `.${ dialogClass }` )?.remove();

	const backdrop = document.createElement( 'div' );
	backdrop.className = dialogClass;
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
