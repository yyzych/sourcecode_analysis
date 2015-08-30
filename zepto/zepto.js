//     Zepto.js
//     (c) 2010-2015 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

// 说明：
// 对代码的学习，解释都写在源码当中。
// 有多处打问号的地方，表示疑问，希望知道的童鞋能够告知*_*
// 
// 阅读链接：
// http://www.runoob.com/w3cnote/zepto-js-source-analysis.html
// http://www.css88.com/doc/zeptojs_api/#Touch events

/*
 * zepto的两个bug:
 * 1. camelize函数的问题：-webkit-transition => WebkitTransition，应该是webkitTransition才对(zepto.js 143)
 * 2. 如果使用代理的方式处理mouseenter和mouseleave的话，是有bug的，即没有解决mouseover/out的多次触发的问题(event.js 99)
*/

var Zepto = (function() {
    var undefined, key, $, classList, emptyArray = [],
        concat = emptyArray.concat,
        filter = emptyArray.filter,
        slice = emptyArray.slice,
        document = window.document,
        elementDisplay = {},
        classCache = {},
        // 缓存哪些css属性是不需要单位的纯数字
        cssNumber = {
            'column-count': 1,
            'columns': 1,
            'font-weight': 1,
            'line-height': 1,
            'opacity': 1,
            'z-index': 1,
            'zoom': 1
        },
        // 匹配html字符串的头标签，属性，内容都不检测.'!'用来检测doctype的吧。!??
        fragmentRE = /^\s*<(\w+|!)[^>]*>/, 
        // 匹配简单的标签，不带有没有属性没有内容。如：<div>, <div />, <div></div>
        singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/, 
        // ?!exp表示不以exp开头的字符串，注意，这些元素都是自闭和的，所以就是匹配有结束标签同时写成了<div />这种模式字符串
        tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig, 
        rootNodeRE = /^(?:body|html)$/i,
        capitalRE = /([A-Z])/g,

        // 特殊的属性需要用特殊的方法去操作，不能直接使用attr方法
        // special attributes that should be get/set via method calls
        methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

        adjacencyOperators = ['after', 'prepend', 'before', 'append'],
        table = document.createElement('table'),
        tableRow = document.createElement('tr'),
        // 缓存这些元素的相应类型的父元素，这些父元素是用来做一些辅助作用的
        containers = {
            'tr': document.createElement('tbody'),
            'tbody': table,
            'thead': table,
            'tfoot': table,
            'td': tableRow,
            'th': tableRow,
            '*': document.createElement('div')
        },
        readyRE = /complete|loaded|interactive/,
        simpleSelectorRE = /^[\w-]*$/,
        class2type = {},
        toString = class2type.toString,
        zepto = {}, // zepto，内部用到的方法定义在这里，不直接暴露给外界
        camelize, uniq,
        tempParent = document.createElement('div'),
        propMap = {
            'tabindex': 'tabIndex',
            'readonly': 'readOnly',
            'for': 'htmlFor',
            'class': 'className',
            'maxlength': 'maxLength',
            'cellspacing': 'cellSpacing',
            'cellpadding': 'cellPadding',
            'rowspan': 'rowSpan',
            'colspan': 'colSpan',
            'usemap': 'useMap',
            'frameborder': 'frameBorder',
            'contenteditable': 'contentEditable'
        },
        isArray = Array.isArray ||
        function(object) {
            return object instanceof Array
        }

    zepto.matches = function(element, selector) {
        if (!selector || !element || element.nodeType !== 1) return false
        // matchesSelector: 元素是否匹配选择器
        var matchesSelector = element.webkitMatchesSelector || element.mozMatchesSelector ||
            element.oMatchesSelector || element.matchesSelector
        if (matchesSelector) return matchesSelector.call(element, selector)
            // fall back to performing a selector:
        var match, parent = element.parentNode,
            temp = !parent // 是否有父亲节点
        if (temp)(parent = tempParent).appendChild(element)
        // 负数的二进制表示为它的绝对值的二进制取反然后加1。按位非操作只是取反没有加1.
        // ~：按位非, 返回数值的反码。用十进制考虑本质为：操作数的负值－1（减去1的原因是：转换为负值的时候加了1，而非操作只要求取反，所以得把加的1减掉），但因为是二进制数据在底层操作速度更快。
        // 如：-1 => 0，1 => -2。只有－1会变成0
        match = ~zepto.qsa(parent, selector).indexOf(element)
        temp && tempParent.removeChild(element)
        return match
    }

    function type(obj) {
        return obj == null ? String(obj) :
            class2type[toString.call(obj)] || "object"
    }

    function isFunction(value) {
        return type(value) == "function"
    }

    function isWindow(obj) {
        // obj为什么会带上window的属性
        // 只有window对象上有window的属性，window.window
        return obj != null && obj == obj.window 
    }

    function isDocument(obj) {
        return obj != null && obj.nodeType == obj.DOCUMENT_NODE
    }

    function isObject(obj) {
        return type(obj) == "object"
    }

    function isPlainObject(obj) {
        return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype
    }

    function likeArray(obj) {
        return typeof obj.length == 'number'
    }

    // 去掉null/undefined值的元素
    function compact(array) {
        return filter.call(array, function(item) {
            return item != null
        })
    }

    //类似得到一个数组的副本
    function flatten(array) {
        return array.length > 0 ? $.fn.concat.apply([], array) : array
    }
    // 将字符串转成驼峰式的格式, item-el => itemEl
    // 注意：-webkit-transition => WebkitTransition，应该是webkitTransition才对
    camelize = function(str) {
        return str.replace(/-+(.)?/g, function(match, chr) {
            return chr ? chr.toUpperCase() : ''
        })
    }

    // 将字符串格式化成-拼接的形式,一般用在样式属性上，比如border-width
    function dasherize(str) {
        return str.replace(/::/g, '/') //将：：替换成/
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2') //在大小写字符之间插入_,大写在前，比如AAAbb,得到AA_Abb
            .replace(/([a-z\d])([A-Z])/g, '$1_$2') //在大小写字符之间插入_,小写或数字在前，比如bbbAaa,得到bbb_Aaa
            .replace(/_/g, '-') //将_替换成-
            .toLowerCase() //转成小写
    }
    uniq = function(array) {
        return filter.call(array, function(item, idx) {
            return array.indexOf(item) == idx // 如果后面项与前面项相同，返回前面项的index，不等于idx。true：取出该项
        })
    }

    function classRE(name) {
        return name in classCache ?
            classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
    }

    function maybeAddPx(name, value) {
        return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
    }

    function defaultDisplay(nodeName) {
        var element, display
        if (!elementDisplay[nodeName]) {
            element = document.createElement(nodeName)
            document.body.appendChild(element)
            display = getComputedStyle(element, '').getPropertyValue("display")
            element.parentNode.removeChild(element)
            display == "none" && (display = "block")
            elementDisplay[nodeName] = display
        }
        return elementDisplay[nodeName]
    }

    function children(element) {
        return 'children' in element ?
            slice.call(element.children) :
            $.map(element.childNodes, function(node) {
                // 元素节点
                if (node.nodeType == 1) return node
            })
    }

    // $('...')返回的是Z的实例对象
    // Z.prototype=$.fn;
    function Z(dom, selector) {
        var i, len = dom ? dom.length : 0
        for (i = 0; i < len; i++) this[i] = dom[i]
        this.length = len
        this.selector = selector || ''
    }

    // 由字符串生成元素，返回$对象或普通数组，虽然没什么关系，但感觉不统一。。。
    // `$.zepto.fragment` takes a html string and an optional tag name
    // to generate DOM nodes nodes from the given html string.
    // The generated DOM nodes are returned as an array.
    // This function can be overriden in plugins for example to make
    // it compatible with browsers that don't support the DOM fully.
    zepto.fragment = function(html, name, properties) {
        var dom, nodes, container

        // A special case optimization for a single tag
        if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1))

        if (!dom) {
            // 如果是<div />这种形式的就把他转化为正确的，能设置给innerHtml的字符串。如：'42348394lsfkd<div class="item"/>'.replace(fragmentRE,'<$1></$2>') => "42348394lsfkd<div class=\"item\"></div>"
            if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")
            if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
            if (!(name in containers)) name = '*'

            container = containers[name] 
            container.innerHTML = '' + html // html实际代表什么元素是不知道的，通过一个父元素的innerHTML处理
            dom = $.each(slice.call(container.childNodes), function() {
                container.removeChild(this)
            })
        }

        if (isPlainObject(properties)) {
            nodes = $(dom)
            $.each(properties, function(key, value) {
                if (methodAttributes.indexOf(key) > -1) nodes[key](value)
                else nodes.attr(key, value)
            })
        }

        //返回将字符串转成的DOM节点后的数组，比如'<li></li><li></li><li></li>'转成[li,li,li]
        return dom
    }

    // `$.zepto.Z` swaps out the prototype of the given `dom` array
    // of nodes with `$.fn` and thus supplying all the Zepto functions
    // to the array. This method can be overriden in plugins.
    zepto.Z = function(dom, selector) {
        return new Z(dom, selector)
    }

    // `$.zepto.isZ` should return `true` if the given object is a Zepto
    // collection. This method can be overriden in plugins.
    zepto.isZ = function(object) {
        return object instanceof zepto.Z
    }


    // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
    // takes a CSS selector and an optional context (and handles various
    // special cases).
    // This method can be overriden in plugins.
    zepto.init = function(selector, context) {
        var dom
            // If nothing given, return an empty Zepto collection
        if (!selector) return zepto.Z()
            // Optimize for string selectors
        else if (typeof selector == 'string') {
            selector = selector.trim()
                // If it's a html fragment, create nodes from it
                // Note: In both Chrome 21 and Firefox 15, DOM error 12
                // is thrown if the fragment doesn't begin with <
            if (selector[0] == '<' && fragmentRE.test(selector))
                dom = zepto.fragment(selector, RegExp.$1, context), selector = null
                // If there's a context, create a collection on that context first, and select
                // nodes from there
            else if (context !== undefined) return $(context).find(selector)
                // If it's a CSS selector, use it to select nodes.
            else dom = zepto.qsa(document, selector)
        }
        // If a function is given, call it when the DOM is ready
        else if (isFunction(selector)) return $(document).ready(selector)
            // If a Zepto collection is given, just return it
        else if (zepto.isZ(selector)) return selector
        else {
            // normalize array if an array of nodes is given
            if (isArray(selector)) dom = compact(selector)
                // Wrap DOM nodes.
            else if (isObject(selector))
                dom = [selector], selector = null
                // If it's a html fragment, create nodes from it
            // 卧槽，上面typeof selector == 'string'的情况不是已经做过了吗???!!
            else if (fragmentRE.test(selector))
                dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null
                // If there's a context, create a collection on that context first, and select
                // nodes from there
            else if (context !== undefined) return $(context).find(selector)
                // And last but no least, if it's a CSS selector, use it to select nodes.
            else dom = zepto.qsa(document, selector)
        }
        // create a new Zepto collection from the nodes found
        return zepto.Z(dom, selector)
    }

    // `$` will be the base `Zepto` object. When calling this
    // function just call `$.zepto.init, which makes the implementation
    // details of selecting nodes and creating Zepto collections
    // patchable in plugins.
    $ = function(selector, context) {
        return zepto.init(selector, context)
    }

    function extend(target, source, deep) {
        // ps: for in也可以循环数组的。没有考虑prototype上的属性，会把原型上的数据也复制给target的
        for (key in source)
            if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
                if (isPlainObject(source[key]) && !isPlainObject(target[key]))
                    target[key] = {}
                if (isArray(source[key]) && !isArray(target[key]))
                    target[key] = []
                extend(target[key], source[key], deep)
            } else if (source[key] !== undefined) target[key] = source[key]
    }

    // Copy all but undefined properties from one or more
    // objects to the `target` object.
    $.extend = function(target) {
        var deep, args = slice.call(arguments, 1)
        if (typeof target == 'boolean') {
            deep = target
            target = args.shift()
        }
        args.forEach(function(arg) {
            extend(target, arg, deep)
        })
        return target
    }

    // `$.zepto.qsa` is Zepto's CSS selector implementation which
    // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
    // This method can be overriden in plugins.
    zepto.qsa = function(element, selector) {
        var found,
            maybeID = selector[0] == '#',
            maybeClass = !maybeID && selector[0] == '.',
            nameOnly = maybeID || maybeClass ? selector.slice(1) : selector, // Ensure that a 1 char tag name still gets checked
            isSimple = simpleSelectorRE.test(nameOnly) // 是否只有1个选择器的情况为sample，#btn, .wrap，div这种
        return (element.getElementById && isSimple && maybeID) ? // Safari DocumentFragment doesn't have getElementById. Safari下的文档片段也不支持getElementById
            ((found = element.getElementById(nameOnly)) ? [found] : []) :
            (element.nodeType !== 1 && element.nodeType !== 9 && element.nodeType !== 11) ? [] :
            slice.call(
                isSimple && !maybeID && element.getElementsByClassName ? // DocumentFragment doesn't have getElementsByClassName/TagName，文档片段不支持getElementsByClassName/getElementsByTagName
                maybeClass ? element.getElementsByClassName(nameOnly) : // If it's simple, it could be a class
                element.getElementsByTagName(selector) : // Or a tag
                element.querySelectorAll(selector) // Or it's not simple, and we need to query all
            )
    }

    function filtered(nodes, selector) {
        return selector == null ? $(nodes) : $(nodes).filter(selector)
    }

    $.contains = document.documentElement.contains ?
        function(parent, node) {
            return parent !== node && parent.contains(node)
        } :
        function(parent, node) {
            while (node && (node = node.parentNode))
                if (node === parent) return true
            return false
        }

    // 判断是不是函数，是，执行返回结果，否则直接返回
    function funcArg(context, arg, idx, payload) {
        return isFunction(arg) ? arg.call(context, idx, payload) : arg
    }

    function setAttribute(node, name, value) {
        value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
    }

    // access className property while respecting SVGAnimatedString
    // 设置或返回classname。baseVal是什么鬼---svg里面的内容
    function className(node, value) {
        var klass = node.className || '',
            svg = klass && klass.baseVal !== undefined

        if (value === undefined) return svg ? klass.baseVal : klass
        svg ? (klass.baseVal = value) : (node.className = value)
    }

    // "true"  => true
    // "false" => false
    // "null"  => null
    // "42"    => 42
    // "42.5"  => 42.5
    // "08"    => "08"
    // JSON    => parse if valid
    // String  => self
    function deserializeValue(value) {
        try {
            return value ?
                value == "true" ||
                (value == "false" ? false :
                    value == "null" ? null :
                    // 检测能不能转为数字的情况。  +value: value是数字没有变化；如果是字符串能转为数字则变为数字(‘423asds’这种也返回NaN)，否则返回NaN，NaN+"" != value。+一定要在value前面，不能value+，会报错
                    +value + "" == value ? +value :
                    /^[\[\{]/.test(value) ? $.parseJSON(value) :
                    value) : value
        } catch (e) {
            return value
        }
    }

    $.type = type
    $.isFunction = isFunction
    $.isWindow = isWindow
    $.isArray = isArray
    $.isPlainObject = isPlainObject

    // 是否是空对象{}，如果Object.prototype上面定义了可枚举的属性返回false
    $.isEmptyObject = function(obj) {
        var name
        for (name in obj) return false
        return true
    }

    $.inArray = function(elem, array, i) {
        return emptyArray.indexOf.call(array, elem, i)
    }

    $.camelCase = camelize
    $.trim = function(str) {
        return str == null ? "" : String.prototype.trim.call(str)
    }

    // plugin compatibility
    $.uuid = 0
    $.support = {}
    $.expr = {}
    $.noop = function() {}

    $.map = function(elements, callback) {
        var value, values = [],
            i, key
        if (likeArray(elements))
            for (i = 0; i < elements.length; i++) {
                value = callback(elements[i], i)
                if (value != null) values.push(value)
            } 
        else
            for (key in elements) {
                value = callback(elements[key], key)
                if (value != null) values.push(value)
            }
        return flatten(values)
    }

    $.each = function(elements, callback) {
        var i, key
        if (likeArray(elements)) {
            for (i = 0; i < elements.length; i++)
                if (callback.call(elements[i], i, elements[i]) === false) return elements
        } else {
            for (key in elements)
                if (callback.call(elements[key], key, elements[key]) === false) return elements
        }

        return elements
    }

    $.grep = function(elements, callback) {
        return filter.call(elements, callback)
    }

    if (window.JSON) $.parseJSON = JSON.parse

    // Populate the class2type map
    $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
        class2type["[object " + name + "]"] = name.toLowerCase()
    })

    // Define methods that will be available on all
    // Zepto collections
    $.fn = {
        constructor: zepto.Z,
        length: 0,

        // Because a collection acts like an array
        // copy over these useful array functions.
        forEach: emptyArray.forEach,
        reduce: emptyArray.reduce,
        push: emptyArray.push,
        sort: emptyArray.sort,
        splice: emptyArray.splice,
        indexOf: emptyArray.indexOf,
        concat: function() {
            var i, value, args = []
            for (i = 0; i < arguments.length; i++) {
                value = arguments[i]
                args[i] = zepto.isZ(value) ? value.toArray() : value // 要先转为纯数组
            }
            return concat.apply(zepto.isZ(this) ? this.toArray() : this, args)
        },

        // `map` and `slice` in the jQuery API work differently
        // from their array counterparts
        map: function(fn) {
            return $($.map(this, function(el, i) {
                return fn.call(el, i, el)
            }))
        },
        slice: function() {
            return $(slice.apply(this, arguments))
        },

        ready: function(callback) {
            // need to check if document.body exists for IE as that browser reports
            // document ready when it hasn't yet created the body element
            // readyState如果是'complete'同时用body元素的存在就说明已经加载完成，不用在绑定事件了
            if (readyRE.test(document.readyState) && document.body) callback($)
            else document.addEventListener('DOMContentLoaded', function() {
                callback($)
            }, false)
            return this
        },
        get: function(idx) {
            return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
        },
        toArray: function() {
            return this.get()
        },
        size: function() {
            return this.length
        },
        remove: function() {
            return this.each(function() {
                if (this.parentNode != null)
                    this.parentNode.removeChild(this)
            })
        },
        each: function(callback) {
            emptyArray.every.call(this, function(el, idx) {
                return callback.call(el, idx, el) !== false
            })
            return this
        },
        filter: function(selector) {
            if (isFunction(selector)) return this.not(this.not(selector))
            return $(filter.call(this, function(element) {
                return zepto.matches(element, selector)
            }))
        },
        add: function(selector, context) {
            return $(uniq(this.concat($(selector, context))))
        },
        is: function(selector) {
            return this.length > 0 && zepto.matches(this[0], selector)
        },
        not: function(selector) {
            var nodes = []
            if (isFunction(selector) && selector.call !== undefined)
                this.each(function(idx) {
                    if (!selector.call(this, idx)) nodes.push(this)
                })
            else {
                var excludes = typeof selector == 'string' ? this.filter(selector) :
                    (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
                this.forEach(function(el) {
                    if (excludes.indexOf(el) < 0) nodes.push(el)
                })
            }
            return $(nodes)
        },
        has: function(selector) {
            return this.filter(function() {
                return isObject(selector) ?
                    $.contains(this, selector) :
                    $(this).find(selector).size()
            })
        },
        eq: function(idx) {
            return idx === -1 ? this.slice(idx) : this.slice(idx, +idx + 1)
        },
        first: function() {
            var el = this[0]
            return el && !isObject(el) ? el : $(el)
        },
        last: function() {
            var el = this[this.length - 1]
            return el && !isObject(el) ? el : $(el)
        },
        find: function(selector) {
            var result, $this = this
            if (!selector) result = $()
            else if (typeof selector == 'object')
                result = $(selector).filter(function() {
                    var node = this
                    // some 为数组中的每一个元素执行一次 callback 函数，直到找到一个使得 callback 返回一个“真值”（即可转换为布尔值 true 的值）。
                    // 如果找到了这样一个值，some 将会立即返回 true。
                    return emptyArray.some.call($this, function(parent) {
                        return $.contains(parent, node)
                    })
                })
            else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
            else result = this.map(function() {
                return zepto.qsa(this, selector)
            })
            return result
        },
        closest: function(selector, context) {
            var node = this[0],
                collection = false
            if (typeof selector == 'object') collection = $(selector)
            while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
                node = node !== context 
                        && !isDocument(node) 
                        && node.parentNode
            return $(node)
        },
        parents: function(selector) {
            var ancestors = [],
                nodes = this
            while (nodes.length > 0)
                nodes = $.map(nodes, function(node) {
                    if ((node = node.parentNode) 
                        && !isDocument(node) 
                        && ancestors.indexOf(node) < 0) {
                        ancestors.push(node)
                        return node
                    }
                })
            return filtered(ancestors, selector)
        },
        parent: function(selector) {
            return filtered(uniq(this.pluck('parentNode')), selector)
        },
        children: function(selector) {
            return filtered(this.map(function() {
                return children(this)
            }), selector)
        },
        contents: function() {
            return this.map(function() {
                // contentDocument --- iframe中子文档的内容
                return this.contentDocument || slice.call(this.childNodes)
            })
        },
        siblings: function(selector) {
            return filtered(this.map(function(i, el) {
                return filter.call(children(el.parentNode), function(child) {
                    return child !== el
                })
            }), selector)
        },
        empty: function() {
            return this.each(function() {
                this.innerHTML = ''
            })
        },
        // `pluck` is borrowed from Prototype.js
        pluck: function(property) {
            return $.map(this, function(el) {
                return el[property]
            })
        },
        show: function() {
            return this.each(function() {
                this.style.display == "none" && (this.style.display = '')
                if (getComputedStyle(this, '').getPropertyValue("display") == "none")
                    this.style.display = defaultDisplay(this.nodeName)
            })
        },
        replaceWith: function(newContent) {
            return this.before(newContent).remove()
        },
        wrap: function(structure) {
            var func = isFunction(structure)
            if (this[0] && !func)
                //如果structure是字符串，则将其转成DOM
                var dom = $(structure).get(0),
                    //如果structure是已经存在于页面上的节点或者被wrap的记录不只一条，则需要clone dom
                    clone = dom.parentNode || this.length > 1

            return this.each(function(index) {
                $(this).wrapAll(
                    func ? structure.call(this, index) :
                    clone ? dom.cloneNode(true) : dom
                )
            })
        },
        wrapAll: function(structure) {
            if (this[0]) {
                $(this[0]).before(structure = $(structure)) // 先插入到第一个字节点的前面位置去
                var children
                    // drill down to the inmost element
                // /取structure里的第一个子节点的最里层
                while ((children = structure.children()).length) 
                    structure = children.first() // 一层层递归进去
                //将当前集合整个插入到最里层的节点里，达到wrapAll的目的
                $(structure).append(this)
            }
            return this
        },
        wrapInner: function(structure) {
            var func = isFunction(structure)
            return this.each(function(index) {
                var self = $(this),
                    contents = self.contents(),
                    dom = func ? structure.call(this, index) : structure
                contents.length ? contents.wrapAll(dom) : self.append(dom)
            })
        },
        unwrap: function() {
            this.parent().each(function() {
                $(this).replaceWith($(this).children())
            })
            return this
        },
        // ==================================================
        // ==================================================
        clone: function() {
            return this.map(function() {
                return this.cloneNode(true)
            })
        },
        hide: function() {
            return this.css("display", "none")
        },
        toggle: function(setting) {
            return this.each(function() {
                var el = $(this);
                (setting === undefined ? el.css("display") == "none" : setting) ? el.show(): el.hide()
            })
        },
        prev: function(selector) {
            return $(this.pluck('previousElementSibling')).filter(selector || '*')
        },
        next: function(selector) {
            return $(this.pluck('nextElementSibling')).filter(selector || '*')
        },
        html: function(html) {
            return 0 in arguments ?
                this.each(function(idx) {
                    var originHtml = this.innerHTML
                    $(this).empty().append(funcArg(this, html, idx, originHtml))
                }) :
                (0 in this ? this[0].innerHTML : null)
        },
        text: function(text) {
            return 0 in arguments ?
                this.each(function(idx) {
                    var newText = funcArg(this, text, idx, this.textContent)
                    this.textContent = newText == null ? '' : '' + newText
                }) :
                (0 in this ? this[0].textContent : null) // textContent 属性设置或返回指定节点的文本内容，以及它的所有后代。
        },
        attr: function(name, value) {
            var result
            return (typeof name == 'string' && !(1 in arguments)) ?
                (!this.length || this[0].nodeType !== 1 ? undefined :
                    // 如果getAttribute能直接拿到值就返回result，然后再去检查元素的属性
                    (!(result = this[0].getAttribute(name)) && name in this[0]) ? this[0][name] : result
                ) :
                this.each(function(idx) {
                    if (this.nodeType !== 1) return
                    if (isObject(name))
                        for (key in name) setAttribute(this, key, name[key])
                    else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
                })
        },
        removeAttr: function(name) {
            return this.each(function() {
                this.nodeType === 1 && name.split(' ').forEach(function(attribute) {
                    setAttribute(this, attribute)
                }, this)
            })
        },
        // attr和prop的区别是，前者先读取html特性再读取元素属性
        prop: function(name, value) {
            name = propMap[name] || name
            return (1 in arguments) ?
                this.each(function(idx) {
                    this[name] = funcArg(this, value, idx, this[name])
                }) :
                (this[0] && this[0][name])
        },
        data: function(name, value) {
            var attrName = 'data-' + name.replace(capitalRE, '-$1').toLowerCase()

            var data = (1 in arguments) ?
                this.attr(attrName, value) :
                this.attr(attrName)

            return data !== null ? deserializeValue(data) : undefined
        },
        val: function(value) {
            return 0 in arguments ?
                this.each(function(idx) {
                    this.value = funcArg(this, value, idx, this.value)
                }) :
                (this[0] && (this[0].multiple ?
                    $(this[0]).find('option').filter(function() {
                        return this.selected
                    }).pluck('value') :
                    this[0].value))
        },
        offset: function(coordinates) {
            if (coordinates) return this.each(function(index) {
                var $this = $(this),
                    coords = funcArg(this, coordinates, index, $this.offset()), // coordinates：相对于document的位置，相对于offsetParent设置
                    parentOffset = $this.offsetParent().offset(),
                    props = {
                        top: coords.top - parentOffset.top,
                        left: coords.left - parentOffset.left
                    }
                //注意元素的position为static时，设置top,left是无效的
                if ($this.css('position') == 'static') props['position'] = 'relative'
                $this.css(props)
            })
            if (!this.length) return null
            if (!$.contains(document.documentElement, this[0])) // 元素不在文档中
                return {
                    top: 0,
                    left: 0
                }
            var obj = this[0].getBoundingClientRect() // 相对于视口
            return {
                left: obj.left + window.pageXOffset, // 此属性能够返回当前页面左上角相对于浏览器窗口显示区域左上角X轴上的距离。>= ie9。 相当于scrollTop，如果不支持可以用body.scrollTop替代
                top: obj.top + window.pageYOffset,
                width: Math.round(obj.width),
                height: Math.round(obj.height)
            }
        },
        css: function(property, value) {
            if (arguments.length < 2) {
                var computedStyle, element = this[0]
                if (!element) return
                computedStyle = getComputedStyle(element, '')
                if (typeof property == 'string')
                    return element.style[camelize(property)] || computedStyle.getPropertyValue(property)
                else if (isArray(property)) {
                    var props = {}
                    $.each(property, function(_, prop) {
                        // 如果是从style中拿属性的需要转换为驼峰格式；注意camelize的bug: -webkit-transition => WebkitTransition，应该是webkitTransition才对
                        // 通过getComputedStyle的就不需要了，直接-webkit-tran....
                        props[prop] = (element.style[camelize(prop)] || computedStyle.getPropertyValue(prop))
                    })
                    return props
                }
            }

            var css = ''
            if (type(property) == 'string') {
                if (!value && value !== 0) // null/undefined
                    this.each(function() {
                        this.style.removeProperty(dasherize(property))
                    })
                else
                    css = dasherize(property) + ":" + maybeAddPx(property, value)
            } else {
                for (key in property)
                    if (!property[key] && property[key] !== 0)
                        this.each(function() {
                            // removeProperty和computedStyle.getPropertyValue一样，接受'-'拼接的属性参数
                            this.style.removeProperty(dasherize(key))
                        })
                    else
                        css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
            }

            return this.each(function() {
                this.style.cssText += ';' + css
            })
        },
        index: function(element) {
            return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
        },
        hasClass: function(name) {
            if (!name) return false
            return emptyArray.some.call(this, function(el) {
                return this.test(className(el))
            }, classRE(name)) // classRE(name):执行callback时的this值；forEach, filter都支持这个可选的参数
        },
        addClass: function(name) {
            if (!name) return this
            return this.each(function(idx) {
                if (!('className' in this)) return
                classList = []
                var cls = className(this),
                    newName = funcArg(this, name, idx, cls)
                newName.split(/\s+/g).forEach(function(klass) {
                    if (!$(this).hasClass(klass)) classList.push(klass)
                }, this)
                classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
            })
        },
        removeClass: function(name) {
            return this.each(function(idx) {
                if (!('className' in this)) return
                if (name === undefined) return className(this, '')
                classList = className(this)
                funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass) {
                    classList = classList.replace(classRE(klass), " ")
                })
                className(this, classList.trim())
            })
        },
        toggleClass: function(name, when) {
            if (!name) return this
            return this.each(function(idx) {
                var $this = $(this),
                    names = funcArg(this, name, idx, className(this))
                names.split(/\s+/g).forEach(function(klass) {
                    (when === undefined ? !$this.hasClass(klass) : when) ?
                    $this.addClass(klass): $this.removeClass(klass)
                })
            })
        },
        scrollTop: function(value) {
            if (!this.length) return
            var hasScrollTop = 'scrollTop' in this[0]
            if (value === undefined) return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset // this[0].pageYOffset 只有window才有pageYOffset的啊!??
            return this.each(hasScrollTop ?
                function() {
                    this.scrollTop = value
                } :
                function() {
                    this.scrollTo(this.scrollX, value)
                })
        },
        scrollLeft: function(value) {
            if (!this.length) return
            var hasScrollLeft = 'scrollLeft' in this[0]
            if (value === undefined) return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset
            return this.each(hasScrollLeft ?
                function() {
                    this.scrollLeft = value
                } :
                function() {
                    this.scrollTo(value, this.scrollY)
                })
        },
        position: function() {
            if (!this.length) return

            var elem = this[0],
                // Get *real* offsetParent
                offsetParent = this.offsetParent(),
                // Get correct offsets
                offset = this.offset(),
                parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? {
                    top: 0,
                    left: 0
                } : offsetParent.offset()

            // Subtract element margins
            // note: when an element has margin: auto the offsetLeft and marginLeft
            // are the same in Safari causing offset.left to incorrectly be 0
            // 从外边框开始算的!??
            offset.top -= parseFloat($(elem).css('margin-top')) || 0
            offset.left -= parseFloat($(elem).css('margin-left')) || 0

            // Add offsetParent borders
            // 元素定位是内边框开始的
            parentOffset.top += parseFloat($(offsetParent[0]).css('border-top-width')) || 0
            parentOffset.left += parseFloat($(offsetParent[0]).css('border-left-width')) || 0

            // Subtract the two offsets
            return {
                top: offset.top - parentOffset.top,
                left: offset.left - parentOffset.left
            }
        },
        offsetParent: function() {
            return this.map(function() {
                var parent = this.offsetParent || document.body
                while (parent 
                    && !rootNodeRE.test(parent.nodeName) 
                    && $(parent).css("position") == "static")
                    parent = parent.offsetParent
                return parent
            })
        }
    }

    // for now
    $.fn.detach = $.fn.remove

    // Generate the `width` and `height` functions
    ;
    ['width', 'height'].forEach(function(dimension) {
        var dimensionProperty =
            dimension.replace(/./, function(m) {
                return m[0].toUpperCase()
            })

        $.fn[dimension] = function(value) {
            var offset, el = this[0]
            if (value === undefined) return isWindow(el) ? el['inner' + dimensionProperty] :
                isDocument(el) ? el.documentElement['scroll' + dimensionProperty] :
                (offset = this.offset()) && offset[dimension]
            else return this.each(function(idx) {
                el = $(this)
                el.css(dimension, funcArg(this, value, idx, el[dimension]()))
            })
        }
    })

    function traverseNode(node, fun) {
        fun(node)
        for (var i = 0, len = node.childNodes.length; i < len; i++)
            traverseNode(node.childNodes[i], fun)
    }

    // Generate the `after`, `prepend`, `before`, `append`,
    // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
    adjacencyOperators.forEach(function(operator, operatorIndex) {
        var inside = operatorIndex % 2 //=> prepend, append

        $.fn[operator] = function() {
            // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
            var argType, nodes = $.map(arguments, function(arg) {
                    argType = type(arg)
                    return argType == "object" || argType == "array" || arg == null ?
                        arg : zepto.fragment(arg)
                }),
                parent, 
                copyByClone = this.length > 1 // 如果需要插入到多个元素里面，则nodes需要clone，不能直接插
            if (nodes.length < 1) return this

            return this.each(function(_, target) {
                parent = inside ? target : target.parentNode

                // convert all methods to a "before" operation
                // 通过改变target将after，prepend，append操作转成before操作，insertBefore的第二个参数为null时等于appendChild操作
                target = operatorIndex == 0 ? target.nextSibling :
                    operatorIndex == 1 ? target.firstChild :
                    operatorIndex == 2 ? target :
                    null

                var parentInDocument = $.contains(document.documentElement, parent)

                nodes.forEach(function(node) {
                    if (copyByClone) 
                        node = node.cloneNode(true)
                    else if (!parent) 
                        return $(node).remove() // 为什么要删除???

                    parent.insertBefore(node, target)
                    //插入节点后，如果被插入的节点是SCRIPT，并且父节点本来就在document中的，则执行里面的内容并将window设为上下文
                    if (parentInDocument) 
                        traverseNode(node, function(el) {
                            if (el.nodeName != null 
                                && el.nodeName.toUpperCase() === 'SCRIPT' 
                                &&(!el.type || el.type === 'text/javascript') 
                                && !el.src)
                                window['eval'].call(window, el.innerHTML)
                        })
                })
            })
        }

        // after    => insertAfter
        // prepend  => prependTo
        // before   => insertBefore
        // append   => appendTo
        $.fn[inside ? operator + 'To' : 'insert' + (operatorIndex ? 'Before' : 'After')] = function(html) {
            $(html)[operator](this)
            return this
        }
    })

    
    // zepto.Z.prototype为什么也要设置???
    zepto.Z.prototype = Z.prototype = $.fn

    // Export internal API functions in the `$.zepto` namespace
    zepto.uniq = uniq
    zepto.deserializeValue = deserializeValue
    $.zepto = zepto

    return $
})()

// If `$` is not yet defined, point it to `Zepto`
window.Zepto = Zepto
window.$ === undefined && (window.$ = Zepto)


