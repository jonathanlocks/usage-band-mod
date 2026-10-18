# Changelog

## 0.2.0 (2026-10-18)

- The `/uso` panel is gone: the band shows everything, and the settings window handles the options.
- Options in `/config` and in the install screen: language (English, Portuguese), currency (USD, BRL, EUR), mascot (animated, still, hidden) and the per-model weekly limit.
- Settings window for macOS 26, in SwiftUI with Liquid Glass (`/usage-settings`, `/uso-ajustes`, or ⚙ on the band).
- Animated pixel mascot: 13 gestures in a 56-second loop, still with reduced motion.
- Exchange rates from Coinbase, only when the currency is not USD, with growing waits after a failure. No requests at all with `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`.
- The `5h` and `7d` bars only show up when the session has those limits (subscriptions).
- Model names from Bedrock, Vertex and with suffixes such as `[1m]` read correctly.
- The band no longer runs past narrow terminals and no longer redraws when nothing changed.
- Hiding the band with `×` lasts across sessions.
- Settings from the window are saved as one request that survives the reloads `/config` triggers, so changing two options at once keeps both.
- `/usage-settings` only reports the window as open after the app says it is ready; the ⚙ only shows up on macOS 26.
- The app's SHA-256 is in `macos/PainelDeUso.sha256`.
- UI tests draw the band on the terminal and the desktop.
- The ⚙ can't open two windows at once, and the command gives up after 15 s if the app doesn't answer.
- Undoing a change that `/config` refused no longer brings it back next session.
- An exchange rate older than 3 days is not used; the cost goes back to dollars.
- Narrow terminals: without bars each segment is compact (`Context 56%`), and the header drops the cost, then the mascot, then the model before any segment.
- Settings window: level colors and the accent orange pass 4.5:1 contrast in light and dark; the mascot stays still with reduced motion.
- `build.sh` only rewrites the published hash with `--atualizar-hash`, so the check compares your build with the published one.
- README: the right way to install from the desktop app.
- Settings window: the band preview has an almost opaque background, so its colored percentages stay readable in light mode even with a dark window behind the glass.
- A request saved without a reload is marked as applied, so a later change in `/config` wins instead of being overwritten.
- After giving up on an app that didn't answer, nothing it sends later is applied.

## 0.1.0 (2026-10-08)

- First version: band above the prompt, `/uso` panel and `/uso-barra`.
