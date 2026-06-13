# Yellow 项目指令

## OTA 部署规则（强制）
每次代码改动后必须执行完整 OTA 流程，不得跳过：

1. 更新 `public/version.json`（版本号+描述）
2. 更新 `src/components/About.tsx`（changelog 新条目 + expandedVer 默认值）
3. `npm run build`
4. `npx gh-pages -d dist --dotfiles`
5. `git add -A && git commit -m "vX.Y.Z: 描述"`
6. `git tag vX.Y.Z`
7. `git push origin main && git push origin vX.Y.Z`

## 部署后验证（强制，每次必做）
部署完必须验证 gh-pages 确实更新了，不能只看 `Published` 输出：

1. `git fetch origin gh-pages && git show origin/gh-pages:version.json` — 确认版本号是刚部署的
2. 如版本号不对，重新执行 `npx gh-pages -d dist --dotfiles` 再验证
3. 验证通过后才执行 git commit/tag/push

常见坑：`gh-pages` 命令输出 `Published` 但实际没更新文件（可能是 dist/ 未清理、缓存、或并发部署冲突）。

## 项目结构
- React 18 + TypeScript + Vite + Capacitor Android
- OTA 更新源：raw.githubusercontent.com + cdn.jsdelivr.net CDN 回退
- SW 拦截：/、/index.html、/assets/、/books/、/version.json
- IndexedDB 存储：books / chapters / progress 三个 store
