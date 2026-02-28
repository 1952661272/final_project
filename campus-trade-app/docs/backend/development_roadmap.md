# 系统继续开发计划（后端落地版）

## 1. 当前状态
1. 前端已完成主要业务流程与交互演示（Quasar + 本地状态）。
2. 后端未落地，业务数据仍在浏览器本地存储。
3. 下一目标是把“可演示”升级为“可部署”。

## 2. 迭代目标
1. 完成账号、商品、订单、审核、消息的接口化。
2. 接入 MySQL，实现数据持久化与多端同步。
3. 保持现有前端页面结构，优先替换数据来源，减少 UI 改动风险。

## 3. API 清单（V1）
## 3.1 认证与用户
1. `POST /api/v1/auth/login`
2. `POST /api/v1/auth/logout`
3. `GET /api/v1/users/me`
4. `POST /api/v1/users/verify`
5. `PATCH /api/v1/admin/users/{userId}/status`

## 3.2 商品
1. `GET /api/v1/listings`：支持 `keyword/category/campus/priceMin/priceMax/status/sort/page/pageSize`
2. `POST /api/v1/listings`
3. `GET /api/v1/listings/{listingId}`
4. `PATCH /api/v1/listings/{listingId}`
5. `PATCH /api/v1/listings/{listingId}/status`
6. `POST /api/v1/listings/{listingId}/favorite`
7. `DELETE /api/v1/listings/{listingId}/favorite`
8. `POST /api/v1/admin/listings/{listingId}/review`

## 3.3 订单
1. `POST /api/v1/orders`
2. `GET /api/v1/orders?role=buyer|seller&status=`
3. `GET /api/v1/orders/{orderId}`
4. `PATCH /api/v1/orders/{orderId}/status`

## 3.4 消息
1. `GET /api/v1/conversations`
2. `POST /api/v1/conversations`
3. `GET /api/v1/conversations/{conversationId}/messages`
4. `POST /api/v1/conversations/{conversationId}/messages`
5. `PATCH /api/v1/messages/{messageId}/read`

## 4. 前后端字段约定（核心）
1. 状态字段全部用数值枚举存库，接口层转换为前端中文状态。
2. 时间字段统一 UTC 存储，接口输出 ISO8601。
3. 所有列表接口统一分页返回：
`{ list: [], page: 1, pageSize: 20, total: 0 }`

## 5. 建议技术栈
1. 后端：Node.js + NestJS（或 Express + TypeScript）。
2. ORM：Prisma（便于和 MySQL schema 对齐）。
3. 认证：JWT + Refresh Token。
4. 文件：对象存储（开发期可本地 MinIO）。

## 6. 分阶段实施
## 阶段 A（1-2 周）
1. 搭建后端项目骨架、接入数据库。
2. 完成登录、用户、商品列表/详情/发布/审核。
3. 前端替换：`Home/Search/Detail/Publish/AdminListings/AdminUsers`。

## 阶段 B（1 周）
1. 完成订单接口与状态流转日志。
2. 前端替换：`Profile` 中买家/卖家订单逻辑。

## 阶段 C（1 周）
1. 完成会话与消息接口。
2. 前端替换：`Messages` 页面。

## 阶段 D（0.5 周）
1. 联调与回归测试。
2. 补论文中的“系统实现”和“测试结果”章节截图与数据。

## 7. 风险与规避
1. 风险：前端状态字段与后端枚举不一致。
规避：定义单独 `enum-map.ts` 并在联调前冻结。
2. 风险：图片上传方案变化导致发布流程返工。
规避：先约定上传 API，再改发布/编辑页。
3. 风险：订单状态机缺少约束。
规避：后端仅允许合法状态迁移，并写入 `ct_order_status_log`。

## 8. 验收标准（可用于中期/终期）
1. 核心接口通过 Postman 集合测试，成功率 >= 99%。
2. 前端不再依赖 localStorage 作为主数据源。
3. 核心链路“发布->审核->下单->成交->消息沟通”可全程演示。
4. 数据库可追溯审核与订单流转记录。
