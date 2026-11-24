# Android build — DayPlanner

Primary production surface. Do **not** use Expo Go for acceptance (SQLite + local notifications need a real native build).

## Prerequisites

- Node.js ≥ 22.13.0 / npm (Expo SDK 58; see `.nvmrc`)
- JDK 17+ (JDK 21 works with the current Gradle/AGP)
- Android SDK: `platform-tools`, `platforms;android-35`, `build-tools;35.0.0`, NDK as resolved by Expo prebuild
- Env: `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) pointing at the SDK root

```bash
export ANDROID_HOME=/path/to/android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

## Local Gradle APKs (recommended for this repo)

Native `android/` is generated (gitignored). Regenerate and assemble:

```bash
npm install
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleDebug      # debug-signed → app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease    # release build; currently signed with the debug keystore for sideload QA
# Optional: shrink APK size for a single ABI (e.g. physical arm64 device / arm64 emulator)
./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a
```

Copy artifacts out of the tree when needed (versioned Finalinstall convention):

```bash
mkdir -p Finalinstall/1.2.0
cp android/app/build/outputs/apk/release/app-release.apk   Finalinstall/1.2.0/NeoOrganizer-1.2.0-release.apk
```

APKs under `Finalinstall/` are gitignored. See `Finalinstall/README.md`.

### Install on a device / emulator

```bash
adb install -r dayplanner-1.0.0-debug.apk
# or
adb install -r dayplanner-1.0.0-release.apk
```

Package id: `com.dayplanner.app` · Launcher display name: **NeoOrganizer**

### Dev client (optional)

```bash
npx expo run:android
```

## EAS Build (cloud)

Profiles live in `eas.json`:

| Profile | Output | Use |
| --- | --- | --- |
| `development` | APK + dev client | Local Metro + device |
| `preview` | APK | Internal sideload |
| `production` | APK | Release candidate |

```bash
npx eas-cli login
npx eas-cli build -p android --profile preview
npx eas-cli build -p android --profile production
```

For a store-ready AAB later, change `android.buildType` to `app-bundle` and configure a release keystore via `eas credentials`.

## Permissions (declared in `app.json`)

- `POST_NOTIFICATIONS` — reminder banners
- `SCHEDULE_EXACT_ALARM` — precise AlarmManager delivery when the user allows it
- `RECEIVE_BOOT_COMPLETED` — OS may need this for notification persistence across reboot (reminders are also rebuilt on app open)
- `VIBRATE` — channel vibration pattern

In **Settings → Reminders**, grant notification permission and optionally **Precise timing (exact alarms)**. Without exact-alarm permission, Android may delay delivery (OEM battery policies).

## Offline smoke checklist

1. Airplane mode on; open DayPlanner
2. Quick-add a timed event/task; confirm it appears on Today
3. With notifications allowed, create a timed item with a reminder offset; confirm a pending OS notification appears (`adb shell dumpsys notification` / Settings → Apps → DayPlanner → Notifications / scheduled)
4. Kill the process; relaunch — data still present (SQLite)
5. Toggle theme; export a JSON backup; restore after a dummy edit

## Signing note

Local `assembleRelease` uses the **debug keystore** (Expo default until a production keystore is configured). Fine for sideload QA; replace before Play Store upload.
