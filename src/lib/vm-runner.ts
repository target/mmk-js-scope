import events from 'events'
import crypto from 'crypto'
import { VM } from 'vm2'
import puppeteer, {
  Page,
  Browser,
  ConsoleMessage,
  WebWorker,
  HTTPResponse,
  HTTPRequest
} from 'puppeteer'

export type RunnerOpts = {
  code: string
  scan_id: string
  test: boolean
  config: {
    browserAgs: string[]
    timeout: number
  }
}

import hooks from '../hooks.js'
import {
  ScanEventType,
  ScanEventPayload,
  ScanEvent,
  WebConsoleMessage,
  LogMessage,
  HtmlSnapshot,
  Screenshot,
  WebPageError,
  WebCookies,
  WebWorkerCreated,
  WebScriptEvent,
  WebResponseError,
  WebRequestEvent,
  ScanError,
  WebFunctionCallEvent
} from '@merrymaker/types'

export default class vmRunner {
  // puppeteer browser instance
  browser: Browser
  // vm for site code
  vm: VM
  // Scan ID
  scanID: string
  // run in test mode
  test: boolean
  // event emitter for all browser events
  browserEvent: events.EventEmitter
  // current page
  page: Page
  // Total emitted events
  totalEvents: number

  events: Array<{ event: string; payload: ScanEventPayload }>
  // failure tracker
  failure: string
  constructor() {
    this.totalEvents = 0
    this.browserEvent = new events.EventEmitter()
  }

  /**
   * runner
   *  Create a headless browser, captures events,
   *  and runs puppeteer script
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public runner = async ({
    scan_id,
    code,
    test,
    config,
  }) => {
    this.scanID = scan_id
    this.test = test
    this.totalEvents = 0
    this.events = []
    this.failure = ''
    try {
      this.browser = ((await puppeteer.launch({
        args: config.browserAgs,
        headless: true,
        dumpio: false,
        ignoreHTTPSErrors: true
      })) as unknown) as Browser
      this.page = await this.browser.newPage()

      this.vm = new VM({
        sandbox: {
          page: this.page,
          hookEvents: hooks,
          module,
          screenshot: this.screenshot,
          htmlSnapshot: this.htmlSnapshot,
          browserEvent: this.browserEvent,
          timeout: config.timeout
        }
      })

      this.page.evaluateOnNewDocument(hooks)
      await this.page.exposeFunction('dispatchHook', (e: never) => {
        this.functionCall(e)
      })
      // handle responses
      this.page.on('response', this.responseHandler)
      // Custom events
      // https://github.com/puppeteer/puppeteer/issues/6839 - custom event types not supported
      /* eslint-disable @typescript-eslint/no-explicit-any */
      this.page.on('htmlsnapshot' as any, (snap: HtmlSnapshot) => {
        this.htmlSnapshotEvent(snap)
      })
      this.page.on('screenshot' as any, (payload: string) =>
        this.screenshotEvent({ payload })
      )
      this.page.on('logMessage' as any, (message: string) =>
        this.logMessage({ message })
      )
      /* eslint-enable @typescript-eslint/no-explicit-any */
      // handle errors on the page
      this.page.on('pageerror', (err: Error) => {
        this.pageError({ message: err.message })
      })

      this.page.on('requestfailed', (request: HTTPRequest) => {
        this.pageError({
          message: `Request failed: ${request.url()} - ${
            request.failure().errorText
          }`
        })
      })

      // handle console log messages
      this.page.on('console', (message: ConsoleMessage) => {
        this.consoleMessage({ message: message.text() })
      })
      // handle web worker created
      this.page.on('workercreated', (worker: WebWorker) => {
        this.workerCreated({
          url: worker.url(),
          page: this.page.url()
        })
      })

