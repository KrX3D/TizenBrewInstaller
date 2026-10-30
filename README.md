# TizenBrew Installer

TizenBrew Installer allows you to install TizenBrew and other Tizen apps easily, with resigning support for Tizen 7+ TVs!

[Discord Server Invite](https://discord.gg/m2P7v8Y2qR)

## Installation

To install TizenBrew Installer, you'll need a PC or a mobile device. Since Samsung has shut down the service for the USB Demo Package creation, the only way is using TizenBrew Installer Desktop.

## TizenBrew Installer Desktop

TizenBrew Installer Desktop is TizenBrew Installer on your PC or (Android only) mobile device. Download the latest release from the [releases section](https://github.com/reisxd/TizenBrewInstaller/releases/latest).

### Using TizenBrew Installer Desktop manually

If you're using Termux or would like to use TizenBrew Installer Desktop manually, you can follow these steps:

1. Install [Node.js](https://nodejs.org/) (on Android, you can use [Termux](https://termux.com/) and install Node.js via `pkg install nodejs`).

2. Install [git](https://git-scm.com/) if you don't have it already (on Android/Termux, use `pkg install git`).

3. Clone the repository using `git clone https://github.com/reisxd/TizenBrewInstaller.git`.

4. Navigate to the `ui` folder using `cd TizenBrewInstaller/client/ui` and run `npm install --force && npm run build`.

5. Navigate to the `tizenbrew-installer-service` folder using `cd ../services/tizenbrew-installer-service` and run `npm install`.

6. Run the application using `node .`.

## Repo lists

Instead of typing repos on the TV, keep them in a text/markdown file on GitHub and add it under Saved Repos > Add repo list (e.g. `owner/repo/repos.md`, optional `@branch`; GitHub file URLs also work).

```
# Comments and blank lines are ignored
reisxd/TizenBrew
- KrX3D/TizenTube        # bullets and trailing notes are fine
someone/else/more-repos.md   # another list: shown nested, removed again if this line is removed
```

- Lists are synced at startup, when the app is resumed and when Saved Repos opens. Repos that appear are added; repos that disappear are removed.
- Repos added by hand, and repos you lock (padlock button), are never removed by a sync. A list that can't be loaded is left untouched.
- Removing a list removes its unlocked repos and any nested lists with them. The eye button disables syncing for a list without removing anything.

## CI secrets

The release workflow (`.github/workflows/build-release.yaml`) uses these repository secrets (Settings > Secrets and variables > Actions):

| Secret | Used for |
| --- | --- |
| `GITHUB_TOKEN` | Provided automatically by GitHub. Pushes the version bump/tag and creates the release. |
| `TIZEN_AUTHOR_KEY` | Base64 of the author certificate (`.p12`) that signs the `.wgt`. |
| `TIZEN_AUTHOR_KEY_PW` | Password of that author certificate. |
| `TIZEN_CERT_BUNDLE` | Base64 `tar.gz` holding `distributor/sdk-public/tizen-distributor-signer.p12` from Tizen Studio. `tizenjs` normally downloads it from `download.tizen.org`, which now returns 404, so the workflow restores it into `~/share/.tizen-cert` instead. |

### Creating `TIZEN_CERT_BUNDLE`

Needs Tizen Studio installed (default path `C:\tizen-studio`). In PowerShell:

```powershell
tar -czf "$env:TEMP\tizen-cert.tgz" -C "C:\tizen-studio\tools\certificate-generator\certificates" distributor/sdk-public/tizen-distributor-signer.p12
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:TEMP\tizen-cert.tgz")) | Set-Clipboard
(Get-Clipboard).Length
Remove-Item "$env:TEMP\tizen-cert.tgz"
```

The printed length should be around 3,300 (GitHub's secret limit is 48,000 characters). Paste the clipboard as the secret value. Only this one file is needed because the build runs `tizenjs` with `-p public`.
