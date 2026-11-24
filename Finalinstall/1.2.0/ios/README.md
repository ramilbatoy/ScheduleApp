# NeoOrganizer 1.2.0 — iOS package

Layout used: **`Finalinstall/1.2.0/ios/`** (sibling of the Android APK under `Finalinstall/1.2.0/`).

| Field | Value |
| --- | --- |
| Display name | **NeoOrganizer** |
| Bundle id | `com.dayplanner.app` (first iOS id in this project; keep for upgrade-compatible installs) |
| Marketing version | `1.2.0` |
| Build number | `3` (matches Android `versionCode`) |

## What this folder contains

| Artifact | Purpose |
| --- | --- |
| `NeoOrganizer-1.2.0-simulator.app` (+ `.zip`) | Release **Simulator** build (unsigned). For Xcode Simulator once an iOS Simulator runtime is installed. |
| `NeoOrganizer-1.2.0-unsigned.xcarchive` | Device `iphoneos` archive built with `CODE_SIGNING_ALLOWED=NO`. |
| `NeoOrganizer-1.2.0-unsigned.ipa` | Payload zip of that archive’s `.app`. **Not installable on a phone** until resigned with a valid Apple team / provisioning profile. |

There is **no** signed distributable `NeoOrganizer-1.2.0.ipa` on this Mac yet.

## Blocker (device IPA)

```
security find-identity -v -p codesigning  →  0 valid identities found
xcodebuild -exportArchive …              →  error: exportArchive No Team Found in Archive
```

No Apple Development / Distribution certificate, no App Store / Ad Hoc provisioning profile, and no Xcode team is configured. EAS/local export cannot produce a sideloadable IPA until credentials exist.

Also: Simulator **runtimes** for iOS 17.2 / 18.0 show as unavailable; Xcode has the iOS 27.2 Simulator SDK, but no usable runtime was present when packaging — install a runtime in Xcode → Settings → Platforms before booting the simulator `.app`.

## How to install later (when credentials exist)

1. Open `ios/NeoOrganizer.xcworkspace` (regenerate with `npx expo prebuild --platform ios` if needed).
2. In Xcode → Signing & Capabilities, select your Team for target **NeoOrganizer**.
3. Archive (Product → Archive) or:

```bash
cd ios
xcodebuild -workspace NeoOrganizer.xcworkspace -scheme NeoOrganizer \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -archivePath /tmp/NeoOrganizer-1.2.0.xcarchive archive
xcodebuild -exportArchive \
  -archivePath /tmp/NeoOrganizer-1.2.0.xcarchive \
  -exportPath /tmp/NeoOrganizer-1.2.0-export \
  -exportOptionsPlist exportOptions.plist   # method: debugging / ad-hoc / app-store-connect
```

4. Copy the signed IPA to this folder as `NeoOrganizer-1.2.0.ipa` and install via Finder / Apple Configurator / `ios-deploy`.

Or with EAS (after `eas credentials` / Apple login):

```bash
npx eas-cli build -p ios --profile preview --local
```

## Simulator install (after runtime is available)

```bash
xcrun simctl boot "<device-udid>"
xcrun simctl install booted \
  Finalinstall/1.2.0/ios/NeoOrganizer-1.2.0-simulator.app
xcrun simctl launch booted com.dayplanner.app
```
