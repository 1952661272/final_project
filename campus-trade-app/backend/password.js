import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const HASH_PREFIX = 'scrypt'
const KEY_LENGTH = 64

export function hashPassword(password) {
  const value = String(password || '').trim()
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(value, salt, KEY_LENGTH).toString('hex')
  return `${HASH_PREFIX}$${salt}$${hash}`
}

export function verifyPassword(password, encodedHash) {
  const value = String(password || '').trim()
  const raw = String(encodedHash || '')
  const [prefix, salt, storedHash] = raw.split('$')
  if (prefix !== HASH_PREFIX || !salt || !storedHash) return false

  const candidateHash = scryptSync(value, salt, KEY_LENGTH)
  const existingHash = Buffer.from(storedHash, 'hex')
  if (candidateHash.length !== existingHash.length) return false
  return timingSafeEqual(candidateHash, existingHash)
}
