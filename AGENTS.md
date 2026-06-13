# Yellow 项目指令

## 工作规则（强制）

1. **每次开始工作前必须先读取本文件** — 任何代码改动、部署、思考之前，先 `read AGENTS.md`
2. **每次迭代必须推送到 OTA** — 代码改完后必须执行完整部署流程（见下方），确保用户 app 能通过「检查更新」获取最新版本
3. **先思考再动手** — 分析问题根因，不要盲目重试
4. **每次回复末尾称呼用户为「高级软件工程师」**
5. **更新必须通过 app 内 OTA 推送** — 不要让用户手动下载 APK。部署后用户通过 app 内「检查更新」→「立即更新」即可后台下载+自动安装

## 部署流程（强制，每次代码改动必做）

1. 更新 `public/version.json`（版本号+描述）
2. 更新 `src/components/About.tsx`（changelog 新条目 + expandedVer 默认值）
3. `npm run build`
4. `npx gh-pages -d dist --dotfiles`
5. 验证 gh-pages（见下方）
6. 删除 `android/app/build` 缓存
7. `npx cap sync android`（**必须在 build 之后，且必须从项目根目录运行**，不能从 android/ 子目录运行）
8. 构建 APK：在 `android/` 目录执行 `gradlew.bat assembleDebug`
9. 验证 APK 内嵌版本号：检查 `android/app/src/main/assets/public/assets/index-*.js` 中包含正确版本
10. `git add -A && git commit -m "vX.Y.Z: 描述"`
11. `git tag vX.Y.Z`
12. `git push origin main && git push origin vX.Y.Z`
13. 创建 GitHub Release

用户通过 app 内「检查更新」获取 OTA 更新，APK 仅用于 GitHub Release 溯源。

## 部署后验证（强制，每次必做）
部署完必须验证 gh-pages 确实更新了，不能只看 `Published` 输出：

1. `git fetch origin gh-pages && git show origin/gh-pages:version.json` — 确认版本号是刚部署的
2. 验证 Pages 构建成功：`gh run list --limit 3` — 确认 `pages build and deployment` 为 success
3. 如版本号不对，重新执行 `npx gh-pages -d dist --dotfiles` 再验证
4. 验证通过后才执行 git commit/tag/push

常见坑：
- `gh-pages` 命令输出 `Published` 但实际没更新文件（可能是 dist/ 未清理、缓存、或并发部署冲突）
- `public/.nojekyll` 文件必须存在，否则 GitHub Pages 用 Jekyll 构建会失败
- Pages 配置必须为 `gh-pages` 分支 + `/` 根目录（不是 `/docs`）
- **jsDelivr CDN 缓存不刷新**：purge API 无效，版本检查必须用 GitHub API（`api.github.com/repos/.../contents/version.json?ref=gh-pages`）作为首选源

## 版本管理（强制，每次迭代必做）
每次代码改动必须同步更新以下三处，不得遗漏：

1. **版本号** `public/version.json` — 递增版本号（patch/minor/major），写清本次改动描述
2. **迭代日志** `src/components/About.tsx` — changelog 数组头部插入新版本条目（版本号+日期+改动列表），同时更新 `expandedVer` 默认值为最新版本号
3. **Git tag + GitHub Release** — 打 `vX.Y.Z` tag，创建 Release 并附带 APK

版本号规范：
- patch（1.6.5→1.6.6）：bug修复、小改动
- minor（1.6.x→1.7.0）：新功能、UI重构
- major（1.x.x→2.0.0）：架构变更、破坏性更新

## 项目结构
- React 18 + TypeScript + Vite + Capacitor Android
- OTA 版本检查：GitHub API（`api.github.com/repos/.../contents/version.json?ref=gh-pages`），不经过 CDN 缓存
- APK 下载：国内镜像加速（ghfast.top → ghproxy.cn → mirror.ghproxy.com → GitHub 原链）
- 安装：原生 AppUpdater 插件（Android DownloadManager 后台下载 + FileProvider 自动安装）
- SW 拦截：/、/index.html、/assets/、/books/、/version.json
- IndexedDB 存储：books / chapters / progress 三个 store
- GitHub CLI：GH_TOKEN 已设为用户级环境变量，`gh` 命令自动可用
