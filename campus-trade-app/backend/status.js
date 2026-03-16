export const LISTING_STATUS = {
  DRAFT: '草稿',
  PENDING: '待审核',
  PUBLISHED: '上架',
  SOLD: '已售',
  OFFLINE: '下架',
  REJECTED: '驳回',
  TRADING: '交易中'
}

export const ORDER_STATUS = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REJECTED: '已拒绝'
}

export const PAYMENT_STATUS = {
  UNPAID: '未支付',
  PENDING: '待支付',
  PAID: '已支付'
}

export const VERIFY_STATUS = {
  PENDING: '待审核',
  APPROVED: '通过',
  REJECTED: '驳回'
}

export const LISTING_STATUS_TO_CODE = {
  [LISTING_STATUS.DRAFT]: 0,
  [LISTING_STATUS.PENDING]: 1,
  [LISTING_STATUS.PUBLISHED]: 2,
  [LISTING_STATUS.SOLD]: 3,
  [LISTING_STATUS.OFFLINE]: 4,
  [LISTING_STATUS.REJECTED]: 5
}

export const ORDER_STATUS_TO_CODE = {
  [ORDER_STATUS.PENDING]: 0,
  [ORDER_STATUS.CONFIRMED]: 1,
  [ORDER_STATUS.IN_PROGRESS]: 2,
  [ORDER_STATUS.COMPLETED]: 3,
  [ORDER_STATUS.CANCELLED]: 4,
  [ORDER_STATUS.REJECTED]: 5
}

export const PAYMENT_STATUS_TO_CODE = {
  [PAYMENT_STATUS.UNPAID]: 0,
  [PAYMENT_STATUS.PENDING]: 1,
  [PAYMENT_STATUS.PAID]: 2
}

export const VERIFY_STATUS_TO_CODE = {
  [VERIFY_STATUS.PENDING]: 0,
  [VERIFY_STATUS.APPROVED]: 1,
  [VERIFY_STATUS.REJECTED]: 2
}

export const LISTING_CODE_TO_STATUS = Object.fromEntries(
  Object.entries(LISTING_STATUS_TO_CODE).map(([label, code]) => [code, label])
)

export const ORDER_CODE_TO_STATUS = Object.fromEntries(
  Object.entries(ORDER_STATUS_TO_CODE).map(([label, code]) => [code, label])
)

export const PAYMENT_CODE_TO_STATUS = Object.fromEntries(
  Object.entries(PAYMENT_STATUS_TO_CODE).map(([label, code]) => [code, label])
)

export const VERIFY_CODE_TO_STATUS = Object.fromEntries(
  Object.entries(VERIFY_STATUS_TO_CODE).map(([label, code]) => [code, label])
)

function normalizeAlias(value, aliases, fallback) {
  const text = String(value || '').trim()
  if (!text) return fallback
  return aliases[text] || fallback
}

export function normalizeListingStatus(value) {
  return normalizeAlias(value, {
    [LISTING_STATUS.DRAFT]: LISTING_STATUS.DRAFT,
    [LISTING_STATUS.PENDING]: LISTING_STATUS.PENDING,
    [LISTING_STATUS.PUBLISHED]: LISTING_STATUS.PUBLISHED,
    [LISTING_STATUS.SOLD]: LISTING_STATUS.SOLD,
    [LISTING_STATUS.OFFLINE]: LISTING_STATUS.OFFLINE,
    [LISTING_STATUS.REJECTED]: LISTING_STATUS.REJECTED,
    [LISTING_STATUS.TRADING]: LISTING_STATUS.TRADING,
    DRAFT: LISTING_STATUS.DRAFT,
    PENDING: LISTING_STATUS.PENDING,
    PUBLISHED: LISTING_STATUS.PUBLISHED,
    SOLD: LISTING_STATUS.SOLD,
    OFFLINE: LISTING_STATUS.OFFLINE,
    REJECTED: LISTING_STATUS.REJECTED,
    TRADING: LISTING_STATUS.TRADING
  }, LISTING_STATUS.PENDING)
}

export function normalizeOrderStatus(value) {
  return normalizeAlias(value, {
    [ORDER_STATUS.PENDING]: ORDER_STATUS.PENDING,
    [ORDER_STATUS.CONFIRMED]: ORDER_STATUS.CONFIRMED,
    [ORDER_STATUS.IN_PROGRESS]: ORDER_STATUS.IN_PROGRESS,
    [ORDER_STATUS.COMPLETED]: ORDER_STATUS.COMPLETED,
    [ORDER_STATUS.CANCELLED]: ORDER_STATUS.CANCELLED,
    [ORDER_STATUS.REJECTED]: ORDER_STATUS.REJECTED,
    PENDING: ORDER_STATUS.PENDING,
    CONFIRMED: ORDER_STATUS.CONFIRMED,
    IN_PROGRESS: ORDER_STATUS.IN_PROGRESS,
    COMPLETED: ORDER_STATUS.COMPLETED,
    CANCELLED: ORDER_STATUS.CANCELLED,
    REJECTED: ORDER_STATUS.REJECTED
  }, ORDER_STATUS.PENDING)
}

export function normalizePaymentStatus(value, orderStatus = '') {
  const normalized = normalizeAlias(value, {
    [PAYMENT_STATUS.UNPAID]: PAYMENT_STATUS.UNPAID,
    [PAYMENT_STATUS.PENDING]: PAYMENT_STATUS.PENDING,
    [PAYMENT_STATUS.PAID]: PAYMENT_STATUS.PAID,
    UNPAID: PAYMENT_STATUS.UNPAID,
    PENDING_PAYMENT: PAYMENT_STATUS.PENDING,
    PAID: PAYMENT_STATUS.PAID
  }, '')

  if (normalized) return normalized

  const normalizedOrderStatus = normalizeOrderStatus(orderStatus)
  if (normalizedOrderStatus === ORDER_STATUS.CONFIRMED) return PAYMENT_STATUS.PENDING
  if ([ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.COMPLETED].includes(normalizedOrderStatus)) {
    return PAYMENT_STATUS.PAID
  }
  return PAYMENT_STATUS.UNPAID
}

export function normalizeVerifyStatus(value) {
  return normalizeAlias(value, {
    [VERIFY_STATUS.PENDING]: VERIFY_STATUS.PENDING,
    [VERIFY_STATUS.APPROVED]: VERIFY_STATUS.APPROVED,
    [VERIFY_STATUS.REJECTED]: VERIFY_STATUS.REJECTED,
    PENDING: VERIFY_STATUS.PENDING,
    APPROVED: VERIFY_STATUS.APPROVED,
    REJECTED: VERIFY_STATUS.REJECTED
  }, VERIFY_STATUS.PENDING)
}

export function toListingStatusCode(value) {
  return LISTING_STATUS_TO_CODE[normalizeListingStatus(value)]
}

export function toOrderStatusCode(value) {
  return ORDER_STATUS_TO_CODE[normalizeOrderStatus(value)]
}

export function toPaymentStatusCode(value, orderStatus = '') {
  return PAYMENT_STATUS_TO_CODE[normalizePaymentStatus(value, orderStatus)]
}

export function toVerifyStatusCode(value) {
  return VERIFY_STATUS_TO_CODE[normalizeVerifyStatus(value)]
}
