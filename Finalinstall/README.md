# Finalinstall — sideload packages

Phone install copies for NeoPlanner (`com.dayplanner.app`). **APKs and IPAs are gitignored**; only this README, nested version READMEs, and `Neo.jpeg` (launcher source art) are tracked.

## Versioned layout

```
Finalinstall/
  Neo.jpeg                          # launcher icon source
  NeoOrganizer-1.0.0-release.apk    # legacy flat path (kept if present)
  1.1.0/
    NeoOrganizer-1.1.0-release.apk
  1.2.0/
    NeoOrganizer-1.2.0-release.apk  # Android
    ios/                            # iOS package (sibling of the APK)
      README.md
      NeoOrganizer-1.2.0.ipa        # when a distributable IPA is available
      …                             # or Simulator .app / unsigned archive notes
  1.3.0/
    NeoOrganizer-1.3.0-release.apk  # historical NeoOrganizer filename (stale open PR #29)
  1.3.1/
    NeoPlanner-1.3.1-release.apk    # current product name (preferred from 1.3.1)
  <version>/
    NeoPlanner-<version>-release.apk
    ios/                            # preferred iOS layout from 1.2.0 onward
```

Going forward, put each Android release under `Finalinstall/<version>/NeoPlanner-<version>-release.apk` and the matching iOS sideload package under `Finalinstall/<version>/ios/`. Builds through 1.3.0 keep their NeoOrganizer filenames; **1.3.1+ use NeoPlanner-** to match the launcher/display name.

## Upgrade rules (Android)

- Keep `applicationId` / package **`com.dayplanner.app`** so install-over-1.0.0 … 1.3.0 updates in place and preserves SQLite data.
- Bump `versionName` and `versionCode` (must be higher than the installed build). Current: **1.3.1** / **5** (skips/supersedes planned 1.3.0 = 4 so any 1.3.0 sideload and 1.2.0 = 3 both upgrade cleanly).
- Sign with the **same debug keystore** used for 1.0.0–1.3.0 (`android/app/debug.keystore` after Expo prebuild; SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`) so Android accepts the upgrade.
- Launcher display name: **NeoPlanner**. Icon: adaptive assets from `Neo.jpeg` (same art as 1.1.0+).

## Upgrade rules (iOS)

- Display name **NeoPlanner**; bundle id **`com.dayplanner.app`** (keep the package id for upgrade-compatible installs).
- `ios.buildNumber` tracks the Android `versionCode` (currently `5`).
- A true device IPA needs Apple Developer signing. See `1.2.0/ios/README.md` for what this Mac produced and how to install.

## Build Android (local)

```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
mkdir -p ../Finalinstall/1.3.1
cp app/build/outputs/apk/release/app-release.apk \
  ../Finalinstall/1.3.1/NeoPlanner-1.3.1-release.apk
```

## Build iOS (local)

```bash
npx expo prebuild --platform ios --no-install
# Then archive / export via Xcode or EAS when credentials allow.
# Artifacts land in Finalinstall/<version>/ios/ — see that folder's README.
```
