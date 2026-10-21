# Install Usage Band on macOS

A step-by-step guide for an agent (or a careful human) installing the mod for someone on a Mac. Follow it top to bottom; every step says how to check it worked.

Run the commands in Terminal (or any shell on the Mac).

## Before you start

| Requirement | How to check | Expected | If not |
|---|---|---|---|
| macOS 26 for the settings window | `sw_vers -productVersion` | `26.0` or higher | The band works on any macOS that runs Claude Code; on older versions only the settings window is missing, and the options live in `/config`. |
| Claude Code installed | `which claude` | a path such as `/Users/<you>/.local/bin/claude` | Install it with `curl -fsSL https://claude.ai/install.sh \| bash` |
| Claude Code 2.1.302 or later | `claude --version` | `2.1.302 (Claude Code)` or higher | `claude update` |
| Signed in to Claude (subscription) or an API key | `claude auth status` | `"loggedIn": true` | Run `claude` and follow the login. In the desktop app, sign in in the app; this check does not apply there. |
| Xcode | not needed | | The settings app ships already built (universal: Apple Silicon and Intel). Xcode's command line tools are only for rebuilding it. |

Do not use `sudo` for anything in this guide.

## Install

Pick one of the three paths.

**In a Claude Code terminal session:**

```
/plugin install usage-band-mod --marketplace jonathanlocks/usage-band-mod
```

**From a shell:**

```bash
claude plugin install usage-band-mod --marketplace jonathanlocks/usage-band-mod
```

Expected: `✔ Successfully installed plugin: usage-band-mod@usage-band-mod (scope: user)`. To set the options in the same command, add `--config` once per option, for example `--config idioma=en --config moeda=USD --config mascote=animado --config limitePorModelo=true`.

**In the Claude desktop app** (where `/plugin` is not available): click **+** next to the prompt box, then **Plugins**, **Add marketplace**, type `jonathanlocks/usage-band-mod`, then **Add plugin** next to `usage-band-mod`.

The install screen asks four questions. When the person has no preference, keep the defaults:

| Question | Values | Recommended default |
|---|---|---|
| Language / Idioma | `en`, `pt` | `en` (`pt` if the person writes in Portuguese) |
| Currency | `USD`, `BRL`, `EUR` | `USD` (needs no network) |
| Mascot | `animado`, `parado`, `oculto` | `animado` |
| Per-model weekly limit | on, off | on |

## Check that it worked

1. `claude plugin list` shows `usage-band-mod@usage-band-mod` with `Status: ✔ enabled`.
   If it says `disabled`: `claude plugin enable usage-band-mod@usage-band-mod`.
2. Start `claude` in a folder. Within about 10 seconds a line appears above the prompt with the model name (for example `Opus 5.5`), the cost and `Context` with a bar.
   The `5h` and `7d` bars only appear on a subscription.
3. Run `/usage-band`: the line disappears and Claude Code answers `Usage band hidden.` Run it again: `Usage band visible.`
4. Run `/usage-settings`: Claude Code answers `Settings window open.` and the settings window opens (in the desktop app, the ⚙ on the band does the same). Change **Language** to **Português** and watch the band switch to `Contexto` right away. Click **Done** (or press Return or Esc).
5. Quit `claude` and start it again. The band is still in Portuguese, and `/config` shows the new value under `usage-band-mod`. Switch back the same way if that was only a test (the commands are now `/uso-barra` and `/uso-ajustes`).

If `/usage-settings` answers that the window needs macOS 26, the Mac runs an older macOS: use `/config`.

## Settings

| Option | Values | Default | What it does |
|---|---|---|---|
| Language | `en`, `pt` | `en` | Language of the band, the window and the commands |
| Currency | `USD`, `BRL`, `EUR` | `USD` | Currency of the session cost. Other currencies use Coinbase's public rates |
| Mascot | `animado`, `parado`, `oculto` | `animado` | The pixel crab: animated, still or hidden |
| Per-model weekly limit | on, off | on | Shows per-model limits such as Fable; reads an undocumented Anthropic endpoint |

