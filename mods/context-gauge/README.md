# Context Gauge

A one-row bar above the Claude Code prompt that shows how much of the context window the session is using, scaled to a threshold (150k tokens by default) rather than to the model's full window.

The default comes from Matt Pocock's "smart zone": past roughly 150k tokens, models reason less sharply, so `/compact` at the next phase boundary rather than pushing on.

```
 ██████████████░░░░░░  104k / 150k                    ▸ details
```

- **Green** below 80% of the threshold, **yellow** from 80% to the threshold, **red** past it. Past the threshold the bar grows overflow cells (`▌`) and shows `(+13k)`.
- **`—`** before the first response of a session and right after a compaction, until the next response reports a count.
- **Toast** once when the session crosses the threshold. It fires again only after usage drops below 80% (say, after `/compact`) and climbs back over. The mod never compacts by itself.

## Details

`▸ details` redraws the bar in category colors and lists each category using context, in `/context` order:

```
 ████████████▒▒▒░░░░░  124k / 150k                    ▾ details
   ■ System prompt     ~3.1k
   ■ System tools     ~17.1k
   ■ MCP tools         ~9.4k
   ■ Messages         ~88.2k
```

The breakdown is a local estimate (`/context`'s `summary` mode), computed only while expanded and refreshed after each turn, so its rows need not add up to the live count. Free space and the autocompact buffer are left out, since the bar spans the threshold, not the window. Details start collapsed in every session.

## Settings

| Field | Default | Meaning |
| --- | --- | --- |
| `threshold` | `150000` | Tokens at which the bar fills and turns red. |

Change it in `/config`.
