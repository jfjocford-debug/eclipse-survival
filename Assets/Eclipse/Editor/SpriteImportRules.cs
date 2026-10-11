using UnityEditor;
using UnityEngine;
namespace EclipseSurvival.Editor
{
    // Every PNG under Art/Sprites imports the same way, so art made to Documentation/ART.md needs no manual import work.
    // Sheets are cut into sprites at runtime, so the texture itself stays a plain, uncompressed, point-filtered image.
    public sealed class SpriteImportRules : AssetPostprocessor
    {
        const string Folder = "Assets/Eclipse/Art/Sprites/";
        void OnPreprocessTexture()
        {
            if(!assetPath.StartsWith(Folder)||!assetPath.EndsWith(".png"))return;
            var t=(TextureImporter)assetImporter;
            t.textureType=TextureImporterType.Default;
            t.alphaIsTransparency=true;
            t.mipmapEnabled=false;
            t.filterMode=FilterMode.Point;
            t.textureCompression=TextureImporterCompression.Uncompressed;
            t.npotScale=TextureImporterNPOTScale.None;
            t.maxTextureSize=4096;
            t.wrapMode=TextureWrapMode.Clamp;
            t.isReadable=false;
        }
    }
}
