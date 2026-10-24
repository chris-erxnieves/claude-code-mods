# claude-code-mods

Personal [Claude Code](https://docs.claude.com/en/docs/claude-code) mods, published as a plugin marketplace named `chris-erxnieves-mods`.

## Mods

| Mod | What it does |
| --- | --- |
| [`context-gauge`](mods/context-gauge) | A one-row context bar above the prompt, scaled to a 150k "smart zone" threshold, with a toggle that shows a per-category breakdown. |

## Install

```
/plugin install context-gauge --marketplace chris-erxnieves/claude-code-mods
```

Answer `y` to add the marketplace, then pick a scope. From a shell:

```
claude plugin install context-gauge --marketplace chris-erxnieves/claude-code-mods
```

## Developing from a local checkout

```
claude plugin marketplace add ~/projects/claude-code-mods
claude plugin install context-gauge@chris-erxnieves-mods
```

A folder marketplace is read from the working copy, so after an edit run `/reload-plugins` in the session. No reinstall or version bump is needed.

Checks, per mod:

```
claude plugin validate mods/<name>
claude plugin test mods/<name>
```

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
