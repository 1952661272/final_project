# 校园二手交易平台 API 参考

## 1. 认证

- `POST /api/v1/auth/register`
  - 请求体：`{ username, studentNo, password }`
  - 说明：注册普通用户，并同步写入认证用户表。
- `POST /api/v1/auth/login`
  - 请求体：`{ account, password }`
  - 说明：普通用户使用学号账号登录。软删除用户默认禁止登录。
- `POST /api/v1/auth/admin-login`
  - 请求体：`{ account, password }`
  - 说明：管理员登录。
- `GET /api/v1/users/me`
  - 请求头：`x-user-name`
  - 说明：读取当前登录用户资料。软删除用户会被拒绝访问。

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
  - 说明：管理员审核商品，上架或驳回。
- `PATCH /api/v1/admin/listings/:listingId/violation`
  - 请求头：`x-admin-account`
  - 请求体：`{ reason }`
  - 说明：对已上架或交易中的商品执行违规下架，并通知卖家。

## 5. 订单

- `POST /api/v1/orders`
  - 请求头：`x-user-name`
  - 请求体：`{ listingId }`
  - 说明：从商品详情或聊天链路创建订单。
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
  - 说明：同商品 + buyer + seller 唯一复用。
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
  - 说明：管理员查看平台通知投递记录。

## 8. 管理端

- `GET /api/v1/admin/dashboard`
  - 支持参数：`dateFrom`、`dateTo`

- `GET /api/v1/admin/users`
  - 请求头：`x-admin-account`
  - 支持参数：`studentNo`、`status`、`verified`
  - `status` 语义：
    - 为空：默认不返回已软删除用户
    - `正常`：只返回正常用户
    - `禁用`：只返回禁用但未删除用户
    - `已删除`：只返回软删除用户
  - 返回字段新增：
    - `account`：学号账号
    - `deletedAt`：软删除时间，未删除时为 `null`

- `PATCH /api/v1/admin/users/:userId/status`
  - 请求头：`x-admin-account`
  - 请求体：`{ status }`
  - 说明：管理员禁用或恢复用户；已删除用户不允许再次调整状态。

- `POST /api/v1/admin/users/:userId/password/reset`
  - 请求头：`x-admin-account`
  - 说明：管理员将目标用户密码重置为 `123456`。
  - 返回示例：`{ userId, name, account, password, message }`
  - 安全说明：不支持查看原密码，仅支持重置后一次性提示。

- `DELETE /api/v1/admin/users/:userId`
  - 请求头：`x-admin-account`
  - 说明：执行软删除，不物理删除用户。
  - 删除副作用：
    - 自动取消该用户相关进行中订单（`待确认 / 已确认 / 进行中`）
    - 写入订单取消原因、订单日志与通知
    - 将该用户名下可流通商品统一下架
    - 用户状态写为 `禁用`，并记录 `deletedAt`

## 9. 实时事件

- `GET /api/v1/events/stream`
  - 事件类型：
    - `inbox.updated`
    - `orders.updated`
    - `listings.updated`
    - `admin.updated`
  - 说明：前端登录后建立 SSE 连接，断开时可回退轮询。
