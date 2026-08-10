# 剧集框架使用文档（写给作者自己）

你写故事、你设计谜题，框架负责：存档、门禁、密码门、加密工具、氛围组件。
**故事和谜题创意全部由你填写，本文档只教你怎么用工具。**

## 目录结构

```text
episodes/
  README.md        ← 本文件
  _template/       ← 空骨架模板（复制它开新期）
    index.html       期入口页模板
    page.html        内容页模板（可复制成多页）
    404.html         期内假404页模板（"手动改网址"谜题用）
  ep01/            ← 示例期《深夜点歌台》（完整可玩，照着改写）
    index.html       A面：故事 + 密码门
    b-side.html      B面：Base64/改网址谜题
    tape.html        通关页：EP.done()
  ep02/ ... ep12/  ← 待你创建
```

## 新建一期（5 步）

1. 复制 `episodes/_template` 整个文件夹，改名为 `episodes/epXX`（如 ep03）
2. 打开文件夹里每个 HTML，把 `EP.config({ id: 'epXX' })` 的 id 全部改成对应期号
   （**同一期内所有页面 id 必须一致**，否则存档不互通）
3. 替换 `.ep-story` 里的占位故事
4. 设计谜题（见下文组件），设置密码门答案哈希
5. 打开 `archive.html`，把期 id 加进底部脚本的 `CREATED` 数组（"【待补】"标记即消失）

## 调试后门

任意页面 URL 加 `?debug=1`：跳过所有门禁（`EP.require` 直接放行），不影响存档。
例：`episodes/ep03/tape.html?debug=1` 可直接查看通关页。

## 密码门答案哈希怎么生成

密码门不存明文答案，存 SHA-256 哈希。启动本地服务器后在浏览器控制台生成：

```text
node server.js        → 打开 http://localhost:7100/
浏览器控制台输入：EP.sha256('你的答案').then(console.log)
把输出的 hex 填进 EP.gate({ hash: '...' })
```

注意：校验前会自动 `trim + toLowerCase`，所以 "333 " 和 "333" 等价；"ABC" 和 "abc" 等价。
（`file://` 直接双击打开页面没有 `crypto.subtle`，**必须用 server.js 运行**。）

## EP 组件 API 一览

每页必须先：`EP.config({ id: 'epXX', title: '第X期《标题》- FM-MIDNIGHT' })`

### 存档与门禁
| API | 作用 |
|---|---|
| `EP.flag(name)` | 写当前期 flag |
| `EP.has(name)` | 读当前期 flag |
| `EP.require(flag, redirectTo)` | 门禁：无 flag 踢回 redirectTo（debug 放行） |
| `EP.done()` | 标记通关（**只在最后一页调用**，archive 显示"已收听"） |
| `EP.progress.count()` | 已通关期数（0~12），联动用 |
| `EP.progress.isDone('ep03')` | 某期是否通关 |

### 密码门
```js
EP.gate({
  input: '#answer',   // 输入框选择器（必填）
  button: '#submit',  // 按钮选择器（必填）
  msg: '#msg',        // 提示文字元素（可选）
  hash: '<答案的SHA-256>',
  flag: 'gate1',      // 通过后写入的 flag（下一页用 EP.require('gate1', ...) 校验）
  hints: { 3: '第三次错给这个提示', 5: '第五次错直接放水' },
  deny: '不对。',      // 默认拒绝文案
  okText: '对了。',    // 通过文案
  goto: 'next.html'   // 通过后跳转（或用 onOk: function(){...} 回调）
});
```
点击按钮或在输入框按回车都触发校验。

