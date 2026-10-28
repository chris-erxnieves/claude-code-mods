# Context Gauge

A one-row bar above the Claude Code CLI prompt that shows how much context the session is using, scaled to a threshold (150k tokens by default) rather than to the model's full window.

The default comes from Matt Pocock's "smart zone": past roughly 150k tokens, models reason less sharply, so `/compact` at the next phase boundary rather than pushing on.

```
Context  104k of 150k  ███████████████████████████████░░░░░░░░░░░░░░  Show
Context  163k of 150k  ██████████████████████████████████████████████  Show
```

- **Count** is **green** below 80% of the threshold, **yellow** from 80% to the threshold, **red** past it.
- **Bar** fills the columns the label, count and toggle leave (at least 10). Each category gets a run of `█` in its color (see [Details](#details)), largest first, sized in whole cells by largest remainder so the runs always add up to the filled length. Any usage shows at least one cell. Until the first breakdown arrives, the fill is solid `subtle`. The rest of the bar is a dim `░` track, so the threshold's end is visible. Past the threshold the bar stays full; the red count is the only signal.
- **`—`** before the first response of a session and right after a compaction, until the next response reports a count.
- **Toast** once when the session crosses the threshold. It fires again only after usage drops below 80% (say, after `/compact`) and climbs back over. The mod never compacts by itself.

The band draws in the terminal only. On other surfaces the mod passes and draws nothing.

## Details

`/context-gauge` shows or hides the list of categories using context. It runs at once, mid-turn too. The `Show`/`Hide` toggle does the same: click it in fullscreen mode, or focus the band with `ctrl+x tab` and press Enter.

```
Context  124k of 150k  █████████████████████████████████████░░░░░░░░  Hide

■ Messages 88k  ■ System tools 17k  ■ MCP tools 9k  ■ System prompt 3k
```

Counts are whole numbers (`k` from 1,000 up), in the bar's order and colors, wrapping across rows as width allows.

The breakdown is a local estimate (`/context`'s `summary` mode), refreshed after each turn, so its rows need not add up to the live count; the bar's length follows the live count and only its colors follow the breakdown. Free space and the autocompact buffer are left out, since the bar spans the threshold, not the window. Details start collapsed in every session.

## Settings

| Field | Default | Meaning |
| --- | --- | --- |
| `threshold` | `150000` | Tokens at which the bar fills and the count turns red. |

Change it in `/config`.
