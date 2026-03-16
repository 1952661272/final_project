# 校园二手交易平台 AI 可执行部署清单

本文档用于在另一台电脑上，把当前项目以可演示或可接入 MySQL 的方式部署起来。默认项目路径为当前仓库根目录下的 `campus-trade-app`。

## 1. 目标说明

可部署为两种模式：

1. `JSON` 模式
   - 无需 MySQL。
   - 适合前端联调、功能演示、课堂答辩演示。
   - 数据保存在 `backend/data/state.json`。

2. `MySQL` 模式
   - 需要 MySQL 8.0+。
   - 后端启动时会自动执行 [schema_mysql.sql](/Users/mac/Downloads/毕设产品说明书/campus-trade-app/docs/database/schema_mysql.sql)。
   - 适合正式展示“数据库已接入”的版本。

## 2. 环境前提

在目标电脑上，AI 需要先确认以下条件：

1. 已安装 `Node.js 20+`
2. 已安装 `npm`
3. 项目代码已完整存在于本地
4. 若使用 MySQL 模式：
   - 已安装并启动 `MySQL 8.0+`
   - 已知数据库账号、密码、主机、端口

建议 AI 先执行：

```bash
node -v
npm -v
pwd
ls
```

若要走 MySQL 模式，再执行：

```bash
mysql --version
```

## 3. 标准部署流程

### 3.1 进入项目

```bash
cd /你的项目路径/campus-trade-app
```

### 3.2 安装依赖

```bash
npm install
```

### 3.3 跑测试

```bash
npm test
```

通过标准：

1. `backend/app.test.js` 通过
2. `backend/schema.contract.test.js` 通过
3. 如果未设置 `TEST_MYSQL_URL`，`backend/mysql.schema.test.js` 可以跳过

### 3.4 构建前端

```bash
npm run build
```

通过标准：

1. 构建成功
2. 输出目录为 `dist/spa`

## 4. JSON 模式部署

适用于没有 MySQL 的电脑。

### 4.1 启动后端

```bash
npm run backend:dev
```

预期输出包含：

```text
[api] campus-trade backend listening on http://127.0.0.1:3001
[api] state driver: json
```

### 4.2 启动前端

另开一个终端执行：

```bash
npm run dev
```

### 4.3 JSON 模式验收

后端健康检查：

```bash
curl -s http://127.0.0.1:3001/api/health
```

预期：

1. 返回 `ok: true`
2. `service` 为 `campus-trade-api`

列表接口检查：

```bash
curl -s "http://127.0.0.1:3001/api/v1/listings?status=%E4%B8%8A%E6%9E%B6&page=1&pageSize=2"
```

用户接口检查：

```bash
curl -s -H "x-user-name: %E5%BC%A0%E5%90%8C%E5%AD%A6" http://127.0.0.1:3001/api/v1/users/me
```

## 5. MySQL 模式部署

适用于需要展示“数据库已接入”的电脑。

### 5.1 准备连接串

示例：

```bash
export MYSQL_URL="mysql://root:password@127.0.0.1:3306/campus_trade"
```

如果是 Windows PowerShell：

```powershell
$env:MYSQL_URL="mysql://root:password@127.0.0.1:3306/campus_trade"
```

### 5.2 启动后端

```bash
npm run backend:dev
```

预期输出包含：

```text
[api] state driver: mysql
```

说明：

1. 启动时会自动执行 [schema_mysql.sql](/Users/mac/Downloads/毕设产品说明书/campus-trade-app/docs/database/schema_mysql.sql)
2. 会自动创建业务表
3. 还会创建 `app_state` 用于当前应用状态持久化

### 5.3 可选的 MySQL 架构测试

如果希望 AI 验证 SQL 能直接在测试库执行，可再设置：

```bash
export TEST_MYSQL_URL="mysql://root:password@127.0.0.1:3306/"
npm test
```

注意：

1. `TEST_MYSQL_URL` 需要指向一个允许执行建库建表语句的 MySQL 实例
2. 测试会执行 `schema_mysql.sql`

### 5.4 MySQL 模式验收

后端接口：

```bash
curl -s http://127.0.0.1:3001/api/health
```

数据库表检查：

```bash
mysql -uroot -p -e "USE campus_trade; SHOW TABLES;"
```

至少应看到：

1. `ct_user`
2. `ct_listing`
3. `ct_listing_image`
4. `ct_listing_tag`
5. `ct_order`
6. `ct_order_status_log`
7. `ct_conversation`
8. `ct_message`

