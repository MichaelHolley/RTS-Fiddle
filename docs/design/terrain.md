# Terrain

## Map

- The battlefield is a square `MAP_SIZE` metres across with rolling hills from a seeded noise heightmap (`TERRAIN`). The two armies deploy on opposite sides of the center (see [combat](combat.md)).
- Every load rolls a new map. The seed shows in the HUD; open the page with `?seed=<number>` to replay a map.
- Ground color reads the shape of the land: lush grass in valleys, drier grass on high ground, bare dirt on steep slopes.
- Soldiers stand on the ground and march over hills at their normal speed. Slopes have no gameplay effect yet.
- The camera pans to the map edge, zooms out to `CAMERA.maxDistance`, and rises and falls with the ground under it. Clicks and drags land on the terrain surface under the pointer.

## Obstacles

- Boulders, rocks and pines are scattered by the entries in `PROP_TYPES`. Pines grow mostly in forests, patches shaped by `FOREST`; rocks lie mostly in open ground.
- Each obstacle is a solid circle the size of its trunk or rock: soldiers cannot pass through it.
- Obstacles stay at least `OBSTACLE_GAP` apart, wider than a soldier, so there is always a way between them and no dead ends.
- Nothing spawns within `DEPLOY_CLEAR_RADIUS` of either army's deployment center, so both start on open ground.

## Moving through obstacles

- Units march in a straight line to their destination; there is no pathfinding. Soldiers walk around obstacles in their way and rejoin their slot past them, so formations flow around rocks and through forests.
- Each soldier passes an obstacle on the side its slot lies on, so a formation parts around both sides of a rock instead of funnelling past one side in single file. If another obstacle blocks that way round, it turns further the same way, so it threads between trees instead of zigzagging against them.
- While a unit marches, soldiers whose slot is inside an obstacle don't hold the unit up: they walk around and rejoin once their slot comes out the other side. A few other stragglers don't hold it up either (see [formation](formation.md)).
- When a unit halts with slots inside an obstacle, those soldiers stand at the obstacle's edge nearest their slot.
