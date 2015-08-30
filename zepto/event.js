//     Zepto.js
//     (c) 2010-2015 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($) {
    var _zid = 1,
        undefined,
        slice = Array.prototype.slice,
        isFunction = $.isFunction,
        isString = function(obj) {
            return typeof obj == 'string'
        },
        handlers = {},
        specialEvents = {},
        focusinSupported = 'onfocusin' in window, // 当元素（或在其内的任意元素）获得焦点时发生 focusin 事件。focus不能冒泡，focusin能冒泡
        focus = {
            focus: 'focusin',
            blur: 'focusout'
        },
        hover = {
            mouseenter: 'mouseover',
            mouseleave: 'mouseout'
        }

    // 创建事件时有些事件特殊的事件名
    specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

    function zid(element) {
        return element._zid || (element._zid = _zid++)
    }

    function findHandlers(element, event, fn, selector) {
        event = parse(event)
        if (event.ns) 
            var matcher = matcherFor(event.ns)
        return (handlers[zid(element)] || []).filter(function(handler) {
            return handler 
                && (!event.e || handler.e == event.e) 
                && (!event.ns || matcher.test(handler.ns)) 
                // 如果fn没有_zid它就会生成一个，又因为handler.fn和fn是同一个，所以他们的_zid是一样的。但是为什么不直接检验：handler.fn === fn呢？
                // 使用$.proxy会给fn生成一个_zid
                // 可能会这样做：$el.on('click', $.proxy(handler, context)); 
                // $.proxy返回一个匿名函数，照理是off的时候是删这个匿名函数的，但是取不到匿名函数，这时可以直接$el.off('click', handler);就行了，因为存了一个_zid
                && (!fn || zid(handler.fn) === zid(fn)) 
                && (!selector || handler.sel == selector)
        })
    }

    function parse(event) {
        var parts = ('' + event).split('.')
        return {
            e: parts[0],
            ns: parts.slice(1).sort().join(' ')  // click.1.3.2 =>［1，3，2］=> [1,2,3] => '1 2 3'
        }
    }

    function matcherFor(ns) {
        return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
    }

    // 通过给focus和blur事件设置为捕获来达到事件冒泡的目的
    // 如果浏览器不支持focusin，但又要绑定focusin事件，则使用事件捕获来模拟冒泡，不然不会冒泡到代理的元素上
    function eventCapture(handler, captureSetting) {
        return handler.del &&
            (!focusinSupported && (handler.e in focus)) ||
            !!captureSetting
    }

    function realEvent(type) {
        // 模拟mouseenter和mouseleave事件
        // 支持的话则优先使用focusin事件
        return hover[type] || (focusinSupported && focus[type]) || type
    }

    function add(element, events, fn, data, selector, delegator, capture) {
        var id = zid(element),
            set = (handlers[id] || (handlers[id] = []))
        events.split(/\s/).forEach(function(event) {
            if (event == 'ready') return $(document).ready(fn)
            var handler = parse(event)
            handler.fn = fn // fn: 用户设置的callback
            handler.sel = selector // 代理函数
            // emulate mouseenter, mouseleave
            if (handler.e in hover) 
                fn = function(e) {
                    var related = e.relatedTarget
                    /* 
                        relatedTarget为事件相关对象，只有在mouseover和mouseout事件时才有值
                        mouseover时表示的是鼠标移出的那个对象，mouseout时表示的是鼠标移入的那个对象
                        mouseenter: 从子元素移出进入父元素也会触发，此时，related===this===父元素
                    */
                    console.log(related);
                    console.log(this);
                    if (!related || (related !== this && !$.contains(this, related))) // 防止多次触发
                        return handler.fn.apply(this, arguments)
                }
            handler.del = delegator
            // 如果使用代理的方式处理mouseenter和mouseleave的话，是有bug的，即没有解决mouseover/out的多次触发的问题
            var callback = delegator || fn // 实际的callback
            handler.proxy = function(e) { // 实际绑定的事件处理程序
                e = compatible(e) // 封装事件
                // isImmediatePropagationStopped：用于阻止剩余的事件处理函数的执行，并防止当前事件在DOM树上冒泡。
                if (e.isImmediatePropagationStopped()) return // 干什么用???
                e.data = data
                var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args)) // _args: trigger时传进去的参数
                // 当事件处理函数返回false时，阻止默认操作和冒泡
                if (result === false) e.preventDefault(), e.stopPropagation()
                return result
            }
            // 设置处理函数的在函数集中的位置
            handler.i = set.length
            // 将函数存入函数集中
            set.push(handler)
            if ('addEventListener' in element)
                element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
        })
    }

    function remove(element, events, fn, selector, capture) {
        var id = zid(element);
        (events || '').split(/\s/).forEach(function(event) {
            findHandlers(element, event, fn, selector).forEach(function(handler) {
                delete handlers[id][handler.i]
                if ('removeEventListener' in element)
                    element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
            })
        })
    }

    $.event = {
        add: add,
        remove: remove
    }

    $.proxy = function(fn, context) {
        var args = (2 in arguments) && slice.call(arguments, 2)
        if (isFunction(fn)) {
            var proxyFn = function() {
                return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments)
            }
            proxyFn._zid = zid(fn) // _zid用来寻找handler的
            return proxyFn
        } else if (isString(context)) {
            if (args) {
                args.unshift(fn[context], fn)
                return $.proxy.apply(null, args)
            } else {
                return $.proxy(fn[context], fn)
            }
        } else {
            throw new TypeError("expected function")
        }
    }

    $.fn.bind = function(event, data, callback) {
        return this.on(event, data, callback)
    }
    $.fn.unbind = function(event, callback) {
        return this.off(event, callback)
    }
    $.fn.one = function(event, selector, data, callback) {
        return this.on(event, selector, data, callback, 1)
    }

    var returnTrue = function() {
            return true
        },
        returnFalse = function() {
            return false
        },
        ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$)/,
        eventMethods = {
            preventDefault: 'isDefaultPrevented',
            stopImmediatePropagation: 'isImmediatePropagationStopped',
            stopPropagation: 'isPropagationStopped'
        }

    function compatible(event, source) {
        // event：封装了的事件  source：原事件
        if (source || !event.isDefaultPrevented) {
            source || (source = event)

            $.each(eventMethods, function(name, predicate) {
                var sourceMethod = source[name]
                event[name] = function() { // source === event的啊！！还是同一个引用
                    this[predicate] = returnTrue
                    return sourceMethod && sourceMethod.apply(source, arguments)
                }
                event[predicate] = returnFalse // 没用调用相应的方法前，isDefaultPrevented这几个方法返回的是false
            })

            // 检测默认动作是否被取消了，取消了就重新设置isDefaultPrevented的代码，因为上面设置的是returnFalse
            // defaultPrevented: 原生的，返回一个布尔值,表明当前事件的默认动作是否被取消,也就是是否执行了 event.preventDefault()方法.
            // returnValue: 为true表示默认动作取消了
            if (source.defaultPrevented !== undefined ? source.defaultPrevented :
                'returnValue' in source ? source.returnValue === false :
                source.getPreventDefault && source.getPreventDefault())
                event.isDefaultPrevented = returnTrue
        }
        return event
    }

    function createProxy(event) {
        var key, proxy = {
            originalEvent: event
        }
        for (key in event)
            if (!ignoreProperties.test(key) && event[key] !== undefined) 
                proxy[key] = event[key]

        return compatible(proxy, event)
    }

    $.fn.delegate = function(selector, event, callback) {
        return this.on(event, selector, callback)
    }
    $.fn.undelegate = function(selector, event, callback) {
        return this.off(event, selector, callback)
    }

    $.fn.live = function(event, callback) {
        $(document.body).delegate(this.selector, event, callback)
        return this
    }
    $.fn.die = function(event, callback) {
        $(document.body).undelegate(this.selector, event, callback)
        return this
    }

    $.fn.on = function(event, selector, data, callback, one) {
        var autoRemove, delegator, $this = this
        if (event && !isString(event)) {
            $.each(event, function(type, fn) {
                $this.on(type, selector, data, fn, one)
            })
            return $this
        }

        if (!isString(selector) && !isFunction(callback) && callback !== false)
            callback = data, data = selector, selector = undefined
        if (callback === undefined || data === false)
            callback = data, data = undefined
        if (callback === false) 
            callback = returnFalse

        return $this.each(function(_, element) {
            if (one) 
                autoRemove = function(e) {
                    remove(element, e.type, callback)
                    return callback.apply(this, arguments)
                }

            if (selector) 
                delegator = function(e) {
                    var evt, 
                        // 从元素本身开始，逐级向上级元素匹配，并返回最先匹配selector的元素。如果给定context节点参数，那么只匹配该节点的后代元素
                        // 事件可能由元素的子元素触发的，e.target就不是代理的selector元素，所以要纠正
                        match = $(e.target).closest(selector, element).get(0)
                    if (match && match !== element) {
                        evt = $.extend(createProxy(e), {
                            currentTarget: match,
                            liveFired: element
                        })
                        return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
                    }
                }

            add(element, event, callback, data, selector, delegator || autoRemove) // delegator里面处理了autoRemove，所以先检测delegator先就可以了
        })
    }
    $.fn.off = function(event, selector, callback) {
        var $this = this
        if (event && !isString(event)) {
            $.each(event, function(type, fn) {
                $this.off(type, selector, fn)
            })
            return $this
        }

        if (!isString(selector) && !isFunction(callback) && callback !== false)
            callback = selector, selector = undefined
        if (callback === false) 
            callback = returnFalse

        return $this.each(function() {
            remove(this, event, callback, selector)
        })
    }

    /*
        // trigger和triggerHandler的不同
        var bd=$('body');
        bd.on('testevent', function (e) {
           console.log('testevent') 
        }).on('testevent.ych', function () {
            console.log('testevent.ych') 
        });
        $('button').click(function () {
            // bd.trigger('testevent'); // testevent testevent.ych
            // bd.trigger('testevent.ych'); // 没有反应，因为吧testevent.ych当成了一整个事件名而不是ych为命名空间

            // bd.triggerHandler('testevent'); // testevent testevent.ych
            bd.triggerHandler('testevent.ych'); // testevent.ych
        });
    */

    $.fn.trigger = function(event, args) {
        event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
        event._args = args
        return this.each(function() {
            // handle focus(), blur() by calling them directly
            if (event.type in focus && typeof this[event.type] == "function") 
                this[event.type]()
            // items in the collection might not be DOM elements
            else if ('dispatchEvent' in this) 
                this.dispatchEvent(event) //注意：这种由dispatchEvent触发的事件和浏览器自己触发的事件是不区分命名空间的，就是说，不能触发特定命名空间下的事件处理器（见上面注释）
            else 
                $(this).triggerHandler(event, args)
        })
    }

    // triggers event handlers on current element just as if an event occurred,
    // doesn't trigger an actual event, doesn't bubble
    // 相当于直接调用指定的事件处理程序，不是真正的触发
    $.fn.triggerHandler = function(event, args) {
        var e, result
        this.each(function(i, element) {
            e = createProxy(isString(event) ? $.Event(event) : event)
            e._args = args
            e.target = element
            $.each(findHandlers(element, event.type || event), function(i, handler) {
                result = handler.proxy(e)
                if (e.isImmediatePropagationStopped()) return false
            })
        })
        return result
    }

    // shortcut methods for `.bind(event, fn)` for each event type
    ;('focusin focusout focus blur load resize scroll unload click dblclick ' +
        'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave ' +
        'change select keydown keypress keyup error').split(' ').forEach(function(event) {
        $.fn[event] = function(callback) {
            return (0 in arguments) ?
                this.bind(event, callback) :
                this.trigger(event)
        }
    })

    $.Event = function(type, props) {
        if (!isString(type)) props = type, type = props.type
        var event = document.createEvent(specialEvents[type] || 'Events'),
            bubbles = true
        if (props)
            for (var name in props)
                (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
        event.initEvent(type, bubbles, true)
        return compatible(event)
    }

})(Zepto)