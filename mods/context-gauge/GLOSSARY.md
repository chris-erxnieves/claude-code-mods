# Context Gauge

A gauge above the Claude Code CLI prompt that shows how much context the session uses against a threshold, not against the model's window.

## Language

**Band**:
Everything the mod draws above the prompt: the Context label, the count, the bar, the toggle, and the Details.
_Avoid_: bar (for the whole thing), row, gauge

**Bar**:
The colored part of the band: the runs followed by the track, spanning exactly one threshold.
_Avoid_: band, meter

**Segment**:
One used-context category, as the breakdown reports it.
_Avoid_: slice, row

**Run**:
A segment's share of the bar: a whole number of `█` cells in the segment's color.
_Avoid_: fill, slice

**Track**:
The dim `░` remainder of the bar between the last run and the threshold.
_Avoid_: hatch, background

**Count**:
The live context token figure shown before the bar, or a dash when none is known yet.
_Avoid_: usage, total

**Threshold**:
The token count the bar spans and past which the session is over.
_Avoid_: limit, window, smart zone

**Zone**:
Where the count sits relative to the threshold: ok, warn (from 80% of it), or over (past it).
_Avoid_: level, status

**Details**:
The optional list of segments under the bar, shown by the toggle or `/context-gauge`.
_Avoid_: legend, breakdown
