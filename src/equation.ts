import { Plugin } from 'ckeditor5';
import LatexEditing from './latexediting.js';
import LatexUI from './latexui.js';

export type EquationAbout = {
	name: string;
	version: string;
	creator: string;
};

export default class Equation extends Plugin {
	public static readonly about: EquationAbout = {
		name: 'ilatex-editor',
		version: '0.2.0-ck43.3',
		creator: 'CDS'
	};

	public static get requires() {
		return [ LatexEditing, LatexUI ] as const;
	}

	public static get pluginName() {
		return 'Equation' as const;
	}
}
