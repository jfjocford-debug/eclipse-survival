using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
namespace EclipseSurvival.Editor
{
    public static class Builds
    {
        [MenuItem("Eclipse/Build/Android test APK")]
        public static void Android(){EditorUserBuildSettings.buildAppBundle=false;Build(BuildTarget.Android,"Builds/Android/EclipseSurvival.apk",true);}
        [MenuItem("Eclipse/Build/iOS Xcode project")]
        public static void IOS(){Build(BuildTarget.iOS,"Builds/iOS",false);}
        [MenuItem("Eclipse/Build/Windows test build")]
        public static void Windows(){Build(BuildTarget.StandaloneWindows64,"Builds/Windows/EclipseSurvival.exe",true);}
        [MenuItem("Eclipse/Build/macOS test build")]
        public static void Mac(){Build(BuildTarget.StandaloneOSX,"Builds/macOS/EclipseSurvival.app",true);}
        [MenuItem("Eclipse/Build/WebGL test build")]
        public static void WebGL()
        {
            // GitHub Pages cannot send Content-Encoding headers for .br/.gz files, so compression is off.
            PlayerSettings.WebGL.compressionFormat=WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.decompressionFallback=false;
            PlayerSettings.WebGL.dataCaching=false;
            Build(BuildTarget.WebGL,"Builds/WebGL",false);
        }
        static void Build(BuildTarget target,string path,bool development)
        {
            ProjectSetup.Ensure();
            if(!BuildPipeline.IsBuildTargetSupported(BuildPipeline.GetBuildTargetGroup(target),target))throw new InvalidOperationException("Install Unity Hub build support for "+target+" before building.");
            if(!EditorUserBuildSettings.SwitchActiveBuildTarget(BuildPipeline.GetBuildTargetGroup(target),target))throw new InvalidOperationException("Could not switch build target to "+target+".");
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{
                scenes=new[]{ProjectSetup.Root+"Scenes/MainMenu/MainMenu.unity",ProjectSetup.Root+"Scenes/GameScene/GameScene.unity"},
                locationPathName=path,target=target,options=development?BuildOptions.Development:BuildOptions.None
            });
            if(report.summary.result!=BuildResult.Succeeded)throw new InvalidOperationException(target+" build failed: "+report.summary.totalErrors+" errors. See Editor log.");
            UnityEngine.Debug.Log("Eclipse build: "+path+" ("+report.summary.totalSize+" bytes)");
        }
    }
}
