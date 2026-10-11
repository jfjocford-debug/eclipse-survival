using System;
using UnityEngine;
namespace EclipseSurvival
{
    /// <summary>
    /// Small synthesized sounds for the cues that need no recorded asset yet: blows on the walls, scratching at the
    /// door and the sting when something notices you. They are built once, on first use, and reused.
    /// </summary>
    public static class ProceduralSfx
    {
        const int Rate = 22050;
        static readonly System.Random Rng = new System.Random(7);
        static AudioClip thump, scratch, alert;

        public static AudioClip Thump { get { return thump ? thump : (thump = Make("Wall thump", .5f, ThumpAt)); } }
        public static AudioClip Scratch { get { return scratch ? scratch : (scratch = MakeScratch()); } }
        public static AudioClip Alert { get { return alert ? alert : (alert = Make("Noticed", .5f, AlertAt)); } }

        static float Noise() { return (float)(Rng.NextDouble() * 2.0 - 1.0); }

        static float ThumpAt(float t)
        {
            float body = Mathf.Sin(2f * Mathf.PI * (55f - 25f * t) * t) * Mathf.Exp(-t * 9f);
            float crack = Noise() * Mathf.Exp(-t * 55f) * .6f;
            return (body + crack) * .9f;
        }

        static float AlertAt(float t)
        {
            float local = t < .2f ? t : t - .2f, pitch = t < .2f ? 440f : 660f;
            return Mathf.Sin(2f * Mathf.PI * pitch * t) * Mathf.Exp(-local * 9f) * .7f;
        }

        static AudioClip MakeScratch()
        {
            float low = 0f;
            return Make("Scratching", .8f, t =>
            {
                low += .25f * (Noise() - low);
                float burst = Mathf.Max(0f, Mathf.Sin(2f * Mathf.PI * 6f * t));
                return (Noise() - low) * burst * burst * burst * Mathf.Exp(-t * 1.2f) * .6f;
            });
        }

        static AudioClip Make(string name, float seconds, Func<float, float> sample)
        {
            int count = Mathf.CeilToInt(seconds * Rate);
            var data = new float[count];
            for (int i = 0; i < count; i++) data[i] = Mathf.Clamp(sample(i / (float)Rate), -1f, 1f);
            var clip = AudioClip.Create(name, count, 1, Rate, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
