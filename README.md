# WebNav Hub

一个简洁、可自定义的网址导航页，基于 Cloudflare Pages 构建。收录常用站点，支持在线添加、编辑和删除链接。

![WebNav Hub](https://img.186404.xyz/file/5fbf538aeded6157ac7e8.png)

## 功能特点

- 响应式布局，适配手机与桌面端
- 按分类展示链接，滚动时自动高亮当前分类
- 在线添加、编辑、删除链接，修改密码保护
- 加载失败提示与重试，操作结果使用 Toast 提示
- 键盘可操作，支持减少动态效果（`prefers-reduced-motion`）
- 使用 Font Awesome 图标美化链接显示
- 服务端校验分类、标题、网址与图标类名
- 基于 Cloudflare Pages，部署简单，访问快速

## 项目结构

```
.
├── index.html              # 页面结构与分类
├── styles.css              # 样式
├── script.js               # 渲染、滚动高亮与编辑交互
├── favicon.svg             # 站点图标
├── _headers                # Cloudflare Pages 安全响应头与缓存策略
└── functions/
    └── api/
        └── links.js        # GET / POST / DELETE 接口与默认链接
```

## 部署步骤

### 1. 克隆仓库

```bash
git clone https://github.com/bbylw/kvp.git
cd kvp
```

### 2. 创建 Cloudflare Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 "Workers & Pages"，点击 "创建"
3. 选择 "Pages" → "连接到 Git"，然后选择你的 GitHub 仓库
4. 构建设置中：
   - 构建命令：留空
   - 构建输出目录：`/`
5. 点击 "保存并部署"

### 3. 设置 KV 命名空间

1. 在 Cloudflare Dashboard 中，转到 "Workers & Pages" → "KV"
2. 点击 "创建命名空间"，命名为 `LINKS_KV`

### 4. 绑定 KV 到 Pages 项目

1. 在 Pages 项目设置中，转到 "Functions" → "KV 命名空间绑定"
2. 点击 "添加绑定"，变量名称设为 `LINKS_KV`，选择刚创建的命名空间

### 5. 配置环境变量

在 Pages 项目设置的 "环境变量" 中添加：

- `EDIT_PASSWORD`：编辑密码（必须设置，否则所有写操作都会被拒绝）
- `NODE_VERSION`：可选，设置为 `16` 或更高版本

### 6. 重新部署

在 "部署" 选项卡中点击 "重新部署"，让绑定和环境变量生效。

## 使用说明

点击右下角「管理」进入编辑模式：

- 「添加链接」：填写标题、网址、分类、图标类名（可选）和编辑密码
- 点击卡片右上角的铅笔图标：编辑已有链接
- 点击卡片右上角的垃圾桶图标：删除链接
- 再次点击「完成」退出编辑模式

编辑密码只保存在当前页面的内存中，刷新或关闭页面后需要重新输入，不会写入 LocalStorage。

### 图标

图标使用 Font Awesome 7 类名，例如 `fa-solid fa-globe`、`fa-brands fa-github`、`fa-regular fa-images`；同时兼容旧写法 `fas` / `far` / `fab`。
留空时会自动使用 `fa-solid fa-globe`。可在 [Font Awesome 图标库](https://fontawesome.com/search) 查询。

## 接口

所有接口位于 `/api/links`：

| 方法 | 用途 | 请求体 |
| --- | --- | --- |
| `GET` | 获取全部链接 | 无 |
| `POST` | 新增或更新链接 | `{ "password": "...", "link": { "category", "title", "url", "icon" }, "originalUrl"?: "..." }` |
| `DELETE` | 删除链接 | `{ "password": "...", "url": "..." }` |

服务端会校验：

- 分类必须是已知分类
- 标题必填，最长 60 个字符
- 网址仅允许 `http` / `https`
- 图标类名需符合 `fa-solid|fa-regular|fa-brands`（兼容 `fas|far|fab`）加 `fa-*` 的格式
- 链接总数上限 500 条

返回内容均为 JSON；出错时包含 `error` 字段。密码比较使用哈希后的恒定时间比较。

## 自定义

- 修改 `index.html` 中的 `<section>` 可增删分类；导航和表单选项会自动从中生成
- 新增或修改分类时，同时更新 `functions/api/links.js` 中的 `CATEGORIES`，否则接口会拒绝该分类
- 编辑 `styles.css` 调整配色与布局（顶部 `:root` 中的 CSS 变量）
- 在 `functions/api/links.js` 的 `getDefaultLinks()` 中添加或修改默认链接

## 数据与删除

新添加或修改的链接保存在 Cloudflare KV 的 `all_links` 键中。直接在页面中删除即可；如需整体重置，可在 KV 中删除 `all_links` 键，页面会重新使用默认链接。

KV 中的 `all_links` 一旦存在（包括空数组），就不会再回退到默认链接，这是预期行为。

## 安全说明

- 页面渲染使用 DOM API 与 `textContent`，不会把链接标题或图标当作 HTML 插入，避免 XSS
- `_headers` 为站点配置了 CSP、`X-Content-Type-Options`、`X-Frame-Options` 等安全响应头
- CSP 允许从 cdnjs 加载 Font Awesome；如需更严格策略，可将其改为自托管
- 编辑密码通过环境变量配置，请勿提交到仓库

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 许可

本项目采用 MIT 许可证。详情请见 [LICENSE](LICENSE) 文件。
