# AGENTS.md

Mods here target the Claude Code CLI's `terminal` surface only.

- Match `ui.render` hooks on `surface: 'terminal'` so other surfaces fall through to the engine.
- Size drawings in whole cells from `e.props.bodyColumns` (or `e.viewport`), not from proportional `flexGrow` or percentage sizes.
- Make every interactive control reachable from the keyboard: a slash command (`$.command.register`) or a Button `hotkey`. A click works only in fullscreen mode.
- Tests mount on `surface: 'terminal'`; add one non-terminal mount only to assert the mod passes there.
- Before finishing a change, run `claude plugin validate mods/<name>` and `claude plugin test mods/<name>`.
