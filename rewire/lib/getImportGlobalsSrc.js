/**
 * Declares all globals with a var and assigns the global object. Thus you're able to
 * override globals without changing the global object itself.
 *
 * Returns something like
 * "var console = global.console; var process = global.process; ..."
 *
 * @return {String}
 */
// 返回一个模块能用到的全局变量组成的字符串，用于插入到改装后的模块中，
// 是原来global上的属性，将这些属性定义为变量，因此在模块中改变，并不会影响原来的值
// 
function getImportGlobalsSrc(ignore) {
    var key,
        value,
        src = "",
        globalObj = typeof global === "undefined"? window: global;

    ignore = ignore || [];
    // global itself can't be overridden because it's the only reference to our real global objects
    ignore.push("global");
    // ignore 'module', 'exports' and 'require' on the global scope, because otherwise our code would
    // shadow the module-internal variables
    // @see https://github.com/jhnns/rewire-webpack/pull/6
    ignore.push("module", "exports", "require");

    for (key in globalObj) { /* jshint forin: false */
        if (ignore.indexOf(key) !== -1) {
            continue;
        }
        value = globalObj[key];

        // key may be an invalid variable name (e.g. 'a-b')
        try {
          eval("var " + key + ";"); // key名如果不正确会直接报错
          src += "var " + key + " = global." + key + "; ";
        } catch(e) {}
    }

    return src;
}

module.exports = getImportGlobalsSrc;
