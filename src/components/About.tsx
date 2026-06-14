import { useState, useCallback } from 'react'
import { checkForUpdates, APP_VERSION } from '../utils/updater'
import { nativeDownload, getNativeProgress, isNativeDownloaderAvailable } from '../plugins/NativeDownloader'

const changelog = [
  { version: '5.15.0', date: '2026-06-15', changes: [
    '头像升级：15个酷炫新头像（龙、鹰、狼、鲨鱼等）',
    '邀请码激活后可在个人资料中清除，状态同步到Supabase',
    '昵称修改冷却从24小时改为1分钟',
    '备份频率可选：1/5/10/30分钟，在通用设置中调整',
    '用户数据全量同步Supabase：书架、设置、搜索历史、备份频率',
    '关于页面下载超时30秒自动弹出失败弹窗+重试/浏览器下载',
    '用户ID显示昵称而非随机后缀',
    '修复头像更新：本地先更新再同步数据库',
    '竖屏锁定：去掉屏幕旋转按钮',
    '修复昵称冷却提醒位置和修改密码文字缩进'
  ]},
  { version: '5.14.0', date: '2026-06-15', changes: [
    '邀请码状态独立存储为Supabase数据库字段（invite_code_activated）',
    '登录时从数据库读取邀请码状态，恢复数据时自动本地激活',
    'hasInviteCode()同时检查localStorage和UserProfile',
    '新增hasInviteCodeFromProfile()函数',
    '上传云端时invite_code_activated作为独立字段更新'
  ]},
  { version: '5.13.1', date: '2026-06-15', changes: [
    '邀请码确认后输入框消失，显示「已激活」状态',
    '邀请码激活状态同步到云端数据库，换设备自动恢复',
    '邀请码按钮改为「确认」，无效码提示错误'
  ]},
  { version: '5.13.0', date: '2026-06-15', changes: [
    '发现页优化：只展示36本推荐+热门tag分类区块',
    '邀请码机制：注册时选填邀请码，设置页可补填，控制集书阁书源可见性',
    '搜索转圈修复：本地结果出来后立即停止',
    '云端恢复修复：添加错误处理和日志',
    '爬虫章节数从30提升到200，解决章节缺失问题',
    '爬虫封面提取增强：更多选择器覆盖',
    '章节目录改为固定高度可滚动区域'
  ]},
  { version: '5.12.0', date: '2026-06-15', changes: [
    '搜索结果添加到书架不再显示未知书名/未知作者',
    '搜索结果全部加载完毕后才停止转圈（本地+在线搜索都结束后）',
    '缓存管理修复：显示实际已缓存章节数和进度条',
    '缓存章节添加bookId字段，支持按书ID查询已缓存内容',
    '爬虫封面提取：所有10个书源自动提取书籍封面图片',
    '爬虫章节排序：从章节标题提取数字用于正确排序',
    '书籍详情章节目录默认全展开，点击直接跳转阅读'
  ]},
  { version: '5.11.0', date: '2026-06-15', changes: [
    '阅读器重写：去掉分页标识，自动合并多页内容为完整章节',
    '新增章节列表弹窗（点击目录按钮/底栏目录按钮）',
    '已读章节标记（绿色✓）+ 已读数据同步到 Supabase',
    '爬虫修复：自动检测并合并分页章节（_2/_3后缀）',
    '底栏新增「目录」按钮，点击弹出章节列表'
  ]},
  { version: '5.10.0', date: '2026-06-15', changes: [
    '书籍库扩充至224本（含经典热门正版书籍）',
    '爬虫扩展到10个书源并行搜索+正版验证机制',
    '发现页直接展示书籍库'
  ]},
  { version: '5.9.9', date: '2026-06-15', changes: [
    '应用图标：纯黑背景+黄色书本居中（缩小50%）'
  ]},
  { version: '5.9.8', date: '2026-06-15', changes: [
    '应用图标：纯黑背景+白色Yellow居中+Impact方正字体+去掉READER'
  ]},
  { version: '5.9.7', date: '2026-06-15', changes: [
    '应用图标：Yellow字样缩小一倍+READER副标题+渐变装饰线',
    '彻查底部遮挡：根因是内层div height:100%吃掉padding-bottom，已移除',
    '去除重复.page-content CSS定义'
  ]},
  { version: '5.9.6', date: '2026-06-15', changes: [
    '搜索结果已添加书籍不再变暗，点击进入详情页（而非直接阅读）',
    '主页底部内容不被底栏遮挡（padding增大到120px）',
    '应用名称改为Yellow',
    '应用图标：白底+黄色Yellow字样+渐变设计'
  ]},
  { version: '5.9.5', date: '2026-06-15', changes: [
    '阅读界面底部安全区增至36px',
    '主页/书架底部内容不被遮挡（padding增大到90px+safe-bottom）',
    '搜索页：初始化显示搜索历史（localStorage持久化，最多15条）',
    '搜索框右侧添加X清除按钮',
    '搜索加速：debounce从400ms降到250ms+本地结果先显示+在线结果追加'
  ]},
  { version: '5.9.4', date: '2026-06-15', changes: [
    '底部安全区从48px降到12px（之前太高挡住内容）',
    '主页/书架底部内容不被遮挡（page-content padding适配）',
    '主页换一换按钮生效（添加shuffleKey强制重排）',
    '阅读界面控制栏完全不透明（rgba(0,0,0,1)）',
    '阅读底部安全区归零（不再有多余间距）'
  ]},
  { version: '5.9.3', date: '2026-06-15', changes: [
    '发现页书籍随机排列（每次进入/换一换都不同顺序）',
    '筛选标签改为flex-wrap换行排列（不再横滑）',
    '底栏安全区增大（padding包含safe-bottom）',
    '发现页底部内容不被底栏遮挡（page-content padding适配）'
  ]},
  { version: '5.9.2', date: '2026-06-14', changes: [
    'toast弹窗位置上移（紧贴状态栏下方）',
    '书架删除书籍需要确认弹窗'
  ]},
  { version: '5.9.1', date: '2026-06-14', changes: [
    '修复缓存状态丢失：App级别维护cachedBookIds集合，跨导航持久化',
    'Tab切换不刷新：改为CSS display:none保持组件挂载（不再条件渲染卸载）',
    '发现页/书架切换不再重新加载数据'
  ]},
  { version: '5.9.0', date: '2026-06-14', changes: [
    '默认光明模式（首次安装不再强制暗黑）',
    '主题设置同步到云端（备份/恢复时包含暗黑模式开关）',
    'Tab切换不重新渲染（去掉key={activeTab}，避免书架/发现页每次切换刷新）',
    '需在Supabase执行: ALTER TABLE yellow_users ADD COLUMN IF NOT EXISTS theme text'
  ]},
  { version: '5.8.7', date: '2026-06-14', changes: [
    'toast弹窗大幅下移：CSS覆盖sonner默认位置(距顶部108px)',
    '搜索页键盘防抖：100dvh+transform:translateY(0)防止底栏被顶起',
    '书架点击书籍进入详情页(新增onViewDetail回调)'
  ]},
  { version: '5.8.6', date: '2026-06-14', changes: [
    '所有顶部弹窗大幅下移(offset 48→120)',
    '阅读界面底部安全区翻倍(24px→48px)'
  ]},
  { version: '5.8.5', date: '2026-06-14', changes: [
    '修复清除数据弹窗被底栏盖住：modal z-index从50提升到200',
    '修复搜索时底栏被键盘顶起：安装@capacitor/keyboard+配置resize:none',
    '修复缓存时弹多个toast：缓存完成检测移入useEffect避免重复触发',
    'toast位置下移：offset=48避免被状态栏遮挡',
    '阅读底部安全区扩大到24px'
  ]},
  { version: '5.8.4', date: '2026-06-14', changes: [
    '修复二级页面弹窗不显示：改用sonner toast（渲染在root层，z-index最高）',
    '已缓存状态自动检测：打开详情页时查询IndexedDB，已缓存书籍直接显示"已缓存"'
  ]},
  { version: '5.8.3', date: '2026-06-14', changes: [
    '书籍详情页：缓存/加入书架操作后显示toast弹窗',
    '缓存完成后按钮变为"已缓存"状态',
    '去掉书籍信息中的"格式"字段',
    '阅读界面底部安全区：Android手势条至少16px'
  ]},
  { version: '5.8.2', date: '2026-06-14', changes: [
    '顶部安全区扩大到48px，标题和返回按钮下移避免被状态栏遮挡'
  ]},
  { version: '5.8.1', date: '2026-06-14', changes: [
    '顶部安全区扩大到36px',
    '去除设置页设备信息',
    '去除关于页OTA调试面板'
  ]},
  { version: '5.8.0', date: '2026-06-14', changes: [
    '下载改用HttpURLConnection直连（绕过国产ROM流量保护限制）',
    '新增30秒超时检测+失败弹窗保留+浏览器下载兜底',
    '顶部安全区fallback增大到32px'
  ]},
  { version: '5.7.2', date: '2026-06-14', changes: [
    '修复键盘弹出时底栏上移：tab-bar改为position:fixed固定底部',
    '扩大二级页面顶部安全区：fallback从24px增大到28px'
  ]},
  { version: '5.7.1', date: '2026-06-14', changes: [
    '修复移动数据下载失败：移除DownloadManager的MIME类型（触发系统安全限制）',
    '下载失败弹窗保留+增加"浏览器下载"兜底按钮',
    '提示用户连接WiFi后重试'
  ]},
  { version: '5.7.0', date: '2026-06-14', changes: [
    '登录后自动从云端恢复数据',
    '每5分钟自动后台备份（静默，显示上次备份时间）',
    '退出登录自动备份+清除本地数据+刷新页面'
  ]},
  { version: '5.6.0', date: '2026-06-14', changes: [
    '集成Supabase云端同步（74k⭐）：昵称+密码注册登录',
    '备份到云端/从云端恢复（书籍+阅读进度+阅读设置）',
    '数据存储在Supabase PostgreSQL数据库'
  ]},
  { version: '5.5.0', date: '2026-06-14', changes: [
    '简化用户系统：只需昵称即可使用，移除密码和同步密钥',
    '数据保存在本设备IndexedDB（离线优先方案）',
    '修复阅读界面底部安全区：只在阅读页处理，主页底栏不再多余padding'
  ]},
  { version: '5.4.1', date: '2026-06-14', changes: [
    '修复底栏被安全区遮挡：改用padding-bottom替代absolute伪元素',
    '修复安全区fallback：无手势条设备不再强制加16px'
  ]},
  { version: '5.4.0', date: '2026-06-14', changes: [
    '修复云同步：移除嵌入token（GitHub Secret Scanning拦截），改为用户输入同步密钥',
    '同步密钥由管理员提供，不暴露在代码中',
    '修复阅读界面滑动：.page-enter添加height:100%',
    '修复底部安全区：检测env(safe-area-inset-bottom)并设置CSS变量'
  ]},
  { version: '5.3.0', date: '2026-06-14', changes: [
    '注册添加密码验证（SHA-256哈希存储）+ 登录/注册双模式',
    '隐藏GitHub相关文案，改为"云端同步"',
    '二级页面进入动画（书籍详情/关于/缓存管理）',
    '修复底部安全区：tab-bar用::after伪元素填充安全区高度'
  ]},
  { version: '5.2.1', date: '2026-06-14', changes: [
    '下载失败时显示提示弹窗：说明从GitHub下载可能不稳定+重试按钮',
    '按钮文字随状态变化：立即更新→下载中...→重新下载'
  ]},
  { version: '5.2.0', date: '2026-06-14', changes: [
    '用户系统重写：昵称注册（无需登录GitHub）',
    '数据存储在开发者GitHub仓库的gh-pages/users/目录',
    '上传/恢复按钮+头像颜色+用户ID显示'
  ]},
  { version: '5.1.0', date: '2026-06-14', changes: [
    '新增用户管理：GitHub Personal Access Token登录（行业标准OAuth方案）',
    '数据同步到GitHub私有Gist（仅用户本人可见）',
    '设置页顶部显示登录状态+头像+上传/恢复按钮',
    '未登录时数据缓存在本地IndexedDB，登录后可同步到云端'
  ]},
  { version: '5.0.1', date: '2026-06-14', changes: [
    '修复加入书架后重启丢失：handleAddBook添加saveBook持久化到IndexedDB'
  ]},
  { version: '5.0.0', date: '2026-06-14', changes: [
    '彻底修复更新后显示旧版本：移除ServiceWorker（Capacitor直接从APK加载，不需要SW缓存）',
    '启动时注销所有旧SW+清除所有CacheStorage',
    '安装新APK后直接显示新版本，不再需要手动清除数据'
  ]},
  { version: '4.9.1', date: '2026-06-14', changes: [
    '测试版本：验证OTA更新+缓存清除+自动安装全流程'
  ]},
  { version: '4.9.0', date: '2026-06-14', changes: [
    '终极修复更新后显示旧版本：原生层MainActivity启动时清除WebView+SW缓存',
    '清除SW CacheStorage/HTTP Cache/Code Cache三个目录',
    '保留IndexedDB（用户书籍数据）和localStorage（用户设置）',
    '每次打开app都加载APK内最新代码，不再依赖SW缓存检测'
  ]},
  { version: '4.8.0', date: '2026-06-14', changes: [
    '修复OTA下载失败：先用HEAD请求解析GitHub 302重定向URL，再传给DownloadManager',
    '下载通知标题包含版本号（如"Yellow v4.8.0 更新"）',
    '下载通知描述改为"正在下载，请稍候..."'
  ]},
  { version: '4.7.0', date: '2026-06-14', changes: [
    '修复更新后显示旧版本：启动时检测版本变化自动清除所有SW缓存并刷新',
    'localStorage记录当前版本号，每次启动对比__APP_VERSION__',
    '版本变化时：清除缓存→注销旧SW→自动刷新页面'
  ]},
  { version: '4.6.0', date: '2026-06-14', changes: [
    '修复OTA下载后自动安装：添加REQUEST_INSTALL_PACKAGES权限',
    'BroadcastReceiver改用RECEIVER_EXPORTED接收系统下载完成广播',
    '下载完成后延迟500ms启动安装（确保JS回调处理完毕）',
    '添加安装日志（Log.d）便于排查问题'
  ]},
  { version: '4.5.0', date: '2026-06-14', changes: [
    '书籍详情页：加入书架/缓存后停留在详情页不退出，显示toast反馈',
    '阅读界面全面屏适配：安全区用主题背景色填充，不再遮挡状态栏和底部手势条',
    '修复字间距：text-align改为left（justify在中文中会把字拉开）'
  ]},
  { version: '4.4.0', date: '2026-06-14', changes: [
    '修复OTA下载失败：改用GitHub直链（DownloadManager原生支持302重定向）',
    '添加User-Agent请求头（防止GitHub拒绝无UA请求）',
    '移除ghfast.top代理（嵌套URL格式DownloadManager不支持）'
  ]},
  { version: '4.3.0', date: '2026-06-14', changes: [
    '阅读界面全面屏适配：内容区正确处理状态栏和底部手势条安全距离',
    '去除右侧黄色竖条（Chapter dots指示器）',
    '阅读进度条整合到底栏：章节滑块+点击跳转+上下章按钮',
    '底栏和顶栏改为毛玻璃半透明效果',
    '缓存管理重写：TanStack Query缓存+存储统计+缓存进度条'
  ]},
  { version: '4.2.0', date: '2026-06-14', changes: [
    '发现页优化：TanStack Query缓存(10分钟新鲜+1小时GC)，页面切换不再重新加载',
    'QueryClientProvider全局注入，所有数据请求自动缓存/去重/重试',
    '移除左右翻页模式(上一版本)，Reader精简到200行'
  ]},
  { version: '4.1.0', date: '2026-06-14', changes: [
    '修复更新下载：改用WebView原生桥接(NativeDownloader)替代失效的Capacitor插件',
    '后台下载+进度条+下载完自动拉起系统安装界面',
    '删除左右翻页模式(上一版本)，Reader精简到200行'
  ]},
  { version: '4.0.0', date: '2026-06-14', changes: [
    '删除左右翻页模式，只保留上下滚动阅读（行业标准阅读方式）',
    '优化滚动体验：WebkitOverflowScrolling平滑滚动',
    '章节切换时自动恢复滚动位置',
    '删除翻页模式设置项，简化阅读设置面板',
    'Reader组件从400行精简到200行'
  ]},
  { version: '3.3.0', date: '2026-06-14', changes: [
    '修复更新下载：AppUpdater插件不可用时自动回退到系统浏览器下载APK',
    '解决"AppUpdater plugin is not implemented on Android"错误'
  ]},
  { version: '3.2.0', date: '2026-06-14', changes: [
    '翻页算法彻底重构：offsetHeight累加分页（替代错误的getBoundingClientRect）',
    '用offsetTop定位页面（不受transform:translateY影响）',
    '分页逻辑：累加段落高度+margin，超过视口高度时在段落顶部断页',
    '双重rAF确保DOM渲染完成后再计算分页'
  ]},
  { version: '3.1.0', date: '2026-06-14', changes: [
    '翻页重写：overflow:hidden+translateY（中文阅读器标准方案）',
    '下载链接改用ghfast.top国内镜像代理'
  ]},
  { version: '3.0.0', date: '2026-06-14', changes: [
    '行业标准重构：集成Dexie.js(12k⭐)/sonner(19k⭐)/react-error-boundary(7k⭐)/DOMPurify(14k⭐)',
    'IndexedDB用Dexie.js重写：类型安全查询+批量操作+自动事务管理',
    'Toast系统改为sonner：支持堆叠/类型/自定义持续时间',
    '错误边界改为react-error-boundary：支持重试+局部隔离',
    '内容渲染添加DOMPurify防XSS',
    'AGENTS.md嵌入完整流程标准+行业标准库清单'
  ]},
  { version: '2.2.0', date: '2026-06-14', changes: [
    'OTA行业标准重构：版本检查+下载链接全部从version.json读取（azhon/AppUpdate标准）',
    'version.json增加downloadUrl/versionCode/updateContent字段',
    '下载链接不再硬编码，服务端可随时更换CDN源'
  ]},
  { version: '2.1.0', date: '2026-06-14', changes: [
    '翻页底层重构：采用CSS Multi-Column分页（epub.js/foliate-js行业标准方案）',
    '文字自动分列：column-width=视口宽度，浏览器自动排版分页',
    '翻页=translateX偏移，松手后snap动画到目标页',
    '手势方向锁定：首次移动>10px后锁定水平/垂直，防止误触'
  ]},
  { version: '2.0.2', date: '2026-06-14', changes: [
    '修复下载进度不动：移除不可靠的镜像HEAD测速，直接用GitHub原链',
    'DownloadManager原生支持HTTP重定向，自动走GitHub CDN',
    '修复Java插件call.resolve重复调用bug，进度轮询改为500ms'
  ]},
  { version: '2.0.1', date: '2026-06-14', changes: [
    '阅读进度：基于章节权重+滚动/翻页位置计算全书百分比',
    '翻页分页：用隐藏测量div获取真实段落高度，不再依赖字符估算',
    '顶栏+底栏+内容区底部均显示进度百分比',
    '底部常驻进度条'
  ]},
  { version: '2.0.0', date: '2026-06-14', changes: [
    '更新机制重写：后台自动下载APK+下载完成后自动拉起安装',
    '国内镜像加速：ghfast.top/ghproxy.cn/mirror.ghproxy.com 优先',
    '原生Capacitor插件：Android DownloadManager下载+FileProvider安装'
  ]},
  { version: '1.9.9', date: '2026-06-14', changes: [
    '更新机制改为跳转GitHub Release下载APK（OTA热更新在SW架构下不可靠）',
    '修复更新描述乱码：GitHub API base64中文UTF-8解码',
    '修复重启后重复弹更新：启动时清除update-pending标记'
  ]},
  { version: '1.9.8', date: '2026-06-14', changes: [
    '修复翻页分页：中文字符宽度从0.55修正为0.95，扣除padding计算可用高度'
  ]},
  { version: '1.9.7', date: '2026-06-14', changes: [
    'OTA终极修复：用GitHub API获取版本（绕过jsDelivr和raw.githubusercontent.com的CDN缓存）'
  ]},
  { version: '1.9.6', date: '2026-06-14', changes: [
    'OTA修复：GitHub raw设为首选更新源（jsDelivr CDN缓存过期不刷新）'
  ]},
  { version: '1.9.5', date: '2026-06-14', changes: [
    'Reader彻底重写：翻页模式和滚动模式完全分离，不再共用容器',
    '翻页模式：overflow:hidden + translateX滑动 + 字符估算分页',
    '滚动模式：overflow:auto 正常上下滚动',
    '切换模式时容器属性完全切换，不再互相干扰'
  ]},
  { version: '1.9.4', date: '2026-06-14', changes: [
    'OTA根治：版本化SW缓存（activate清除旧缓存）+ 纯XHR检查 + 启动清理',
    '安装新版本后自动清除旧缓存，保留用户设置',
    '版本号直接编译进JS bundle，不再读version.json'
  ]},
  { version: '1.9.3', date: '2026-06-14', changes: [
    'OTA调试版：About页直接用XHR测试CDN可达性，显示调试日志'
  ]},
  { version: '1.9.2', date: '2026-06-14', changes: [
    'OTA验证版本：确认app内检查更新可正常检测到新版本'
  ]},
  { version: '1.9.1', date: '2026-06-14', changes: [
    '翻页彻底重写：渲染全部段落+DOM实测高度分页+translateY定位',
    '修复滑动弹回：swipe用translateX偏移，松手后CSS transition动画到新页',
    '内容区touchAction:none防止WebView默认手势干扰'
  ]},
  { version: '1.9.0', date: '2026-06-14', changes: [
    'OTA彻底修复：版本号编译进JS bundle，不再依赖运行时fetch',
    'OTA检查添加XMLHttpRequest超时兜底（WebView fetch可能失效）',
    '翻页分页useEffect替代useRef+底部安全距离修复'
  ]},
  { version: '1.8.0', date: '2026-06-14', changes: [
    '左右翻页改为分页模式：文字自动切割成页，左右滑动翻页（非逐章切换）',
    '书籍详情页显示内容标签（短篇/校园/情感等），移除格式标签',
    '书籍缩略图无封面时完整显示书名（支持换行）',
    '阅读底栏显示页码+章节进度',
    'OTA更新检查：fetch超时保护+错误toast提示'
  ]},
  { version: '1.6.6', date: '2026-06-14', changes: [
    '彻查清理垃圾代码：删除scripts/爬虫脚本、占位书籍、无用组件、临时文件',
    '修复db.ts未使用导入，index.json移除无效书籍条目',
    '重建APK确保版本号正确'
  ]},
  { version: '1.6.5', date: '2026-06-14', changes: [
    '修复系统右滑返回：cap sync注册@capacitor/app插件（capacitor.plugins.json为空导致插件未加载）',
    '重新构建APK，删除设置页刷新按钮，OTA更新时清理旧缓存'
  ]},
  { version: '1.6.4', date: '2026-06-14', changes: [
    '删除设置页「刷新页面」按钮（会导致版本倒退）', 'OTA更新时清理旧assets缓存，防止reload加载旧JS'
  ]},
  { version: '1.6.3', date: '2026-06-14', changes: [
    '修复系统右滑返回手势：用Capacitor backButton事件替代popstate'
  ]},
  { version: '1.6.2', date: '2026-06-14', changes: [
    '二级页面（关于/书籍详情/缓存管理/阅读器）支持系统右滑返回手势'
  ]},
  { version: '1.6.1', date: '2026-06-14', changes: [
    '检查更新无新版本时弹窗显示「当前已是最新版本 vX.Y.Z」'
  ]},
  { version: '1.6.0', date: '2026-06-14', changes: [
    '设置页重构：去掉阅读设置（保留在阅读界面右上角），改为全局设置',
    '新增：自动检查更新开关、刷新页面、清除所有数据、设备信息',
    '设置项分组展示（通用/存储/关于）+ iOS风格列表样式'
  ]},
  { version: '1.5.7', date: '2026-06-14', changes: [
    'OTA检查等待ServiceWorker就绪后再发请求（不再首次失败）', 'jsDelivr CDN优先（国内更稳定）', '版本号读取与SW就绪同步'
  ]},
  { version: '1.5.6', date: '2026-06-14', changes: [
    '修复设置页黑屏：Settings全字段null安全兜底 + ErrorBoundary防崩溃',
    '崩溃时显示错误信息和「清除数据并重启」按钮'
  ]},
  { version: '1.5.5', date: '2026-06-14', changes: [
    '启动时预热ServiceWorker，2秒后弹窗提示有新版本可更新'
  ]},
  { version: '1.5.4', date: '2026-06-14', changes: [
    '修复设置页黑屏：旧localStorage缺少brightness/paragraphSpacing字段时用默认值兜底'
  ]},
  { version: '1.5.3', date: '2026-06-14', changes: [
    'OTA更新检查首次失败修复：去掉AbortController超时，改为3次递增延迟重试（2s/4s/6s）'
  ]},
  { version: '1.5.2', date: '2026-06-14', changes: [
    '阅读底栏去掉重复的「设置」按钮（保留顶栏设置）', '设置页去掉存储信息显示区', '新增阅读内容宽度设置（窄/标准/宽/全屏）'
  ]},
  { version: '1.5.1', date: '2026-06-14', changes: [
    '设置页新增阅读器设置（字体/行距/段距/亮度/主题/字体族）', 'OTA首次检查失败自动重试（1.5s延迟后二次尝试）', '阅读内容区亮度调节（CSS filter）', '滚动条全面屏手势条适配', '移除旧版清除缓存按钮（统一用缓存管理）'
  ]},
  { version: '1.5.0', date: '2026-06-14', changes: [
    '书籍详情页新增「缓存」按钮，后台逐章缓存到本地', '设置新增缓存管理二级界面（查看/删除已缓存书籍）', 'OTA更新完成后弹窗提示（不再直接reload）', '阅读器内容区全面屏上下安全区间距修正'
  ]},
  { version: '1.4.2', date: '2026-06-14', changes: [
    '阅读器顶栏底栏改为黄色高亮突出', '顶栏底栏全面屏safe-area适配', '章节指示条优化'
  ]},
  { version: '1.4.1', date: '2026-06-14', changes: [
    'OTA更新源增加jsDelivr CDN镜像回退', '自动检查更新失败时显示错误提示', 'HTML资源解析适配相对路径(./assets/)'
  ]},
  { version: '1.4.0', date: '2026-06-14', changes: [
    '全局全面屏安全区自适应（JS兜底检测+CSS变量统一）', 'header/tab-bar/modal/toast 全面适配安全区', '书籍详情页：章节目录/作者/操作按钮完成', '预缓存书索引增至18本'
  ]},
  { version: '1.3.0', date: '2026-06-14', changes: [
    '发现页点击进入书籍详情页（显示章节目录/作者/来源等信息）', '详情页可加入书架后再开始阅读', '阅读器全面屏安全区适配修复（顶部按钮不再被状态栏遮挡）', '预缓存书籍增至12本'
  ]},
  { version: '1.2.0', date: '2026-06-13', changes: [
    '发现页改为本地加载预缓存书籍', '预置7本小说本地缓存（JSON格式含全文）', '支持OTA远程获取新增书籍到发现页', '搜索页增加本地书籍索引搜索'
  ]},
  { version: '1.1.0', date: '2026-06-13', changes: [
    '新增发现页：热门分类推荐、书籍卡片浏览', '暗黑/白天模式切换', '全面屏沉浸式适配', '搜索性能大幅优化（8s超时、并发提速）', '启动自动检查OTA更新并弹窗提醒', '书源增加到21个（含集书阁）'
  ]},
  { version: '1.0.0', date: '2026-06-13', changes: [
    '首个正式版发布', '内置20+中文小说书源', '多源搜索与换源', '书架管理与本地缓存', '沉浸式阅读器（主题/字体调节）', 'OTA热更新支持', '迭代日志'
  ]},
  { version: '0.3.0', date: '2026-06-10', changes: ['重构书源架构', '支持多源并行搜索', '阅读器性能优化', 'UI动效改进']},
  { version: '0.2.0', date: '2026-06-05', changes: ['阅读器核心功能', '字体/主题切换', '章节缓存', '阅读进度保存']},
  { version: '0.1.0', date: '2026-06-01', changes: ['项目初始化', 'React + TypeScript + Vite', '书架页面', 'Gutendex API搜索', 'IndexedDB存储']}
]

