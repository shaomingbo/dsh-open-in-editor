# DSH Open in Editor

为 DeepSeek Harness Web 的“产物文件”增加可配置的本地 macOS IDE 打开方式。

## 功能

- 点击产物文件名：用设置中的默认 IDE 打开。
- 点击文件旁的箭头：临时选择系统默认、Zed、Visual Studio Code 或 Xcode，不修改默认值。
- 在 **设置 → 打开方式** 中选择默认 IDE，并刷新本机应用探测结果。
- 支持文件与目录；相对产物路径会先按会话工作区解析。

第一版只支持 macOS。正文中的普通可点击路径仍使用 DSH 原生打开方式；本插件只接管每轮结束后的“产物文件”行。

## 安装

运行固定 GitHub release 的安装器：

```sh
npx --yes github:shaomingbo/dsh-open-in-editor#v0.2.1
```

安装器会安全更新 `web` profile、启用 bundle，并执行 `pnpm install --ignore-scripts`。它会保留 package manifest 备份；如果依赖安装失败，会恢复原始 manifest。安装器绝不会自动重启 DSH。

安装完成后，请手动重启 DSH，并强制刷新现有 Web GUI。

需要指定其他 profile 或本地源码时：

```sh
npx --yes github:shaomingbo/dsh-open-in-editor#v0.2.1 --profile web
npx --yes github:shaomingbo/dsh-open-in-editor#v0.2.1 --source link:/仓库的绝对路径/dsh-open-in-editor
```

自动化场景也可以通过 `DSH_OPEN_IN_EDITOR_SOURCE` 覆盖 source。

查询当前配置状态：

```sh
npx --yes github:shaomingbo/dsh-open-in-editor#v0.2.1 status
```

手动修改 profile 仅作为兜底方案：在 `dependencies` 中加入固定 tag 的 source，把 `dsh-open-in-editor` 加入 `dsh.profile.bundles`，再在 profile 目录运行 `pnpm install --ignore-scripts`。

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

```sh
npx --yes github:shaomingbo/dsh-open-in-editor#v0.2.1 uninstall
```

然后手动重启 DSH，并强制刷新 Web GUI。

## License

MIT
