# fish-book 离线版 1.1.0（Windows 64 位）

[点击下载 EPUB + TXT 免安装版](https://github.com/Cyxfssx/fish-bookYYY/raw/refs/heads/download/offline-v1.1.0/downloads/fish-book-offline-1.1.0-win-x64.zip)

完整解压后运行 `fish-book.exe`。书籍放入 `resources/books`，回到“我的书架”点击“同步书架”。升级时请将旧版书籍复制到新版相同目录。

- 支持 TXT、未加密 EPUB 2 / EPUB 3 的文字阅读，全程离线。
- 书架卡片点击“目录 / 选章节”即可跳章，阅读窗口右侧目录图标也可打开章节菜单。
- EPUB 按书内顺序读取章节与目录，TXT 自动识别“第一章”等标题。
- 在快捷键设置中按下小键盘 1、2（`num1`、`num2`）后点击“应用”，结果会有提示。
- 不显示 EPUB 原书排版和图片；不支持 DRM 加密 EPUB。

验证：9 项解析和快捷键测试、生产构建、打包内应用的 EPUB 书架/目录/跳章/翻页、TXT 回归、阅读目录菜单与外网拦截检查通过。Windows EXE 未签名，尚未在真实 Windows 系统上运行验证。

源码与测试在同一分支；下载完整性可用 `SHA256SUMS.txt` 检查。
