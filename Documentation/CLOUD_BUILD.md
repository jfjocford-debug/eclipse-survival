# Cloud build with Unity Build Automation (replaces the GameCI route)

The GameCI workflow cannot be used: the current Unity Hub no longer writes the classic `.ulf` license file it needs.
Unity Build Automation is Unity's own service; Unity's pricing page says anyone with a Unity ID can use it free, with a monthly allowance of Linux build minutes.

## Setup (Unity Dashboard, https://cloud.unity.com)

1. Sign in with your Unity account. If asked, create an organization and a project (any name).
2. Open DevOps > Build Automation > Configurations > Get started, and configure source control:
   - Source control tab, choose GitHub.
   - Create a GitHub Personal Access Token (GitHub > Settings > Developer settings > Personal access tokens). For this public repository a classic token with the `public_repo` scope is enough (add `write:repo_hook` only if you want auto-build). Paste it and choose Authorize.
   - Select `jfjocford-debug/eclipse-survival`, then Save.
3. Create a build target (Target setup):
   - Target name: `webgl`
   - Branch: `main`
   - Auto detect Unity version: on (reads 6000.3.12f1)
   - Builder operating system: Linux
   - Platform: WebGL
4. Advanced settings: if a "Pre-export method" field exists, enter `EclipseSurvival.Editor.CloudHooks.PreExport`. This creates the game's scenes and data assets before the build, which are not stored in the repository.
5. Save, then Run build.
6. When it finishes, open the build and use Download or Share.

## Known unknowns

- Whether the free Linux machine has enough memory for a WebGL build.
- Whether the Pre-export method field is offered for WebGL; without it the build may contain no scenes.
- How a finished WebGL build can be played on an iPhone. The build is a folder of files; it needs a web host (the Share page, or GitHub Pages, or similar).
