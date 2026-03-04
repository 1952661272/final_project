# 校园二手交易平台数据库设计说明

## 1. 设计目标
1. 覆盖前端已实现核心能力：用户、商品、审核、订单、消息、收藏、后台治理。
2. 支持后续后端接入与数据持久化。
3. 保持筛选字段语义与前端路由参数一致。

## 2. 当前状态声明
1. 数据库结构设计与建表脚本已完成。
2. 当前运行版本尚未接入真实数据库。
3. 本文档属于“设计完成、待接入实现”状态。

## 3. 设计原则
1. 主键统一：`BIGINT UNSIGNED AUTO_INCREMENT`。
2. 核心实体支持软删除。
3. 关键业务链路可追溯（审核、订单状态日志）。
4. 高频筛选字段优先建立组合索引。

## 4. E-R 关系（文本版）
1. `ct_user` 1:N `ct_listing`。
2. `ct_listing` 1:N `ct_listing_image`。
3. `ct_user` N:M `ct_listing`（`ct_favorite`）。
4. `ct_listing` 1:N `ct_order`。
5. `ct_order` 1:N `ct_order_status_log`。
6. `ct_listing + buyer_id + seller_id` 唯一确定 `ct_conversation`。
7. `ct_conversation` 1:N `ct_message`。

## 5. 状态字典
### 5.1 用户状态
1. `1`：正常
2. `2`：禁用

### 5.2 商品状态
1. `0`：草稿
2. `1`：待审核
3. `2`：上架
4. `3`：已售
5. `4`：下架
6. `5`：驳回

### 5.3 订单状态
1. `0`：待确认
2. `1`：已确认
3. `2`：进行中
4. `3`：已完成
5. `4`：已取消
6. `5`：已拒绝

## 6. 高频查询与索引策略
1. 搜索页：`category+status`、`campus+status`、`price`。
2. 我的发布：`seller+status`。
3. 我的订单：`buyer+status`、`seller+status`。
4. 审核列表：`listing_status+created_at`。
5. 会话消息：`conversation_id+sent_at`。

## 7. 与前端导航筛选字段映射说明
### 7.1 路由与参数
1. 分类路由：`/#/category/{分类名}`。
2. 搜索路由：`/#/search`。
3. 快速筛选：`/#/search?price=0-100&sort=价格升序`。

### 7.2 参数语义映射
1. `category` -> `ct_listing.category_id`（经分类字典映射）。
2. `campus` -> `ct_listing.campus_id`（经校区字典映射）。
3. `price` -> `ct_listing.price` 区间过滤（接口层解析区间表达）。
4. `condition` -> `ct_listing.quality_score`。
5. `sort` -> `created_at` 或 `price` 排序策略。

### 7.3 接口层建议
1. 前端中文参数值在接口层统一转义为标准枚举/区间。
2. 路由 params 与 query 在服务层合并为单一查询对象。
3. 分页查询统一返回 `{ list, page, pageSize, total }`。

## 8. 前端字段映射（关键）
1. `item.id` -> `ct_listing.listing_id`。
2. `item.images[]` -> `ct_listing_image`。
3. `item.status` -> `ct_listing.listing_status`。
4. `order.id`（展示）-> `ct_order.order_no`。
5. `chat.messages[]` -> `ct_message`。

## 9. 迁移建议
1. 阶段1：接入用户、商品、审核、订单四大表。
2. 阶段2：接入会话与消息持久化。
3. 阶段3：扩展支付、评价、举报、风控表。

## 10. 文件说明
1. 建表脚本：`schema_mysql.sql`。
2. 环境建议：MySQL 8.0+，`utf8mb4` 字符集。
