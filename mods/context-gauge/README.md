# Context Gauge

A one-row bar above the Claude Code prompt that shows how much of the context window the session is using, scaled to a threshold (150k tokens by default) rather than to the model's full window.

The default comes from Matt Pocock's "smart zone": past roughly 150k tokens, models reason less sharply, so `/compact` at the next phase boundary rather than pushing on.

```
Context  104k of 150k  ██████████████╲╲╲╲╲╲                    Show
Context  163k of 150k  ████████████████████                    Show
```

- **Count** is **green** below 80% of the threshold, **yellow** from 80% to the threshold, **red** past it.
- **Bar** is split by category color (see [Details](#details)), largest category first, each as wide as its share of usage against the threshold. The empty rest is a `subtle` `╲` hatch on an `inverseText` track. Segments are colored boxes sized by `flexGrow`, not glyphs, so the desktop app draws every edge to the pixel. Until the first breakdown arrives, the fill is solid `inactive`. Past the threshold the bar stays full; the red count is the only signal.
- **`—`** before the first response of a session and right after a compaction, until the next response reports a count.
- **Toast** once when the session crosses the threshold. It fires again only after usage drops below 80% (say, after `/compact`) and climbs back over. The mod never compacts by itself.

## Details

`Show` lists each category using context, in the bar's order and colors, wrapping across rows as width allows:

```
Context  124k of 150k  █████████████████╲╲╲                    Hide
  ■ Messages 88k   ■ System tools 17k   ■ MCP tools 9k   ■ System prompt 3k
```

Counts are whole numbers (`k` from 1,000 up).

The breakdown is a local estimate (`/context`'s `summary` mode), refreshed after each turn, so its rows need not add up to the live count; the bar's length follows the live count and only its colors follow the breakdown. Free space and the autocompact buffer are left out, since the bar spans the threshold, not the window. Details start collapsed in every session.

## Settings

| Field | Default | Meaning |
| --- | --- | --- |
| `threshold` | `150000` | Tokens at which the bar fills and the count turns red. |

Change it in `/config`.
