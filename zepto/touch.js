//     Zepto.js
//     (c) 2010-2015 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

// 不是很了解ie10处理触摸的方式，有关这部分的代码没看明白。忘知道的同学告知

;(function($) {
    var touch = {
            /*
                x1: 保存开始触摸时位置的x值,
                y1: ...
                x2: 记录每次touchmove时触摸位置的变化
                y2: ...
                last: 保存上一次touchstart的时间
                isDoubleTap: 如果delta > 0 && delta <= 250间隔内发生了两次touchstart,则视为双击
            */
        },
        touchTimeout, tapTimeout, swipeTimeout, longTapTimeout,
        longTapDelay = 750,
        gesture

    function swipeDirection(x1, x2, y1, y2) {
        // 先判断哪个轴绝对值大，得到水平还是竖直再判断具体的方向
        return Math.abs(x1 - x2) >= Math.abs(y1 - y2) 
            ? (x1 - x2 > 0 ? 'Left' : 'Right') 
            : (y1 - y2 > 0 ? 'Up' : 'Down')
    }

    function longTap() {
        longTapTimeout = null
        if (touch.last) {
            touch.el.trigger('longTap')
            touch = {}
        }
    }

    function cancelLongTap() {
        if (longTapTimeout) clearTimeout(longTapTimeout)
        longTapTimeout = null
    }

    function cancelAll() {
        if (touchTimeout) clearTimeout(touchTimeout)
        if (tapTimeout) clearTimeout(tapTimeout)
        if (swipeTimeout) clearTimeout(swipeTimeout)
        if (longTapTimeout) clearTimeout(longTapTimeout)
        touchTimeout = tapTimeout = swipeTimeout = longTapTimeout = null
        touch = {}
    }

    // ???
    function isPrimaryTouch(event) {
        return (event.pointerType == 'touch' || event.pointerType == event.MSPOINTER_TYPE_TOUCH) 
            && event.isPrimary
    }

    function isPointerEventType(e, type) {
        return (e.type == 'pointer' + type ||
            e.type.toLowerCase() == 'mspointer' + type)
    }

    // 在document上绑定touch事件模型，然后根据条件在e.target上trigger特定的自定义事件，tap这些，
    // tap这些事件是会冒泡的，所以可以使用代理
    $(document).ready(function() {
        var now, 
            delta, // 上一次touch和这一次touch的时间间隔
            deltaX = 0, // x轴方向上总共移动的距离
            deltaY = 0,
            firstTouch, _isPointerType

        if ('MSGesture' in window) {
            gesture = new MSGesture()
            gesture.target = document.body
        }

        $(document).bind('MSGestureEnd', function(e) {
                var swipeDirectionFromVelocity = e.velocityX > 1 ? 'Right' 
                    : e.velocityX < -1 ? 'Left' 
                    : e.velocityY > 1 ? 'Down' 
                    : e.velocityY < -1 ? 'Up' 
                    : null;
                if (swipeDirectionFromVelocity) {
                    touch.el.trigger('swipe')
                    touch.el.trigger('swipe' + swipeDirectionFromVelocity)
                }
            })
            .on('touchstart MSPointerDown pointerdown', function(e) {
                // 如果是使用IE10的触摸方式则不用再处理touch ???
                if ((_isPointerType = isPointerEventType(e, 'down')) &&
                    !isPrimaryTouch(e)) return
                firstTouch = _isPointerType ? e : e.touches[0]
                if (e.touches && e.touches.length === 1 && touch.x2) {
                    // Clear out touch movement data if we have it sticking around
                    // This can occur if touchcancel doesn't fire due to preventDefault, etc.
                    touch.x2 = undefined
                    touch.y2 = undefined
                }
                now = Date.now()
                delta = now - (touch.last || now)
                touch.el = $('tagName' in firstTouch.target ?
                    firstTouch.target : firstTouch.target.parentNode)
                touchTimeout && clearTimeout(touchTimeout)
                touch.x1 = firstTouch.pageX
                touch.y1 = firstTouch.pageY
                if (delta > 0 && delta <= 250) touch.isDoubleTap = true
                touch.last = now
                longTapTimeout = setTimeout(longTap, longTapDelay)
                // adds the current touch contact for IE gesture recognition
                // 第一句的if如果为true直接return的话，这里还有什么用呢???
                if (gesture && _isPointerType) 
                    gesture.addPointer(e.pointerId);
            })
            .on('touchmove MSPointerMove pointermove', function(e) {
                if ((_isPointerType = isPointerEventType(e, 'move')) &&
                    !isPrimaryTouch(e)) return
                firstTouch = _isPointerType ? e : e.touches[0]
                cancelLongTap() // 取消长按事件
                touch.x2 = firstTouch.pageX
                touch.y2 = firstTouch.pageY

                deltaX += Math.abs(touch.x1 - touch.x2)
                deltaY += Math.abs(touch.y1 - touch.y2)
            })
            .on('touchend MSPointerUp pointerup', function(e) {
                if ((_isPointerType = isPointerEventType(e, 'up')) &&
                    !isPrimaryTouch(e)) return
                cancelLongTap()

                // swipe
                if ((touch.x2 && Math.abs(touch.x1 - touch.x2) > 30)
                    || (touch.y2 && Math.abs(touch.y1 - touch.y2) > 30))
                    // 为什么使用间隔为0的超时调用呢
                    // 间隔为0的超时调用：添加到当前代码队列之后，当前队列中的前面那些代码执行完再立即执行这段代码
                    // 因为如果是用户在滚动屏幕的话，就不再触发swipe,tap,doubleTap等这些事件了
                    // 对window的scroll滚动事件进行绑定并立即执行回调，在回调中取消tap这些事件就可以了
                    swipeTimeout = setTimeout(function() {
                        touch.el.trigger('swipe') // 在目标元素上触发事件
                        touch.el.trigger('swipe' + (swipeDirection(touch.x1, touch.x2, touch.y1, touch.y2)))
                        touch = {}
                    }, 0)

                // normal tap
                else if ('last' in touch)
                    // don't fire tap when delta position changed by more than 30 pixels,
                    // for instance when moving to a point and back to origin
                    if (deltaX < 30 && deltaY < 30) {
                        // delay by one tick so we can cancel the 'tap' event if 'scroll' fires
                        // ('tap' fires before 'scroll') 应该是after吧。。
                        // 使用超时调用的原因如上swipe
                        tapTimeout = setTimeout(function() {

                            // trigger universal 'tap' with the option to cancelTouch()
                            // (cancelTouch cancels processing of single vs double taps for faster 'tap' response)
                            var event = $.Event('tap')
                            event.cancelTouch = cancelAll
                            touch.el.trigger(event)

                            // trigger double tap immediately
                            if (touch.isDoubleTap) {
                                if (touch.el) touch.el.trigger('doubleTap')
                                touch = {}
                            }

                            // trigger single tap after 250ms of inactivity
                            else {
                                touchTimeout = setTimeout(function() {
                                    touchTimeout = null
                                    if (touch.el) touch.el.trigger('singleTap')
                                    touch = {}
                                }, 250)
                            }
                        }, 0)
                    } else {
                        touch = {}
                    }

                // 恢复初始化
                deltaX = deltaY = 0
            })
            // touchcancel: 当系统停止跟踪触摸时触发
            // 注意：when the browser window loses focus,
            // for example when a modal dialog is shown,
            // cancel all ongoing events
            .on('touchcancel MSPointerCancel pointercancel', cancelAll)

        // 注意：用户如果是想滚动窗口则取消swipe等事件。
        // scrolling the window indicates intention of the user
        // to scroll, not tap or swipe, so cancel all ongoing events
        $(window).on('scroll', cancelAll)
    })

    ;['swipe', 'swipeLeft', 'swipeRight', 'swipeUp', 'swipeDown',
        'doubleTap', 'tap', 'singleTap', 'longTap'
    ].forEach(function(eventName) {
        $.fn[eventName] = function(callback) {
            return this.on(eventName, callback)
        }
    })
})(Zepto)

