# Changelog

## 0.4.4 (2026-10-22)

- Whether the settings window exists on this system is kept in the mod's session state, so the band redraws with the ⚙ as soon as it is known, without a workaround, and the check is not repeated after a reload.
- New tests for what the user sees: a failed per-model read keeps the last numbers, the exchange-rate wait keeps growing after repeated failures, and only weekly per-model limits are shown.
- CI also runs every Monday, to catch a new Claude Code version breaking the mod without a push.

## 0.4.3 (2026-10-22)

- On the desktop app, the ⚙ on the band shows up as soon as the system answers whether the settings window can open, instead of up to a minute later.
- If saving the settings window's choices fails after it closes, the choices still apply for the session and no error is left unhandled.
- `macos/build.sh` builds in a temporary folder and leaves the shipped app alone unless `--atualizar-hash` is given; before, it replaced the app even when the check failed. `arte/gerar_mascote.py --check` also checks `arte/mascote-animado.svg` and the gesture images in `docs/gestures/`.
- CI tests the Windows app it has just built (the smoke test, the protocol, opening in front, and now the accessibility scan) even when it does not match the published hash; jobs have a 30-minute limit, and outside `main` a newer push cancels the run on the same branch.
- Install guides: Claude Code 2.1.295 or later; the real install output; the Windows status from the first user; troubleshooting for the 0.4.0 and 0.4.1 problems; where the mod keeps its state.
- Dead code removed: an unused parameter, a duplicate read, the unused handling of the app's last line, exports nothing imported, and test mocks for calls the mod never makes.

## 0.4.2 (2026-10-22)

- Windows: the settings window opens in front of Claude. The app is started by a background process (desktop app → `claude.exe` → hooks worker → `PainelDeUso.exe`), and Windows refuses the foreground to such a process, so the window opened behind the Claude window and the ⚙ or `/usage-settings` seemed to do nothing. The window now lifts itself above other windows (Topmost on and off) and then asks for the foreground through the input queue of the window in front. Reported by the first Windows user.
- CI checks it: a stand-in "Claude" window takes the foreground and the input, another process opens the app, and the settings window has to end up on top. On a Windows Server 2022 runner the 0.4.1 app opened behind in this test and the 0.4.2 app opened in front with the focus.

## 0.4.1 (2026-10-22)

- Loads in the Claude desktop app again. The app runs conversations on its own bundled Claude Code engine, which can lag behind the `claude` CLI; engine 2.1.295 refused the whole hooks module because `register.tsx` passed `$` to functions imported from `./fontes` and `./janela` (`$ is followed only into a function declared in this same file, never across an import`), so no band and no `/usage-band` command. Every function that calls `$` now lives in `register.tsx`; `fontes.ts` and `janela.ts` keep only the pure parts. Same behavior on newer engines. Reported by the first Windows user; it was not specific to Windows.
- CI also validates and tests the mod on engine 2.1.295.

## 0.4.0 (2026-10-21)

- Terminal look: the mascot is a whole one-line Clawd face (arms at mid height, an orange body and two black eyes, 5 columns) instead of the top row of the Claude Code logo, which read as cut off. Bars are painted cells, the level color on a track in the theme's subtle gray, without the `░` texture; use above 0% fills at least one cell and use below 100% leaves at least one empty; with no reading the bar is a dim dotted line, not an empty track. Each percentage sits right after its bar. The band is left-aligned with a one-column margin, like the rest of Claude Code, with more room between segments and a dim `×` that inverts under the pointer. `↻` only marks reset times, so the context reads `112k/200k` (also on the desktop). In 0.3.0 the centered line could lose a character at some widths (for example `Fable 2` for `Fable 2%`, `↻ 4d 0` for `↻ 4d 0h`); the left-aligned line, with its margin counted, fits every width from 10 to 220 columns.
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
