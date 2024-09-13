# WebNav Hub

WebNav Hub是一个简洁、可自定义的网址导航页面,基于Cloudflare Pages构建。它允许用户轻松管理和访问常用网站链接,并支持在线编辑功能。
![f1148d4aee92043fb7a0c.png](https://img.186404.xyz/file/5fbf538aeded6157ac7e8.png)

## 功能特点

- 响应式设计,适配各种设备
- 分类展示网站链接
- 支持在线添加和编辑链接
- 密码保护的编辑功能
- 使用Font Awesome图标美化链接显示
- 基于Cloudflare Pages,部署简单,访问快速

## 部署步骤

### 1. 克隆仓库


### 2. 创建Cloudflare Pages项目

1. 登录[Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入"Pages"部分
3. 点击"创建项目"
4. 选择"连接到Git",然后选择您的GitHub仓库
5. 在构建设置中:
   - 构建命令: 留空
   - 构建输出目录: `/`
6. 点击"保存并部署"

### 3. 设置KV命名空间

1. 在Cloudflare Dashboard中,转到"Workers & Pages" > "KV"
2. 点击"创建命名空间"
3. 命名为"LINKS_KV"

### 4. 绑定KV到Pages项目

1. 在Pages项目设置中,转到"Functions" > "KV命名空间绑定"
2. 点击"添加绑定"
3. 变量名称设为"LINKS_KV",选择刚才创建的KV命名空间

### 5. 配置环境变量

1. 在Pages项目设置中,转到"环境变量"
2. 添加以下变量:
   - `NODE_VERSION`: 设置为`16`或更高版本
   - `EDIT_PASSWORD`: 设置为您选择的编辑密码

### 6. 重新部署

在Pages项目的"部署"选项卡中,点击"重新部署"以应用新的设置。

## 使用说明

### 访问导航页面

部署完成后,您可以通过Cloudflare Pages提供的URL或您设置的自定义域名访问导航页面。

### 编辑链接

1. 点击页面右下角的"编辑模式"按钮
2. 在弹出的表单中填写以下信息:
   - 编辑密码: 您在环境变量中设置的密码
   - 类别: 选择链接所属类别
   - 标题: 链接显示的名称
   - URL: 网站的完整URL
   - 图标类名: Font Awesome图标类名(如`fas fa-globe`)
3. 点击"保存"按钮提交更改

## 自定义

- 修改`index.html`以添加或删除类别
- 编辑`styles.css`以更改页面样式
- 在`functions/api/links.js`中的`getDefaultLinks()`函数里添加或修改默认链接

- ## 删除新添加的链接

对于部署在 Cloudflare Pages 上的导航页面，新添加的链接存储在 Cloudflare 的 KV (Key-Value) 存储中。要删除这些链接，请按照以下步骤操作：

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)

2. 进入 "Workers & Pages" 部分

3. 在左侧菜单中找到并点击 "KV"

4. 找到您的 KV 命名空间（通常命名为 "LINKS_KV"）

5. 在 KV 命名空间中，您应该能看到所有存储的键值对

6. 找到您想要删除的链接对应的键

7. 点击该键旁边的删除按钮（通常是一个垃圾桶图标）

8. 确认删除操作

请注意，删除操作是不可逆的。在删除之前，请确保您真的想要移除该链接。如果不确定，可以考虑先编辑链接内容，将其暂时隐藏或修改，而不是直接删除。

## 贡献

欢迎提交问题和拉取请求来改进这个项目。

## 许可

本项目采用MIT许可证。详情请见[LICENSE](LICENSE)文件。
