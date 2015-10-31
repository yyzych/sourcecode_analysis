// 插入的代码的核心就在于：改变了Module.wrapper的值

var Module = require("module"), // 一个模块的构造函数
    fs = require("fs"),
    getImportGlobalsSrc = require("./getImportGlobalsSrc.js"),
    getDefinePropertySrc = require("./getDefinePropertySrc.js"),
    detectStrictMode = require("./detectStrictMode.js"),
    moduleEnv = require("./moduleEnv.js");

/**
 * Does actual rewiring the module. For further documentation @see index.js
 */
function internalRewire(parentModulePath, targetPath) {
    var targetModule,
        prelude,
        appendix,
        src;

    // Checking params
    if (typeof targetPath !== "string") {
        throw new TypeError("Filename must be a string");
    }

    // Resolve full filename relative to the parent module
    // 根据父模块的路径解析目标模块的实际路径
    targetPath = Module._resolveFilename(targetPath, parentModulePath);

    // Special support for older node versions that returned an array on Module._resolveFilename
    // @see https://github.com/joyent/node/blob/865b077819a9271a29f982faaef99dc635b57fbc/lib/module.js#L319
    // TODO Remove this switch on the next major release
    /* istanbul ignore next because it will be removed soon */
    if (Array.isArray(targetPath)) {
        targetPath = targetPath[1];
    }

    // Create testModule as it would be created by require()
    targetModule = new Module(targetPath, parentModulePath);

    // We prepend a list of all globals declared with var so they can be overridden (without changing original globals)
    prelude = getImportGlobalsSrc();

    // Wrap module src inside IIFE so that function declarations do not clash with global variables
    // @see https://github.com/jhnns/rewire/issues/56
    prelude += "(function () { ";
    // 模块实际的代码在prelude和appendix之间，用了一个自执行匿名函数包装，防止全局污染，导入的importClobal变量在匿名函数外面
    // We append our special setter and getter.
    appendix = "\n" + getDefinePropertySrc();

    // End of IIFE
    appendix += "})();";

    // Check if the module uses the strict mode.
    // If so we must ensure that "use strict"; stays at the beginning of the module.
    src = fs.readFileSync(targetPath, "utf8");
    if (detectStrictMode(src) === true) {
        prelude = ' "use strict"; ' + prelude;
    }

    moduleEnv.inject(prelude, appendix);
    moduleEnv.load(targetModule);

    return targetModule.exports;
}

module.exports = internalRewire;
