# 系统继续开发计划（后端落地版，文档同步更新）

## 1. 当前状态
1. 前端主流程已完整实现（Quasar + 真实领域 API 驱动，保留本地 seed 作为降级回退）。
2. 后端已拆分为 `app + repository + service` 结构，并完成主流程 API 接入。
3. 前端分类导航路由化已完成：支持 `/#/category/{分类名}`。
4. 搜索页已支持 query 与 params 联动筛选，并可回写 URL。
5. 数据库设计已补齐 `ct_listing_tag`，用于承接前台商品标签能力。

## 2. 本阶段已完成沉淀（可复用）
1. 路由规范沉淀：`/search` + `/category/:category` 双入口。
2. 快速筛选沉淀：参数化跳转 `price/sort`。
3. 筛选参数语义统一：`category/campus/price/condition/sort`。
4. UI主题和交互反馈完成统一（卡片、按钮、趋势图动效）。
5. 层级冲突导致页面空白下沉问题已定位并修复。

## 3. 迭代目标
1. 接入后端服务，替换本地状态源。
2. 接入 MySQL，完成交易数据持久化。
3. 保持现有前端页面结构，降低改造风险。

## 4. API 清单（V1）
### 4.1 认证与用户
1. `POST /api/v1/auth/login`
2. `POST /api/v1/auth/logout`
3. `GET /api/v1/users/me`
4. `POST /api/v1/users/verify`
5. `PATCH /api/v1/admin/users/{userId}/status`

### 4.2 商品
1. `GET /api/v1/listings`（支持 `keyword/category/campus/priceMin/priceMax/condition/sort/page/pageSize`）
2. `POST /api/v1/listings`
3. `GET /api/v1/listings/{listingId}`
4. `PATCH /api/v1/listings/{listingId}`
5. `PATCH /api/v1/listings/{listingId}/status`
6. `POST /api/v1/listings/{listingId}/favorite`
7. `DELETE /api/v1/listings/{listingId}/favorite`
8. `POST /api/v1/admin/listings/{listingId}/review`
9. `GET /api/v1/favorites`

### 4.3 订单
1. `POST /api/v1/orders`
2. `GET /api/v1/orders?role=buyer|seller&status=`
3. `GET /api/v1/orders/{orderId}`
4. `PATCH /api/v1/orders/{orderId}/status`

### 4.4 消息
1. `GET /api/v1/conversations`
2. `POST /api/v1/conversations`
3. `GET /api/v1/conversations/{conversationId}/messages`
4. `POST /api/v1/conversations/{conversationId}/messages`
5. `PATCH /api/v1/messages/{messageId}/read`

## 5. 前后端字段约定
1. 状态字段数据库存数值枚举，接口层映射中文状态。
2. 时间统一 UTC 存储，API 输出 ISO8601。
3. 列表统一分页结构：`{ list, page, pageSize, total }`。
4. 路由筛选参数与接口参数保持语义一致：`category/campus/price/condition/sort`。
5. 商品标签统一输出为 `listing.tags: string[]`，数据库通过 `ct_listing_tag` 持久化。

## 6. 分阶段实施
### 阶段A（1-2周）
1. 搭建后端骨架并接入数据库连接。
2. 实现登录、用户、商品列表/详情/发布/审核。
3. 前端替换模块：`Home/Search/Detail/Publish/AdminListings/AdminUsers`。
4. 前端已完成能力复用：分类路由和筛选参数联动直接对接接口。

### 阶段B（1周）
1. 实现订单接口与状态日志。
2. 前端替换 `Profile` 中买卖家订单逻辑。

### 阶段C（1周）
1. 实现会话与消息接口。
2. 前端替换 `Messages` 页面逻辑。

### 阶段D（0.5周）
1. 联调、回归、冒烟测试。
2. 更新论文与汇报中的实现与测试章节数据。

## 7. 风险与规避
1. 风险：前后端状态语义不一致。  
规避：冻结 `enum-map` 并在联调前评审。
2. 风险：图片上传方案变化引发返工。  
规避：先固化上传 API，再改发布页。
3. 风险：订单状态机出现非法迁移。  
规避：后端强约束迁移并记录日志。

## 8. 文档与代码一致性维护规范
1. 每次路由/筛选行为变更，必须同步修改说明书、论文与汇报稿。
2. 每次接口参数变更，必须同步更新本文件与数据库设计文档。
3. 提交前执行一次“口径检查”：
   - 是否误写“已接入数据库”；
   - 是否遗漏新增路由路径；
   - 是否遗漏筛选参数语义。

## 9. 验收标准
1. 核心链路“发布->审核->下单->成交->消息”可全程演示。
2. 分类导航与快速筛选可稳定跳转并复现结果。
3. 文档描述与代码行为一致，不出现误导性上线表述。
4. 后端接入后前端不再以 localStorage 为主数据源。

## 10. 本阶段不覆盖
1. “保存草稿”仅保留 UI 兼容提示，不做持久化实现。
2. “查看评价”入口暂不接入评价表与评价页面。
3. 不新增通知中心、支付、注册/找回密码功能。
