using UnityEngine;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    /// <summary>
    /// The game's tuning as a Unity asset: weapons, enemies, items, walls, the day clock and the Eclipse profiles.
    /// Edit it in the Inspector; the simulation reads a validated copy for every run, so a bad edit is reported and
    /// replaced by the shipped defaults rather than breaking the game.
    /// </summary>
    [CreateAssetMenu(menuName="Eclipse/Game data")]
    public sealed class GameDataAsset : ScriptableObject
    {
        public const string ResourcePath="Config/GameData";
        public GameData data=GameData.CreateDefault();

        void Reset(){data=GameData.CreateDefault();}
        [ContextMenu("Reset to shipped defaults")] void ResetToDefaults(){data=GameData.CreateDefault();}
        [ContextMenu("Validate")] void CheckNow(){Report(data);}
        void OnValidate(){Report(data);}

        static bool Report(GameData d)
        {
            if(d==null){Debug.LogError("Game data is empty.");return false;}
            var problems=d.Validate();
            foreach(var p in problems)Debug.LogWarning("Game data: "+p);
            return problems.Count==0;
        }

        /// <summary>
        /// A fresh, validated copy of the asset's data (or of the shipped defaults when the asset is missing or invalid).
        /// Each run gets its own copy, so nothing a run does can change the asset.
        /// </summary>
        public static GameData Load(GameDataAsset asset=null)
        {
            asset=asset?asset:Resources.Load<GameDataAsset>(ResourcePath);
            if(!asset){Debug.LogWarning("No game data asset at Resources/"+ResourcePath+"; using shipped defaults. Run Eclipse > Set up project assets.");return GameData.CreateDefault();}
            var copy=JsonUtility.FromJson<GameData>(JsonUtility.ToJson(asset.data));
            if(copy==null||!Report(copy)){Debug.LogError("Game data asset '"+asset.name+"' is invalid; using shipped defaults.");return GameData.CreateDefault();}
            return copy;
        }
    }
}
