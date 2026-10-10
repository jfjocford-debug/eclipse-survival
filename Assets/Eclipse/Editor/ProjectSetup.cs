using System;
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEditor.U2D;
using UnityEngine;
using UnityEngine.Audio;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.U2D;
using UnityEngine.UI;
using Object=UnityEngine.Object;
namespace EclipseSurvival.Editor
{
    // Generated assets stay editable. Existing authored assets/scenes are never replaced.
    [InitializeOnLoad]
    public static class ProjectSetup
    {
        public const string Root="Assets/Eclipse/";
        const string Marker="ProjectSettings/EclipseSetup.version";
        static bool running;
        static ProjectSetup()
        {
            if(!Application.isBatchMode)EditorApplication.delayCall+=()=>
            {if(!File.Exists(Marker)&&!EditorApplication.isPlayingOrWillChangePlaymode)Ensure();};
        }
        [MenuItem("Eclipse/Set up project assets")]
        public static void Ensure()
        {
            if(running)return;running=true;
            try
            {
                foreach(var dir in new[]{"Resources/Config","Resources/Generated","Art/Characters","Art/Tilesets","Art/Props","Art/UI","Audio/SFX","Audio/Ambience","Audio/Eclipse","Scenes/MainMenu","Scenes/GameScene","Scenes/TestScene","Prefabs/Player","Prefabs/Enemies","Prefabs/Props","Prefabs/UI","ScriptableObjects"})Directory.CreateDirectory(Root+dir);
                AssetDatabase.Refresh();
                if(!File.Exists(Marker))ConfigureProject();ConfigurePipeline();
                var config=AssetDatabase.LoadAssetAtPath<SurvivalConfig>(Root+"Resources/Config/SurvivalConfig.asset");
                if(!config){config=ScriptableObject.CreateInstance<SurvivalConfig>();AssetDatabase.CreateAsset(config,Root+"Resources/Config/SurvivalConfig.asset");}
                if(!AssetDatabase.LoadAssetAtPath<GameDataAsset>(Root+"Resources/Config/GameData.asset"))AssetDatabase.CreateAsset(ScriptableObject.CreateInstance<GameDataAsset>(),Root+"Resources/Config/GameData.asset");
                ImportSprite(Root+"Art/Characters/hero.png",new Rect(192,172,656,1230),false,640);
                ImportSprite(Root+"Art/Characters/apostle.png",new Rect(247,9,625,1521),false,520);
                if(!config.hero)config.hero=LoadSprite(Root+"Art/Characters/hero.png");
                if(!config.apostle)config.apostle=LoadSprite(Root+"Art/Characters/apostle.png");
                foreach(string kind in new[]{"grass","road","floor","house","tree","car","crate","shadow","bandit","scavenger"})
                {
                    string path=Root+"Resources/Generated/"+kind+".png";
                    if(!File.Exists(path)){var t=PixelArt.Texture(kind);File.WriteAllBytes(path,t.EncodeToPNG());Object.DestroyImmediate(t);AssetDatabase.ImportAsset(path);}
                    ImportSprite(path,null,kind=="grass"||kind=="road"||kind=="floor",24);
                }
                if(!config.bandit)config.bandit=LoadSprite(Root+"Resources/Generated/bandit.png");
                if(!config.scavenger)config.scavenger=LoadSprite(Root+"Resources/Generated/scavenger.png");
                string spritePath=Root+"Resources/Config/SpriteUnlit.mat";
                if(!AssetDatabase.LoadAssetAtPath<Material>(spritePath)){var shader=Shader.Find("Universal Render Pipeline/2D/Sprite-Unlit-Default");if(!shader)throw new InvalidOperationException("URP sprite shader missing.");AssetDatabase.CreateAsset(new Material(shader),spritePath);}
                if(!config.spriteMaterial)config.spriteMaterial=AssetDatabase.LoadAssetAtPath<Material>(spritePath);
                ConfigureAtlases(config);ConfigureAnimation(config);ConfigureAudio(config);ConfigurePrefabs(config);
                string fogPath=Root+"Resources/Config/ScreenFog.mat";
                if(!AssetDatabase.LoadAssetAtPath<Material>(fogPath))
                {var shader=Shader.Find("Eclipse/ScreenFog");if(!shader)throw new InvalidOperationException("Eclipse fog shader is missing.");AssetDatabase.CreateAsset(new Material(shader),fogPath);}
                if(!config.fogMaterial)config.fogMaterial=AssetDatabase.LoadAssetAtPath<Material>(fogPath);
                EditorUtility.SetDirty(config);
                EnsureScenes();AssetDatabase.SaveAssets();AssetDatabase.Refresh();
                File.WriteAllText(Marker,"1\nUnity 6000.3.12f1\n");
                Debug.Log("Eclipse setup complete. Open Assets/Eclipse/Scenes/MainMenu/MainMenu.unity and press Play. Android: Eclipse > Build > Android test APK.");
            }
            finally{running=false;}
        }
        public static void ConfigureProject()
        {
            PlayerSettings.companyName="Eclipse Prototype";PlayerSettings.productName="Eclipse Survival";PlayerSettings.bundleVersion="0.3.0";
            PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android,"com.eclipseprototype.survival");
            PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.iOS,"com.eclipseprototype.survival");
            PlayerSettings.defaultScreenWidth=1280;PlayerSettings.defaultScreenHeight=720;
            PlayerSettings.defaultInterfaceOrientation=UIOrientation.AutoRotation;
            PlayerSettings.allowedAutorotateToLandscapeLeft=true;PlayerSettings.allowedAutorotateToLandscapeRight=true;
            PlayerSettings.allowedAutorotateToPortrait=false;PlayerSettings.allowedAutorotateToPortraitUpsideDown=false;
            PlayerSettings.colorSpace=ColorSpace.Linear;PlayerSettings.runInBackground=false;
            PlayerSettings.Android.minSdkVersion=AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.Android.targetSdkVersion=AndroidSdkVersions.AndroidApiLevelAuto;
            PlayerSettings.Android.targetArchitectures=AndroidArchitecture.ARM64;
            PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Android,ScriptingImplementation.IL2CPP);
            PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.iOS,ScriptingImplementation.IL2CPP);
            PlayerSettings.iOS.targetOSVersionString="15.0";
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android,false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android,new[]{GraphicsDeviceType.Vulkan,GraphicsDeviceType.OpenGLES3});
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.iOS,false);PlayerSettings.SetGraphicsAPIs(BuildTarget.iOS,new[]{GraphicsDeviceType.Metal});
            var settings=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset")[0]);
            var input=settings.FindProperty("activeInputHandler");if(input!=null){input.intValue=1;settings.ApplyModifiedPropertiesWithoutUndo();}
            Physics2D.gravity=Vector2.zero;Time.fixedDeltaTime=1f/60f;
            var tags=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/TagManager.asset")[0]);
            tags.FindProperty("layers").GetArrayElementAtIndex(8).stringValue="WorldSolid";tags.ApplyModifiedPropertiesWithoutUndo();
            EditorSettings.serializationMode=SerializationMode.ForceText;
            EditorSettings.spritePackerMode=SpritePackerMode.SpriteAtlasV2;
        }
        static void ConfigurePipeline()
        {
            string path=Root+"Resources/Config/MobileURP.asset";
            var pipeline=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(path);
            if(!pipeline)
            {
                var renderer=ScriptableObject.CreateInstance<Renderer2DData>();
                AssetDatabase.CreateAsset(renderer,Root+"Resources/Config/MobileRenderer2D.asset");
                // Unity's asset factory fills the pipeline's package resource references.
                pipeline=UniversalRenderPipelineAsset.Create(renderer);pipeline.name="Eclipse Mobile URP";
                pipeline.supportsHDR=false;pipeline.msaaSampleCount=1;pipeline.renderScale=1;
                pipeline.supportsCameraDepthTexture=false;pipeline.supportsCameraOpaqueTexture=false;
                pipeline.useSRPBatcher=true;pipeline.supportsDynamicBatching=true;
                AssetDatabase.CreateAsset(pipeline,path);
            }
            GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;
            QualitySettings.vSyncCount=0;QualitySettings.antiAliasing=0;QualitySettings.shadows=UnityEngine.ShadowQuality.Disable;
        }
        static Sprite LoadSprite(string path)
        {foreach(var asset in AssetDatabase.LoadAllAssetsAtPath(path))if(asset is Sprite sprite)return sprite;return null;}
        static void ImportSprite(string path,Rect? crop,bool centered,float ppu)
        {
            var importer=AssetImporter.GetAtPath(path) as TextureImporter;if(!importer)return;
            importer.textureType=TextureImporterType.Sprite;importer.spriteImportMode=crop.HasValue?SpriteImportMode.Multiple:SpriteImportMode.Single;
            importer.spritePixelsPerUnit=ppu;importer.filterMode=FilterMode.Point;importer.mipmapEnabled=false;importer.alphaIsTransparency=true;importer.isReadable=false;importer.maxTextureSize=2048;importer.textureCompression=TextureImporterCompression.Uncompressed;
            var data=new TextureImporterSettings();importer.ReadTextureSettings(data);data.spriteAlignment=(int)SpriteAlignment.Custom;data.spritePivot=new Vector2(.5f,centered?.5f:0);data.spriteMeshType=SpriteMeshType.FullRect;importer.SetTextureSettings(data);
            if(crop.HasValue)
            {
#pragma warning disable 0618
                importer.spritesheet=new[]{new SpriteMetaData{name=Path.GetFileNameWithoutExtension(path),rect=crop.Value,alignment=(int)SpriteAlignment.Custom,pivot=new Vector2(.5f,0)}};
#pragma warning restore 0618
            }
            importer.SaveAndReimport();
        }
        static void ConfigureAtlases(SurvivalConfig c)
        {
            string path=Root+"Art/Characters/Characters.spriteatlas";
            var atlas=AssetDatabase.LoadAssetAtPath<SpriteAtlas>(path);
            if(!atlas)
            {
                atlas=new SpriteAtlas();atlas.SetPackingSettings(new SpriteAtlasPackingSettings{padding=4,enableRotation=false,enableTightPacking=false});
                atlas.SetTextureSettings(new SpriteAtlasTextureSettings{filterMode=FilterMode.Point,generateMipMaps=false,readable=false,sRGB=true});
                atlas.Add(new Object[]{c.hero,c.apostle,c.bandit,c.scavenger});
                atlas.SetIncludeInBuild(true);AssetDatabase.CreateAsset(atlas,path);
            }
            if(!c.characterAtlas)c.characterAtlas=atlas;
        }
        static void ConfigureAnimation(SurvivalConfig c)
        {
            string path=Root+"Art/Characters/Locomotion.controller";
            var controller=AssetDatabase.LoadAssetAtPath<AnimatorController>(path);
            if(!controller)
            {
                controller=AnimatorController.CreateAnimatorControllerAtPath(path);
                controller.AddParameter("MoveX",AnimatorControllerParameterType.Float);controller.AddParameter("MoveY",AnimatorControllerParameterType.Float);controller.AddParameter("Speed",AnimatorControllerParameterType.Float);
                var machine=controller.layers[0].stateMachine;
                foreach(string direction in new[]{"South","North","West","East"})
                {
                    var clip=new AnimationClip{name="Walk"+direction,frameRate=8};
                    // Directional slots deliberately share the supplied single pose. Replace these curves with authored frames.
                    AnimationUtility.SetObjectReferenceCurve(clip,new EditorCurveBinding{path="",type=typeof(SpriteRenderer),propertyName="m_Sprite"},new[]{new ObjectReferenceKeyframe{time=0,value=c.hero},new ObjectReferenceKeyframe{time=.5f,value=c.hero}});
                    var clipSettings=AnimationUtility.GetAnimationClipSettings(clip);clipSettings.loopTime=true;AnimationUtility.SetAnimationClipSettings(clip,clipSettings);
                    AssetDatabase.CreateAsset(clip,Root+"Art/Characters/Walk"+direction+".anim");
                    var state=machine.AddState(direction);state.motion=clip;if(direction=="South")machine.defaultState=state;
                    var transition=machine.AddAnyStateTransition(state);transition.hasExitTime=false;transition.duration=0;transition.canTransitionToSelf=false;
                    transition.AddCondition(direction=="West"||direction=="South"?AnimatorConditionMode.Less:AnimatorConditionMode.Greater,direction=="West"||direction=="South"?-.3f:.3f,direction=="West"||direction=="East"?"MoveX":"MoveY");
                }
            }
            if(!c.locomotion)c.locomotion=controller;
        }
        static void ConfigureAudio(SurvivalConfig c)
        {
            const BindingFlags flags=BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Instance|BindingFlags.Static;
            string path=Root+"Audio/EclipseAudio.mixer";
            var mixer=AssetDatabase.LoadAssetAtPath<AudioMixer>(path);
            if(!mixer)
            {
                // Unity has no public mixer creation API. Isolate its editor-only factory behind version-checked reflection.
                Type type=null;foreach(var assembly in AppDomain.CurrentDomain.GetAssemblies()){type=assembly.GetType("UnityEditor.Audio.AudioMixerController");if(type!=null)break;}
                var create=type?.GetMethod("CreateMixerControllerAtPath",flags);
                if(create==null)throw new InvalidOperationException("Mixer factory changed in this Editor. Use Unity 6000.3.12f1 or create Audio/EclipseAudio.mixer with SFX, Ambience, Eclipse groups.");
                mixer=(AudioMixer)create.Invoke(null,new object[]{path});
                var master=type.GetProperty("masterGroup",flags).GetValue(mixer);
                foreach(string name in new[]{"SFX","Ambience","Eclipse"})
                {var group=type.GetMethod("CreateNewGroup",flags).Invoke(mixer,new object[]{name,false});type.GetMethod("AddChildToParent",flags).Invoke(mixer,new[]{group,master});}
                EditorUtility.SetDirty(mixer);AssetDatabase.SaveAssets();
            }
            c.mixer=mixer;c.sfxGroup=mixer.FindMatchingGroups("SFX")[0];c.ambienceGroup=mixer.FindMatchingGroups("Ambience")[0];c.eclipseGroup=mixer.FindMatchingGroups("Eclipse")[0];
            c.wind=Clip("Ambience","Wind",4);c.birds=Clip("Ambience","Birds",6);c.heartbeat=Clip("Eclipse","Heartbeat",1.1f);c.distortion=Clip("Eclipse","Distortion",4);c.melee=Clip("SFX","Melee",.2f);c.hurt=Clip("SFX","Hurt",.32f);
        }
        static AudioClip Clip(string folder,string name,float length)
        {
            string path=Root+"Audio/"+folder+"/"+name+".wav";
            if(!File.Exists(path))
            {
                const int rate=22050;int count=(int)(rate*length);var rng=new System.Random(81);float smooth=0;
                using(var stream=new FileStream(path,FileMode.Create))using(var w=new BinaryWriter(stream))
                {
                    w.Write(System.Text.Encoding.ASCII.GetBytes("RIFF"));w.Write(36+count*2);w.Write(System.Text.Encoding.ASCII.GetBytes("WAVEfmt "));w.Write(16);w.Write((short)1);w.Write((short)1);w.Write(rate);w.Write(rate*2);w.Write((short)2);w.Write((short)16);w.Write(System.Text.Encoding.ASCII.GetBytes("data"));w.Write(count*2);
                    for(int i=0;i<count;i++)
                    {
                        float t=i/(float)rate,n=(float)rng.NextDouble()*2-1;smooth=Mathf.Lerp(smooth,n,.06f);float value=0;
                        if(name=="Wind")value=smooth*.35f;
                        else if(name=="Birds"){float local=t%2;value=local<.2f?Mathf.Sin(t*(3400+700*Mathf.Sin(t*70)))*Mathf.Sin(local/.2f*Mathf.PI)*.08f:0;}
                        else if(name=="Heartbeat"){float pulse=Mathf.Exp(-t*35)+.65f*Mathf.Exp(-Mathf.Max(0,t-.19f)*35)*(t>.19f?1:0);value=Mathf.Sin(t*65*2*Mathf.PI)*pulse*.5f;}
                        else if(name=="Distortion")value=(Mathf.Sin(t*42*2*Mathf.PI)+smooth)*.05f;
                        else value=(smooth+Mathf.Sin(t*(name=="Hurt"?180:95)*2*Mathf.PI))*(1-t/length)*.3f;
                        float fade=Mathf.Min(1,Mathf.Min(i/128f,(count-1-i)/128f));w.Write((short)(Mathf.Clamp(value*fade,-1,1)*32767));
                    }
                }
                AssetDatabase.ImportAsset(path);
            }
            var importer=AssetImporter.GetAtPath(path) as AudioImporter;
            if(importer){var settings=importer.defaultSampleSettings;settings.loadType=AudioClipLoadType.DecompressOnLoad;settings.compressionFormat=AudioCompressionFormat.Vorbis;settings.quality=.6f;settings.sampleRateSetting=AudioSampleRateSetting.PreserveSampleRate;importer.defaultSampleSettings=settings;importer.forceToMono=true;importer.SaveAndReimport();}
            return AssetDatabase.LoadAssetAtPath<AudioClip>(path);
        }
        static GameObject ActorPrefab(string path,Sprite sprite,bool player,RuntimeAnimatorController animation=null)
        {
            var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(path);if(prefab)return prefab;
            var go=new GameObject(Path.GetFileNameWithoutExtension(path));go.AddComponent<SpriteRenderer>().sprite=sprite;
            if(player){var body=go.AddComponent<Rigidbody2D>();body.bodyType=RigidbodyType2D.Kinematic;body.gravityScale=0;var collider=go.AddComponent<CircleCollider2D>();collider.radius=.06f;collider.isTrigger=true;if(animation)go.AddComponent<Animator>().runtimeAnimatorController=animation;}
            prefab=PrefabUtility.SaveAsPrefabAsset(go,path);Object.DestroyImmediate(go);return prefab;
        }
        static void ConfigurePrefabs(SurvivalConfig c)
        {
            if(!c.playerPrefab)c.playerPrefab=ActorPrefab(Root+"Prefabs/Player/Player.prefab",c.hero,true,c.locomotion);
            if(!c.banditPrefab)c.banditPrefab=ActorPrefab(Root+"Prefabs/Enemies/Bandit.prefab",c.bandit,false);
            if(!c.scavengerPrefab)c.scavengerPrefab=ActorPrefab(Root+"Prefabs/Enemies/Scavenger.prefab",c.scavenger,false);
            if(!c.apostlePrefab)c.apostlePrefab=ActorPrefab(Root+"Prefabs/Enemies/Apostle.prefab",c.apostle,false);
            if(!c.lootPrefab)c.lootPrefab=ActorPrefab(Root+"Prefabs/Props/Loot.prefab",LoadSprite(Root+"Resources/Generated/crate.png"),false);
            string path=Root+"Prefabs/UI/ActionButton.prefab";
            if(!c.buttonPrefab)c.buttonPrefab=AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if(!c.buttonPrefab){var go=new GameObject("ActionButton",typeof(RectTransform),typeof(Image),typeof(Button));go.layer=5;go.GetComponent<RectTransform>().sizeDelta=new Vector2(96,96);c.buttonPrefab=PrefabUtility.SaveAsPrefabAsset(go,path);Object.DestroyImmediate(go);}
        }
        static void EnsureScenes()
        {
            var paths=new string[3];int i=0;
            foreach(string name in new[]{"MainMenu","GameScene","TestScene"})
            {
                string path=Root+"Scenes/"+name+"/"+name+".unity";paths[i++]=path;
                if(File.Exists(path))continue;
                var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Additive);
                var root=new GameObject("Eclipse Survival");UnityEngine.SceneManagement.SceneManager.MoveGameObjectToScene(root,scene);
                var game=root.AddComponent<GameController>();game.menuScene=name=="MainMenu";game.testScene=name=="TestScene";game.simulateTouch=name=="TestScene";
                EditorSceneManager.SaveScene(scene,path);EditorSceneManager.CloseScene(scene,true);
            }
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(paths[0],true),new EditorBuildSettingsScene(paths[1],true),new EditorBuildSettingsScene(paths[2],false)};
        }
    }
}
