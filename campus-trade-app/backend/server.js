import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { createApp } from './app.js'
import { createRepository } from './repository.js'

function loadDotEnvIfPresent() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    if (!key || process.env[key]) continue
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
}

loadDotEnvIfPresent()

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
