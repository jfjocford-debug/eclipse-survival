using UnityEngine;
using UnityEngine.Audio;
using UnityEngine.U2D;
namespace EclipseSurvival
{
    [CreateAssetMenu(menuName="Eclipse/Survival configuration")]
    public sealed class SurvivalConfig : ScriptableObject
    {
        [Header("Cycle")]
        [Tooltip("Day and Eclipse lengths now live in the Game data asset (Clock).")] public bool quickCycle;
        [Header("Mobile")]
        [Range(.08f,.10f)] public float safeMargin=.08f;
        [Range(.1f,.15f)] public float joystickDeadzone=.12f;
        [Range(140,160)] public float joystickSize=150;
        [Range(90,120)] public float attackSize=112;
        [Range(90,120)] public float actionSize=96;
        [Range(80,100)] public float inventorySize=80;
        public bool autoLoot=true;
        [Min(.25f)] public float heavyHoldSeconds=.45f;
        [Header("View")]
        [Range(32,100)] public int pixelsPerUnit=48;
        public Vector2Int referenceResolution=new Vector2Int(640,360);
        public bool reducedMotion;
        [Tooltip("Use integer pixel ratios for the lens; small zoom changes can quantize away. Otherwise preserve smooth gameplay zoom with pixel-snapped positions and point-filtered art.")] public bool strictPixelPerfectZoom;
        [Range(.75f,1f)] public float minimumRenderScale=.8f;
        public Sprite hero;
        public Sprite apostle;
        public Sprite bandit;
        public Sprite scavenger;
        public SpriteAtlas characterAtlas;
        public RuntimeAnimatorController locomotion;
        public GameObject playerPrefab, banditPrefab, scavengerPrefab, apostlePrefab, lootPrefab, buttonPrefab;
        public Material fogMaterial, spriteMaterial;
        [Header("Audio")]
        public AudioMixer mixer;
        public AudioMixerGroup sfxGroup, ambienceGroup, eclipseGroup;
        public AudioClip wind,birds,heartbeat,distortion,melee,hurt;
    }
}
