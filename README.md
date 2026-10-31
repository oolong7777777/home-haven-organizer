# 家物管家 · Home Haven

家庭收纳整理应用：记录物品名称、数量、分类、存放位置和备注，让家里的东西更容易找到。

## 已有功能

- 概览：物品、分类、位置和今日新增统计，最近添加的物品。
- 物品：新增、编辑、删除，按名称或描述搜索，按分类和位置筛选。
- 位置：通过父子位置组织房间、柜子和收纳空间。
- 分类：自定义名称、图标和颜色。
- React 手机端和桌面端界面；Express API；SQLite 持久化数据。

## 本地开发

需要 Node.js 24 或更高版本（后端使用内置 `node:sqlite`）。

```bash
npm run install:all
npm run dev
```

按 Vite 输出的网址打开前端。前端开发代理将 `/api` 请求发送到后端 3001 端口。

## 生产运行

```bash
npm run build
BASIC_AUTH_USER=haven BASIC_AUTH_PASSWORD=请替换为长密码 NODE_ENV=production npm start
```

打开 http://localhost:3001 。前端和 API 使用同一个服务。`PORT` 可修改监听端口，`DATABASE_PATH` 可设置数据库文件路径，其父目录需提前创建并允许服务写入。默认数据文件是 `server/database.sqlite`。

## Docker 运行

```bash
echo "BASIC_AUTH_PASSWORD=请替换为长密码" > .env
docker compose up -d --build
```

打开 http://localhost:3001 。命名卷 `home-haven-data` 保存数据库，更新镜像不会清除数据。不要使用 `docker compose down -v`，该命令会删除数据卷。

## 数据与访问

当前是单家庭共享数据版本，生产环境通过浏览器内置的账号密码登录保护全站和 API，没有家庭成员之间的用户隔离。生产启动必须设置 `BASIC_AUTH_USER` 和 `BASIC_AUTH_PASSWORD`。默认 Docker 端口仅绑定本机；需要远程访问时，应通过带身份认证的反向代理或私人网络提供访问。

备份前先停止服务，再复制数据库文件以及同目录中的 `-wal`、`-shm` 文件（如有）；恢复时保持服务停止并一起还原。不要把家庭数据文件提交到 GitHub。

## 免费部署到 Render

`render.yaml` 使用 **Free** 服务，不创建付费磁盘。Render 可能因空闲休眠，首次打开需要等待。平台仍可能要求账号验证；是否需要绑卡以 Render 当前账号页面为准，不要选择付费套餐。免费额度和条款以平台为准。

1. 登录 https://dashboard.render.com ，选择 **New → Blueprint**。
2. 连接本 GitHub 仓库，选择 `codex/mobile-and-docker-setup` 分支（合并后也可用 `main`）。Blueprint Path 留空。
3. 点击 Retry 重新读取配置，核对为 **Free** 且没有 Disk，再确认部署。如果仍显示 Starter 或磁盘，不要继续，先刷新配置。
4. 等状态变为 **Live**，打开 Render 分配的 HTTPS 网址。
5. 用户名为 `haven`；在服务 **Environment** 页面查看自动生成的 `BASIC_AUTH_PASSWORD`，或自行修改成长密码并重新部署。不要把密码发到聊天或提交到 GitHub。

### 先试用，再连接免费云数据库

未配置云数据库时，Render 使用 `/tmp/home-haven.sqlite`，这是临时数据，服务重启或重新部署可能清空。页面会显示提示，可点击“导出数据”下载 JSON 快照（当前未提供自动导入）。先用测试记录体验功能，不要把临时版本当作正式家庭档案。

要长期保存并跨设备共用数据，可连接 Turso 提供的 SQLite 云数据库：

1. 在 https://turso.tech 注册，核对并选择其免费计划，创建数据库。
2. 在 Turso 获取数据库 URL 和访问 token。
3. 在 Render 服务的 **Environment** 添加 `TURSO_DATABASE_URL`（通常为 `libsql://…turso.io`）和 `TURSO_AUTH_TOKEN`，保存并重新部署。两项必须一起设置。token 只填在 Render，不能提交到仓库或发送到聊天。
4. 服务启动时自动建表；页面显示“云数据库已连接”后，用测试记录检查新增和刷新。云数据库不依赖 Render 的临时磁盘，手机电脑使用同一网址和家庭账号即可共用数据。

连接云数据库不会自动迁移临时数据，应先导出。云数据库免费额度、暂停和保留规则以 Turso 当前条款为准；请定期导出备份。

部署状态、构建错误和实际网址需要在 Render 页面核实。代码提交不等于已上线。

GitHub 保存源代码，不会运行 Express 和 SQLite 后端。GitHub Pages 仅适合静态网页，本项目应部署在支持 Node.js 24 和持久化磁盘的服务器或 Docker 主机上。
