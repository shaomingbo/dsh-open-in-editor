# DSH Open in Editor

Add a configurable local macOS IDE opener to DeepSeek Harness Web produced-file rows.

## Features

- Click a produced filename to open it in the configured default IDE.
- Click its arrow to choose System default, Zed, Visual Studio Code, or Xcode for one open without changing the default.
- Choose the default under **Settings → Open in IDE** and refresh local application detection.
- Open files or directories; relative produced paths are resolved against the session workspace first.

The first release supports macOS only. Ordinary inline file links keep DSH's native opener; this plugin replaces only the produced-files turn tail.

## Installation

Add the GitHub repository and bundle to the DSH `web` profile:

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

Then run in the profile directory:

```sh
pnpm install --ignore-scripts
```

A new Host bundle requires a DSH restart, followed by refreshing the existing Web GUI. For local development, clone the repository and replace the GitHub dependency with `link:/absolute/path/to/dsh-open-in-editor`.

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

Remove `dsh-open-in-editor` from both `dependencies` and `dsh.profile.bundles` in `~/.dsh/profiles/web/package.json`, run `pnpm install --ignore-scripts`, and restart DSH.

## License

MIT
