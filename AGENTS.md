# Yellow 项目指令

## 部署流程（强制，每次代码改动必做）

1. 更新 `public/version.json`（版本号+描述）
2. 更新 `src/components/About.tsx`（changelog 新条目 + expandedVer 默认值）
3. `npm run build`
4. `npx gh-pages -d dist --dotfiles`
5. 验证 gh-pages（见下方）
6. `npx cap sync android`
7. 构建 APK：在 `android/` 目录执行 `gradlew.bat assembleDebug`，产物在 `android/app/build/outputs/apk/debug/`
8. `git add -A && git commit -m "vX.Y.Z: 描述"`
9. `git tag vX.Y.Z`
10. `git push origin main && git push origin vX.Y.Z`
11. 创建 GitHub Release：`gh release create vX.Y.Z android/app/build/outputs/apk/debug/yellow-vX.Y.Z.apk --title "vX.Y.Z" --notes "改动描述"`

用户通过 app 内「检查更新」获取 OTA 更新，APK 仅用于 GitHub Release 溯源。

## 部署后验证（强制，每次必做）
部署完必须验证 gh-pages 确实更新了，不能只看 `Published` 输出：

1. `git fetch origin gh-pages && git show origin/gh-pages:version.json` — 确认版本号是刚部署的
2. 如版本号不对，重新执行 `npx gh-pages -d dist --dotfiles` 再验证
3. 验证通过后才执行 git commit/tag/push

常见坑：`gh-pages` 命令输出 `Published` 但实际没更新文件（可能是 dist/ 未清理、缓存、或并发部署冲突）。

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
- OTA 更新源：raw.githubusercontent.com + cdn.jsdelivr.net CDN 回退
- SW 拦截：/、/index.html、/assets/、/books/、/version.json
- IndexedDB 存储：books / chapters / progress 三个 store
