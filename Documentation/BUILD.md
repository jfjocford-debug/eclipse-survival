# Build pipeline

## Android first

Activate Unity in Hub and install exactly 6000.3.12f1 with Android Build Support, Android SDK/NDK, and OpenJDK. Run **Eclipse → Set up project assets**, then **Eclipse → Build → Android test APK**.

Default Android settings: ARM64, IL2CPP, minimum API 26, SDK target automatic from installed tools, Vulkan with OpenGLES3 fallback, landscape left/right only, development build. Package ID is `com.eclipseprototype.survival`; replace it with your own before distribution.

The menu produces `Builds/Android/EclipseSurvival.apk`. It is a development APK using the normal local debug signing behavior, not a Play Store release. With USB debugging enabled on your own Android device:

```sh
adb install -r Builds/Android/EclipseSurvival.apk
```

CLI on Linux/macOS:

```sh
export UNITY_EDITOR="/path/to/Unity"
./BuildScripts/build.sh setup
./BuildScripts/build.sh android
```

PowerShell:

```powershell
$env:UNITY_EDITOR = 'C:\Program Files\Unity\Hub\Editor\6000.3.12f1\Editor\Unity.exe'
.\BuildScripts\build.ps1 setup
.\BuildScripts\build.ps1 android
```

Open the corresponding file under `Logs` if Unity exits unsuccessfully. A nonzero exit is propagated; the scripts do not report failed builds as successful. Batch jobs need their own properly activated license; no credentials or license files are included in this project.

## iOS second

After Android controls and survival are verified, install iOS Build Support. Choose **Eclipse → Build → iOS Xcode project**, producing `Builds/iOS`. Defaults are Metal, IL2CPP and iOS 15+. Open the export on a Mac with a compatible Xcode version, set your own bundle ID and signing team, and run on a device. TestFlight requires your Apple Developer/App Store Connect setup, an archive signed for distribution, and upload/processing there. No Apple account, signing certificate, provisioning profile, Xcode archive, or TestFlight upload is included.

## Desktop afterward

Menu commands and CLI targets `windows` and `mac` create development players once the relevant platform build modules are installed. Output directories are `Builds/Windows` and `Builds/macOS`. Desktop adaptation supplies keyboard/mouse controls, mouse reticle, and a less enlarged HUD. Desktop players have not been produced in this delivery.

## Tests

Pure C# core, no Unity license required:

```sh
dotnet run --project Tests/CoreHarness/CoreHarness.csproj -c Release
```

Unity Test Runner: Window → General → Test Runner, run EditMode then PlayMode. Or use `BuildScripts/test.sh` after setting UNITY_EDITOR. EditMode can use `-nographics`; the PlayMode HUD tests should run in a desktop session (or `xvfb-run` on Linux).

## Device acceptance pass

Check an Android phone in landscape with two simultaneous fingers: stick center/deadzone, full-tilt run, tap/hold attack without a second strike, swipe dodge, releasing input on pause/background, inventory scrolling, safe-area spacing, and entering/exiting all five interiors. Confirm tools strengthen the safehouse walls one at a time, the wall meter shows in the safehouse, the Apostle walks to the door at the Eclipse and the cracking warning appears at 25%, warning audio triggers, the Apostle spawns only at Eclipse, and a full 150/90-second cycle reaches dawn. Repeat in portrait/background and under low frame rate. Inspect GPU frame time, thermal behavior, allocation spikes and memory using Unity Profiler on-device. Then repeat the core pass on iOS before TestFlight.
