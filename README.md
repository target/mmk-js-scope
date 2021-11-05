```
   _
  (_)___       ___  ___ ___  _ __   ___
  | / __|_____/ __|/ __/ _ \| '_ \ / _ \
  | \__ \_____\__ \ (_| (_) | |_) |  __/
 _/ |___/     |___/\___\___/| .__/ \___|
|__/                        |_|
v2.0
```

# About

Enumerates javascript requests and hooks native function calls with Headless Chrome.

# Setup

```bash
yarn install
```

## Config


__redis__

The default configs point to localhost for the redis server (scan queue).

__puppeteer__

Replace default startup arguments as needed (proxy/sandbox)

```
    "args": [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--single-process",
      "--no-zygote"
    ],
    "timeout": 300000
```


Depends on the MerryMaker Scan queue for tasking jobs and queueing results.

## Running

```bash
yarn start
```

## Building

```bash
yarn build
```

## Linting

```bash
yarn lint
```

## Testing

Start the test web server

```
yarn start-test
```

Run Jest

```bash
yarn jest
```

# Events

- `console-message` - catches and relays console messages
- `log-message` - user defined log message for debugging and tracking state
- `complete` - fired once the site flow has completed
- `pageError` - the page threw an error
- `pageCookies` - tracks cookies
- `workerCreated` - tracks web workers
- `scriptRequest` - tracks javascript request events
- `responseError` - occurs when a request failed
- `requestResponse` - contains details of a request and response
- `scanError` - fired when the scan itself fails to complete
- `functionCall` - tracks hooked native function calls
- `screenshotEvent` - contains a base64 encoded screenshot for tracing the site flow

---

```
Copyright (c) 2021 Target Brands, Inc.
```
