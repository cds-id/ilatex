import 'mathlive/static.css';
import 'mathlive/fonts.css';
import tinymce from 'tinymce';

// TinyMCE 7 self-hosted assets pulled from the npm package.
import 'tinymce/models/dom/model';
import 'tinymce/themes/silver';
import 'tinymce/icons/default';
import 'tinymce/skins/ui/oxide/skin.min.css';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/link';

import contentCss from 'tinymce/skins/content/default/content.min.css?inline';

import { setupLatexEquation } from '../src/tinymce';
import { renderLatexInElement } from '../src/render';

declare global {
	interface Window {
		tinymce: typeof tinymce;
	}
}
window.tinymce = tinymce;

const output = document.querySelector( '#output' ) as HTMLPreElement;
const downstream = document.querySelector( '#downstream' ) as HTMLDivElement;

tinymce.init( {
	selector: '#editor',
	license_key: 'gpl',
	menubar: false,
	height: 320,
	plugins: 'lists link',
	toolbar: 'bold italic | bullist numlist | formula',
	skin: false,
	content_css: false,
	content_style: contentCss,
	setup: setupLatexEquation,
	init_instance_callback: editor => {
		const refresh = () => {
			const html = editor.getContent();
			output.textContent = html;
			downstream.innerHTML = html;
			renderLatexInElement( downstream );
		};
		editor.on( 'change SetContent input', refresh );
		refresh();
	}
} );
