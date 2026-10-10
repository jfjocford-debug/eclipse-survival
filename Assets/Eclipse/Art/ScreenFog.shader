Shader "Eclipse/ScreenFog"
{
 Properties { [PerRendererData] _MainTex("Texture",2D)="white"{} _Color("Tint",Color)=(1,1,1,1) _Night("Night",Float)=0 _Safe("Sheltered",Float)=0 _Clock("Clock",Float)=0 }
 SubShader
 {
  Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
  Blend SrcAlpha OneMinusSrcAlpha
  ZWrite Off Cull Off ZTest Always
  Pass
  {
   CGPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #include "UnityCG.cginc"
   struct appdata {float4 vertex:POSITION; float2 uv:TEXCOORD0; fixed4 color:COLOR;};
   struct v2f {float4 pos:SV_POSITION; float2 uv:TEXCOORD0; fixed4 color:COLOR;};
   float _Night,_Safe,_Clock;fixed4 _Color;
   v2f vert(appdata v){v2f o;o.pos=UnityObjectToClipPos(v.vertex);o.uv=v.uv;o.color=v.color*_Color;return o;}
   fixed4 frag(v2f i):SV_Target
   {
    half2 p=i.uv-half2(.5,.5);half edge=saturate(length(p*half2(1.4,1.8)));
    half bands=sin(i.uv.y*18+_Clock*.14+sin(i.uv.x*8+_Clock*.09));
    half opacity=lerp(.13,.40+edge*.5,_Night)-_Safe*.22+bands*.035*_Night;
    return fixed4(lerp(fixed3(.38,.06,.035),fixed3(.025,.015,.07),_Night),saturate(opacity)*i.color.a);
   }
   ENDCG
  }
 }
}
