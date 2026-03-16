import process from 'node:process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadLocalEnv({ cwd = process.cwd(), fileName = '.env.local', env = process.env } = {}) {
  const envPath = resolve(cwd, fileName)
  if (!existsSync(envPath)) return false

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    if (!key || env[key]) continue

    env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }

  return true
}

export function deriveMysqlRootUrl(rawUrl) {
  const url = new URL(String(rawUrl).trim())
  url.pathname = '/'
  url.search = ''
  url.hash = ''
  return url.toString()
}

export function ensureTestMysqlUrlFromMysqlUrl(env = process.env) {
  const explicitTestMysqlUrl = String(env.TEST_MYSQL_URL || '').trim()
  if (explicitTestMysqlUrl) return explicitTestMysqlUrl

  const mysqlUrl = String(env.MYSQL_URL || '').trim()
  if (!mysqlUrl) return ''

  const derivedTestMysqlUrl = deriveMysqlRootUrl(mysqlUrl)
  env.TEST_MYSQL_URL = derivedTestMysqlUrl
  return derivedTestMysqlUrl
}