### 加密工具（出题编码 / 玩家自查）
| API | 作用 | 示例 |
|---|---|---|
| `EP.caesar(str, shift)` | 凯撒位移（支持负数） | `EP.caesar('FREQUENCY', 3)` → `IUHTXHQFB` |
| `EP.b64encode(str)` | Base64 编码 | `EP.b64encode('tape.html')` → `dGFwZS5odG1s` |
| `EP.b64decode(str)` | Base64 解码 | 玩家在控制台自己解 |
| `EP.morseText(str)` | 文本转摩斯码 | `EP.morseText('SOS')` → `... --- ...` |
| `EP.param(name)` | 读 URL 参数 | `EP.param('from')` |
| `FM.morse(str)` | 摩斯音频播放（common.js） | 配"开启声音"按钮用 |

### 氛围与触发
| API | 作用 |
|---|---|
| `EP.snow(0~1)` | 雪花噪点屏，返回停止函数 |
| `EP.scare({duration, html, onDone})` | jumpscare（黑层+音效；需玩家先点过"开启声音"） |
| `EP.glitchEl(el, on)` | 元素加/去故障抖动 |
| `EP.idle(sec, cb, once)` | 玩家静止 sec 秒触发（"别走神"类惊吓） |
| `EP.atTime(hour, cb, once)` | 真实小时数命中触发（如 `EP.atTime(3, ...)` 凌晨3点隐藏内容） |
| `EP.consoleHint(msg)` | 控制台线索（故事里引导玩家按 F12） |
| `EP.titleBlink(titles, ms)` | 标签页标题循环切换，返回停止函数 |
| `FM.enableSoundUI()` | "开启声音"按钮（浏览器要求手势后才能出声） |

## 藏线索写法约定

| 手法 | 写法 | 玩家怎么发现 |
|---|---|---|
| HTML 注释 | `<!-- 线索 -->` | 右键查看源码 / F12 |
| 近隐形文字 | `<p class="whisper">线索</p>` | 鼠标选中文字才显形 |
| 图片 alt 藏字 | `<img src="不存在的图.svg" alt="线索">` | 坏图悬停 / 查看源码 |
| 控制台 | `EP.consoleHint('线索')` | 故事里暗示按 F12 |
| 标题闪烁 | `EP.titleBlink(['404','它还在播出'])` | 瞟到浏览器标签页 |
| 改网址 | 假404页藏正确文件名 | 地址栏手动改 |
| URL 参数 | 链接 `xxx.html?from=xx`，页内 `EP.param('from')` 分支 | 观察地址栏 |

**重要取舍**：本游戏"看源码作弊"正是玩法本身——但密码门答案务必只存哈希，
否则玩家查看源码直接看到明文，谜题就废了。

## 常用样式类（css/style.css + css/episode.css）

`.container` `.ep-head`（`.ep-no` 期号 / `.ep-title` 标题 / `.ep-meta` 播出信息）
`.ep-story`（故事正文，首行缩进）`.ep-divider`（分隔线）`.ep-gate` + `.ep-gate-msg`
`.ep-404-box` + `.ep-404-code`（假404）`.ep-broken-img`（坏图占位）
`.whisper` `.glitch-text`（需 `data-text`）`.glitch` `.flicker` `.danger` `.muted` `.small` `.ep-back`

## 示例期 ep01《深夜点歌台》谜题设计表

流程：`index.html →（密码门 333）→ b-side.html →（Base64 改网址）→ tape.html`

| # | 谜面 | 线索位置 | 解法 | 答案 |
|---|------|---------|------|------|
| 1 | "S"来信结尾乱码 `IUHTXHQFB` | 夜莺口播"把钟拨回三格"；"频率表上只剩一个三位数" | 凯撒 -3 → FREQUENCY → 频率三位数 | `333` |
| 2 | B面磁带标签被磨掉 | b-side.html 源码注释藏 `dGFwZS5odG1s`；页底 whisper 提示 Base64 | Base64 解码 → 地址栏改文件名 | `tape.html` |

## 安全边界（务必遵守）

恐怖效果只停留在表现层：禁止真实恶意代码、禁止锁定浏览器、不自动全屏。
含闪光/突发音效的页面确保玩家从 `index.html` 警告页进入（主线入口已有）。
