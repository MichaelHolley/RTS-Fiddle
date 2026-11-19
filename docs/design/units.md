# Units and soldiers

## Terms

- **Unit**: the selectable block (`Unit` entity: type, center, destination, facing, files × ranks). Selection, control groups and orders work on units, never on single soldiers.
- **Soldier**: one trooper (`Soldier` entity: its owning unit plus a fixed slot in the unit's formation).
- **Faction**: the side a unit fights for (`FactionId`), see [combat](combat.md).
- **Files** are columns and **ranks** are rows. The front rank's width is the **frontage**.

## Unit types

A unit type (`UnitTypeId`) has its stats in `UNIT_TYPES`: name, full-strength size, starting files, march speed, soldier model, soldier health, melee stats and, for ranged units, ranged stats. Each faction's starting army is its `army` in `FACTIONS`, front line first; both field `ARMY`. A selection of mixed types moves each unit at its own speed, as in Total War without group lock.

- **Trooper**: ranged line infantry with a carbine that fires laser bolts. Standing still, soldiers shoulder the carbine and aim down the sights; on the move they run leaning forward with the carbine held in both hands.
- **Vanguard**: heavily armoured melee infantry with a lightning sword and a blue holo shield. Slower than troopers because of the armour, with fewer soldiers per unit, deployed in the front line ahead of them. Tougher and far deadlier in melee than troopers, with no ranged attack.
