# Terrain

## Map

- The battlefield is a square `MAP_SIZE` metres across with rolling hills from a seeded noise heightmap (`TERRAIN`). The army deploys at the center.
- Every load rolls a new map. The seed shows in the HUD; open the page with `?seed=<number>` to replay a map.
- Ground color reads the shape of the land: lush grass in valleys, drier grass on high ground, bare dirt on steep slopes.
- Soldiers stand on the ground and march over hills at their normal speed. Slopes have no gameplay effect yet.
- The camera pans to the map edge, zooms out to `CAMERA.maxDistance`, and rises and falls with the ground under it. Clicks and drags land on the terrain surface under the pointer.

## Obstacles

- Boulders, rocks and pines are scattered by the entries in `PROP_TYPES`. Pines grow mostly in forests, patches shaped by `FOREST`; rocks lie mostly in open ground.
- Each obstacle is a solid circle the size of its trunk or rock: soldiers cannot pass through it.
- Obstacles stay at least `OBSTACLE_GAP` apart, wider than a soldier, so there is always a way between them and no dead ends.
- Nothing spawns within `DEPLOY_CLEAR_RADIUS` of the map center, so the army starts on open ground.

## Moving through obstacles

- Units march in a straight line to their destination; there is no pathfinding. Soldiers walk around obstacles in their way and rejoin their slot past them, so formations flow around rocks and through forests.
- A slot that falls inside an obstacle moves to the obstacle's edge, so its soldier can always reach it.
- A unit still waits for stragglers (see [formation](formation.md)), so it slows while its soldiers squeeze around a boulder or through dense forest.