      this.active()
      await this.runCode(code)
      const cookies = await this.page.cookies()
      this.pageCookies({ cookies })
      this.complete()
    } catch (e) {
      this.failure = e.message
    } finally {
      if (this.page) {
        await this.page.close()
      }
      if (this.browser) {
        await this.browser.close()
      }
    }
    if (this.failure) {
      this.scanError({ message: this.failure })
      throw new Error(this.failure)
    }
  }

  /**
   * runCode
   *  Wraps site code inside a promise
   *  so it can be called async
   */
  private runCode(code: string) {
    return this.vm.run(`
        module.exports = new Promise(async (resolve, reject) => {
          function log(message) { page.emit('logMessage', message) };
          try {
            ${code}
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      `)
  }

  private async screenshot(page: Page): Promise<void> {
    const buff = await page.screenshot({
      encoding: 'base64',
      quality: 50,
      type: 'jpeg',
      fullPage: true
    })
    page.emit('screenshot', buff)
  }

  private async htmlSnapshot(page: Page): Promise<void> {
    const url = page.url()
    const html = await page.content()
    page.emit('htmlsnapshot', { url, html })
  }

  /**
   * responseHandler
   *  Handles all browser responses and emits `script-request`,
   *  and `response` events
   */
  private responseHandler = async (res: HTTPResponse) => {
    const req = res.request()
    const url = res.url()
    let text = ''
    let sha256 = null
    let lastModified = null
    const redirect = []
    // capture successful script responses
    if (res.status() < 400 && req.resourceType() === 'script') {
      const chain = req.redirectChain()
      const maxLen = 5
      for (let i = 0; i < chain.length && i < maxLen; i += 1) {
        redirect.push(chain[i].url())
      }
      try {
        text = await res.text()
        lastModified = res.headers()['last-modified']
        sha256 = crypto.createHmac('sha256', text).digest('hex')
        this.scriptRequest({
          page: this.page.url(),
          serverLastModified: lastModified,
          headers: req.headers(),
          url,
          sha256,
          redirect
        })
      } catch (e) {
        this.responseError({
          message: e.message
        })
      }
    }

    this.requestResponse({
      url: req.url(),
      method: req.method(),
      headers: req.headers(),
      postData: req.postData(),
      resourceType: req.resourceType(),
      response: {
        headers: res.headers(),
        status: res.status(),
        url: res.url()
      }
    })
  }

  private EmitEvent(eType: ScanEventType, payload: ScanEventPayload) {
    this.totalEvents += 1
    this.browserEvent.emit('scan-event', {
      scanID: this.scanID,
      test: this.test,
      type: eType,
      payload
    } as ScanEvent)
    this.events.push({ event: eType, payload })
  }

  // Wrappers around event types
  private consoleMessage(e: WebConsoleMessage) {
    this.EmitEvent('console-message', e)
  }

  private logMessage(e: LogMessage) {
    this.EmitEvent('log-message', e)
  }

  private active() {
    this.browserEvent.emit('scan-event', {
      scanID: this.scanID,
      type: 'active'
    })
  }

  private complete() {
    this.EmitEvent('complete', { message: 'successful' })
  }

  private pageError(e: WebPageError) {
    this.EmitEvent('page-error', e)
  }

  private pageCookies(e: WebCookies) {
    this.EmitEvent('cookie', e)
  }

  private workerCreated(e: WebWorkerCreated) {
    this.EmitEvent('worker-created', e)
  }

  private scriptRequest(e: WebScriptEvent) {
    this.EmitEvent('script-response', e)
  }

  private responseError(e: WebResponseError) {
    this.EmitEvent('response-error', e)
  }

  private requestResponse(e: WebRequestEvent) {
    this.EmitEvent('request', e)
  }

  private scanError(e: ScanError) {
    this.EmitEvent('error', e)
  }

  private functionCall(e: WebFunctionCallEvent) {
    this.EmitEvent('function-call', e)
  }

  private screenshotEvent(e: Screenshot) {
    this.EmitEvent('screenshot', e)
  }

  private htmlSnapshotEvent(e: HtmlSnapshot) {
    this.EmitEvent('html-snapshot', e)
  }
}
