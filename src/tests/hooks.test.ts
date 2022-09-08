/* global describe */
import { WebFunctionCallEvent, WebRequestEvent } from '@merrymaker/types'
import { config } from 'node-config-ts'

import vmRunner from '../lib/vm-runner'

const browserWorker = new vmRunner()

const source = `
  await page.goto('http://localhost:5000/simple.html')
  await page.waitForTimeout(2 * 1000)
`

describe('Simple Hooks', () => {
  beforeAll(done => {
    browserWorker.browserEvent.on('scan-event', eType => {
      if (eType.type === 'complete') {
        done()
      }
    })
    browserWorker.runner({
      code: source,
      scan_id: 'test-run123',
      test: false,
      config: {
        browserAgs: config.puppeteer.args,
        timeout: config.puppeteer.timeout
      }
    })
  })

  it('should not have a page-page', () => {
    expect(browserWorker.events.every(e => e.event === 'page-error')).toBe(
      false
    )
  })

  it('should capture network request', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebRequestEvent
        return (
          e.event === 'request' &&
          payload.url === 'http://localhost:5000/simple.html' &&
          payload.method === 'GET'
        )
      })
    ).toBe(true)
  })

  it('should capture FontFace', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'FontFace' &&
          payload.args === 'url(//foo.com/foo.woff)'
        )
      })
    ).toBe(true)
  })

  it('should capture Image.src', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'Image.src' &&
          payload.args === 'image.png'
        )
      })
    ).toBe(true)
  })

  it('should capture Image.onload', async () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'Image.onload' &&
          payload.args === 'function () { var a = 1; }'
        )
      })
    ).toBe(true)
  })

  it('should capture innerHTML', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'innerHTML' &&
          payload.args === '<img src="http://exfil.example.com">'
        )
      })
    ).toBe(true)
  })

  it('should capture WebSocket', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'WebSocket' &&
          payload.args === 'wss://exfil.example.com/'
        )
      })
    ).toBe(true)
  })

  it('should capture CssBackgroundImage', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'CssBackgroundImage' &&
          payload.args === 'url(http://exfil.example.com/foo.jpg)'
        )
      })
    ).toBe(true)
  })

  it('should capture Audio', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'Audio' &&
          payload.args === 'http://exfil.example.com'
        )
      })
    ).toBe(true)
  })

  it('should capture ElementSource on Audio', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'ElementSource' &&
          payload.args === 'http://exfil.example.com' &&
          payload.prop === 'src' &&
          payload.element === 'AUDIO'
        )
      })
    ).toBe(true)
  })

  it('should capture ElementSource on Video', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'ElementSource' &&
          payload.args === 'http://exfil2.example.com' &&
          payload.prop === 'src' &&
          payload.element === 'VIDEO'
        )
      })
    ).toBe(true)
  })

  it('should capture ElementSource on Image', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'ElementSource' &&
          payload.args === 'http://exfil3.example.com' &&
          payload.prop === 'src' &&
          payload.element === 'IMG'
        )
      })
    ).toBe(true)
  })

  it('should capture ElementSource on Iframe', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'ElementSource' &&
          payload.args === 'http://exfil4.example.com' &&
          payload.prop === 'src' &&
          payload.element === 'IFRAME'
        )
      })
    ).toBe(true)
  })

  it('should capture ElementSource on link', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'ElementSource' &&
          payload.args === 'http://exfil5.example.com' &&
          payload.prop === 'href' &&
          payload.element === 'LINK'
        )
      })
    ).toBe(true)
  })

  it('should capture addEventListener on click', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'EventTarget.addEventListener' &&
          payload.args === 'click' &&
          payload.funcSource === "function () {\n    var foo = 'bar'\n  }"
        )
      })
    ).toBe(true)
  })

  it('should capture eval', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'eval' &&
          payload.args === 'var a = "foo"'
        )
      })
    ).toBe(true)
  })

  it('should capture atob', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'atob' &&
          payload.args === '123'
        )
      })
    ).toBe(true)
  })

  it('should capture btoa', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'btoa' &&
          payload.args === '×m'
        )
      })
    ).toBe(true)
  })

  it('should capture setTimeout', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'setTimeout' &&
          payload.args === "function () { var foo = 'bar'}"
        )
      })
    ).toBe(true)
  })

  it('should capture preconnect on link elements', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'ElementSource' &&
          payload.args === 'preconnect'
        )
      })
    ).toBe(true)
  })

  it('should capture href on link elements', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'ElementSource' &&
          payload.args === '//foobar.google.com' &&
          payload.prop === 'href' &&
          payload.element === 'LINK'
        )
      })
    ).toBe(true)
  })

  it('should capture mouseup event listener', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'EventTarget.addEventListener' &&
          payload.args === 'mouseup' &&
          payload.target?.tagName === 'INPUT' &&
          payload.target?.id === 'creditCard'
        )
      })
    ).toBe(true)
  })

  it('should capture XHR', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebFunctionCallEvent
        return (
          e.event === 'function-call' &&
          payload.func === 'XMLHttpRequest' &&
          payload.args === 'GET http://exfil6.example.com/foo'
        )
      })
    ).toBe(true)
  })

  it('should capture image requests', () => {
    expect(
      browserWorker.events.some(e => {
        const payload = e.payload as WebRequestEvent
        return (
          e.event === 'request' &&
          payload.url === 'http://localhost:5000/image.png' &&
          payload.method === 'GET' &&
          payload.resourceType === 'image'
        )
      })
    ).toBe(true)
  })
})
