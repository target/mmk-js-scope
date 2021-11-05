/** Test Server */

import Koa from 'koa'
import serve from 'koa-static'

const app = new Koa();

app.use(serve('./src/tests/fixtures'))

export default app
