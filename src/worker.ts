import Bull, { Queue, Job } from 'bull'
import { config } from 'node-config-ts'
import vmRunner from './lib/vm-runner'
import BullWorker from './lib/bull-worker'

import { createClient } from './lib/redis'
import { EventResult } from '@merrymaker/types'

const redisClient = createClient()

const browserWorker = new vmRunner()

const browserEventWorker = new Bull<EventResult>('browser-event-queue', {
  createClient
})

const scannerWorker: Queue = new Bull('scanner-queue', {
  createClient
})

const scannerEventQueue = new Bull<EventResult>('scan-log-queue', {
  createClient
})

browserWorker.browserEvent.on('scan-event', (evt: EventResult) => {
  browserEventWorker.add(evt, {
    removeOnComplete: true
  })
})

async function work(job: Job) {
  const source = await redisClient.get(`source:${job.data.source_id}`)
  if (!source) {
    await job.discard()
    throw new Error('No source')
  }
  return browserWorker.runner({
    code: source,
    scan_id: job.data.scan_id,
    test: job.data.test,
    config: {
      browserAgs: config.puppeteer.args,
      timeout: config.puppeteer.timeout
    }
  })
}

const jobManager = new BullWorker(3000, scannerWorker, work)

jobManager.on('info', console.log)
jobManager.on('error', console.error)

jobManager.on('failed', (job: Job) => {
  scannerEventQueue.add({
    entry: 'failed',
    scan_id: job.data.scan_id,
    level: 'error',
    event: { message: job.failedReason }
  })
})
;(async () => {
  console.log('waiting for queues')
  await browserEventWorker.isReady()
  await scannerWorker.isReady()
  await jobManager.poll()
})()
