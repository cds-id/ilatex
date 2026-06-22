// Shared inline-math shortcode pattern: matches [% ... %] with a non-greedy body.
// Exported so the editor post-fixer and the standalone renderer stay in sync.
export const SHORTCODE_PATTERN = /\[%\s*([\s\S]*?)\s*%\]/g;

export const LATEX_MATH_CLASS = 'latex-math';
