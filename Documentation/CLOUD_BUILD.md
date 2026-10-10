# Cloud build: Unity WebGL on GitHub (no local Unity install)

Result: every push to `main` builds the game on GitHub's servers and publishes it at
`https://<your-github-name>.github.io/<repo-name>/`, playable in iPhone Safari.

## One-time setup

1. **GitHub account and repository.** Create a repository. GitHub Pages on a free account needs a PUBLIC repository, so the source will be public. Upload the contents of this project folder (including the hidden `.github` folder) to the `main` branch.
2. **Turn on Pages.** Repository > Settings > Pages > Source: "GitHub Actions".
3. **Get a Unity license file (.ulf).** GameCI documents this as: install Unity Hub, sign in with your Unity account, open Preferences > Licenses > Add > free Personal license, and complete the steps even if a license already shows. The file is then at:
   - Windows `C:\ProgramData\Unity\Unity_lic.ulf`
   - Mac `/Library/Application Support/Unity/Unity_lic.ulf`
   Only Unity Hub is needed. The Unity Editor itself does not have to be installed (not yet verified for the latest Hub; if Hub refuses, tell me the message).
4. **Add three secrets.** Repository > Settings > Secrets and variables > Actions > New repository secret:
   - `UNITY_LICENSE`: paste the full text of the `.ulf` file
   - `UNITY_EMAIL`: your Unity account email
   - `UNITY_PASSWORD`: your Unity account password. Use a password unique to Unity, letters and digits only (GameCI reports problems with special characters).
5. **Run it.** Actions tab > "Build and publish WebGL" > Run workflow. The first build is slow (about 20 to 40 minutes is typical, because the Library cache is empty). Later builds are faster.

## Reading the result

- Green run: open the Pages link on your iPhone.
- Red run: open the failed step and send me the first error lines. Compile errors, setup-menu errors and license errors look different, and I can tell them apart.

## What is untested

- The WebGL build method (`Eclipse > Build > WebGL test build`) has not run in real Unity.
- Touch input, the safe area and performance in iPhone Safari are unknown. WebGL on iPhone is memory-limited.
- Whether Unity permits Personal-license activation on a cloud build server is a licensing-terms question. GameCI documents it as supported.
