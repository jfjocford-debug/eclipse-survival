using System;
using System.Collections.Generic;

namespace EclipseSurvival.Core
{
    /// <summary>Everything the simulation announces. Append new kinds before <see cref="Count"/>.</summary>
    public enum GameEventKind
    {
        Start, Door, Build, Loot, Equip, Heal, Dodge, Empty,
        Swing, Shot, Heavy, Hit, HeavyHit, ShotHit, Hurt, Dead,
        /// <summary>The sky is changing: the Eclipse is about to begin.</summary>
        Warning,
        /// <summary>The Eclipse has begun.</summary>
        Eclipse,
        /// <summary>The Eclipse is over and the player survived it.</summary>
        EclipseEnded,
        /// <summary>A new day has begun (after <c>NextCycle</c>).</summary>
        DayStarted,
        Snarl,
        /// <summary>The Apostle has reached the safehouse door and begun to wear the walls down.</summary>
        Siege,
        /// <summary>Wall integrity fell to the warning threshold.</summary>
        Cracking,
        /// <summary>Wall integrity reached zero.</summary>
        Breach,
        /// <summary>An enemy changed AI state. Subject is the enemy id, Value the new <see cref="AiState"/>.</summary>
        EnemyState,
        /// <summary>A light swing was made without enough stamina and is weaker. Amount is the damage scale.</summary>
        Winded,
        /// <summary>The player's posture changed. Value is the new <see cref="Posture"/>.</summary>
        Posture,
        /// <summary>Sentinel: the number of kinds. Keep last.</summary>
        Count
    }

    /// <summary>Who or what caused an event. Wall damage always names its source, so later sources such as sabotage can be added.</summary>
    public enum EventSource { None, Player, Bandit, Scavenger, Apostle }

    /// <summary>
    /// One announcement. Payload meaning by kind: Subject is an enemy or loot id (or -1); Value is an item, AI state
    /// or wall count; Amount is damage, quantity or wall integrity; Position is where it happened.
    /// </summary>
    [Serializable]
    public struct GameEvent
    {
        public int Id;
        public GameEventKind Kind;
        public EventSource Source;
        public int Subject;
        public int Value;
        public float Amount;
        public V2 Position;
    }

    /// <summary>
    /// Delivers the simulation's events to subscribers. The simulation only appends data to <c>GameState.Events</c>;
    /// the host calls <see cref="Pump"/> once per frame, after stepping, so handlers never run in the middle of a
    /// simulation step. Handlers must not step or mutate the simulation, and should not subscribe or unsubscribe
    /// from inside a handler. Each event is delivered once, in order, to the subscribers of its kind and then to
    /// the subscribers of all kinds.
    /// </summary>
    public sealed class EventBus
    {
        private readonly List<Action<GameEvent>> everything = new List<Action<GameEvent>>();
        private readonly List<Action<GameEvent>>[] byKind = new List<Action<GameEvent>>[(int)GameEventKind.Count];
        private GameState source;
        private int lastId;

        /// <summary>Events that were trimmed from the bounded log before this bus could deliver them.</summary>
        public int Missed { get; private set; }

        public void Subscribe(Action<GameEvent> handler)
        {
            if (handler == null) throw new ArgumentNullException("handler");
            everything.Add(handler);
        }

        public void Subscribe(GameEventKind kind, Action<GameEvent> handler)
        {
            if (handler == null) throw new ArgumentNullException("handler");
            if (kind < 0 || kind >= GameEventKind.Count) throw new ArgumentOutOfRangeException("kind");
            List<Action<GameEvent>> list = byKind[(int)kind];
            if (list == null) byKind[(int)kind] = list = new List<Action<GameEvent>>(2);
            list.Add(handler);
        }

        public void Unsubscribe(Action<GameEvent> handler) { everything.Remove(handler); }

        public void Unsubscribe(GameEventKind kind, Action<GameEvent> handler)
        {
            if (kind < 0 || kind >= GameEventKind.Count) return;
            List<Action<GameEvent>> list = byKind[(int)kind];
            if (list != null) list.Remove(handler);
        }

        /// <summary>Delivers every event not yet delivered for this state and returns how many there were.</summary>
        public int Pump(GameState state)
        {
            if (state == null) return 0;
            if (!ReferenceEquals(state, source)) { source = state; lastId = 0; }
            List<GameEvent> log = state.Events;
            int delivered = 0;
            for (int i = 0; i < log.Count; i++)
            {
                GameEvent e = log[i];
                if (e.Id <= lastId) continue;
                if (delivered == 0 && e.Id > lastId + 1) Missed += e.Id - lastId - 1;
                lastId = e.Id; delivered++;
                List<Action<GameEvent>> list = e.Kind >= 0 && e.Kind < GameEventKind.Count ? byKind[(int)e.Kind] : null;
                if (list != null) for (int j = 0; j < list.Count; j++) list[j](e);
                for (int j = 0; j < everything.Count; j++) everything[j](e);
            }
            return delivered;
        }
    }
}
