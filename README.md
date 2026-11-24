# Qlayo Core

面向屋面和车棚光伏项目的浏览器工作台。支持导入图片或单页 PDF、标定比例与方向、绘制屋面和附属物、自动布置组件、查看 2D／3D 与日照阴影、生成简版报告和导出布置图。实景匹配支持屋面角点或自定义点、前景遮挡、渲染调节和图片下载。

## 本地运行

需要 Node.js 22.13 或更新版本。推荐使用桌面 Chrome 或 Edge，文件保存依赖浏览器的文件选择器。使用 localhost 或 HTTPS 打开应用。

```sh
npm ci
npm run dev
```

## 测试和构建

```sh
npm test
npm run build
npm run preview
```

网站入口是 `dist/index.html`。产物可部署到静态站点，使用相对资源路径。最近项目存放在当前浏览器，重要项目请另存为 JSON 文件。

## 项目兼容

Core 可以读取含 Pro 扩展字段的项目，并在保存时保留这些字段。涉及电气、工程量、发电量和收益的输出请回到 Pro 更新。

第三方素材和组件的出处见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。此目录是本地发布候选，Qlayo Core 的许可证待确定。
