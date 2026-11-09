# Units and soldiers

## Terms

- **Unit**: the selectable block (`Unit` entity: type, center, destination, facing, files × ranks). Selection, control groups and orders work on units, never on single soldiers.
- **Soldier**: one trooper (`Soldier` entity: its owning unit plus a fixed slot in the unit's formation).
- **Files** are columns and **ranks** are rows. The front rank's width is the **frontage**.

## Unit types

A unit type (`UnitTypeId`) has its stats in `UNIT_TYPES`: name, full-strength size, starting files, march speed and soldier model. The starting army is listed in `ARMY`, front line first. A selection of mixed types moves each unit at its own speed, as in Total War without group lock.

- **Trooper**: ranged line infantry with a carbine.
- **Vanguard**: heavily armoured melee infantry with a lightning sword and a blue holo shield. Slower than troopers because of the armour, with fewer soldiers per unit, deployed in the front line ahead of them. Combat does not exist yet, so for now the role only shows in the model and deployment.
