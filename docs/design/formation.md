# Formation movement

- A unit marches as a block at its type's `speed` in `UNIT_TYPES`. A soldier further than `UNIT_REFORM_DISTANCE` from its slot is a straggler. The unit only advances while no more than `UNIT_STRAGGLER_SHARE` of its soldiers straggle, so the formation waits to reform after a turn instead of stretching out, but a few soldiers caught on a rock or in a crowd don't halt the whole unit, as in Total War.
- Soldiers run to their slot at their unit's speed times `SOLDIER_CATCH_UP`, so they can catch up and heavy soldiers also run slower. Stragglers sprint at `SOLDIER_SPRINT` instead, so they rejoin quickly once free. They turn at `SOLDIER_TURN_SPEED`: toward the march direction while moving, toward the unit's facing once it stops.
- Idle soldiers pushed more than `UNIT_DRIFT_DISTANCE` off their slot walk back.
- On a new order, the front ranks go to the soldiers already furthest forward along the new facing, left to right, so paths cross as little as possible. Soldiers keep that slot until the next order.

## Collisions

- Soldiers of the same unit keep `2 × SOLDIER_RADIUS` apart.
- Soldiers of different friendly units only keep `FORMATION_SPACING / 2` apart, so they fit between each other's files and units can pass through one another, as in Total War.
- Enemy soldiers keep `2 × SOLDIER_RADIUS` apart and push each other equally, so battle lines press against each other instead of passing through (see [combat](combat.md#melee)).
- Between friendly units, a marching unit has right of way over an idle one. Between two marching units, the lower unit id wins. The other soldier steps sideways off the path instead of being shoved ahead, and the marching soldier is not pushed at all. If stepping aside would put it inside an obstacle, both soldiers are pushed apart instead.
- Soldiers never enter obstacles; see [terrain](terrain.md#obstacles).
