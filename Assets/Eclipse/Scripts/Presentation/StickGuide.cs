using UnityEngine;
using UnityEngine.UI;
namespace EclipseSurvival
{
    /// <summary>Two faint rings on the virtual stick that mark where walk becomes jog and where jog becomes run.</summary>
    public static class StickGuide
    {
        static Sprite ring;

        public static void Build(RectTransform stick,float deadzone,float walkBandMax,float runBandMin)
        {
            float radius=stick.rect.width*.35f; // the same travel the stick uses
            Make(stick,"Walk limit",radius*(deadzone+walkBandMax*(1f-deadzone)));
            Make(stick,"Run threshold",radius*(deadzone+runBandMin*(1f-deadzone)));
        }

        static void Make(RectTransform parent,string name,float radius)
        {
            var go=new GameObject(name,typeof(RectTransform),typeof(Image));go.layer=5;
            var rect=(RectTransform)go.transform;rect.SetParent(parent,false);
            rect.anchorMin=rect.anchorMax=rect.pivot=new Vector2(.5f,.5f);rect.sizeDelta=Vector2.one*radius*2f;rect.anchoredPosition=Vector2.zero;
            var image=go.GetComponent<Image>();image.sprite=Ring();image.color=new Color(1f,.93f,.64f,.35f);image.raycastTarget=false;
            rect.SetAsFirstSibling();
        }

        static Sprite Ring()
        {
            if(ring)return ring;
            const int size=128;const float outer=size*.5f-1f,inner=outer-2.5f;
            var texture=new Texture2D(size,size,TextureFormat.RGBA32,false){filterMode=FilterMode.Bilinear,wrapMode=TextureWrapMode.Clamp};
            var pixels=new Color32[size*size];
            for(int y=0;y<size;y++)for(int x=0;x<size;x++)
            {
                float d=Mathf.Sqrt((x-size*.5f+.5f)*(x-size*.5f+.5f)+(y-size*.5f+.5f)*(y-size*.5f+.5f));
                pixels[y*size+x]=d<=outer&&d>=inner?new Color32(255,255,255,255):new Color32(255,255,255,0);
            }
            texture.SetPixels32(pixels);texture.Apply();
            return ring=Sprite.Create(texture,new Rect(0,0,size,size),new Vector2(.5f,.5f),size);
        }
    }
}
