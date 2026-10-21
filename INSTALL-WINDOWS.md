# Install Usage Band on Windows

A step-by-step guide for an agent (or a careful human) installing the mod for someone on Windows 10 or 11. Follow it top to bottom; every step says how to check it worked.

Run the commands in **PowerShell** (Windows PowerShell 5.1 or PowerShell 7), not in WSL.

**Status of this guide.** The Windows settings window is a preview. The requirement checks, the install commands and the window itself were run on GitHub Actions runners; the band and the window inside a signed-in Claude Code session have not been run on Windows yet (steps 2 to 5 of [Check that it worked](#check-that-it-worked)). If a step does not give the expected result, report it, and use `/config` for the options.

## Before you start

| Requirement | How to check | Expected | If not |
|---|---|---|---|
| Windows 10 version 1903 or later, or Windows 11 | `[Environment]::OSVersion.Version.Build` (or run `winver`) | `18362` or higher | Update Windows. On older builds the band still works; only the settings window is missing. |
| Claude Code installed natively, not inside WSL | `where.exe claude` | a Windows path such as `C:\Users\<you>\.local\bin\claude.exe` (the native installer's location; winget or npm installs live elsewhere, which is fine) | If `where.exe` finds nothing, install it with `irm https://claude.ai/install.ps1 \| iex`. If Claude Code only runs inside WSL (a `\\wsl$` or `/usr/...` path), the session runs on Linux: the band works, the settings window does not, and the options live in `/config`. |
| Claude Code 2.1.302 or later | `claude --version` | `2.1.302 (Claude Code)` or higher | `claude update` |
| .NET Framework 4.8 (ships with Windows 10 1903+ and 11) | `reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release` | `Release    REG_DWORD    0x80ea8` or a higher number (0x80ea8 = 528040 = 4.8) | Run Windows Update, or install .NET Framework 4.8 from Microsoft: <https://dotnet.microsoft.com/download/dotnet-framework/net48>. Without it the band works and the settings window is not offered. |
| Git for Windows (recommended) | `git --version` | `git version 2.x` | Claude Code's Bash tool uses it. The mod itself does not need it. |
| Windows Terminal (recommended for the terminal) | `Get-AppxPackage Microsoft.WindowsTerminal \| Select-Object Version` | a version number | Install it from the Microsoft Store. The legacy console (conhost) draws the bars but shows boxes instead of the crab's head (`▐▛███▜▌`) and the reset arrow (`↻`). |
| Smart App Control (Windows 11) | `reg query "HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy" /v VerifiedAndReputablePolicyState` | `0x0` (off), or the value is missing (Windows 10) | `0x1` means on and `0x2` means evaluation mode. Smart App Control may refuse to run `PainelDeUso.exe`, which is not code-signed; this has not been tested. Install anyway: the band does not depend on the window, and `/config` has every option. Do not turn Smart App Control off for this mod; that is the person's security decision. |
| Signed in to Claude (subscription) or an API key | `claude auth status` | `"loggedIn": true` | Run `claude` and follow the login. In the desktop app, sign in in the app; this check does not apply there. |

Do not run anything as Administrator. Nothing in this guide needs it.

## Install

Pick one of the three paths.

**In a Claude Code terminal session:**

```
/plugin install usage-band-mod --marketplace jonathanlocks/usage-band-mod
```

**From PowerShell:**

```powershell
claude plugin install usage-band-mod --marketplace jonathanlocks/usage-band-mod
```

Expected: `✔ Successfully installed plugin: usage-band-mod@usage-band-mod (scope: user)` (`√` instead of `✔` in some Windows consoles). To set the options in the same command, add `--config` once per option, for example `--config idioma=en --config moeda=USD --config mascote=animado --config limitePorModelo=true`.

**In the Claude desktop app** (where `/plugin` is not available): click **+** next to the prompt box, then **Plugins**, **Add marketplace**, type `jonathanlocks/usage-band-mod`, then **Add plugin** next to `usage-band-mod`.

The install screen asks four questions. When the person has no preference, keep the defaults:

| Question | Values | Recommended default |
|---|---|---|
| Language / Idioma | `en`, `pt` | `en` (`pt` if the person writes in Portuguese) |
| Currency | `USD`, `BRL`, `EUR` | `USD` (needs no network) |
| Mascot | `animado`, `parado`, `oculto` | `animado` |
| Per-model weekly limit | on, off | on |

## Check that it worked

1. `claude plugin list` shows `usage-band-mod@usage-band-mod` with `Status: ✔ enabled` (`√` instead of `✔` in some Windows consoles).
   If it says `disabled`: `claude plugin enable usage-band-mod@usage-band-mod`.
2. Start `claude` in a folder. Within about 10 seconds a line appears above the prompt with the model name (for example `Opus 5.5`), the cost and `Context` with a bar.
   The `5h` and `7d` bars only appear on a subscription.
3. Run `/usage-band`: the line disappears and Claude Code answers `Usage band hidden.` Run it again: `Usage band visible.`
4. Run `/usage-settings`: Claude Code answers `Settings window open.` and a window titled **Usage band** opens. Change **Language** to **Português** and watch the band switch to `Contexto` right away. Click **Done** (or press Enter or Esc).
5. Quit `claude` and start it again. The band is still in Portuguese, and `/config` shows the new value under `usage-band-mod`. Switch back the same way if that was only a test (the commands are now `/uso-barra` and `/uso-ajustes`).

If `/usage-settings` answers that the window needs macOS 26 or Windows 10/11, go back to the .NET Framework row in [Before you start](#before-you-start).

## Settings

| Option | Values | Default | What it does |
|---|---|---|---|
| Language | `en`, `pt` | `en` | Language of the band, the window and the commands |
| Currency | `USD`, `BRL`, `EUR` | `USD` | Currency of the session cost. Other currencies use Coinbase's public rates |
| Mascot | `animado`, `parado`, `oculto` | `animado` | The pixel crab: animated, still or hidden |
| Per-model weekly limit | on, off | on | Shows per-model limits such as Fable; reads an undocumented Anthropic endpoint |

The options live in Claude Code's own settings: `/config`, under `usage-band-mod`. The settings window (`/usage-settings`, or the ⚙ on the band in the desktop app) writes to the same place, so both always agree. Changes in the window apply to the band at once and are saved when the window closes.

## Troubleshooting

| Symptom | Cause | Do this |
|---|---|---|
| No band above the prompt | The plugin is disabled | `claude plugin enable usage-band-mod@usage-band-mod`, then restart `claude` |
| No band above the prompt | A survey or other prompt is using that space, or the band was hidden with `×` | Wait for the survey to go away; run `/usage-band` to show the band again |
| The band is cut short | The terminal is narrow | Widen the window: the band drops details (reset times, bars, cost) to stay on one line |
| The band shows `—` | The first turn has not finished yet | Send a message and wait for the answer |
| No `5h` or `7d` bars | The session uses an API key, Bedrock or Vertex, not a subscription | Expected: those limits exist only on subscriptions |
| `/usage-settings` says the window needs macOS 26 or Windows 10/11 | Claude Code runs in WSL, or .NET Framework 4.8 is missing | Check the WSL and .NET Framework rows in [Before you start](#before-you-start); meanwhile use `/config` |
| "Could not open the settings window (…). On Windows, Smart App Control or an antivirus may have blocked PainelDeUso.exe…" (the ⚙ shows the same text in a toast) | Windows did not let `PainelDeUso.exe` start: Smart App Control, an antivirus, or the file is missing | Check Smart App Control with the `reg query` from [Before you start](#before-you-start). If it is on (`0x1`), use `/config`: Smart App Control has no per-app exception, and turning it off is the person's call, not the installer's. If an antivirus quarantined the file, restore it and allow the plugin folder (`%USERPROFILE%\.claude\plugins\cache\usage-band-mod`) only if the person agrees. If the file is gone, uninstall and install the plugin again (see [Update and uninstall](#update-and-uninstall)). |
| The window opens behind the terminal | Windows sometimes blocks a new window from taking the focus | Click its icon (the pixel crab) on the taskbar |
| `▐▛███▜▌`, `█░` or `↻` show as boxes or question marks | The legacy console (conhost) or a font without those characters | Use Windows Terminal with Cascadia Mono (its default) |
| The cost is in dollars although BRL or EUR is chosen | No exchange rate yet (no network, or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set) | Expected: the band shows dollars until it has a rate less than 3 days old |
| Commands in the wrong language | The language option | The commands follow it: `/usage-band` and `/usage-settings` in English, `/uso-barra` and `/uso-ajustes` in Portuguese |

## Do not

- Do not run Claude Code or the settings window as Administrator.
- Do not install a .NET runtime or SDK to use the mod. .NET Framework 4.8 is part of Windows; the SDK is only for rebuilding the app.
- Do not copy `PainelDeUso.exe` out of the plugin folder or run it from somewhere else; the mod starts it from its own folder.
- Do not edit files in the plugin cache (`%USERPROFILE%\.claude\plugins\cache`). Change options with `/config` or the window.
- Do not add the plugin folder to `CLAUDE_CODE_PLUGIN_DIRS` unless you are developing the mod. If you do, separate paths with `;` on Windows.
- Do not turn off Smart App Control, SmartScreen or an antivirus to make the window open; use `/config` instead. Never bypass those prompts for a `PainelDeUso.exe` that did not come from this repository. The executable is not code-signed; its SHA-256 is in `windows/PainelDeUso.sha256`.

## Update and uninstall

```powershell
claude plugin update usage-band-mod@usage-band-mod
claude plugin uninstall usage-band-mod@usage-band-mod
claude plugin marketplace remove usage-band-mod
```

Restart `claude` after an update. The mod writes only to Claude Code's own settings (the four options) and to Claude Code's plugin store; it creates no files of its own. After uninstalling, Claude Code may keep its cached copy of the plugin in `%USERPROFILE%\.claude\plugins\cache\usage-band-mod` until it cleans its cache; deleting that folder by hand is safe once the plugin is uninstalled.

## For developers

```powershell
git clone https://github.com/jonathanlocks/usage-band-mod
cd usage-band-mod
claude --plugin-dir .
claude plugin validate .
claude plugin test .
```

To rebuild the settings window and check it against the published hash, install the .NET SDK pinned in `windows/global.json` (8.0.425) and run one of these (PowerShell 7, or the Windows PowerShell 5.1 that comes with Windows):

```powershell
pwsh windows/build.ps1
powershell -ExecutionPolicy Bypass -File windows\build.ps1
```

It prints `PainelDeUso.exe: OK` when your build matches `windows/PainelDeUso.sha256` byte for byte. If it prints `FAILED`, the published `PainelDeUso.exe` is left as it was and your build stays in `windows/bin/Release/net48/`. For type-checking, see [Development](README.md#development) in the README.

---

Last checked with Claude Code 2.1.305 on GitHub Actions runners (2026-10-20). On Windows Server 2022 (build 20348, x64): the requirement commands, installing from PowerShell (`claude plugin install`, `list`, `disable`, `enable`, `update`, `uninstall`, `marketplace remove`), the plugin cache path, and the settings window started from the installed plugin. On Windows Server 2022, Windows Server 2025 (build 26100, x64) and Windows 11 25H2 (build 26200, ARM64): the settings window itself (screenshots, UI Automation and, on the two x64 images, keyboard and the JSON protocol the mod uses). The Smart App Control `reg query` was run on the runners: it returned `0` (off) on Windows 11 and found no value on the two Server images. Smart App Control was never on, so a blocked `PainelDeUso.exe` has not been seen; the mod's message for it is covered by simulated tests only. Not run on Windows yet: the band itself and `/usage-settings` or the ⚙ inside a signed-in Claude Code session (checked on macOS only), and any real PC.
