using UnityEngine;
using UnityEngine.U2D;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    public sealed class CameraRig : MonoBehaviour
    {
        public Camera Main {get;private set;}
        public Camera Ui {get;private set;}
        public float TargetSize {get;private set;}
        public float ResolutionScale {get;private set;}=1;
        GameController game;
        PixelPerfectCamera pixel;
        UniversalRenderPipelineAsset pipeline;
        float average=1f/60,qualityTimer,originalScale=1,size=3.75f;
        Vector3 follow;
        string area;
        public void Initialize(GameController controller)
        {
            game=controller;Main=gameObject.AddComponent<Camera>();Main.tag="MainCamera";
            Main.orthographic=true;Main.orthographicSize=3.75f;Main.nearClipPlane=.1f;Main.farClipPlane=100;
            Main.backgroundColor=new Color(.07f,.12f,.10f);Main.clearFlags=CameraClearFlags.SolidColor;
            Main.cullingMask=~(1<<5);Main.allowHDR=false;Main.allowMSAA=false;Main.allowDynamicResolution=game.IsMobile;
            transform.position=new Vector3(0,-5,-10);follow=transform.position;
            pixel=gameObject.AddComponent<PixelPerfectCamera>();pixel.assetsPPU=game.config.pixelsPerUnit;
            pixel.refResolutionX=game.config.referenceResolution.x;pixel.refResolutionY=game.config.referenceResolution.y;
            pixel.gridSnapping=PixelPerfectCamera.GridSnapping.PixelSnapping;
            Ui=new GameObject("UI camera").AddComponent<Camera>();Ui.transform.SetParent(transform,false);Ui.orthographic=true;Ui.orthographicSize=5;Ui.cullingMask=1<<5;Ui.clearFlags=CameraClearFlags.Depth;Ui.allowHDR=false;Ui.allowMSAA=false;
            var uiData=Ui.GetUniversalAdditionalCameraData();uiData.renderType=CameraRenderType.Overlay;
            Main.GetUniversalAdditionalCameraData().cameraStack.Add(Ui);
            pipeline=GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;if(pipeline)originalScale=pipeline.renderScale;
            gameObject.AddComponent<AudioListener>();
        }
        void LateUpdate()
        {
            if(game.State==null)return;
            var s=game.State;float dt=Mathf.Min(Time.unscaledDeltaTime,.1f);
            bool combat=s.Threat>.08f||s.Player.Cooldown>0||s.LockId>=0;
            TargetSize=3.75f*(combat?1.18f:1)*(s.Area!="street"?.88f:1)*(s.Phase==DayPhase.Eclipse?1.06f:1);
            size=Mathf.Lerp(size,TargetSize,game.config.reducedMotion?1:1-Mathf.Exp(-5*dt));
            // Pixel-perfect mode uses Unity's supported Cinemachine correction API to prevent lens overrides.
            // Quantization can reduce the size of a zoom change on low-resolution viewports.
            float corrected=pixel.CorrectCinemachineOrthoSize(size);
            Main.orthographicSize=game.config.strictPixelPerfectZoom?corrected:Mathf.Round(size*game.config.pixelsPerUnit)/game.config.pixelsPerUnit;
            var goal=Iso.World(s.Player.Position)+Vector3.back*10;
            if(area!=s.Area){follow=goal;area=s.Area;}
            var delta=goal-follow;float dead=.18f;
            var target=follow+new Vector3(Mathf.Sign(delta.x)*Mathf.Max(0,Mathf.Abs(delta.x)-dead),Mathf.Sign(delta.y)*Mathf.Max(0,Mathf.Abs(delta.y)-dead),0);
            follow=Vector3.Lerp(follow,target,1-Mathf.Exp(-10*dt));
            float shake=game.config.reducedMotion?0:Mathf.Min(.035f,s.Shake*.14f);
            transform.position=follow+new Vector3(Mathf.Sin(s.Elapsed*89),Mathf.Cos(s.Elapsed*113),0)*shake;
            if(game.IsMobile&&s.Mode==RunMode.Playing)
            {
                average=Mathf.Lerp(average,Time.unscaledDeltaTime,.035f);qualityTimer+=dt;
                if(qualityTimer>=2)
                {
                    qualityTimer=0;
                    if(average>.022f)ResolutionScale=Mathf.Max(game.config.minimumRenderScale,ResolutionScale-.05f);
                    else if(average<.0172f)ResolutionScale=Mathf.Min(1,ResolutionScale+.05f);
                    var api=SystemInfo.graphicsDeviceType;
                    if(api==GraphicsDeviceType.Vulkan||api==GraphicsDeviceType.Metal)ScalableBufferManager.ResizeBuffers(ResolutionScale,ResolutionScale);
                    else if(pipeline)pipeline.renderScale=ResolutionScale;
                }
            }
        }
        void OnDestroy(){ScalableBufferManager.ResizeBuffers(1,1);if(pipeline)pipeline.renderScale=originalScale;}
    }
}
