# DSH Open in Editor

为 DeepSeek Harness Web 的“产物文件”增加可配置的本地 macOS IDE 打开方式。

## 功能

- 点击产物文件名：用设置中的默认 IDE 打开。
- 点击文件旁的箭头：临时选择系统默认、Zed、Visual Studio Code 或 Xcode，不修改默认值。
- 在 **设置 → 打开方式** 中选择默认 IDE，并刷新本机应用探测结果。
- 支持文件与目录；相对产物路径会先按会话工作区解析。

第一版只支持 macOS。正文中的普通可点击路径仍使用 DSH 原生打开方式；本插件只接管每轮结束后的“产物文件”行。

## 安装

在 DSH `web` profile 中添加 GitHub 仓库依赖和 bundle：

```json
{
  "dependencies": {
    "dsh-open-in-editor": "github:shaomingbo/dsh-open-in-editor"
  },
  "dsh": {
    "profile": {
      "bundles": ["dsh-open-in-editor"]
    }
  }
}
```

然后在 profile 目录运行：

```sh
pnpm install --ignore-scripts
```

新增 Host bundle 后需要重启 DSH，再刷新已有 Web GUI。本地开发时可先克隆仓库，再把 GitHub 依赖替换为 `link:/仓库的绝对路径/dsh-open-in-editor`。

## 安全设计

- 浏览器到 Host 的 RPC 仅允许 loopback authority。
- Host 只接受绝对路径，并用 `realpath` 和 `stat` 确认可访问目标是普通文件或目录。
- 应用来自固定 allowlist；不接受自定义命令、可执行文件或参数。
- 使用 `/usr/bin/open` 的参数数组启动应用，不经过 shell，也不拼接命令字符串。
- 默认 IDE 使用 DSH 统一 settings namespace `open-in-editor` 持久化。

## 开发

```sh
pnpm install --ignore-scripts
npm run check
```

测试覆盖 IDE 探测、路径校验、安全 argv、默认/临时 IDE、loopback RPC、turn-tail chain、产物去重和设置页注册。

## 卸载

从 `~/.dsh/profiles/web/package.json` 的 `dependencies` 与 `dsh.profile.bundles` 中删除 `dsh-open-in-editor`，重新运行 `pnpm install --ignore-scripts`，然后重启 DSH。

## License

MIT
