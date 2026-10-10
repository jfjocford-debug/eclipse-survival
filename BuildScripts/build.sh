#!/usr/bin/env bash
set -euo pipefail
: "${UNITY_EDITOR:?Set UNITY_EDITOR to the Unity 6000.3.12f1 executable}"
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
case "${1:-android}" in
  setup) method=EclipseSurvival.Editor.ProjectSetup.Ensure; target=StandaloneLinux64 ;;
  android) method=EclipseSurvival.Editor.Builds.Android; target=Android ;;
  ios) method=EclipseSurvival.Editor.Builds.IOS; target=iOS ;;
  windows) method=EclipseSurvival.Editor.Builds.Windows; target=Win64 ;;
  mac) method=EclipseSurvival.Editor.Builds.Mac; target=OSXUniversal ;;
  *) echo 'Usage: build.sh setup|android|ios|windows|mac' >&2; exit 2 ;;
esac
mkdir -p "$project_dir/Logs"
"$UNITY_EDITOR" -batchmode -nographics -quit -projectPath "$project_dir" -buildTarget "$target" -executeMethod "$method" -logFile "$project_dir/Logs/build-${1:-android}.log"
