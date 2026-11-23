# Finalinstall — sideload APKs

Phone install copies for NeoOrganizer (`com.dayplanner.app`). **APKs are gitignored**; only this README and `Neo.jpeg` (launcher source art) are tracked.

## Versioned layout

```
Finalinstall/
  Neo.jpeg                          # launcher icon source
  NeoOrganizer-1.0.0-release.apk    # legacy flat path (kept if present)
  1.1.0/
    NeoOrganizer-1.1.0-release.apk
  <version>/
    NeoOrganizer-<version>-release.apk
```

Going forward, put each release under `Finalinstall/<version>/NeoOrganizer-<version>-release.apk`.

## Upgrade rules

- Keep `applicationId` / package **`com.dayplanner.app`** so install-over-1.0.0 updates in place and preserves SQLite data.
- Bump `versionName` and `versionCode` (must be higher than the installed build).
- Sign with the **same debug keystore** used for 1.0.0 (`android/app/debug.keystore` after Expo prebuild) so Android accepts the upgrade.
- Launcher display name: **NeoOrganizer**. Icon: regenerate adaptive assets from `Neo.jpeg`.

## Build (local)

```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
mkdir -p ../Finalinstall/1.1.0
cp app/build/outputs/apk/release/app-release.apk \
  ../Finalinstall/1.1.0/NeoOrganizer-1.1.0-release.apk
```
