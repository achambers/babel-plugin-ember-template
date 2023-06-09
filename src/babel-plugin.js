const { ImportUtil } = require('babel-import-util');
const { transformTemplateTag } = require('./template-tag-transform');

const TEMPLATE_TAG_PLACEHOLDER = '__GLIMMER_TEMPLATE';

function isTemplateTag(
  callExpressionPath
) {
  const callee = callExpressionPath.get('callee');
  return (
    !Array.isArray(callee) &&
    callee.isIdentifier() &&
    callee.node.name === TEMPLATE_TAG_PLACEHOLDER
  );
}

/**
 * This Babel plugin takes parseable code emitted by the string-based
 * preprocessor plugin in this package and converts it into calls to
 * the standardized `precompileTemplate` macro from `@ember/template-compilation`.
 *
 * Its goal is to convert code like this:
 *
 * ```js
 * const B = [__GLIMMER_TEMPLATE(`B`, {...})];
 *
 * [__GLIMMER_TEMPLATE(`default`, {...})];
 *
 * class D {
 *   [__GLIMMER_TEMPLATE(`D`, {...})]
 * }
 * ```
 *
 * Into this:
 *
 * ```js
 * import { precompileTemplate } from '@ember/template-compilation';
 * import { setComponentTemplate } from '@ember/component';
 * import templateOnlyComponent from '@ember/component/template-only';
 *
 * const B = setComponentTemplate(
 *   precompileTemplate(`B`, {...}),
 *   templateOnlyComponent('this-module.js', 'B')
 * );
 *
 * export default setComponentTemplate(
 *   precompileTemplate(`default`, {...}),
 *   templateOnlyComponent('this-module.js', '_thisModule')
 * );
 *
 * class D {}
 * setComponentTemplate(precompileTemplate(`D`, {...}), D);
 * ```
 */
module.exports = function (babel) {
  let t = babel.types;
  let visitor = {
    Program: {
      enter(path, state) {
        state.importUtil = new ImportUtil(t, path);
      },
    },

    // Process class bodies before things like class properties get transformed
    // into imperative constructor code that we can't recognize. Taken directly
    // from babel-plugin-htmlbars-inline-precompile https://git.io/JMi1G
    Class(path, state) {
      path.get('body.body').forEach((path) => {
        if (path.type !== 'ClassProperty') return;

        let keyPath = path.get('key');
        let valuePath = path.get('value');

        if (keyPath && visitor[keyPath.type]) {
          visitor[keyPath.type](keyPath, state);
        }

        if (valuePath && visitor[valuePath.type]) {
          visitor[valuePath.type](valuePath, state);
        }
      });
    },

    CallExpression(path, state) {
      if (isTemplateTag(path)) {
        transformTemplateTag(t, path, state);
      }
    },
  };

  return { visitor };
};
