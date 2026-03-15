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
  it('registers a new user and allows reading the bootstrap profile', async () => {
    const app = buildApp()

    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: '新同学', studentNo: '20269999', password: 'secret123' })

    expect(registered.status).toBe(200)
    expect(registered.body.data.name).toBe('新同学')
    expect(registered.body.data.studentNo).toBe('20269999')

    const me = await request(app)
      .get('/api/v1/users/me')
      .set('x-user-name', encoded('新同学'))

    expect(me.status).toBe(200)
    expect(me.body.data.name).toBe('新同学')
    expect(me.body.data.studentNo).toBe('20269999')
  })

  it('rejects duplicate student number registration', async () => {
    const app = buildApp()

    const duplicate = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: '张同学', studentNo: '202301', password: 'secret123' })

    expect(duplicate.status).toBe(409)
    expect(duplicate.body.message).toContain('学号已注册')
  })

  it('supports login by student number and rejects disabled users', async () => {
    const app = buildApp()

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ account: '202301', password: '123456' })

    expect(login.status).toBe(200)
    expect(login.body.data.name).toBe('张同学')
    expect(login.body.data.studentNo).toBe('202301')

    const disabled = await request(app)
      .post('/api/v1/auth/login')
      .send({ account: '202310', password: '123456' })

    expect(disabled.status).toBe(403)
    expect(disabled.body.message).toContain('禁用')
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

  it('marks locked listings as trading so they are not shown as available', async () => {
    const app = buildApp()

    const listings = await request(app)
      .get('/api/v1/listings?page=1&pageSize=200')

    expect(listings.status).toBe(200)
    expect(listings.body.data.list.find((item) => item.id === 3)?.status).toBe('交易中')

    const availableOnly = await request(app)
      .get('/api/v1/listings?status=上架&page=1&pageSize=200')

    expect(availableOnly.status).toBe(200)
    expect(availableOnly.body.data.list.find((item) => item.id === 3)).toBeUndefined()
  })

  it('allows seller confirmation before buyer payment', async () => {
    const app = buildApp()

    const created = await request(app)
      .post('/api/v1/orders')
      .set('x-user-name', encoded('张同学'))
      .send({ listingId: 4 })

    expect(created.status).toBe(200)
    expect(created.body.data.status).toBe('待确认')
    expect(created.body.data.paymentStatus).toBe('未支付')

    const confirmed = await request(app)
      .patch(`/api/v1/orders/${created.body.data.id}/status`)
      .set('x-user-name', encoded('吴同学'))
      .send({ status: '已确认' })

    expect(confirmed.status).toBe(200)
    expect(confirmed.body.data.status).toBe('已确认')
    expect(confirmed.body.data.paymentStatus).toBe('待支付')

    const paid = await request(app)
      .post(`/api/v1/orders/${created.body.data.id}/pay`)
      .set('x-user-name', encoded('张同学'))
      .send({ paymentMethod: '微信支付' })

    expect(paid.status).toBe(200)
    expect(paid.body.data.status).toBe('进行中')
    expect(paid.body.data.paymentStatus).toBe('已支付')
    expect(paid.body.data.paymentMethod).toBe('微信支付')
  })

  it('builds admin dashboard from platform-wide real state changes', async () => {
    const app = buildApp()
    const adminHeaders = { 'x-admin-account': encoded('admin') }

    const before = await request(app)
      .get('/api/v1/admin/dashboard')
      .set(adminHeaders)

    expect(before.status).toBe(200)

    const created = await request(app)
      .post('/api/v1/listings')
      .set('x-user-name', encoded('张同学'))
      .send({
        title: '看板联动测试商品',
        price: 88,
        category: '数码',
        campus: '北校区',
        condition: 9,
        desc: '用于验证后台统计联动',
        shipping: '包邮',
        method: '面交优先',
        images: ['/assets/test-dashboard.jpg'],
        tags: ['联动测试']
      })

    expect(created.status).toBe(200)

    const reviewed = await request(app)
      .post(`/api/v1/admin/listings/${created.body.data.id}/review`)
      .set(adminHeaders)
      .send({ status: '上架' })

    expect(reviewed.status).toBe(200)

    const ordered = await request(app)
      .post('/api/v1/orders')
      .set('x-user-name', encoded('李同学'))
      .send({ listingId: created.body.data.id })

    expect(ordered.status).toBe(200)

    const confirmed = await request(app)
      .patch(`/api/v1/orders/${ordered.body.data.id}/status`)
      .set('x-user-name', encoded('张同学'))
      .send({ status: '已确认' })

    expect(confirmed.status).toBe(200)

    const paid = await request(app)
      .post(`/api/v1/orders/${ordered.body.data.id}/pay`)
      .set('x-user-name', encoded('李同学'))
      .send({ paymentMethod: '微信支付' })

    expect(paid.status).toBe(200)

    const after = await request(app)
      .get('/api/v1/admin/dashboard')
      .set(adminHeaders)

    expect(after.status).toBe(200)
    expect(after.body.data.newItems).toBe(before.body.data.newItems + 1)
    expect(after.body.data.pendingReview).toBe(before.body.data.pendingReview)
    expect(after.body.data.todayItems).toBe(before.body.data.todayItems + 1)
    expect(after.body.data.completedOrders).toBe(before.body.data.completedOrders + 1)
    expect(after.body.data.totalGMV).toBe(before.body.data.totalGMV + 88)
    expect(after.body.data.trendSeries.at(-1)?.items).toBeGreaterThanOrEqual(1)
    expect(after.body.data.trendSeries.at(-1)?.orders).toBeGreaterThanOrEqual(1)
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

  it('reuses the same listing conversation and supports conversation-level read state', async () => {
    const app = buildApp()

    const first = await request(app)
      .post('/api/v1/conversations')
      .set('x-user-name', encoded('张同学'))
      .send({ listingId: 4 })

    const second = await request(app)
      .post('/api/v1/conversations')
      .set('x-user-name', encoded('张同学'))
      .send({ listingId: 4 })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body.data.id).toBe(first.body.data.id)

    const marked = await request(app)
      .patch(`/api/v1/conversations/${first.body.data.id}/read`)
      .set('x-user-name', encoded('张同学'))

    expect(marked.status).toBe(200)
    expect(marked.body.data.unreadCount).toBe(0)
  })

  it('creates and marks system notifications across listing and order lifecycle', async () => {
    const app = buildApp()
    const adminHeaders = { 'x-admin-account': encoded('admin') }

    const created = await request(app)
      .post('/api/v1/listings')
      .set('x-user-name', encoded('张同学'))
      .send({
        title: '通知链路测试商品',
        price: 66,
        category: '数码',
        campus: '北校区',
        condition: 9,
        desc: '验证系统消息是否完整',
        shipping: '包邮',
        method: '面交优先',
        images: ['/assets/test-notify.jpg']
      })

    expect(created.status).toBe(200)

    const sellerNotificationsAfterCreate = await request(app)
      .get('/api/v1/notifications')
      .set('x-user-name', encoded('张同学'))

    expect(sellerNotificationsAfterCreate.status).toBe(200)
    expect(sellerNotificationsAfterCreate.body.data.list.some((item) => item.title === '商品已提交审核')).toBe(true)

    const reviewed = await request(app)
      .post(`/api/v1/admin/listings/${created.body.data.id}/review`)
      .set(adminHeaders)
      .send({ status: '上架' })

    expect(reviewed.status).toBe(200)

    const ordered = await request(app)
      .post('/api/v1/orders')
      .set('x-user-name', encoded('李同学'))
      .send({ listingId: created.body.data.id })

    expect(ordered.status).toBe(200)

    const confirmed = await request(app)
      .patch(`/api/v1/orders/${ordered.body.data.id}/status`)
      .set('x-user-name', encoded('张同学'))
      .send({ status: '已确认' })

    expect(confirmed.status).toBe(200)

    const paid = await request(app)
      .post(`/api/v1/orders/${ordered.body.data.id}/pay`)
      .set('x-user-name', encoded('李同学'))
      .send({ paymentMethod: '微信支付' })

    expect(paid.status).toBe(200)

    const finished = await request(app)
      .patch(`/api/v1/orders/${ordered.body.data.id}/status`)
      .set('x-user-name', encoded('张同学'))
      .send({ status: '已完成' })

    expect(finished.status).toBe(200)

    const buyerNotifications = await request(app)
      .get('/api/v1/notifications')
      .set('x-user-name', encoded('李同学'))

    expect(buyerNotifications.status).toBe(200)
    expect(buyerNotifications.body.data.list.some((item) => item.title === '订单已创建')).toBe(true)
    expect(buyerNotifications.body.data.list.some((item) => item.title === '卖家已确认订单')).toBe(true)
    expect(buyerNotifications.body.data.list.some((item) => item.title === '付款成功')).toBe(true)
    expect(buyerNotifications.body.data.list.some((item) => item.title === '订单已完成')).toBe(true)

    const firstUnreadNotification = buyerNotifications.body.data.list.find((item) => !item.read)
    expect(firstUnreadNotification).toBeTruthy()

    const markRead = await request(app)
      .patch(`/api/v1/notifications/${firstUnreadNotification.id}/read`)
      .set('x-user-name', encoded('李同学'))

    expect(markRead.status).toBe(200)
    expect(markRead.body.data.read).toBe(true)
  })

  it('rejects invalid register and listing payload with structured field details', async () => {
    const app = buildApp()

    const invalidRegister = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'abc???', studentNo: '12ab', password: '123' })

    expect(invalidRegister.status).toBe(400)
    expect(Array.isArray(invalidRegister.body.details)).toBe(true)
    expect(invalidRegister.body.details.length).toBeGreaterThan(0)

    const invalidListing = await request(app)
      .post('/api/v1/listings')
      .set('x-user-name', encoded('202301'))
      .send({
        title: 'test listing',
        price: 1,
        category: 'unknown-category',
        campus: '北校区',
        condition: 9,
        desc: 'desc',
        shipping: '包邮',
        method: '面交优先',
        images: ['/assets/t.jpg']
      })

    expect(invalidListing.status).toBe(400)
    expect(Array.isArray(invalidListing.body.details)).toBe(true)
    expect(invalidListing.body.details.some((item) => item.field === 'category')).toBe(true)
  })

  it('rejects invalid listing status transitions for review and manual status update', async () => {
    const app = buildApp()
    const adminHeaders = { 'x-admin-account': encoded('admin') }

    const created = await request(app)
      .post('/api/v1/listings')
      .set('x-user-name', encoded('202301'))
      .send({
        title: 'status check item',
        price: 88,
        category: '数码',
        campus: '北校区',
        condition: 9,
        desc: 'status validation',
        shipping: '包邮',
        method: '面交优先',
        images: ['/assets/status.jpg']
      })

    expect(created.status).toBe(200)

    const invalidReview = await request(app)
      .post(`/api/v1/admin/listings/${created.body.data.id}/review`)
      .set(adminHeaders)
      .send({ status: '交易中' })

    expect(invalidReview.status).toBe(400)
    expect(Array.isArray(invalidReview.body.details)).toBe(true)

    const invalidManualStatus = await request(app)
      .patch(`/api/v1/listings/${created.body.data.id}/status`)
      .set('x-user-name', encoded('202301'))
      .send({ status: '已售' })

    expect(invalidManualStatus.status).toBe(400)
    expect(Array.isArray(invalidManualStatus.body.details)).toBe(true)
  })

  it('allows admin to force offline a violating listing and notifies the seller', async () => {
    const app = buildApp()
    const adminHeaders = { 'x-admin-account': encoded('admin') }

    const reviewed = await request(app)
      .post('/api/v1/admin/listings/4/review')
      .set(adminHeaders)
      .send({ status: '上架' })

    expect(reviewed.status).toBe(200)

    const violated = await request(app)
      .patch('/api/v1/admin/listings/4/violation')
      .set(adminHeaders)
      .send({ reason: 'bad listing' })

    expect(violated.status).toBe(200)
    expect(violated.body.data.status).not.toBe(reviewed.body.data.status)
    expect(violated.body.data.reviewRemark).toBe('bad listing')

    const notifications = await request(app)
      .get('/api/v1/notifications')
      .set('x-user-name', encoded(violated.body.data.seller))

    expect(notifications.status).toBe(200)
    expect(notifications.body.data.list.some((item) => String(item.content || '').includes('bad listing'))).toBe(true)
  })
})
