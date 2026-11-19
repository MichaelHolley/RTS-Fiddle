# Combat

Two factions, listed in `FACTIONS`, deploy `ARMY_DISTANCE` apart on opposite sides of the map center, front lines facing each other. Blue starts in front of the camera. In the demo the player commands both sides. Soldiers are tinted in their faction's color so the sides read apart.

## Health and casualties

- Every soldier has its unit type's `health`. A soldier at zero health dies and is removed.
- The survivors close ranks: the unit keeps its files and loses rear ranks, and its front rank holds its ground, so the back ranks step up to fill it.
- A unit whose last soldier dies is gone, and drops out of selection and control groups.
- Units fight to the last soldier; there is no morale yet.

## Ranged fire

- Unit types with `ranged` stats (the Trooper) fire laser bolts in their faction's `laserColor`: blue for Blue, red for Red.
- A unit fires only while halted, at the nearest enemy unit whose center is within `range`. Each soldier shoots once per `interval` (varied by `ATTACK_JITTER` so a unit doesn't fire in lockstep) at a random soldier of the target unit that is within its own `range`, turning to face it.
- A shot hits with chance `accuracy`. A hit takes `damage` when the bolt arrives; a miss lands within `LASER_MISS_SPREAD` of the target. Bolts fly at `LASER_BOLT.speed`.
- A soldier fighting in melee does not fire.

## Melee

- Enemy soldiers collide; they cannot pass through each other as friendly units do (see [formation](formation.md#collisions)).
- A soldier within `MELEE_REACH` of an enemy strikes it once per its type's `melee.interval` for `melee.damage`. Every unit type fights in melee, ranged units included, but troopers are weak at it.
- A marching unit halts the moment its soldiers first touch the enemy, as a charge stops on impact in Total War. Ordering it away again disengages it: it marches off while soldiers in reach keep trading blows.
- Soldiers of a halted melee unit leave their slot to close with any enemy within `MELEE_SEEK_RADIUS` of it, so two blocks that meet break into a brawl. The radius is measured from the slot, so they never chase a fleeing enemy far from their unit. Once no enemy is near, they walk back to their slots.
- Halted ranged units hold their slots and keep firing; only soldiers already in contact fight back.

There are no attack, defence or charge stats yet; every blow lands.
