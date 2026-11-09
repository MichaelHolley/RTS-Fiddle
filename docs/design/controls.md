# Controls

Key bindings are listed in `KEYS`; this file describes what each control does.

## Camera

WASD/arrows or screen-edge pan, Q/E or middle-drag rotate, wheel zoom. Pan speed scales with zoom distance. The camera ignores every key while Ctrl is held, so A pans left and Ctrl+A selects all.

## Browser shortcuts

Every key's browser default is cancelled except reload (F5, Ctrl+R), fullscreen (F11), dev tools (F12, Ctrl+Shift+I/J/C) and Cmd combos. No page can block Ctrl+W/T/N/Tab, so they are never bound.

## Select

- Left-click picks the unit of the nearest soldier on screen within `CLICK_SELECT_RADIUS_PX`. Clicking empty ground deselects.
- Left-drag box-selects every unit with any soldier inside the box.
- Double-clicking a unit (within `DOUBLE_CLICK_MS`) selects every unit of its type.
- Shift adds to the selection. Ctrl+A selects all.
- Selected units show a ring under each soldier and their destination footprint until they arrive.

## Control groups

Ctrl+digit stores the selection (an empty selection clears the group). The digit recalls it, Shift+digit adds it. The HUD shows each group's key and unit count.

## Move

Right-click: the selection keeps its relative layout and each unit its frontage, turned to face the direction of travel from the selection's center to the click. A ring pings the click point.

## Frontage

Right-drag past `DRAG_THRESHOLD_PX`: the drag line becomes the combined front rank. Units are placed in their current left-to-right order along the line, each getting width in proportion to its soldier count, with `UNIT_GAP` between units and at least `UNIT_MIN_FILES` files. The drag direction is the units' right, so dragging left-to-right on screen faces away from the camera. Footprint outlines with a facing arrow preview the result while dragging.

## Split

Each selected unit with at least `UNIT_SPLIT_MIN_SOLDIERS` soldiers splits into a left and a right half standing side by side on its front rank. The right half is a new unit that joins the original's control groups; both stay selected. Ignored while Ctrl is held. Deviation from Total War, see [total-war.md](total-war.md).

## Join

Only units of the same type merge. For each type in the selection, the largest selected unit absorbs the others and reforms at their soldier-weighted center with their fronts combined. Absorbed units are destroyed and replaced in control groups by the absorbing unit. Ignored while Ctrl is held. Deviation from Total War, see [total-war.md](total-war.md).