## 6. 最小业务验收脚本

AI 在后端启动后，应至少检查以下链路：

1. 登录
2. 获取当前用户
3. 查看商品列表
4. 发布商品
5. 管理员审核商品
6. 对已上架商品下单
7. 创建会话并发送消息

建议顺序：

```bash
curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"张同学"}'

curl -s -H "x-user-name: %E5%BC%A0%E5%90%8C%E5%AD%A6" \
  http://127.0.0.1:3001/api/v1/users/me

curl -s "http://127.0.0.1:3001/api/v1/listings?status=%E4%B8%8A%E6%9E%B6&page=1&pageSize=5"
```

发布商品：

```bash
curl -s -X POST http://127.0.0.1:3001/api/v1/listings \
  -H "Content-Type: application/json" \
  -H "x-user-name: %E5%BC%A0%E5%90%8C%E5%AD%A6" \
  -d '{
    "title":"部署测试商品",
    "price":99,
    "category":"数码",
    "campus":"北校区",
    "condition":9,
    "desc":"部署验收",
    "shipping":"包邮",
    "method":"面交优先",
    "images":["/assets/test.jpg"],
    "tags":["新发布","包邮"]
  }'
```

管理员审核：

```bash
curl -s -X POST http://127.0.0.1:3001/api/v1/admin/listings/17/review \
  -H "Content-Type: application/json" \
  -H "x-admin-account: admin" \
  -d '{"status":"上架"}'
```

说明：

1. 上面的 `17` 只是示例
2. AI 应先读取发布接口返回的 `id`，再把它代入审核接口

## 7. 常见问题排查

### 7.1 `npm install` 失败

检查：

1. Node 版本是否过低
2. 网络是否可访问 npm registry
3. 是否在 `campus-trade-app` 目录执行

### 7.2 后端启动但接口报 401

检查：

1. 是否传了 `x-user-name`
2. header 中中文是否已 URL 编码
3. 管理员接口是否传了 `x-admin-account: admin`

### 7.3 MySQL 模式启动失败

检查：

1. `MYSQL_URL` 是否正确
2. MySQL 服务是否已启动
3. 数据库账号是否有建库建表权限
4. 目标机器的 MySQL 是否为 8.0+

### 7.4 前端页面空白或无数据

检查：

1. 后端是否已启动在 `127.0.0.1:3001`
2. 浏览器控制台是否有接口报错
3. `npm run build` 是否成功

## 8. 可直接交给 AI 的执行提示词

如果你在另一台电脑上想让 AI 直接执行，可以把下面这段发给它：

```text
请在当前电脑上部署这个项目，项目目录是 /你的项目路径/campus-trade-app。

要求：
1. 先检查 Node、npm、项目目录是否正常。
2. 执行 npm install。
3. 执行 npm test 和 npm run build。
4. 如果本机没有 MySQL，就按 JSON 模式启动并完成接口验收。
5. 如果本机有 MySQL，并且我提供了 MYSQL_URL，就按 MySQL 模式启动，并验证 campus_trade 的表已创建。
6. 验收完成后，告诉我：
   - 实际运行模式（json 或 mysql）
   - 后端是否启动成功
   - 前端是否构建成功
   - 测试是否通过
   - 是否完成“登录、商品列表、发布、审核、下单、消息”的最小链路验证
7. 如果失败，不要停，先排查并修复可修复的问题，再汇报结果。
```

如果你已经确定是 MySQL 模式，可以用这段：

```text
请在当前电脑上以 MySQL 模式部署 /你的项目路径/campus-trade-app。

已知：
1. MYSQL_URL 我会提供给你。
2. 目标是让后端真正连上 MySQL，并自动执行 schema_mysql.sql。

要求：
1. 检查 Node、npm、MySQL 是否可用。
2. 安装依赖。
3. 执行测试和构建。
4. 用 MYSQL_URL 启动后端。
5. 验证 campus_trade 中至少存在 ct_user、ct_listing、ct_listing_tag、ct_order、ct_conversation、ct_message。
6. 验证接口 /api/health、/api/v1/users/me、/api/v1/listings 可正常返回。
7. 汇报所有执行命令、结果和未解决问题。
```

## 9. 当前项目已知边界

本阶段不覆盖：

1. 保存草稿持久化
2. 评价系统
3. 通知中心
4. 支付
5. 注册/找回密码

AI 在部署或验收时，不应把这些能力当作失败项。
