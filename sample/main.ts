import 'ckeditor5/ckeditor5.css';
import 'mathlive/fonts.css';
import './style.css';
import { ClassicEditor, Essentials, Paragraph, Bold, Italic } from 'ckeditor5';
import { MathfieldElement } from 'mathlive';
import { Equation } from '../src';

// Vite bundles the fonts via fonts.css @font-face; disable MathLive's runtime
// font directory probing (which resolves to a wrong path under Vite deps).
MathfieldElement.fontsDirectory = null;

ClassicEditor
	.create( document.querySelector( '#editor' ) as HTMLElement, {
		licenseKey: 'GPL',
		plugins: [ Essentials, Paragraph, Bold, Italic, Equation ],
		toolbar: [ 'bold', 'italic', '|', 'formula' ]
	} )
	.catch( error => {
		console.error( error );
	} );
