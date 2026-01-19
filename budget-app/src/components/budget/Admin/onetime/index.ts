/**
 * One-Time Migrations
 *
 * Each file represents one migration that typically only needs to run once.
 *
 * To add a new migration:
 * 1. Create a migration hook in hooks/migrations/ (see useEnsureUngroupedGroups.ts as example)
 * 2. Create a migration row component in this folder (see EnsureUngroupedGroupsRow.tsx as example)
 * 3. Export it from this index.ts file
 * 4. Import and use it in OnetimeSection.tsx
 */

export { OnetimeSection } from './OnetimeSection'
// Export migration row components here when adding new migrations
// Example: export { MyNewMigrationRow } from './MyNewMigrationRow'

