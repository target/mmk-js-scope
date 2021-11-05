/* tslint:disable */
/* eslint-disable */
declare module "node-config-ts" {
  interface IConfig {
    redis: Redis
    puppeteer: Puppeteer
  }
  interface Puppeteer {
    args: string[]
    timeout: number
  }
  interface Redis {
    uri: undefined
    useSentinel: undefined
    nodes: string[]
    sentinelPort: undefined
    master: undefined
    sentinelPassword: undefined
  }
  export const config: Config
  export type Config = IConfig
}
