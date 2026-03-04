# 校园二手交易平台 (campus-trade-app)

校园二手交易平台前后端联调项目（前端 Quasar + 本地 API 服务）

## Install the dependencies
```bash
yarn
# or
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)
```bash
quasar dev
```

### Start backend API service
```bash
npm run backend:dev
```

### Optional: run backend with MySQL persistence
1. 准备 MySQL 并创建数据库（如 `campus_trade`）
2. 设置连接串并启动：
```bash
MYSQL_URL='mysql://root:password@127.0.0.1:3306/campus_trade' STATE_DRIVER=mysql npm run backend:dev
```
后端会自动创建 `app_state` 表并持久化系统状态。

### Frontend + backend local linkage
1. 终端A运行：`npm run backend:dev`（默认监听 `http://127.0.0.1:3001`）
2. 终端B运行：`npm run dev`
3. 前端通过 `/api/*` 代理到后端，完成登录、商品、订单、消息、后台管理联动

### REST API（核心）
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/users/me`
- `POST /api/v1/users/verify`
- `PATCH /api/v1/admin/users/:userId/status`
- `GET /api/v1/listings`
- `POST /api/v1/listings`
- `GET /api/v1/listings/:listingId`
- `PATCH /api/v1/listings/:listingId`
- `PATCH /api/v1/listings/:listingId/status`
- `POST /api/v1/listings/:listingId/favorite`
- `DELETE /api/v1/listings/:listingId/favorite`
- `POST /api/v1/admin/listings/:listingId/review`
- `POST /api/v1/orders`
- `GET /api/v1/orders`
- `GET /api/v1/orders/:orderId`
- `PATCH /api/v1/orders/:orderId/status`
- `GET /api/v1/conversations`
- `POST /api/v1/conversations`
- `GET /api/v1/conversations/:conversationId/messages`
- `POST /api/v1/conversations/:conversationId/messages`
- `PATCH /api/v1/messages/:messageId/read`


### Build the app for production
```bash
quasar build
```

### Customize the configuration
See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
