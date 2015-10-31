var multiLineComment = /^\s*\/\*.*?\*\//; // 多行注释
var singleLineComment = /^\s*\/\/.*?[\r\n]/; // 单行注释
var strictMode = /^\s*(?:"use strict"|'use strict')[ \t]*(?:[\r\n]|;)/;

/**
 * Returns true if the source code is intended to run in strict mode. Does not detect
 * "use strict" if it occurs in a nested function.
 *
 * @param {String} src
 * @return {Boolean}
 */
function detectStrictMode(src) {
    var singleLine;
    var multiLine;

    // 先把开头的注释全部替换为空字符，再进行use strict的校验
    while ((singleLine = singleLineComment.test(src)) || (multiLine = multiLineComment.test(src))) {
        if (singleLine) {
            src = src.replace(singleLineComment, "");
        }
        if (multiLine) {
            src = src.replace(multiLineComment, "");
        }
    }

    return strictMode.test(src);
}

module.exports = detectStrictMode;
