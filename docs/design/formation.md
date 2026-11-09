# Formation movement

- A unit marches as a block at `UNIT_SPEED`. It only advances while every soldier is within `UNIT_REFORM_DISTANCE` of its slot, so the formation waits for stragglers instead of stretching out.
- Soldiers run to their slot at `SOLDIER_SPEED`, which is faster than `UNIT_SPEED` so they can catch up. They turn at `SOLDIER_TURN_SPEED`: toward the march direction while moving, toward the unit's facing once it stops.
- Idle soldiers pushed more than `UNIT_DRIFT_DISTANCE` off their slot walk back.
- On a new order, the front ranks go to the soldiers already furthest forward along the new facing, left to right, so paths cross as little as possible. Soldiers keep that slot until the next order.

## Collisions

- Soldiers of the same unit keep `2 × SOLDIER_RADIUS` apart.
- Soldiers of different units only keep `FORMATION_SPACING / 2` apart, so they fit between each other's files and units can pass through one another, as in Total War.
- A marching unit has right of way over an idle one. Between two marching units, the lower unit id wins. The other soldier steps sideways off the path instead of being shoved ahead, and the marching soldier is not pushed at all.
