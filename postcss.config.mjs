// PostCSS configuration with a small plugin to remove malformed
// `file:line` declarations that can be accidentally picked up
// by the scanner (e.g. from markdown snippets). This prevents
// build-time CSS warnings about unknown properties.
import tailwindPlugin from '@tailwindcss/postcss';

const removeInvalidFileLine = () => {
  return {
    postcssPlugin: 'remove-invalid-file-line',
    Once(root) {
      root.walkRules((rule) => {
        rule.walkDecls((decl) => {
          if (decl.prop === 'file' || decl.value === 'file:line') {
            decl.remove();
          }
        });
        if (!rule.nodes || rule.nodes.length === 0) {
          rule.remove();
        }
      });
    },
  };
};
removeInvalidFileLine.postcss = true;

const config = {
  plugins: [
    tailwindPlugin(),
    removeInvalidFileLine(),
  ],
};

export default config;
