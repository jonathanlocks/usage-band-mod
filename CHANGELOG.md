# Changelog

## Unreleased

- The per-model bar (e.g. Fable) no longer disappears for up to 10 minutes after this session's own read failed while another open session had just read it: a session whose last try failed now picks up the newer reading from the shared store on the next minute, and still waits the full interval before asking the network again.

## 0.3.0 (2026-10-20)

- Settings window for Windows 10 (1903 or later) and Windows 11, as a preview: a WPF app in `windows/`, one executable of about 60 KB with no runtime to install (.NET Framework 4.8 ships with Windows). Same preview, same four settings, both languages, light and dark theme, high contrast, reduced motion, keyboard and screen-reader names; on Windows 11 it requests the Mica background. Checked on GitHub Actions runners (Windows Server 2022 and 2025, Windows 11 ARM64): build, protocol, keyboard, accessibility tree and screenshots. Not yet run by a person, and not yet opened from a signed-in Claude Code session on Windows; Mica was accepted by the system on the runners but not seen on screen.
- On Windows, the ⚙ on the band and `/usage-settings` should open that window; the mod offers it only when .NET Framework 4.8 is present. The executable is not code-signed: if Windows (Smart App Control, antivirus) keeps it from opening, the command says so and points to `/config`, and the ⚙ shows the same message in a toast.
- `windows/PainelDeUso.sha256` holds the executable's SHA-256; `windows/build.ps1` rebuilds it with the pinned .NET SDK and compares. The build is deterministic: CI compiles it on two different Windows images and checks that both match the published hash.
- `INSTALL-MACOS.md` and `INSTALL-WINDOWS.md`: step-by-step install guides written for agents.
- `.gitattributes` keeps line endings LF on every platform, so hashes and tests survive a Windows checkout.
- CI on GitHub Actions: validate, test and type-check on Linux, macOS and Windows; check both published hashes; rebuild the Windows app; talk to it the way the mod does; install the mod from PowerShell. A manual workflow takes screenshots of the Windows window and scans its accessibility tree.
- The "window needs macOS 26" message now names Windows too; the command description says "(macOS, Windows)".
- Lines from the settings app are trimmed before parsing, so `\r\n` endings are accepted.
- The width-sweep tests have 30 seconds instead of 5: Windows runners are slower.

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
