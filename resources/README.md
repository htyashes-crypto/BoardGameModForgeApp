# resources/

App 图标与构建资源目录。

## icon.svg

矢量图标源文件。画布背景透明，与 Hub 页品牌标识（橙金旋转菱形 + MF）一致。修改后需重新生成派生文件。

## 生成派生图标

`electron-icon-builder` 不支持 SVG 直读，脚本会先经 `@resvg/resvg-js` 渲染为透明 PNG，再生成 ico/icns。

```bash
pnpm icons:generate
```

输出：

- `resources/icon.icns` — macOS dock / dmg
- `resources/icon.ico` — Windows installer / 任务栏
- `resources/icons/png/*.png` — 多尺寸（16, 32, 48, 64, 128, 256, 512, 1024）

## electron-builder 引用

`electron-builder.yml` 中 `directories.buildResources: resources`，构建时自动读取 `icon.ico` / `icon.icns`。
