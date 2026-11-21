# Controls

Key bindings are listed in `KEYS`; this file describes what each control does.

## Camera

WASD/arrows or screen-edge pan, Q/E or middle-drag rotate, wheel zoom. Pan speed scales with zoom distance. The camera ignores every key while Ctrl is held, so A pans left and Ctrl+A selects all.

## Browser shortcuts

Every key's browser default is cancelled except reload (F5, Ctrl+R), fullscreen (F11), dev tools (F12, Ctrl+Shift+I/J/C) and Cmd combos. No page can block Ctrl+W/T/N/Tab, so they are never bound.

## Select

- Left-click picks the unit of the nearest soldier on screen within `CLICK_SELECT_RADIUS_PX`. Clicking empty ground deselects.
- Left-drag box-selects every unit with any soldier inside the box.
- Double-clicking a unit (within `DOUBLE_CLICK_MS`) selects every unit of its type and faction.
- Both factions are selectable and can be selected together in the demo.
- Shift adds to the selection. Ctrl+A selects all.
- Selected units show a ring under each soldier and their destination footprint until they arrive, or a red outline around the unit they are attacking.
- Selected ranged units show a faint circle on the ground at their `range` around the unit's center. It is a full circle because units fire in every direction; Total War draws a forward arc. Deviation, see [total-war.md](total-war.md).

## Control groups

Ctrl+digit stores the selection (an empty selection clears the group). The digit recalls it, Shift+digit adds it. The HUD shows each group's key and unit count. Destroyed units drop out of their groups.

## Move

Right-click: the selection slides to the click without turning. Each unit keeps its facing, its frontage and its place relative to the others, so a line of melee units with ranged units behind it arrives in the same arrangement, and the selection's center lands on the click. Units still marching count from where they are headed, so clicking again on the march keeps the layout last ordered even if faster units have pulled ahead. A ring pings the click point. To turn units, give a frontage order. Deviation from Total War, see [total-war.md](total-war.md).

## Attack

Right-click an enemy unit (picked like a left-click select) to order every selected unit of another faction to attack it. Selected units of the target's own faction ignore the order. Each attacker turns to face the target and:

- **Melee units** march straight at it and follow it as it moves, until their soldiers make contact; then they brawl (see [combat](combat.md#melee)). If the fight around them ends and the target is still alive, they chase it again.
- **Ranged units** march until the target is within `ATTACK_APPROACH` of their `range`, then halt and fire only at the target. If it moves out of range they follow it.

A unit fighting in melee holds where it is, whoever it fights. The order ends when the target is destroyed, and the attacker halts. Any move, frontage, split or join order cancels it. Selected attackers outline their target in red instead of showing a destination footprint. Right-dragging from an enemy unit gives a frontage order, not an attack.

## Frontage

Right-drag past `DRAG_THRESHOLD_PX`: the drag line becomes the combined front rank. Units are placed in their current left-to-right order along the line, each getting width in proportion to its soldier count, with `UNIT_GAP` between units and at least `UNIT_MIN_FILES` files. The drag direction is the units' right, so dragging left-to-right on screen faces away from the camera. Footprint outlines with a facing arrow preview the result while dragging.

## Split

Each selected unit with at least `UNIT_SPLIT_MIN_SOLDIERS` soldiers splits into a left and a right half standing side by side on its front rank. The right half is a new unit that joins the original's control groups; both stay selected. Ignored while Ctrl is held. Deviation from Total War, see [total-war.md](total-war.md).

## Join

Only units of the same type and faction merge. For each type and faction in the selection, the largest selected unit absorbs the others and reforms at their soldier-weighted center with their fronts combined. Absorbed units are destroyed and replaced in control groups by the absorbing unit. Ignored while Ctrl is held. Deviation from Total War, see [total-war.md](total-war.md).
