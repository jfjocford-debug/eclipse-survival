using UnityEngine;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    public sealed class AudioDirector : MonoBehaviour
    {
        GameController game;
        AudioSource wind,birds,heart,sfx,distortion,cue;
        DayPhase phase=DayPhase.Day;
        AudioSource[] loops;
        public void Initialize(GameController root)
        {
            game=root;var c=root.config;
            wind=Source("Wind",c.wind,true,c.ambienceGroup);birds=Source("Birds",c.birds,true,c.ambienceGroup);
            heart=Source("Heartbeat",c.heartbeat,true,c.eclipseGroup);distortion=Source("Eclipse distortion",c.distortion,true,c.eclipseGroup);
            cue=Source("Transition cue",c.distortion,false,c.eclipseGroup);sfx=Source("Combat",null,false,c.sfxGroup);loops=new[]{wind,birds,heart,distortion};
            root.Bus.Subscribe(OnGameEvent);
        }
        void OnDestroy(){if(game!=null)game.Bus.Unsubscribe(OnGameEvent);}
        // Every event arrives here exactly once, so two events in the same frame (a swing and its hit) both get their sound.
        void OnGameEvent(GameEvent e)
        {
            if(sfx==null)return;
            switch(e.Kind)
            {
                case GameEventKind.Hurt:
                    if(game.config.hurt){sfx.volume=.7f;sfx.PlayOneShot(game.config.hurt);}
                    break;
                case GameEventKind.Swing:case GameEventKind.Shot:case GameEventKind.Heavy:case GameEventKind.Hit:case GameEventKind.ShotHit:
                    if(game.config.melee){sfx.volume=.7f;sfx.PlayOneShot(game.config.melee,.7f);}
                    break;
                case GameEventKind.HeavyHit:
                    if(game.config.melee){sfx.volume=.7f;sfx.PlayOneShot(game.config.melee,1f);}
                    break;
            }
        }
        AudioSource Source(string name,AudioClip clip,bool loop,UnityEngine.Audio.AudioMixerGroup group)
        {var go=new GameObject(name);go.transform.SetParent(transform,false);var a=go.AddComponent<AudioSource>();a.clip=clip;a.loop=loop;a.playOnAwake=false;a.outputAudioMixerGroup=group;a.spatialBlend=0;a.volume=0;return a;}
        void Update()
        {
            var s=game.State;if(s==null)return;
            bool play=s.Mode==RunMode.Playing;
            foreach(var a in loops){if(play&&!a.isPlaying&&a.clip)a.Play();else if(!play&&a.isPlaying)a.Pause();}
            if(!play){sfx.Pause();cue.Pause();return;}
            bool eclipse=s.Phase==DayPhase.Eclipse;
            wind.volume=.17f;birds.volume=!eclipse?.17f:0;heart.volume=eclipse?.5f:0;distortion.volume=eclipse?.14f:0;
            // Phase changes play their own cue. This follows the phase itself, not the event stream.
            if(phase!=s.Phase){phase=s.Phase;if(phase!=DayPhase.Day&&cue.clip){cue.volume=.45f;cue.Play();}}
        }
    }
}
