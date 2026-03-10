import { JsonStateStore, MysqlStateStore } from './stateStore.js'
import { createSeedState, migrateLegacyState } from './seedState.js'

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
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
    await this.store.save(this.state)
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
}

export function createRepository({ dataFile, mysqlUrl, driver }) {
  const selectedDriver = driver || (mysqlUrl ? 'mysql' : 'json')
  const store = selectedDriver === 'mysql'
    ? new MysqlStateStore(mysqlUrl)
    : new JsonStateStore(dataFile)
  return new DomainRepository(store)
}
