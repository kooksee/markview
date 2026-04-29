<p align="center">
<br><br><br>
<img src="https://github.com/kooksee/markview/raw/main/images/logo.svg" width="120" alt="markview">
<br><br><br>
</p>

# markview

[![build](https://github.com/kooksee/markview/actions/workflows/ci.yml/badge.svg)](https://github.com/kooksee/markview/actions/workflows/ci.yml) ![Coverage](https://raw.githubusercontent.com/k1LoW/octocovs/main/badges/kooksee/markview/coverage.svg) ![Code to Test Ratio](https://raw.githubusercontent.com/k1LoW/octocovs/main/badges/kooksee/markview/ratio.svg) ![Test Execution Time](https://raw.githubusercontent.com/k1LoW/octocovs/main/badges/kooksee/markview/time.svg)

`markview` is a Markdown viewer that opens `.md` files in a browser.

> For AI coding assistant/project guidance, use `.github/copilot-instructions.md` as the single source of truth.

## Features

- GitHub-flavored Markdown (tables, task lists, footnotes, etc.)
- Syntax highlighting ([Shiki](https://shiki.style/))
- [Mermaid](https://mermaid.js.org/) diagram rendering
- LaTeX math rendering ([KaTeX](https://katex.org/))
- <img src="images/icons/theme-light.svg" width="16" height="16" alt="dark theme"> Dark / <img src="images/icons/theme-dark.svg" width="16" height="16" alt="light theme"> light theme
- <img src="images/icons/group.svg" width="16" height="16" alt="group"> File grouping
- <img src="images/icons/toc.svg" width="16" height="16" alt="toc"> Table of contents panel
- <img src="images/icons/view-flat.svg" width="16" height="16" alt="flat view"> Flat / <img src="images/icons/view-tree.svg" width="16" height="16" alt="tree view"> tree sidebar view with drag-and-drop reorder and file search
- YAML frontmatter display (collapsible metadata block)
- MDX file support (renders as Markdown, strips `import`/`export`, escapes JSX tags)
- <img src="images/icons/width-expand.svg" width="16" height="16" alt="wide view"> Wide / <img src="images/icons/width-compress.svg" width="16" height="16" alt="narrow view"> narrow content width toggle
- <img src="images/icons/raw.svg" width="16" height="16" alt="raw"> Raw markdown view
- <img src="images/icons/copy.svg" width="16" height="16" alt="copy"> Copy content (Markdown / Text / HTML)
- <img src="images/icons/restart.svg" width="16" height="16" alt="restart"> Server restart with session preservation
- Auto session backup and restore
- Drag-and-drop file addition from the OS file manager (content is loaded in-memory; live-reload is not supported for dropped files)
- Live-reload on save (for files opened via CLI)

## Install

**homebrew tap:**

```console
$ brew install kooksee/tap/markview
```

**manually:**

Download binary from [releases page](https://github.com/kooksee/markview/releases)

## Usage

``` console
$ markview README.md                          # Open a single file
$ markview README.md CHANGELOG.md docs/*.md   # Open multiple files
$ markview spec.md --target design            # Open in a named group
```

`markview` opens Markdown files in a browser with live-reload. When you save a file, the browser automatically reflects the changes.

### Single server, multiple files

By default, `markview` runs a single server on port `6275`. If a server is already running on the same port, subsequent `markview` invocations add files to the existing session instead of starting a new one.

``` console
$ markview README.md          # Starts a markview server in the background
$ markview CHANGELOG.md       # Adds the file to the running markview server
```

To run a completely separate session, use a different port:

``` console
$ markview draft.md -p 6276
```

![Multiple files with sidebar](images/multiple-files.png)

### Groups

Files can be organized into named groups using the `--target` (`-t`) flag. Each group gets its own URL path and sidebar.

``` console
$ markview spec.md --target design      # Opens at http://localhost:6275/design
$ markview api.md --target design       # Adds to the "design" group
$ markview notes.md --target notes      # Opens at http://localhost:6275/notes
```

![Group view](images/groups.png)

### Glob pattern watching

Use `--watch` (`-w`) to specify glob patterns. Matching files are opened automatically, and watched directories are monitored for new files.

``` console
$ markview --watch '**/*.md'                          # Watch and open all .md files recursively
$ markview --watch 'docs/**/*.md' --target docs       # Watch docs/ tree in "docs" group
$ markview --watch '*.md' --watch 'docs/**/*.md'      # Multiple patterns
```

`--watch` cannot be combined with file arguments. The `**` pattern matches directories recursively.

#### Removing watch patterns

Use `--unwatch` to stop watching a previously registered pattern. Files already added remain in the sidebar.

``` console
$ markview --unwatch '**/*.md'                              # Stop watching a pattern (default group)
$ markview --unwatch 'docs/**/*.md' --target docs            # Stop watching in a specific group
$ markview --unwatch '/Users/you/project/**/*.md'            # Stop watching by absolute path
```

Patterns are resolved to absolute paths before matching, so you can specify either a relative glob or the full path shown by `--status`.

### Sidebar view modes

The sidebar supports flat and tree view modes. Flat view shows file names only, while tree view displays the directory hierarchy.

| <img src="images/icons/view-flat.svg" height="16"> Flat | <img src="images/icons/view-tree.svg" height="16"> Tree |
| ------------------------------------------------------- | ------------------------------------------------------- |
| ![Flat view](images/sidebar-flat.png)                   | ![Tree view](images/sidebar-tree.png)                   |

### Starting and stopping

`markview` runs in the background by default — the command returns immediately, leaving the shell free for other work. This makes it easy to incorporate into scripts, tool chains, or LLM-driven workflows.

``` console
$ markview README.md
markview: serving at http://localhost:6275 (pid 12345)
$ # shell is available immediately
```

Use `--status` to check all running markview servers, and `--shutdown` to stop one:

``` console
$ markview --status              # Show all running markview servers
http://localhost:6275 (pid 12345, v0.12.0)
  default: 5 file(s)
    watching: /Users/you/project/src/**/*.md, /Users/you/project/*.md
  docs: 2 file(s)
    watching: /Users/you/project/docs/**/*.md

$ markview --shutdown            # Shut down the markview server on the default port
$ markview --shutdown -p 6276    # Shut down the markview server on a specific port
$ markview --restart             # Restart the markview server on the default port
```

If you need the markview server to run in the foreground (e.g. for debugging), use `--foreground`:

``` console
$ markview --foreground README.md
```

### Server restart

Click the <img src="images/icons/restart.svg" width="16" height="16" alt="restart"> restart button (bottom-right corner) or run `markview --restart` to restart the `markview` server process. The current session — all open files and groups — is preserved across the restart. This is useful when you have updated the `markview` binary and want to pick up the new version without re-opening your files.

### Session backup and restore

`markview` automatically saves session state (open files and watch patterns per group) when files are added or removed. When starting a new server, the previous session is automatically restored and merged with any files specified on the command line. Restored session entries appear first, followed by newly specified files.

``` console
$ markview README.md CHANGELOG.md       # Start with two files
$ markview --shutdown                   # Shut down the server
$ markview                              # Restores README.md and CHANGELOG.md
$ markview TODO.md                      # Restores previous session + adds TODO.md
```

Use `--clear` to remove a saved session:

``` console
$ markview --clear                      # Clear saved session for the default port
$ markview --clear -p 6276              # Clear saved session for a specific port
```

### JSON output

Use `--json` to get structured JSON output on stdout, useful for scripting and integration with other tools.

``` console
$ markview --json README.md
{
  "url": "http://localhost:6275",
  "files": [
    {
      "url": "http://localhost:6275/?file=a1b2c3d4",
      "name": "README.md",
      "path": "/Users/you/project/README.md"
    }
  ]
}
```

`--status` also supports `--json`:

``` console
$ markview --status --json
[
  {
    "url": "http://localhost:6275",
    "status": "running",
    "pid": 12345,
    "version": "0.15.0",
    "revision": "abc1234",
    "groups": [
      {
        "name": "default",
        "files": 3,
        "patterns": ["**/*.md"]
      }
    ]
  }
]
```

### Flags

| Flag           | Short | Default   | Description                                           |
| -------------- | ----- | --------- | ----------------------------------------------------- |
| `--target`     | `-t`  | `default` | Group name                                            |
| `--port`       | `-p`  | `6275`    | Server port                                           |
| `--bind`       | `-b`  | `0.0.0.0` | Bind address (e.g. `localhost`)                       |
| `--open`       |       |           | Always open browser                                   |
| `--no-open`    |       |           | Never open browser                                    |
| `--status`     |       |           | Show all running markview servers                     |
| `--watch`      | `-w`  |           | Glob pattern to watch for matching files (repeatable) |
| `--unwatch`    |       |           | Remove a watched glob pattern (repeatable)            |
| `--shutdown`   |       |           | Shut down the running markview server                 |
| `--restart`    |       |           | Restart the running markview server                   |
| `--clear`      |       |           | Clear saved session for the specified port            |
| `--foreground` |       |           | Run markview server in foreground                     |
| `--json`       |       |           | Output structured data as JSON to stdout              |

> [!WARNING]
> Binding to a non-loopback address exposes markview to the network **without any authentication**. Remote clients can read any file accessible by the user, browse the filesystem via glob patterns, and shut down the server. A confirmation prompt is shown when `--bind` is set to a non-loopback address.

## Build

Requires Go and [pnpm](https://pnpm.io/).

``` console
$ make build
```

## References

- [yusukebe/gh-markdown-preview](https://github.com/yusukebe/gh-markdown-preview): GitHub CLI extension to preview Markdown looks like GitHub.

## License

- [MIT License](LICENSE)
    - Include logo as well as source code.
    - Only logo license can be selected [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
    - Also, if there is no alteration to the logo and it is used for technical information about markview, I would not say anything if the copyright notice is omitted.
