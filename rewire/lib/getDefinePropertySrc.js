"use strict";

var __get__ = require("./__get__.js");
var __set__ = require ("./__set__.js");
var __with__ = require("./__with__.js");

var srcs = {
    "__get__": __get__.toString(), // 返回函数的定义
    "__set__": __set__.toString(),
    "__with__": __with__.toString()
};

/*
    返回值: 
    "Object.defineProperty(module.exports, '__get__', {enumerable: false, value: function __get__() {...}}); Object.defineProperty(module.exports, '__set__', {enumerable: false, value: function __set__() {...}}); Object.defineProperty(module.exports, '__with__', {enumerable: false, value: function __with__() {...}});"
*/
function getDefinePropertySrc() {
    var src;

    src = Object.keys(srcs).reduce(function forEachSrc(preValue, value) {
        return preValue += "Object.defineProperty(module.exports, '" +
            value +
            "', {enumerable: false, value: " +
            srcs[value] +
            "}); ";
    }, "");

    return src;
}

module.exports = getDefinePropertySrc;