/* eslint-disable no-setter-return */
/* eslint-disable no-global-assign */
/* eslint-disable no-undef */
/* eslint-env browser */

module.exports = function() {

  // https://github.com/v8/v8/wiki/Stack-Trace-API#customizing-stack-traces
  Object.defineProperty(window, '__stack', {
    get: function() {
      var orig = Error.prepareStackTrace
      Error.prepareStackTrace = function(_, stack) {
        return stack
      }
      var err = new Error()
      Error.captureStackTrace(err, arguments.callee)
      var stack = err.stack
      Error.prepareStackTrace = orig
      return stack
    }
  })

  Object.defineProperty(window, '__trace', {
    get: function() {
      let ret = {}
      let fromEval = false
      try {
        for (let i = 1; i < __stack.length; i += 1) {
          if (__stack[i].isEval()) {
            fromEval = true
            continue
          }

          let script = __stack[i].getFileName()
          if (script && script.length > 0) {
            ret = {
              script,
              line: __stack[i].getLineNumber(),
              column: __stack[i].getColumnNumber(),
              functionName: __stack[i].getFunctionName(),
              fromEval
            }
            break
          }
        }
      } catch (e) {
        console.log('trace exception', e)
      }
      return ret
    }
  })

  // Checks for native functions
  var isNative = function(f) {
    return (
      typeof f === 'function' &&
      f.toString() === 'function () { [native code] }'
    )
  }

  var oldEventListener = window.addEventListener
  window.addEventListener = function() {
    if (!isNative(arguments[1])) {
      dispatchHook({
        func: 'window.addEventListener',
        args: arguments[0],
        funcSource: arguments[1].toString(),
        trace: __trace
      })
    }
    return oldEventListener.apply(window, arguments)
  }

  var oldDEventListener = document.addEventListener
  document.addEventListener = function() {
    if (!isNative(arguments[1])) {
      dispatchHook({
        func: 'document.addEventListener',
        args: arguments[0],
        funcSource: arguments[1].toString(),
        trace: __trace
      })
    }
    return oldDEventListener.apply(document, arguments)
  }

  var oldEventTarget = EventTarget.prototype.addEventListener
  EventTarget.prototype.addEventListener = function(type, fn, capture) {
    if (!isNative(fn)) {
      let name = this.name
      if (name) {
        name = name.substring(0, 256)
      }
      dispatchHook({
        func: 'EventTarget.addEventListener',
        args: arguments[0],
        target: {
          tagName: this.tagName,
          id: this.id,
          rel: this.rel,
          name
        },
        funcSource: arguments[1].toString(),
        trace: __trace
      })
    }
    return oldEventTarget.apply(this, [type, fn, capture])
  }

  var oldWrite = document.write
  document.write = function() {
    dispatchHook({
      func: 'document.write',
      args: arguments[0],
      trace: __trace
    })
    return oldWrite.apply(document, arguments)
  }

  var oldEval = eval
  eval = function() {
    var args = arguments[0]
    if (args.length > 1024) {
      args = `${args.substring(0, 1024)}...`
    }
    dispatchHook({
      func: 'eval',
      args: args,
      trace: __trace
    })
    return oldEval.apply(window, arguments)
  }

  var oldAtoB = window.atob

  window.atob = function() {
    dispatchHook({
      func: 'atob',
      args: arguments[0],
      trace: __trace
    })
    return oldAtoB.apply(window, arguments)
  }

  var oldBtoA = window.btoa
  window.btoa = function() {
    dispatchHook({
      func: 'btoa',
      args: arguments[0],
      trace: __trace
    })
    return oldBtoA.apply(window, arguments)
  }

  var oldTimeout = setTimeout
  setTimeout = function() {
    if (!isNative(arguments[0])) {
      dispatchHook({
        func: 'setTimeout',
        args: arguments[0].toString(),
        trace: __trace
      })
    }
    return oldTimeout.apply(this, arguments)
  }

  // Image src
  const NativeImage = Image
  class FakeImage {
    constructor(w, h) {
      const native = new NativeImage(w, h)
      const imageHandler = {
        set(_obj, prop, val) {
          if (prop === 'src') {
            dispatchHook({
              func: 'Image.src',
              args: val,
              trace: __trace
            })
          }
          return (native[prop] = val)
        },
        get(target, prop) {
          let result = target[prop]
          if (typeof result === 'function') {
            result = result.bind(target)
          }
          return result
        }
      }
      const prox = new Proxy(native, imageHandler)
      try {
        prox[Symbol.toStringTag] = 'HTMLImageElement'
      } catch (e) {
        return prox
      }
    }
  }

  const NativeAudio = Audio
  class FakeAudio {
    constructor(urlString) {
      const native = new NativeAudio(urlString)
      if (urlString && urlString.length) {
        dispatchHook({
          func: 'Audio',
          args: urlString,
          trace: __trace
        })
      }
      const audioHandler = {
        set(_obj, prop, val) {
          if (prop === 'src') {
            dispatchHook({
              func: 'Audio',
              args: val,
              trace: __trace
            })
          }
          return (native[prop] = val)
        },
        get(target, prop) {
          let result = target[prop]
          if (typeof result === 'function') {
            result = result.bind(target)
          }
          return result
        }
      }
      const prox = new Proxy(native, audioHandler)
      try {
        prox[Symbol.toStringTag] = 'HTMLMediaElement'
      } catch (e) {
        return prox
      }
    }
  }

  Audio = FakeAudio

  // In case the script gets tricky and tries to detect hooks
  FakeImage.prototype[Symbol.toStringTag] = NativeImage.prototype.toString()
  Object.defineProperty(FakeImage, 'name', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: 'Image'
  })
  Image = FakeImage

  const oldFontFace = FontFace
  class hookFontFace {
    constructor(fam, source, des) {
      const native = new oldFontFace(fam, source, des)
      const handler = {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        set(_obj, prop, _val) {
          return (native[prop] = value)
        },
        get(target, prop) {
          let result = target[prop]
          if (typeof result === 'function') {
            result = result.bind(target)
          }
          return result
        }
      }
      if (source && source.length > 0) {
        dispatchHook({
          func: 'FontFace',
          args: source,
          trace: __trace
        })
      }
      const prox = new Proxy(native, handler)
      try {
        prox[Symbol.toStringTag] = 'FontFace'
      } catch (e) {
        return prox
      }
    }
  }
  FontFace = hookFontFace

  const oldWebSocket = WebSocket
  class FakeWebSocket {
    constructor(url, protocols) {
      const native = new oldWebSocket(url, protocols)
      if (url && url.length > 0) {
        dispatchHook({
          func: 'WebSocket',
          args: url,
          trace: __trace
        })
      }
      return native
    }
  }
  WebSocket = FakeWebSocket

  // ...innerHTML
  const oldElementInner = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'innerHTML'
  ).set
  Object.defineProperty(Element.prototype, 'innerHTML', {
    set(value) {
      dispatchHook({
        func: 'innerHTML',
        args: value,
        trace: __trace
      })
      return oldElementInner.call(this, value)
    }
  })

  const oldE = CSSStyleDeclaration.prototype.setProperty

  CSSStyleDeclaration.prototype.setProperty = function(
    pName,
    value,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _priority
  ) {
    if (pName === 'backgroundImage') {
      dispatchHook({
        func: 'CssBackgroundImage',
        args: value,
        trace: __trace
      })
    }
    return oldE.apply(this, arguments)
  }

  const oldProp = Element.prototype.setAttribute

  const props = ['src', 'href', 'rel', 'preconnect']

  Element.prototype.setAttribute = function(prop, value) {
    if (props.includes(prop)) {
      dispatchHook({
        func: 'ElementSource',
        args: value,
        prop: prop,
        element: this.tagName,
        trace: __trace
      })
    }
    return oldProp.apply(this, arguments)
  }

  // Hooks all `document.createElement` calls
  document.createElement = (function(create) {
    return function() {
      const e = create.apply(this, arguments)
      // Hooks element.style.backgroundImage
      Object.defineProperty(e.style, 'backgroundImage', {
        set(value) {
          e.style.setProperty('backgroundImage', value)
        }
      })

      if (e.src !== undefined) {
        // Hooks element.src setters
        Object.defineProperty(e, 'src', {
          set(value) {
            e.setAttribute('src', value)
          }
        })
      }

      if (e.href !== undefined) {
        Object.defineProperty(e, 'href', {
          set(value) {
            e.setAttribute('href', value)
          }
        })
      }

      if (e.rel !== undefined) {
        Object.defineProperty(e, 'rel', {
          set(value) {
            e.setAttribute('rel', value)
          }
        })
      }
      return e
    }
  })(document.createElement)

  const oldXMLHTTPOpen = XMLHttpRequest.prototype.open

  XMLHttpRequest.prototype.open = function(method, url) {
    dispatchHook({
      func: 'XMLHttpRequest',
      args: `${method} ${url}`,
      trace: __trace
    })
    return oldXMLHTTPOpen.apply(this, [method, url])
  }
}
