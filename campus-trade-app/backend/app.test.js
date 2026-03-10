import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { InMemoryDomainRepository } from './repository.js'
import { createSeedState } from './seedState.js'

function buildApp() {
  return createApp(new InMemoryDomainRepository(createSeedState()))
}

function encoded(value) {
  return encodeURIComponent(value)
}

describe('campus trade api', () => {
  it('supports login and user bootstrap flow', async () => {
    const app = buildApp()

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ name: '张同学' })

    expect(login.status).toBe(200)
    expect(login.body.data.name).toBe('张同学')

    const me = await request(app)
      .get('/api/v1/users/me')
      .set('x-user-name', encoded('张同学'))

    expect(me.status).toBe(200)
    expect(me.body.data.name).toBe('张同学')
  })

  it('creates pending listing with tags and allows admin review to publish', async () => {
    const app = buildApp()

    const created = await request(app)
      .post('/api/v1/listings')
      .set('x-user-name', encoded('张同学'))
      .send({
        title: '测试耳机',
        price: 199,
        category: '数码',
        campus: '北校区',
        condition: 9,
        desc: 'TDD 发布测试',
        shipping: '包邮',
        method: '面交优先',
        images: ['/assets/test.jpg'],
        tags: ['新发布', '包邮']
      })

    expect(created.status).toBe(200)
    expect(created.body.data.status).toBe('待审核')
    expect(created.body.data.tags).toEqual(['新发布', '包邮'])

    const visibleBeforeReview = await request(app)
      .get('/api/v1/listings?status=上架')

    expect(visibleBeforeReview.body.data.list.find((item) => item.title === '测试耳机')).toBeUndefined()

    const reviewed = await request(app)
      .post(`/api/v1/admin/listings/${created.body.data.id}/review`)
      .set('x-admin-account', encoded('admin'))
      .send({ status: '上架' })

    expect(reviewed.status).toBe(200)
    expect(reviewed.body.data.status).toBe('上架')

    const visibleAfterReview = await request(app)
      .get('/api/v1/listings?status=上架')

    expect(visibleAfterReview.body.data.list.find((item) => item.title === '测试耳机')).toBeTruthy()
  })

  it('rejects duplicate active orders for the same listing', async () => {
    const app = buildApp()

    const first = await request(app)
      .post('/api/v1/orders')
      .set('x-user-name', encoded('张同学'))
      .send({ listingId: 4 })

    expect(first.status).toBe(200)
    expect(first.body.data.status).toBe('待确认')

    const duplicate = await request(app)
      .post('/api/v1/orders')
      .set('x-user-name', encoded('李同学'))
      .send({ listingId: 4 })

    expect(duplicate.status).toBe(409)
    expect(duplicate.body.message).toContain('进行中的订单')
  })

  it('creates listing-scoped conversation, sends messages and marks them read', async () => {
    const app = buildApp()

    const conversation = await request(app)
      .post('/api/v1/conversations')
      .set('x-user-name', encoded('张同学'))
      .send({ listingId: 4 })

    expect(conversation.status).toBe(200)
    expect(conversation.body.data.listingId).toBe(4)
    expect(conversation.body.data.listingTitle).toBeTruthy()

    const sent = await request(app)
      .post(`/api/v1/conversations/${conversation.body.data.id}/messages`)
      .set('x-user-name', encoded('张同学'))
      .send({ text: '请问今晚可以面交吗？' })

    expect(sent.status).toBe(200)
    expect(sent.body.data.text).toBe('请问今晚可以面交吗？')

    const messages = await request(app)
      .get(`/api/v1/conversations/${conversation.body.data.id}/messages`)
      .set('x-user-name', encoded('张同学'))

    expect(messages.status).toBe(200)
    expect(messages.body.data.list.length).toBeGreaterThan(1)

    const firstUnread = messages.body.data.list.find((message) => message.from === 'other')
    expect(firstUnread).toBeTruthy()

    const marked = await request(app)
      .patch(`/api/v1/messages/${firstUnread.id}/read`)
      .set('x-user-name', encoded('张同学'))

    expect(marked.status).toBe(200)
    expect(marked.body.data.read).toBe(true)
  })
})
