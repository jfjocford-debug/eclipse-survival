using System;
using System.Collections.Generic;

namespace EclipseSurvival.Core
{
    [Serializable]
    public struct V2
    {
        public float X;
        public float Y;

        public V2(float x, float y) { X = x; Y = y; }
        public float Magnitude { get { return (float)Math.Sqrt(X * X + Y * Y); } }
        public float SqrMagnitude { get { return X * X + Y * Y; } }
        public V2 Normalized
        {
            get { float length = Magnitude; return length > 0.00001f ? this * (1f / length) : new V2(); }
        }
        public static V2 operator +(V2 a, V2 b) { return new V2(a.X + b.X, a.Y + b.Y); }
        public static V2 operator -(V2 a, V2 b) { return new V2(a.X - b.X, a.Y - b.Y); }
        public static V2 operator *(V2 a, float scale) { return new V2(a.X * scale, a.Y * scale); }
        public static V2 operator *(float scale, V2 a) { return a * scale; }
        public static float Dot(V2 a, V2 b) { return a.X * b.X + a.Y * b.Y; }
        public static float Distance(V2 a, V2 b) { return (a - b).Magnitude; }
        public override string ToString() { return "(" + X + ", " + Y + ")"; }
    }

    public enum RunMode { Ready, Playing, Paused, Dead, Survived }
    public enum DayPhase { Day, Warning, Eclipse }
    /// <summary>What the player is doing with their body. The stick then picks the speed within it.</summary>
    public enum Posture { Stand, Crouch, Prone }
    /// <summary>The effective movement stance, derived each step from posture and stick travel: Walk and Jog are standing speeds, Crouch and Crawl are the low postures.</summary>
    public enum Stance { Walk, Jog, Crouch, Crawl }
    // These numeric values are also the six Inventory array indices.
    public enum Item { Crowbar = 0, Pistol = 1, Food = 2, Medicine = 3, Tools = 4, Ammo = 5 }
    public enum Weapon { Fists, Crowbar, Pistol }
    public enum EnemyKind { Bandit, Scavenger, Apostle }
    public enum AiState { Patrol, Chase, Flee, Attack }
    public enum EffectKind { Hit, Shot, Dodge, Hurt, Loot, Heavy }

    [Serializable]
    public sealed class Actor
    {
        public V2 Position = new V2(4.5f, 5.15f);
        public V2 Face = new V2(1f, 0f);
        public float Health = 100f;
        public float Stamina = 100f;
        public Posture Posture = Posture.Stand;
        /// <summary>Set after the player is stood up by pushing the stick past the run threshold, so they jog instead of running until the stick eases off.</summary>
        public bool RunBlocked;
        /// <summary>Derived by Step from Posture and stick travel; do not set it directly.</summary>
        public Stance Stance = Stance.Walk;
        public bool Running;
        public bool Moving;
        public float Dodge;
        public float Invulnerable;
        public float Cooldown;
        public float Step;
        public float Noise;
        /// <summary>Seconds left in which the player counts as winded: a light swing made with too little stamina. For the HUD.</summary>
        public float Winded;
    }

    [Serializable]
    public sealed class Enemy
    {
        public int Id;
        public V2 Position;
        public EnemyKind Kind;
        public float Health;
        public AiState State;
        public V2 Target = new V2(5f, 5f);
        public float Cooldown;
        public float Flash;
        public float Windup;
        public int Stolen;
    }

    [Serializable]
    public sealed class Loot
    {
        public int Id;
        public string Area = "street";
        public Item Item;
        public int Count;
        public V2 Position;
        public bool Taken;
    }

    [Serializable]
    public sealed class Building
    {
        public string Id = "";
        public string Name = "";
        public V2 Position;
        public float Width;
        public float Height;
        public V2 Door;
        public string Hint = "";
        // Optional view metadata retained from the original authored map.
        public string Color = "";
        public string Roof = "";
    }

    /// <summary>A transient visual event; value type avoids per-effect object allocation.</summary>
    [Serializable]
    public struct Effect
    {
        public EffectKind Kind;
        public V2 Position;
        public float Time;
        public V2 Target;
        public bool HasTarget;
    }

    [Serializable]
    public sealed class GameState
    {
        /// <summary>The tuning this run uses. Simulation.Create sets it; a null value falls back to the shipped defaults.</summary>
        public GameData Data;
        public RunMode Mode = RunMode.Ready;
        public DayPhase Phase = DayPhase.Day;
        public float Time;
        public float Duration;
        public float DayDuration;
        public float NightDuration;
        public int Cycle = 1;
        public Actor Player = new Actor();
        public string Area = "street";
        public int[] Inventory = new int[6];
        public Weapon Equipped = Weapon.Fists;
        // Safehouse walls. Tools spent are permanent for the run; integrity is what the Eclipse wears down.
        public int WallTools;
        public float WallIntegrity;
        public bool WallWarned;
        public bool SiegeStarted;
        public float SiegeTravel;
        public List<Enemy> Enemies = new List<Enemy>(8);
        public List<Loot> Loot = new List<Loot>(16);
        public List<Effect> Effects = new List<Effect>(32);
        public float Elapsed;
        public string Message = "";
        public float MessageTime;
        public int Kills;
        public int Collected;
        public bool AutoLoot;
        public int LockId = -1;
        public float Shake;
        // Legacy single-event view: the name and id of the most recent event. New code should use Events and EventBus.
        public string Event = "";
        public int EventId;
        public const int EventLogCapacity = 64;
        /// <summary>The most recent events, oldest first, bounded to <see cref="EventLogCapacity"/>. Deliver them with <see cref="EventBus"/>.</summary>
        public List<GameEvent> Events = new List<GameEvent>(EventLogCapacity);
        public int Best;
        // Null before the first attack; subsequently "light" or "heavy".
        public string LastAttack;
        public uint Seed;
        public V2? Target;
        public float InteractCooldown;
        public float LootCooldown;
        public float Threat;
        // A remembered attack press; see Simulation.AttackBufferWindow.
        public bool AttackBuffered;
        public bool BufferedHeavy;
        public float AttackBufferTime;
    }
}
