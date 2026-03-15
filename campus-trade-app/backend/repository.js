import { JsonStateStore, MysqlStateStore } from './stateStore.js'
import { createSeedState, migrateLegacyState } from './seedState.js'

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function getToday() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function nextStudentUserId(state) {
  const maxId = state.users
    .filter((user) => /^U\d+$/.test(user.id))
    .reduce((max, user) => Math.max(max, Number(user.id.slice(1))), 0)
  return `U${String(maxId + 1).padStart(2, '0')}`
}

function buildAuthUserFromStateUser(user) {
  return {
    name: user.name,
    studentNo: user.studentNo || '',
    status: user.status || '正常',
    campus: user.campus || '未设置校区',
    credit: Number(user.credit) || 5,
    verified: !!user.verified,
    role: user.role || 'student',
    reg: user.reg || getToday()
  }
}

function findStateUserByStudentNo(state, studentNo) {
  const keyword = String(studentNo || '').trim()
  if (!keyword) return null
  return state.users.find((user) => user.studentNo === keyword) || null
}

function registerStateUser(state, { username, studentNo, password }) {
  const actualName = String(username || '').trim()
  const actualStudentNo = String(studentNo || '').trim()
  const actualPassword = String(password || '').trim()

  if (state.users.some((user) => user.studentNo === actualStudentNo)) {
    const error = new Error('学号已注册')
    error.status = 409
    throw error
  }

  const created = {
    id: nextStudentUserId(state),
    name: actualName,
    account: actualStudentNo,
    password: actualPassword,
    status: '正常',
    campus: '未设置校区',
    credit: 5,
    verified: false,
    reg: getToday(),
    role: 'student',
    studentNo: actualStudentNo
  }
  state.users.push(created)
  return created
}

function authenticateStateUser(state, account, password) {
  const actualAccount = String(account || '').trim()
  const actualPassword = String(password || '').trim()
  const user = state.users.find((candidate) => candidate.studentNo === actualAccount)

  if (!user || String(user.password || '123456') !== actualPassword) {
    const error = new Error('学号或密码错误')
    error.status = 401
    throw error
  }

  return buildAuthUserFromStateUser(user)
}

function syncStateUserFromAuthUser(state, authUser) {
  let user = findStateUserByStudentNo(state, authUser.studentNo)
  if (!user) {
    user = {
      id: nextStudentUserId(state),
      password: '',
      role: authUser.role || 'student'
    }
    state.users.push(user)
  }

  user.name = authUser.name
  user.account = authUser.studentNo || authUser.name
  user.status = authUser.status || '正常'
  user.campus = authUser.campus || '未设置校区'
  user.credit = Number(authUser.credit) || user.credit || 5
  user.verified = !!authUser.verified
  user.reg = authUser.reg || user.reg || getToday()
  user.role = authUser.role || user.role || 'student'
  user.studentNo = authUser.studentNo || user.studentNo || ''

  return user
}

export class DomainRepository {
  constructor(store) {
    this.store = store
    this.state = null
  }

  async init() {
    await this.store.init()
    const loaded = await this.store.load()
    this.state = migrateLegacyState(loaded)
    if (typeof this.store.seedAuthUsers === 'function') {
      await this.store.seedAuthUsers(this.state.users)
    }
    if (this.store.persistOnInit !== false) {
      await this.store.save(this.state)
    }
  }

  async read() {
    if (!this.state) await this.init()
    return deepClone(this.state)
  }

  async write(mutator) {
    if (!this.state) await this.init()
    const draft = deepClone(this.state)
    const result = await mutator(draft)
    this.state = draft
    await this.store.save(this.state)
    return result
  }

  async registerAuthUser(payload) {
    if (typeof this.store.registerAuthUser === 'function') {
      return this.store.registerAuthUser(payload)
    }

    return this.write((state) => buildAuthUserFromStateUser(registerStateUser(state, payload)))
  }

  async authenticateAuthUser(account, password) {
    if (typeof this.store.authenticateAuthUser === 'function') {
      return this.store.authenticateAuthUser(account, password)
    }

    const state = await this.read()
    return authenticateStateUser(state, account, password)
  }

  async syncStateUserFromAuthUser(authUser) {
    return this.write((state) => syncStateUserFromAuthUser(state, authUser))
  }

  async updateAuthUserStatus(user) {
    if (typeof this.store.updateAuthUserStatus === 'function') {
      await this.store.updateAuthUserStatus(user.studentNo, user.status)
    }
  }

  async updateAuthUserVerification(user) {
    if (typeof this.store.updateAuthUserVerification === 'function') {
      await this.store.updateAuthUserVerification(user.studentNo, user.verified)
    }
  }
}

export class InMemoryDomainRepository {
  constructor(seed = createSeedState()) {
    this.state = deepClone(seed)
  }

  async init() {}

  async read() {
    return deepClone(this.state)
  }

  async write(mutator) {
    const draft = deepClone(this.state)
    const result = await mutator(draft)
    this.state = draft
    return result
  }

  async registerAuthUser(payload) {
    return this.write((state) => buildAuthUserFromStateUser(registerStateUser(state, payload)))
  }

  async authenticateAuthUser(account, password) {
    const state = await this.read()
    return authenticateStateUser(state, account, password)
  }

  async syncStateUserFromAuthUser(authUser) {
    return this.write((state) => syncStateUserFromAuthUser(state, authUser))
  }

  async updateAuthUserStatus() {}

  async updateAuthUserVerification() {}
}

export function createRepository({ dataFile, mysqlUrl, driver }) {
  const selectedDriver = driver || (mysqlUrl ? 'mysql' : 'json')
  const store = selectedDriver === 'mysql'
    ? new MysqlStateStore(mysqlUrl)
    : new JsonStateStore(dataFile)
  return new DomainRepository(store)
}
