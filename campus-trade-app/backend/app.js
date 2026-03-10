import express from 'express'
import { DomainService } from './service.js'

function ok(res, data = {}) {
  res.json({ ok: true, data })
}

function fail(res, status, message) {
  res.status(status).json({ ok: false, message })
}

function currentUserName(req) {
  const raw = String(req.headers['x-user-name'] || '').trim()
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function currentAdminAccount(req) {
  const raw = String(req.headers['x-admin-account'] || '').trim()
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

  app.use(express.json({ limit: '12mb' }))

  app.get('/api/health', asyncHandler(async (req, res) => {
    ok(res, await service.health())
  }))

  app.post('/api/v1/auth/login', asyncHandler(async (req, res) => {
    ok(res, await service.login(req.body?.name))
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

  app.post('/api/v1/users/verify', asyncHandler(async (req, res) => {
    ok(res, await service.verifyCurrentUser(currentUserName(req)))
  }))

  app.patch('/api/v1/admin/users/:userId/status', asyncHandler(async (req, res) => {
    ok(res, await service.updateUserStatus(currentAdminAccount(req), req.params.userId, req.body?.status))
  }))

  app.get('/api/v1/favorites', asyncHandler(async (req, res) => {
    ok(res, { favorites: await service.listFavorites(currentUserName(req)) })
  }))

  app.get('/api/v1/listings', asyncHandler(async (req, res) => {
    ok(res, await service.listListings(req.query))
  }))

  app.post('/api/v1/listings', asyncHandler(async (req, res) => {
    ok(res, await service.createListing(currentUserName(req), req.body || {}))
  }))

  app.get('/api/v1/listings/:listingId', asyncHandler(async (req, res) => {
    ok(res, await service.getListing(req.params.listingId))
  }))

  app.patch('/api/v1/listings/:listingId', asyncHandler(async (req, res) => {
    ok(res, await service.updateListing(currentUserName(req), req.params.listingId, req.body || {}))
  }))

  app.patch('/api/v1/listings/:listingId/status', asyncHandler(async (req, res) => {
    ok(res, await service.updateListingStatus(currentUserName(req), req.params.listingId, req.body?.status))
  }))

  app.post('/api/v1/listings/:listingId/favorite', asyncHandler(async (req, res) => {
    ok(res, { favorites: await service.addFavorite(currentUserName(req), req.params.listingId) })
  }))

  app.delete('/api/v1/listings/:listingId/favorite', asyncHandler(async (req, res) => {
    ok(res, { favorites: await service.removeFavorite(currentUserName(req), req.params.listingId) })
  }))

  app.post('/api/v1/admin/listings/:listingId/review', asyncHandler(async (req, res) => {
    ok(res, await service.reviewListing(currentAdminAccount(req), req.params.listingId, req.body?.status, req.body?.reason))
  }))

  app.post('/api/v1/orders', asyncHandler(async (req, res) => {
    ok(res, await service.createOrder(currentUserName(req), req.body?.listingId))
  }))

  app.get('/api/v1/orders', asyncHandler(async (req, res) => {
    ok(res, await service.listOrders(currentUserName(req), String(req.query.role || 'buyer'), String(req.query.status || '').trim()))
  }))

  app.get('/api/v1/orders/:orderId', asyncHandler(async (req, res) => {
    ok(res, await service.getOrder(currentUserName(req), req.params.orderId))
  }))

  app.patch('/api/v1/orders/:orderId/status', asyncHandler(async (req, res) => {
    ok(res, await service.updateOrderStatus(currentUserName(req), req.params.orderId, req.body?.status))
  }))

  app.get('/api/v1/conversations', asyncHandler(async (req, res) => {
    ok(res, await service.listConversations(currentUserName(req)))
  }))

  app.post('/api/v1/conversations', asyncHandler(async (req, res) => {
    ok(res, await service.createConversation(currentUserName(req), req.body?.listingId))
  }))

  app.get('/api/v1/conversations/:conversationId/messages', asyncHandler(async (req, res) => {
    ok(res, await service.getConversationMessages(currentUserName(req), req.params.conversationId))
  }))

  app.post('/api/v1/conversations/:conversationId/messages', asyncHandler(async (req, res) => {
    ok(res, await service.sendMessage(currentUserName(req), req.params.conversationId, req.body?.text))
  }))

  app.patch('/api/v1/messages/:messageId/read', asyncHandler(async (req, res) => {
    ok(res, await service.markMessageRead(currentUserName(req), req.params.messageId))
  }))

  return app
}
