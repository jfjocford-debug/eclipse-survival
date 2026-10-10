using UnityEditor;
namespace EclipseSurvival.Editor
{
    // Entry points for Unity Build Automation. Set "Pre-export method" to
    // EclipseSurvival.Editor.CloudHooks.PreExport in the build target's advanced settings.
    public static class CloudHooks
    {
        public static void PreExport()
        {
            ProjectSetup.Ensure();
            PlayerSettings.WebGL.compressionFormat=WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.decompressionFallback=false;
            PlayerSettings.WebGL.dataCaching=false;
            AssetDatabase.SaveAssets();
        }
    }
}