interface Props {
  currentVersion: string
  showToast: (msg: string) => void
  onClose: () => void
  onOtaSuccess?: (version: string) => void
}

export default function About({ currentVersion, showToast, onClose, onOtaSuccess }: Props) {
  const [checking, setChecking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null)
  const [remoteDesc, setRemoteDesc] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [showLatest, setShowLatest] = useState(false)
  const [expandedVer, setExpandedVer] = useState<string | null>('5.15.0')

  const checkUpdate = useCallback(async () => {
    setChecking(true)
    setErrorMsg('')
    setRemoteVersion(null)

    const result = await checkForUpdates()
    setChecking(false)

    if (result.error) {
      setErrorMsg(result.error)
      showToast(`检查失败: ${result.error}`)
      return
    }
    if (result.hasUpdate && result.updateInfo) {
      setRemoteVersion(result.updateInfo.version)
      setRemoteDesc(result.updateInfo.updateContent)
      setDownloadUrl(result.updateInfo.downloadUrl)
    } else {
      setShowLatest(true)
    }
  }, [showToast])

  const startDownload = useCallback(async () => {
    if (downloading || !remoteVersion) return
    if (!isNativeDownloaderAvailable()) {
      showToast('下载组件未加载，请重启app')
      return
    }
    setDownloading(true)
    setDownloadProgress(0)
    setDownloadError(null)
    try {
      await nativeDownload(downloadUrl, `yellow-v${remoteVersion}.apk`, remoteVersion)
      const poll = setInterval(() => {
        const p = getNativeProgress()
        if (p >= 0 && p <= 100) setDownloadProgress(p)
        if (p === 100) {
          clearInterval(poll)
        } else if (p === -1) {
          clearInterval(poll)
          setDownloading(false)
          setDownloadError('下载失败，可能是网络问题或存储空间不足')
        }
      }, 500)
      setTimeout(() => {
        if (getNativeProgress() <= 0) {
          clearInterval(poll)
          setDownloading(false)
          setDownloadError('下载超时，请检查网络后重试')
        }
      }, 30000)
    } catch (e) {
      setDownloading(false)
      setDownloadError((e as Error).message || '下载失败')
    }
  }, [remoteVersion, downloading, showToast, downloadUrl])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <div className="header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', padding: 0, display: 'flex' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>关于 Yellow</h1>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px calc(var(--safe-bottom) + 16px)' }}>
        {/* 版本信息 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>Yellow</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>简洁强大的移动端阅读器</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>当前版本 v{currentVersion} · React + Capacitor</div>
        </div>

        {/* 版本更新 */}
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>版本更新</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>当前 v{currentVersion}</div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={checkUpdate}
              disabled={checking || downloading}
            >
              {checking ? '检查中...' : '检查更新'}
            </button>
          </div>

          {remoteVersion && (
            <div className="scale-in" style={{
              background: 'var(--accent-glow)', border: '1px solid rgba(240,192,64,0.3)',
              borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginTop: 12
            }}>
              <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>
                ↑ 发现新版本 v{remoteVersion}
              </div>
              {remoteDesc && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{remoteDesc}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>v{currentVersion} → v{remoteVersion}</div>
              <button
                className="btn btn-primary btn-sm" style={{ marginTop: 10, width: '100%' }}
                onClick={startDownload} disabled={downloading}
              >
                {downloading ? `下载中 ${downloadProgress}%` : '立即更新'}
              </button>
              {downloading && (
                <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${downloadProgress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
              )}
              {downloadError && (
                <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.2)' }}>
                  <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 6, fontWeight: 600 }}>{downloadError}</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }}
                      onClick={() => { setDownloadError(null); startDownload() }}>
                      重新下载
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }}
                      onClick={() => window.open(downloadUrl, '_system')}>
                      浏览器下载
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="fade-in" style={{
              background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.3)',
              borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginTop: 10,
              fontSize: 12, color: 'var(--danger)'
            }}>{errorMsg}</div>
          )}
        </div>

        {/* 书源统计 */}
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>内置书源</span>
            <span style={{ fontWeight: 600 }}>20 个</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            笔趣阁系列 · 趣笔阁 · 顶点小说 · 妙笔阁 等
          </div>
        </div>

        {/* 迭代日志 */}
        <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>迭代日志</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {changelog.map((v, i) => (
            <div key={v.version} className="card fade-in" style={{ padding: 0, animationDelay: `${i * 0.05}s`, border: v.version === '1.0.0' ? '1px solid var(--accent)' : undefined }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer' }}
                onClick={() => setExpandedVer(expandedVer === v.version ? null : v.version)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 4, background: v.version === '1.0.0' ? 'var(--accent)' : 'var(--text-muted)' }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>v{v.version}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.date}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: expandedVer === v.version ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-muted)' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <div style={{
                overflow: 'hidden', maxHeight: expandedVer === v.version ? 300 : 0,
                opacity: expandedVer === v.version ? 1 : 0,
                transition: 'max-height 0.3s ease, opacity 0.2s ease'
              }}>
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {v.changes.map((c, ci) => (
                    <div key={ci} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--accent)' }}>+</span> {c}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showLatest && (
        <div className="modal-overlay" onClick={() => setShowLatest(false)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: 'rgba(76,175,132,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4caf84" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: 'var(--success)' }}>当前已是最新版本</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>v{currentVersion}</p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowLatest(false)}>知道了</button>
          </div>
        </div>
      )}
    </div>
  )
}
