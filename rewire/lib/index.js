var rewireModule = require("./rewire.js");

/**
 * Adds a special setter and getter to the module located at filename. After the module has been rewired, you can
 * call myModule.__set__(name, value) and myModule.__get__(name) to manipulate private variables.
 *
 * @param {!String} filename Path to the module that shall be rewired. Use it exactly like require().
 * @return {*} the rewired module
 */
function rewire(filename) {
    // module.parent：加载rewire模块的模块
    return rewireModule(module.parent, filename);
}

module.exports = rewire;

// 模块在引入时会缓存到该对象。通过删除该对象的键值，下次调用require时会重新加载相应模块。
delete require.cache[__filename];   // deleting self from module cache so the parent module is always up to date