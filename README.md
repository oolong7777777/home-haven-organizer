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

## 部署到 Render（获得在线网址）

仓库包含 `render.yaml`，会创建一个 Node.js 服务和 1GB 持久化磁盘。该配置使用付费 Starter 服务和磁盘，请在 Render 的创建页面核对当前费用后再确认。这里只提供部署配置，不会自动开通或扣费。

1. 登录 https://dashboard.render.com ，选择 **New → Blueprint**。
2. 连接本 GitHub 仓库，选择包含 `render.yaml` 的分支 `codex/mobile-and-docker-setup`（合并后也可选择 `main`）。
3. 核对服务和磁盘费用，然后确认部署。等待状态变为 **Live**，点击 Render 提供的 `https://…onrender.com` 地址。
4. 登录账号为 `haven`。密码在 Render 服务的 **Environment** 页面中查看 `BASIC_AUTH_PASSWORD`（自动生成），也可在那里改成长密码并重新部署。不要把密码发到聊天或提交到仓库。
5. 用同一个网址和账号在手机、电脑登录，数据保存到服务器磁盘；浏览器关闭后仍然保留。

部署状态、构建错误和实际网址需要在 Render 页面核实。删除服务或磁盘会影响数据，请定期备份；磁盘不是备份。

GitHub 保存源代码，不会运行 Express 和 SQLite 后端。GitHub Pages 仅适合静态网页，本项目应部署在支持 Node.js 24 和持久化磁盘的服务器或 Docker 主机上。
