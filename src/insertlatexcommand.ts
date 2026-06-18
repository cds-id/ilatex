import { Command, type Editor } from 'ckeditor5';

export default class InsertLatexCommand extends Command {
	public execute( options: { latex: string } ): void {
		const latex = options.latex.trim();

		if ( !latex ) {
			return;
		}

		this.editor.model.change( writer => {
			const element = writer.createElement( 'latexInline', { latex } );
			this.editor.model.insertObject( element, null, null, { setSelection: 'after' } );
		} );
	}

	public refresh(): void {
		const model = this.editor.model;
		const selection = model.document.selection;
		const parent = selection.focus?.parent;
		this.isEnabled = !!parent && model.schema.checkChild( parent as any, 'latexInline' );
	}
}
