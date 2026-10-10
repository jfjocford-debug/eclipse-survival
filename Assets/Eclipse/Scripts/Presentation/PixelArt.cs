using System.Collections.Generic;
using UnityEngine;
namespace EclipseSurvival
{
    // Small original procedural placeholders. Imported hero/Apostle PNG bytes remain unchanged.
    public static class PixelArt
    {
        static readonly Dictionary<string,Sprite> cache=new Dictionary<string,Sprite>();
        public static Sprite Get(string kind)
        {
            if(cache.TryGetValue(kind,out var found))return found;
            var loaded=Resources.Load<Sprite>("Generated/"+kind);
            if(loaded){cache[kind]=loaded;return loaded;}
            var texture=Texture(kind);
            var sprite=Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,kind=="grass"||kind=="road"||kind=="floor"?.5f:0),24);
            cache[kind]=sprite;return sprite;
        }
        public static Texture2D Texture(string kind)
        {
            int w=kind=="house"?128:kind=="bandit"||kind=="scavenger"?24:48;
            int h=kind=="house"?112:kind=="bandit"||kind=="scavenger"?48:kind=="tree"?72:24;
            var t=new Texture2D(w,h,TextureFormat.RGBA32,false){filterMode=FilterMode.Point,wrapMode=TextureWrapMode.Clamp,name=kind};
            Color32[] p=new Color32[w*h];
            Color C(string hex){ColorUtility.TryParseHtmlString(hex,out var c);return c;}
            void Rect(int x,int y,int rw,int rh,Color c){for(int yy=Mathf.Max(0,y);yy<Mathf.Min(h,y+rh);yy++)for(int xx=Mathf.Max(0,x);xx<Mathf.Min(w,x+rw);xx++)p[yy*w+xx]=c;}
            void Poly(Color c,params Vector2[] points){for(int y=0;y<h;y++)for(int x=0;x<w;x++){bool inside=false;for(int i=0,j=points.Length-1;i<points.Length;j=i++){var a=points[i];var b=points[j];if((a.y>y)!=(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}if(inside)p[y*w+x]=c;}}
            if(kind=="grass"||kind=="road"||kind=="floor")
            {
                Poly(C(kind=="grass"?"#556747":kind=="road"?"#434b46":"#797961"),new Vector2(24,0),new Vector2(48,12),new Vector2(24,24),new Vector2(0,12));
                if(kind=="grass")for(int i=0;i<15;i++){int x=(i*19+7)%48,y=(i*7+3)%24;if(p[y*w+x].a>0)p[y*w+x]=C("#788656");}
                if(kind=="road")Rect(19,10,10,2,C("#b7b38a"));
                if(kind=="floor"){Rect(22,7,2,10,C("#687256"));}
            }
            else if(kind=="house")
            {
                Poly(C("#182a2070"),new Vector2(10,7),new Vector2(75,0),new Vector2(127,29),new Vector2(56,51));
                Poly(C("#596b59"),new Vector2(10,28),new Vector2(65,0),new Vector2(65,46),new Vector2(10,73));
                Poly(C("#83917a"),new Vector2(65,0),new Vector2(118,29),new Vector2(118,76),new Vector2(65,46));
                Poly(C("#425e5c"),new Vector2(5,75),new Vector2(61,109),new Vector2(123,79),new Vector2(65,44));
                Poly(C("#698178"),new Vector2(61,109),new Vector2(123,79),new Vector2(126,50),new Vector2(65,79));
                Rect(76,12,12,28,C("#283d32"));Rect(87,22,2,2,C("#d9bf81"));
                Rect(98,28,12,14,C("#adc3a0"));Rect(30,32,12,14,C("#a8b69c"));
                Rect(86,81,10,20,C("#38483b"));Rect(84,100,14,4,C("#acaa82"));
            }
            else if(kind=="bandit"||kind=="scavenger")
            {
                Rect(4,0,6,15,C("#27362d"));Rect(14,0,6,15,C("#27362d"));
                Rect(3,14,18,20,C(kind=="bandit"?"#836252":"#687c5b"));
                Rect(0,15,3,19,C("#424f3b"));Rect(21,15,3,19,C("#424f3b"));
                Rect(6,34,12,10,C("#bd9a6a"));Rect(4,42,16,5,C("#303c2e"));Rect(8,38,9,2,C("#292e27"));
            }
            else if(kind=="tree")
            {
                Rect(22,0,5,44,C("#6a6247"));
                for(int i=0;i<3;i++)Poly(C(i==0?"#354f38":i==1?"#506847":"#70804e"),new Vector2(3+i*4,22+i*13),new Vector2(24,55+i*8),new Vector2(47-i*4,22+i*13));
            }
            else if(kind=="car")
            {Poly(C("#536f69"),new Vector2(0,10),new Vector2(31,0),new Vector2(48,12),new Vector2(14,24));Rect(14,11,21,8,C("#adc0ae"));Rect(4,2,8,6,C("#182e28"));Rect(36,10,8,6,C("#182e28"));}
            else if(kind=="shadow")
            {for(int y=0;y<h;y++)for(int x=0;x<w;x++)if(Mathf.Pow((x-24)/24f,2)+Mathf.Pow((y-12)/8f,2)<1)p[y*w+x]=C("#0b191277");}
            else
            {Poly(C("#826e49"),new Vector2(10,4),new Vector2(26,0),new Vector2(39,8),new Vector2(23,14));Rect(10,6,29,10,C("#ab9561"));Rect(12,15,25,5,C("#c3ae78"));Rect(23,7,3,14,C("#e1d199"));}
            t.SetPixels32(p);t.Apply(false,false);return t;
        }
    }
}
