# Qlayo Core

面向屋面和车棚光伏项目的浏览器工作台。支持导入图片或单页 PDF、标定比例与方向、绘制屋面和附属物、自动布置组件、查看 2D／3D 与日照阴影、生成简版报告和导出布置图。实景匹配支持屋面角点或自定义点、前景遮挡、渲染调节和图片下载。

## 本地运行

需要 Node.js 22.13 或更新版本。请使用桌面 Chrome 或 Edge 编辑和保存项目。文件保存依赖浏览器的文件选择器，请通过 localhost 或 HTTPS 打开应用。手机可打开已有项目并查看布置报告。

```sh
git clone https://github.com/qinzeiwang/qlayo-core.git
cd qlayo-core
npm ci
npm run dev
```

## 测试和构建

```sh
npm test
npm run build
npm run preview
```

网站入口是 `dist/index.html`。部署时上传整个 `dist/` 目录，包含 PDF 渲染资源、字体许可和第三方声明。支持静态站点根路径及子路径。最近项目存放在当前浏览器，重要项目请另存为 JSON 文件。

## 项目兼容

Core 可以读取含 Pro 扩展字段的项目，并在保存时保留这些字段。涉及电气、工程量、发电量和收益的输出请回到 Pro 更新。

## 使用许可

Qlayo Core 源码公开，沿用 PVLANE 的 PolyForm Noncommercial License 1.0.0 和商业展示补充许可。允许非商业使用，也允许在商业场合演示软件和展示其输出。收费开发、软件交付、托管等商业用途须按条款取得书面授权。

许可范围详见 [英文完整条款](LICENSE.md) 和 [中文参考](LICENSE.zh-CN.md)。第三方素材和依赖各自适用其许可，见 [第三方声明](THIRD-PARTY-NOTICES.md)。
