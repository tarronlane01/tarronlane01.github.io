# Packing

A trip planning and packing app for managing what to bring and what to do before family trips.

## Language

### Entities

**Item**:
A physical thing you bring on a trip. Has a Category, Feature tags, and optional Per-Person tags. Matches a Trip if any of its Features overlap with the Trip's Features (OR logic), or any of its Per-Persons overlap with the Trip's Persons (OR logic). Items with no Features and no Per-Persons match every Trip. An Item with Per-Person tags expands into one checkbox per matching person on the Trip checklist. Names must be unique (case-insensitive, trimmed).
_Avoid_: gear, supply, thing

**Task**:
An action you perform before or during a trip. Has a Phase instead of a Category. Appears as a checklist on a Trip but does not go through the plan/pack workflow. Supports Feature tags in the data model for future filtering, but currently all Tasks appear on every Trip. Names must be unique (case-insensitive, trimmed).
_Avoid_: to-do, chore, reminder

**Trip**:
A reusable saved filter configuration, not a one-time event. Defines a set of Features and Per-Persons that determine which Items appear. Persists across uses — reset clears packed state for the next use. Examples: "Wife's family reunion", "Overnight camping", "City Pool".
_Avoid_: outing, vacation, event, trip type, template

### Taxonomies

**Phase**:
A temporal stage of trip preparation that controls layout ordering on the Trip Detail page. Items and Tasks are each assigned to a Phase. Items without a Phase appear in an "Unassigned" group that sorts to the top. Examples: "Weeks Before", "Main Pack", "Right Before".
_Avoid_: section, stage, step, timing

**Category**:
A classification label for an Item, such as "Clothes", "Toiletries", or "Equipment". Each Item belongs to exactly one Category. Within a Phase, items are sub-grouped by Category (alphabetically). The same Category can appear under multiple Phases.
_Avoid_: type, group, kind

**Feature**:
A tag describing a trip characteristic, such as "camping", "water", or "cooking". Items and Trips can have multiple Features. Used to filter which Items are relevant to a Trip. Displayed alphabetically.
_Avoid_: activity, attribute, tag

**Per-Person**:
A family member tag on an Item that causes the packing checklist to show one checkbox per matching person on the Trip (e.g., "Socks" becomes "Socks (Dad)", "Socks (Mom)"). Items can have multiple Per-Person tags. Also used for trip matching — an Item's Per-Persons are checked against the Trip's person list. Displayed alphabetically.
_Avoid_: person, member, traveler, passenger

**Quantity**:
A per-trip count for an Item, defaulting to 1. Stored in `Trip.quantities` as `{ itemId: count }`. Missing entries mean 1. For per-person Items, the quantity applies per person (e.g., quantity 3 = 3 per person). Quantities persist across Trip resets.
_Avoid_: amount, count, number

### Trip State

**Skipped**:
An Item or Per-Person Item entry that matches a Trip's filters but has been dismissed for the current use. Hidden from the packing view in a collapsed "Skipped" section. Resets when the Trip is reset. For Per-Person Items, skipping is per-person.
_Avoid_: excluded, hidden, removed

**Packed**:
An Item or Per-Person Item entry that has been checked off as packed for the current Trip use. Resets when the Trip is reset. For Per-Person Items, packing is per-person.
_Avoid_: checked, done, completed

**Phase Done Indicator**:
A read-only visual indicator on a Phase/Category header. Displays as "done" when every Item or Task in that group is either packed/completed or skipped. Not interactive.
_Avoid_: section checkbox, select all
