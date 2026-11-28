# Qlayo Core

Qlayo Core 是面向屋面和车棚的光伏布置与实景预览工具。可导入图片或单页 PDF，也可在空白画布上绘制。完成布置后，可以查看 2D／3D、检查日照与阴影、下载布置图或打印布局报告。

## 最近更新

- 双坡和连坡屋面支持多边形轮廓。连坡可快速等分，也可在图上切割并分别设置各跨坡度。
- 2D 画布支持输入角度旋转，也可沿底图参考边点选两点校平。绘制时已有区域以半透明显示。
- 平屋面最大连排数提高到 100 排。各屋面可单独设置四周间距，坡屋面还可单独设置屋脊或高侧间距。
- 装机量和组件数量移到画布右下角，与图例及指北针统一尺寸。

## 本地运行

需要 Node.js 22.13 或更新版本。请使用桌面 Chrome 或 Edge 编辑和保存项目。文件保存依赖浏览器的文件选择器，请通过 localhost 或 HTTPS 打开应用。手机可打开已有项目并查看布置报告。

```sh
git clone https://github.com/qinzeiwang/qlayo-core.git
cd qlayo-core
npm ci
npm run dev
```

打开终端显示的本地地址。第一次使用可按 [简明使用指南](docs/USER-GUIDE.md) 从新建项目做到保存和导出。

## 测试和构建

```sh
npm test
npm run build
npm run preview
```

网站入口是 `dist/index.html`。部署时上传整个 `dist/` 目录，包含 PDF 渲染资源、字体许可和第三方声明。支持静态站点根路径及子路径。最近项目存放在当前浏览器，重要项目请另存为 JSON 文件。

## 使用许可

Qlayo Core 源码公开，沿用 PVLANE 的 PolyForm Noncommercial License 1.0.0 和商业展示补充许可。允许非商业使用，也允许在商业场合演示软件和展示其输出。收费开发、软件交付、托管等商业用途须按条款取得书面授权。

许可范围详见 [英文完整条款](LICENSE.md) 和 [中文参考](LICENSE.zh-CN.md)。第三方素材和依赖各自适用其许可，见 [第三方声明](THIRD-PARTY-NOTICES.md)。
