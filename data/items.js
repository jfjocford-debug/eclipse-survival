export const ITEMS = {
 bat:{name:'Baseball bat',category:'Weapon',weight:1.8,description:'A dependable, quiet melee weapon.'},
 axe:{name:'Salvaged axe',category:'Weapon',weight:2.4,description:'Heavy blows. Can break down barricades.'},
 pistol:{name:'9mm pistol',category:'Weapon',weight:1.1,description:'Powerful, but gunshots draw a crowd.'},
 ammo:{name:'9mm rounds',category:'Ammunition',weight:.02,description:'Ammunition for your pistol.'},
 water:{name:'Bottled water',category:'Consumable',weight:.5,description:'Restores 38 thirst.'},
 beans:{name:'Canned beans',category:'Consumable',weight:.4,description:'Restores 32 hunger and a little energy.'},
 bandage:{name:'Clean bandage',category:'Medical',weight:.1,description:'Stops bleeding and restores 12 health.'},
 cloth:{name:'Torn cloth',category:'Material',weight:.15,description:'Make bandages from two pieces.'},
 plank:{name:'Wood plank',category:'Material',weight:1,description:'Use with nails and a hammer to barricade openings.'},
 nails:{name:'Nails',category:'Material',weight:.02,description:'Four nails secure one plank.'},
 hammer:{name:'Claw hammer',category:'Tool',weight:.8,description:'Required to barricade doors and windows.'},
 scrap:{name:'Metal scrap',category:'Material',weight:.3,description:'Useful for improvised tools.'}
};
export const RECIPES = [
 {id:'bandage',name:'Clean bandage',description:'Fold torn cloth into a field dressing.',ingredients:[{id:'cloth',qty:2}],result:{id:'bandage',qty:1}},
 {id:'axe',name:'Salvaged axe',description:'Bind a scrap-metal head to a wooden handle.',ingredients:[{id:'scrap',qty:3},{id:'plank',qty:1},{id:'cloth',qty:1}],result:{id:'axe',qty:1}},
 {id:'plank',name:'Salvaged planks',description:'Break down scrap wood into useful boards.',ingredients:[{id:'scrap',qty:2}],result:{id:'plank',qty:2}}
];
