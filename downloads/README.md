# 莱 · 本地阅读 1.2.0（Windows 64 位）

[点击下载免安装版](https://github.com/Cyxfssx/fish-bookYYY/raw/refs/heads/download/offline-v1.2.0/downloads/lai-reader-offline-1.2.0-win-x64.zip)

完整解压后运行 `fish-book.exe`。书籍放入 `resources/books`，在“我的书架”点击“同步书架”。升级时请保留旧版书籍并复制到新版相同目录。

- 程序、任务栏窗口与托盘使用绿色“莱”字图标，EXE 图标资源已更新。
- 每页字数支持 5～5000，可在“配置 → 小说阅读器”直接输入；新配置默认 800 字，升级保留已有字数设置。
- 阅读窗口默认高度 420，保留段落换行；长内容可滚动，顶部栏可拖动窗口。
- 保留 TXT、未加密 EPUB 2/3 的文字阅读、目录选章、小键盘翻页和设置应用提示。
- 离线运行，禁止外网请求。EPUB 图片和原书完整样式不显示。

验证：生产构建、EXE 图标资源、打包内应用的 5000 字显示、滚动、翻页、EPUB 目录跳章、TXT 回归和外网拦截均通过。未在真实 Windows 系统上运行验证，EXE 未签名。

下载完整性可使用 `SHA256SUMS.txt` 验证。
