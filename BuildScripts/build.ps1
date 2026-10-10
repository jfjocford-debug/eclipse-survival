param([ValidateSet('setup','android','ios','windows','mac')][string]$Target='android')
$ErrorActionPreference='Stop'
if (-not $env:UNITY_EDITOR) { throw 'Set UNITY_EDITOR to the Unity 6000.3.12f1 executable.' }
$projectDir=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$methods=@{setup='ProjectSetup.Ensure';android='Builds.Android';ios='Builds.IOS';windows='Builds.Windows';mac='Builds.Mac'}
$platforms=@{setup='Win64';android='Android';ios='iOS';windows='Win64';mac='OSXUniversal'}
New-Item -ItemType Directory -Force (Join-Path $projectDir 'Logs') | Out-Null
& $env:UNITY_EDITOR -batchmode -nographics -quit -projectPath $projectDir -buildTarget $platforms[$Target] -executeMethod "EclipseSurvival.Editor.$($methods[$Target])" -logFile (Join-Path $projectDir "Logs/build-$Target.log")
if ($LASTEXITCODE -ne 0) { throw "Unity exited with code $LASTEXITCODE. Check Logs/build-$Target.log." }
