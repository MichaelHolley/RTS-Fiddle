# Units and soldiers

## Terms

- **Unit**: the selectable block (`Unit` entity: type, center, destination, facing, files × ranks). Selection, control groups and orders work on units, never on single soldiers.
- **Soldier**: one trooper (`Soldier` entity: its owning unit plus a fixed slot in the unit's formation).
- **Files** are columns and **ranks** are rows. The front rank's width is the **frontage**.
- **Group** is reserved for Total War's Ctrl+G grouping of several units.

## Unit types

A unit type (`UnitTypeId`) has its stats in `UNIT_TYPES`: name, full-strength size and starting files. The starting army is listed in `ARMY`. All types currently share the trooper model and the global speed constants.
