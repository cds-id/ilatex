import 'ckeditor5/ckeditor5.css';
import './style.css';
import { ClassicEditor, Essentials, Paragraph, Bold, Italic } from 'ckeditor5';
import { Equation } from '../src';

ClassicEditor
	.create( document.querySelector( '#editor' ) as HTMLElement, {
		licenseKey: 'GPL',
		plugins: [ Essentials, Paragraph, Bold, Italic, Equation ],
		toolbar: [ 'bold', 'italic', '|', 'formula' ]
	} )
	.catch( error => {
		console.error( error );
	} );
