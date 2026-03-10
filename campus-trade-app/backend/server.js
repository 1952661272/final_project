import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { createRepository } from './repository.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = resolve(__dirname, 'data/state.json')
const PORT = Number(process.env.API_PORT || 3001)
const STATE_DRIVER = process.env.STATE_DRIVER || (process.env.MYSQL_URL ? 'mysql' : 'json')

const repository = createRepository({
  dataFile: DATA_FILE,
  mysqlUrl: process.env.MYSQL_URL,
  driver: STATE_DRIVER
})

await repository.init()

const app = createApp(repository)

app.listen(PORT, () => {
  console.log(`[api] campus-trade backend listening on http://127.0.0.1:${PORT}`)
  console.log(`[api] state driver: ${STATE_DRIVER}`)
})
