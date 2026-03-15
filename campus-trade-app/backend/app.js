import express from 'express'
import { DomainService } from './service.js'

function ok(res, data = {}) {
  res.json({ ok: true, data })
}

function fail(res, status, message) {
  res.status(status).json({ ok: false, message })
}

function currentUserName(req) {
  const raw = String(req.headers['x-user-name'] || req.query.userName || '').trim()
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function currentAdminAccount(req) {
  const raw = String(req.headers['x-admin-account'] || req.query.adminAccount || '').trim()
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function asyncHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      fail(res, error.status || 500, error.message || 'internal server error')
    }
  }
}

export function createApp(repository) {
  const service = new DomainService(repository)
  const app = express()
  const sseClients = new Set()

  const publishEvent = (event, payload = {}) => {
    const body = `event: ${event}\ndata: ${JSON.stringify({ event, ...payload, ts: Date.now() })}\n\n`
    for (const client of sseClients) {
      client.res.write(body)
    }
  }

  app.use(express.json({ limit: '12mb' }))

  app.get('/api/health', asyncHandler(async (req, res) => {
    ok(res, await service.health())
  }))

  app.get('/api/v1/events/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    const client = { res }
    sseClients.add(client)
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, ts: Date.now() })}\n\n`)

    const timer = setInterval(() => {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`)
    }, 15000)

    req.on('close', () => {
      clearInterval(timer)
      sseClients.delete(client)
      res.end()
    })
  })

  app.post('/api/v1/auth/login', asyncHandler(async (req, res) => {
    ok(res, await service.login(req.body?.account, req.body?.password))
  }))

  app.post('/api/v1/auth/register', asyncHandler(async (req, res) => {
    ok(res, await service.register(req.body?.username, req.body?.studentNo, req.body?.password))
  }))

  app.post('/api/v1/auth/admin-login', asyncHandler(async (req, res) => {
    ok(res, await service.adminLogin(req.body?.account, req.body?.password))
  }))

  app.post('/api/v1/auth/logout', asyncHandler(async (req, res) => {
    ok(res, { loggedOut: true })
  }))

  app.get('/api/v1/users/me', asyncHandler(async (req, res) => {
    ok(res, await service.getCurrentUser(currentUserName(req)))
  }))

  app.get('/api/v1/users', asyncHandler(async (req, res) => {
    ok(res, await service.listUsers())
  }))

  app.get('/api/v1/admin/users', asyncHandler(async (req, res) => {
    ok(res, await service.listAdminUsers(currentAdminAccount(req), req.query || {}))
  }))

  app.get('/api/v1/admin/notifications', asyncHandler(async (req, res) => {
    ok(res, await service.listAdminNotifications(currentAdminAccount(req)))
  }))

  app.post('/api/v1/users/verify', asyncHandler(async (req, res) => {
    ok(res, await service.verifyCurrentUser(currentUserName(req)))
  }))

  app.patch('/api/v1/admin/users/:userId/status', asyncHandler(async (req, res) => {
    ok(res, await service.updateUserStatus(currentAdminAccount(req), req.params.userId, req.body?.status))
    publishEvent('admin.updated')
  }))

  app.get('/api/v1/admin/dashboard', asyncHandler(async (req, res) => {
    ok(res, await service.getAdminDashboard(currentAdminAccount(req), req.query || {}))
  }))

  app.get('/api/v1/favorites', asyncHandler(async (req, res) => {
    ok(res, { favorites: await service.listFavorites(currentUserName(req)) })
  }))

  app.get('/api/v1/listings', asyncHandler(async (req, res) => {
    ok(res, await service.listListings(req.query))
  }))

  app.post('/api/v1/listings', asyncHandler(async (req, res) => {
    ok(res, await service.createListing(currentUserName(req), req.body || {}))
    publishEvent('listings.updated')
    publishEvent('admin.updated')
  }))

  app.get('/api/v1/listings/:listingId', asyncHandler(async (req, res) => {
    ok(res, await service.getListing(req.params.listingId))
  }))

  app.patch('/api/v1/listings/:listingId', asyncHandler(async (req, res) => {
    ok(res, await service.updateListing(currentUserName(req), req.params.listingId, req.body || {}))
    publishEvent('listings.updated')
  }))

  app.patch('/api/v1/listings/:listingId/status', asyncHandler(async (req, res) => {
    ok(res, await service.updateListingStatus(currentUserName(req), req.params.listingId, req.body?.status))
    publishEvent('listings.updated')
    publishEvent('admin.updated')
  }))

  app.post('/api/v1/listings/:listingId/favorite', asyncHandler(async (req, res) => {
    ok(res, { favorites: await service.addFavorite(currentUserName(req), req.params.listingId) })
  }))

  app.delete('/api/v1/listings/:listingId/favorite', asyncHandler(async (req, res) => {
    ok(res, { favorites: await service.removeFavorite(currentUserName(req), req.params.listingId) })
  }))

  app.post('/api/v1/admin/listings/:listingId/review', asyncHandler(async (req, res) => {
    ok(res, await service.reviewListing(currentAdminAccount(req), req.params.listingId, req.body?.status, req.body?.reason))
    publishEvent('listings.updated')
    publishEvent('inbox.updated')
    publishEvent('admin.updated')
  }))

  app.patch('/api/v1/admin/listings/:listingId/violation', asyncHandler(async (req, res) => {
    ok(res, await service.markListingViolation(currentAdminAccount(req), req.params.listingId, req.body?.reason))
    publishEvent('listings.updated')
    publishEvent('inbox.updated')
    publishEvent('admin.updated')
  }))

  app.post('/api/v1/orders', asyncHandler(async (req, res) => {
    ok(res, await service.createOrder(currentUserName(req), req.body?.listingId))
    publishEvent('orders.updated')
    publishEvent('inbox.updated')
    publishEvent('listings.updated')
    publishEvent('admin.updated')
  }))

  app.get('/api/v1/orders', asyncHandler(async (req, res) => {
    ok(res, await service.listOrders(currentUserName(req), String(req.query.role || 'buyer'), String(req.query.status || '').trim()))
  }))

  app.get('/api/v1/orders/:orderId', asyncHandler(async (req, res) => {
    ok(res, await service.getOrder(currentUserName(req), req.params.orderId))
  }))

  app.get('/api/v1/order-logs/:orderId', asyncHandler(async (req, res) => {
    ok(res, await service.getOrderLogs(currentUserName(req), req.params.orderId))
  }))

  app.post('/api/v1/orders/:orderId/pay', asyncHandler(async (req, res) => {
    ok(res, await service.payOrder(currentUserName(req), req.params.orderId, req.body?.paymentMethod))
    publishEvent('orders.updated')
    publishEvent('inbox.updated')
    publishEvent('admin.updated')
  }))

  app.patch('/api/v1/orders/:orderId/status', asyncHandler(async (req, res) => {
    ok(res, await service.updateOrderStatus(currentUserName(req), req.params.orderId, req.body?.status, req.body?.reason))
    publishEvent('orders.updated')
    publishEvent('inbox.updated')
    publishEvent('listings.updated')
    publishEvent('admin.updated')
  }))

  app.get('/api/v1/conversations', asyncHandler(async (req, res) => {
    ok(res, await service.listConversations(currentUserName(req)))
  }))

  app.post('/api/v1/conversations', asyncHandler(async (req, res) => {
    ok(res, await service.createConversation(currentUserName(req), req.body?.listingId))
  }))

  app.patch('/api/v1/conversations/:conversationId/read', asyncHandler(async (req, res) => {
    ok(res, await service.markConversationRead(currentUserName(req), req.params.conversationId))
    publishEvent('inbox.updated')
  }))

  app.patch('/api/v1/conversations/:conversationId/pin', asyncHandler(async (req, res) => {
    ok(res, await service.updateConversationPin(currentUserName(req), req.params.conversationId, !!req.body?.pinned))
    publishEvent('inbox.updated')
  }))

  app.get('/api/v1/conversations/:conversationId/messages', asyncHandler(async (req, res) => {
    ok(res, await service.getConversationMessages(currentUserName(req), req.params.conversationId))
  }))

  app.post('/api/v1/conversations/:conversationId/messages', asyncHandler(async (req, res) => {
    ok(res, await service.sendMessage(currentUserName(req), req.params.conversationId, req.body?.text))
    publishEvent('inbox.updated')
  }))

  app.patch('/api/v1/messages/:messageId/read', asyncHandler(async (req, res) => {
    ok(res, await service.markMessageRead(currentUserName(req), req.params.messageId))
    publishEvent('inbox.updated')
  }))

  app.get('/api/v1/notifications', asyncHandler(async (req, res) => {
    ok(res, await service.listNotifications(currentUserName(req)))
  }))

  app.patch('/api/v1/notifications/:notificationId/read', asyncHandler(async (req, res) => {
    ok(res, await service.markNotificationRead(currentUserName(req), req.params.notificationId))
    publishEvent('inbox.updated')
  }))

  return app
}
