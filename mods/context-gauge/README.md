# Context Gauge

A one-row bar above the Claude Code prompt that shows how much of the context window the session is using, scaled to a threshold (150k tokens by default) rather than to the model's full window.

The default comes from Matt Pocock's "smart zone": past roughly 150k tokens, models reason less sharply, so `/compact` at the next phase boundary rather than pushing on.

```
Context  104k of 150k  █████████████▉░░░░░░                    Show
Context  163k of 150k  ████████████████████                    Show
```

- **Count** is **green** below 80% of the threshold, **yellow** from 80% to the threshold, **red** past it.
- **Bar** is split by category color (see [Details](#details)), filling in eighths of a cell as usage approaches the threshold, over a solid `subtle` track. Each cell is painted as a background, so colors run without seams; a cell holds at most two colors, so a category narrower than a cell can drop out. Until the first breakdown arrives, the fill is solid `inactive`. Past the threshold the bar stays full; the red count is the only signal.
- **`—`** before the first response of a session and right after a compaction, until the next response reports a count.
- **Toast** once when the session crosses the threshold. It fires again only after usage drops below 80% (say, after `/compact`) and climbs back over. The mod never compacts by itself.

## Details

`Show` lists each category using context, in `/context` order, matching the bar's colors:

```
Context  124k of 150k  ████████████████▌░░░                    Hide
   ■ System prompt     ~3.1k
   ■ System tools     ~17.1k
   ■ MCP tools         ~9.4k
   ■ Messages         ~88.2k
```

The breakdown is a local estimate (`/context`'s `summary` mode), refreshed after each turn, so its rows need not add up to the live count; the bar's length follows the live count and only its colors follow the breakdown. Free space and the autocompact buffer are left out, since the bar spans the threshold, not the window. Details start collapsed in every session.

## Settings

| Field | Default | Meaning |
| --- | --- | --- |
| `threshold` | `150000` | Tokens at which the bar fills and the count turns red. |

Change it in `/config`.
