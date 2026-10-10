#!/usr/bin/env bash
set -euo pipefail
: "${UNITY_EDITOR:?Set UNITY_EDITOR to the Unity 6000.3.12f1 executable}"
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
mkdir -p "$project_dir/Logs"
"$UNITY_EDITOR" -batchmode -nographics -quit -projectPath "$project_dir" -executeMethod EclipseSurvival.Editor.ProjectSetup.Ensure -logFile "$project_dir/Logs/setup.log"
"$UNITY_EDITOR" -batchmode -nographics -projectPath "$project_dir" -runTests -testPlatform EditMode -testResults "$project_dir/Logs/editmode.xml" -logFile "$project_dir/Logs/editmode.log"
# PlayMode renders the HUD: run in a normal desktop session, or via xvfb-run on Linux.
"$UNITY_EDITOR" -batchmode -projectPath "$project_dir" -runTests -testPlatform PlayMode -testResults "$project_dir/Logs/playmode.xml" -logFile "$project_dir/Logs/playmode.log"
