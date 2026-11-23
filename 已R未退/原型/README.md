# 已R未退交互原型

克隆仓库后，双击本目录下的 [dist/index.html](dist/index.html) 即可打开原型。跟进列表、详情、状态流转、Excel 批量回填和首次触发时长配置均使用演示数据，修改保存在当前浏览器中。

可编辑的页面和业务规则在 [src](src/) 中。修改源码后，在本目录用 Node.js 重新生成页面并启动本地预览：

```sh
node build.cjs
node server.cjs
```

打开 [本地预览](http://127.0.0.1:4178)。结束预览时按 `Ctrl+C`。构建使用 Node.js 自带模块，Excel 读写组件及其[许可证](src/vendor/LICENSE-SheetJS.txt)已随源码附带。