The options live in Claude Code's own settings: `/config`, under `usage-band-mod`. The settings window writes to the same place, so both always agree. Changes in the window apply to the band at once and are saved when the window closes.

## Troubleshooting

| Symptom | Cause | Do this |
|---|---|---|
| No band above the prompt | The plugin is disabled | `claude plugin enable usage-band-mod@usage-band-mod`, then restart `claude` |
| No band above the prompt | A survey or other prompt is using that space, or the band was hidden with `×` | Wait for the survey to go away; run `/usage-band` to show the band again |
| The band is cut short | The terminal is narrow | Widen the window: the band drops details (reset times, bars, cost) to stay on one line |
| The band shows `—` | The first turn has not finished yet | Send a message and wait for the answer |
| No `5h` or `7d` bars | The session uses an API key, Bedrock or Vertex, not a subscription | Expected: those limits exist only on subscriptions |
| `/usage-settings` says the window needs macOS 26 | macOS is older than 26 | Use `/config`; the options are the same |
| "Could not open the settings window (…)" after installing from a zip downloaded in a browser | macOS quarantined the downloaded app, and Gatekeeper blocks it | `xattr -dr com.apple.quarantine <plugin folder>/macos/PainelDeUso.app`, or install with `claude plugin install` instead (Claude Code launches the app itself, so Gatekeeper is not involved) |
| The window opens behind the terminal | Another app kept the focus | Click the app in the Dock or use Cmd-Tab |
| The cost is in dollars although BRL or EUR is chosen | No exchange rate yet (no network, or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set) | Expected: the band shows dollars until it has a rate less than 3 days old |
| Commands in the wrong language | The language option | The commands follow it: `/usage-band` and `/usage-settings` in English, `/uso-barra` and `/uso-ajustes` in Portuguese |

## Do not

- Do not run Claude Code or the settings app with `sudo`.
- Do not install Xcode just to use the mod; the app comes built.
- Do not copy `PainelDeUso.app` out of the plugin folder or open it from somewhere else; the mod starts it from its own folder.
- Do not edit files in the plugin cache (`~/.claude/plugins/cache`). Change options with `/config` or the window.
- Do not add the plugin folder to `CLAUDE_CODE_PLUGIN_DIRS` unless you are developing the mod. If you do, separate paths with `:` on macOS.
- Do not remove the quarantine flag from any `PainelDeUso.app` that did not come from this repository. The app is ad-hoc signed; its SHA-256 is in `macos/PainelDeUso.sha256`.

## Update and uninstall

```bash
claude plugin update usage-band-mod@usage-band-mod
claude plugin uninstall usage-band-mod@usage-band-mod
claude plugin marketplace remove usage-band-mod
```

Restart `claude` after an update. The mod writes only to Claude Code's own settings (the four options) and to Claude Code's plugin store; it creates no files of its own. After uninstalling, Claude Code may keep its cached copy of the plugin in `~/.claude/plugins/cache/usage-band-mod` until it cleans its cache; deleting that folder by hand is safe once the plugin is uninstalled.

## For developers

```bash
git clone https://github.com/jonathanlocks/usage-band-mod
cd usage-band-mod
claude --plugin-dir .
claude plugin validate .
claude plugin test .
```

To rebuild the settings app and check it against the published hash (needs the Xcode command line tools with the macOS 26 SDK: `xcode-select --install`):

```bash
./macos/build.sh
```

It ends with `PainelDeUso.app/Contents/MacOS/PainelDeUso: OK` when your build matches `macos/PainelDeUso.sha256`. The published hash comes from Swift 6.4; another Swift version can produce a different binary. For type-checking, see [Development](README.md#development) in the README.

---

Last checked with Claude Code 2.1.302 on macOS 26.6.2 (2026-10-20): installing from a shell with an empty home folder (`claude plugin install`, `list`, `disable`, `enable`, `update`, `uninstall`, `marketplace remove`), `./macos/build.sh` (OK against the published hash, Swift 6.4), `xattr -dr com.apple.quarantine` on a copy of the app, and the band and settings window in daily use in the terminal and the desktop app.
