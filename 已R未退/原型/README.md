# 已R未退交互原型

克隆仓库后，双击本目录下的 [dist/index.html](dist/index.html) 即可打开原型。跟进列表、详情、状态流转、Excel 批量回填和首次触发时长配置均使用演示数据，修改保存在当前浏览器中。

可编辑的页面和业务规则在 [src](src/) 中。修改源码后，在本目录用 Node.js 重新生成页面并启动本地预览：

```sh
node build.cjs
node server.cjs
```

打开 [本地预览](http://127.0.0.1:4178)。结束预览时按 `Ctrl+C`。Excel 读写和规则排版组件已随源码附带。

## 产品文档

原型右上角的「产品文档」打开随原型一起发布的文档目录。本地使用时请保留完整的 `dist` 文件夹。

- 上一级「已R未退」目录中的每份 `.drawio` 对应 `dist/docs/同名.pdf`，包括原图的全部页面。同名源图更新后沿用原链接。规则正文维护在 [已R未退业务规则.md](../已R未退业务规则.md)。
- Windows 上安装 draw.io Desktop 后，在本目录运行 `.\product-docs\install-watcher.ps1`，即可为当前用户启用保存后自动导出。也可用 `node product-docs/watch.cjs` 只在当前会话监听。监听程序仅更新本地文档。
- 将源图和生成的文档一起提交即可预览。若仅提交源图，GitHub 工作流会在原分支补齐 PDF 和目录。EdgeOne 构建核对源图和 PDF，通过后发布。审阅合入 `main` 后更新正式站。
