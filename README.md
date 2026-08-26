# DSH Open in Editor

Add a configurable local macOS IDE opener to DeepSeek Harness Web produced-file rows.

## Features

- Click a produced filename to open it in the configured default IDE.
- Click its arrow to choose System default, Zed, Visual Studio Code, or Xcode for one open without changing the default.
- When a turn produces more than six paths, expand **+N more** to access every file and collapse it again when finished.
- Choose the default under **Settings → Open in IDE** and refresh local application detection.
- Open files or directories; relative produced paths are resolved against the session workspace first.

The first release supports macOS only. Ordinary inline file links keep DSH's native opener; this plugin replaces only the produced-files turn tail.

## Installation

Run the pinned GitHub release installer:

```sh
npx --yes github:shaomingbo/dsh-open-in-editor#v0.2.2
```

The installer safely updates the `web` profile, enables the bundle, and runs `pnpm install --ignore-scripts`. It preserves a package-manifest backup and restores the original manifest if dependency installation fails. It never restarts DSH automatically.

After installation, restart DSH manually and hard-refresh the existing Web GUI.

Use another profile or package source when needed:

```sh
npx --yes github:shaomingbo/dsh-open-in-editor#v0.2.2 --profile web
npx --yes github:shaomingbo/dsh-open-in-editor#v0.2.2 --source link:/absolute/path/to/dsh-open-in-editor
```

`DSH_OPEN_IN_EDITOR_SOURCE` provides the same source override for automation.

Check the configured state:

```sh
npx --yes github:shaomingbo/dsh-open-in-editor#v0.2.2 status
```

Manual profile editing remains a fallback: add the pinned source to `dependencies`, add `dsh-open-in-editor` to `dsh.profile.bundles`, then run `pnpm install --ignore-scripts` in the profile directory.

## Security

- Browser-to-Host RPC is restricted to loopback authority.
- The Host accepts absolute paths only and uses `realpath` plus `stat` to require an existing regular file or directory.
- Applications come from a fixed allowlist; arbitrary commands, executables, and arguments are not accepted.
- `/usr/bin/open` is invoked with an argv array and never through a shell.
- The default IDE is persisted through DSH's `open-in-editor` settings namespace.

## Development

```sh
pnpm install --ignore-scripts
npm run check
```

Tests cover application detection, path validation, safe argv construction, default and one-shot IDE selection, loopback RPC registration, turn-tail chain selection, produced-path deduplication, and settings registration.

## Uninstall

```sh
npx --yes github:shaomingbo/dsh-open-in-editor#v0.2.2 uninstall
```

Then restart DSH manually and hard-refresh the Web GUI.

## License

MIT
