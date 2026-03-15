# 校园二手交易平台 API 参考

## 1. 认证
- `POST /api/v1/auth/register`
  - 请求：`{ username, studentNo, password }`
  - 说明：注册普通用户，并同步进入真实 MySQL 用户表 `ct_user`
- `POST /api/v1/auth/login`
  - 请求：`{ account, password }`
  - 说明：普通用户使用学号登录
- `POST /api/v1/auth/admin-login`
  - 请求：`{ account, password }`
  - 说明：管理员登录
- `GET /api/v1/users/me`
  - 请求头：`x-user-name`
  - 说明：读取当前登录用户资料

## 2. 商品
- `GET /api/v1/listings`
  - 支持参数：`keyword`、`category`、`campus`、`price`、`condition`、`sort`、`status`、`page`、`pageSize`
- `GET /api/v1/listings/:listingId`
- `POST /api/v1/listings`
  - 请求头：`x-user-name`
  - 请求体：`{ title, price, category, campus, condition, desc, shipping, method, images, tags }`
  - 结果：商品进入 `待审核`
- `PATCH /api/v1/listings/:listingId`
- `PATCH /api/v1/listings/:listingId/status`

## 3. 收藏
- `GET /api/v1/favorites`
- `POST /api/v1/listings/:listingId/favorite`
- `DELETE /api/v1/listings/:listingId/favorite`

## 4. 审核与治理
- `POST /api/v1/admin/listings/:listingId/review`
  - 请求头：`x-admin-account`
  - 请求体：`{ status, reason? }`
  - 说明：用于审核通过或驳回商品
- `PATCH /api/v1/admin/listings/:listingId/violation`
  - 请求头：`x-admin-account`
  - 请求体：`{ reason }`
  - 说明：对已上架或交易中的商品执行违规下架，并向卖家发送系统通知

## 5. 订单
- `POST /api/v1/orders`
  - 请求头：`x-user-name`
  - 请求体：`{ listingId }`
  - 说明：从聊天页创建订单
- `GET /api/v1/orders?role=buyer|seller`
- `GET /api/v1/orders/:orderId`
- `GET /api/v1/order-logs/:orderId`
- `POST /api/v1/orders/:orderId/pay`
  - 请求体：`{ paymentMethod }`
- `PATCH /api/v1/orders/:orderId/status`
  - 请求体：`{ status, reason? }`

## 6. 会话与消息
- `GET /api/v1/conversations`
- `POST /api/v1/conversations`
  - 请求体：`{ listingId }`
  - 说明：同商品 + buyer + seller 唯一复用
- `PATCH /api/v1/conversations/:conversationId/read`
- `PATCH /api/v1/conversations/:conversationId/pin`
  - 请求体：`{ pinned }`
- `GET /api/v1/conversations/:conversationId/messages`
- `POST /api/v1/conversations/:conversationId/messages`
  - 请求体：`{ text }`
- `PATCH /api/v1/messages/:messageId/read`

## 7. 通知
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:notificationId/read`
- `GET /api/v1/admin/notifications`
  - 请求头：`x-admin-account`
  - 说明：管理员查看通知投递记录

## 8. 管理端
- `GET /api/v1/admin/dashboard`
  - 支持参数：`dateFrom`、`dateTo`
- `GET /api/v1/admin/users`
  - 支持参数：`studentNo`、`status`、`verified`
- `PATCH /api/v1/admin/users/:userId/status`

## 9. 实时事件
- `GET /api/v1/events/stream`
  - 事件类型：
  - `inbox.updated`
  - `orders.updated`
  - `listings.updated`
  - `admin.updated`
  - 说明：前端登录后建立 SSE 连接，断开时可回退轮询
