# Finalinstall — sideload packages

Phone install copies for NeoOrganizer (`com.dayplanner.app`). **APKs and IPAs are gitignored**; only this README, nested version READMEs, and `Neo.jpeg` (launcher source art) are tracked.

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
    NeoOrganizer-1.3.0-release.apk  # Android (schema v4 / #28)
  <version>/
    NeoOrganizer-<version>-release.apk
    ios/                            # preferred iOS layout from 1.2.0 onward
```

Going forward, put each Android release under `Finalinstall/<version>/NeoOrganizer-<version>-release.apk` and the matching iOS sideload package under `Finalinstall/<version>/ios/`.

## Upgrade rules (Android)

- Keep `applicationId` / package **`com.dayplanner.app`** so install-over 1.0.0–1.2.0 updates in place and preserves SQLite data.
- Bump `versionName` and `versionCode` (must be higher than the installed build). Current: **1.3.0** / **4**.
- Sign with the **same debug keystore** used for 1.0.0–1.2.0 (`android/app/debug.keystore` after Expo prebuild; SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`) so Android accepts the upgrade.
- Launcher display name: **NeoOrganizer**. Icon: adaptive assets from `Neo.jpeg` (same art as 1.1.0+).
- On first open after upgrade, SQLite migrations run through schema **v4** (subtask `deadline_at`).

## Upgrade rules (iOS)

- Display name **NeoOrganizer**; bundle id **`com.dayplanner.app`** (set in `app.json` for 1.2.0; keep it for future upgrade-compatible installs).
- `ios.buildNumber` tracks the Android `versionCode` (currently `4`).
- A true device IPA needs Apple Developer signing. See `1.2.0/ios/README.md` for what this Mac produced and how to install. 1.3.0 is Android-only unless an iOS package is added later.

## Build Android (local)

```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
mkdir -p ../Finalinstall/1.3.0
cp app/build/outputs/apk/release/app-release.apk \
  ../Finalinstall/1.3.0/NeoOrganizer-1.3.0-release.apk
```

## Build iOS (local)

```bash
npx expo prebuild --platform ios --no-install
# Then archive / export via Xcode or EAS when credentials allow.
# Artifacts land in Finalinstall/<version>/ios/ — see that folder's README.
```
