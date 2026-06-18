import { Plugin } from 'ckeditor5';
import LatexEditing from './latexediting';
import LatexUI from './latexui';

export type EquationAbout = {
	name: string;
	version: string;
	creator: string;
};

export default class Equation extends Plugin {
	public static readonly about: EquationAbout = {
		name: 'ilatex-editor',
		version: '0.1.0',
		creator: 'CDS'
	};

	public static get requires() {
		return [ LatexEditing, LatexUI ] as const;
	}

	public static get pluginName() {
		return 'Equation' as const;
	}
}
