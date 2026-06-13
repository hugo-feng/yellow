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

验证：`webfetch` 访问 `raw.githubusercontent.com/hugo-feng/yellow/gh-pages/version.json` 确认版本号正确。

## 项目结构
- React 18 + TypeScript + Vite + Capacitor Android
- OTA 更新源：raw.githubusercontent.com + cdn.jsdelivr.net CDN 回退
- SW 拦截：/、/index.html、/assets/、/books/、/version.json
- IndexedDB 存储：books / chapters / progress 三个 store
