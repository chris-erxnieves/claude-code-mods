# claude-code-mods

Personal mods for the [Claude Code](https://docs.claude.com/en/docs/claude-code) CLI, published as a plugin marketplace named `chris-erxnieves-mods`. They target the terminal only; the desktop app, VS Code and mobile surfaces are out of scope.

## Mods

| Mod | What it does |
| --- | --- |
| [`context-gauge`](mods/context-gauge) | A one-row context bar above the prompt, scaled to a 150k "smart zone" threshold, with `/context-gauge` to show a per-category breakdown. |

## Install

At the prompt of a terminal session:

```
/plugin install context-gauge --marketplace chris-erxnieves/claude-code-mods
```

Answer `y` to add the marketplace, then pick a scope. From a shell:

```
claude plugin install context-gauge --marketplace chris-erxnieves/claude-code-mods
```

## Developing

Run a session with the mod loaded straight from the working copy:

```
claude --plugin-dir mods/<name>
```

An interactive session watches that folder: a save reloads the hooks module, with no `/reload-plugins`. Add `--debug` to see skipped hooks and refused trees in the debug log.

To exercise the installed path instead, add the checkout as a folder marketplace. It is read from the working copy, so after an edit run `/reload-plugins`; no reinstall or version bump is needed.

```
claude plugin marketplace add ~/projects/claude-code-mods
claude plugin install context-gauge@chris-erxnieves-mods
```

Checks, per mod:

```
claude plugin validate mods/<name>
claude plugin test mods/<name>
```

Bump `version` in the mod's `plugin.json` for any change meant to reach a GitHub install; `claude plugin update` only picks up a new version.

## Layout

```
.claude-plugin/marketplace.json   the marketplace listing
mods/<name>/                      one mod per folder
  .claude-plugin/plugin.json
  hooks/hooks.json, hooks/*.tsx   the hooks module
  types/index.d.ts                the mod's $.state contract
  tests/*.test.tsx                claude plugin test suites
```

## License

MIT
