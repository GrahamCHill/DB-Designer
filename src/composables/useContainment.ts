/**
 * useContainment — pure geometry helpers for auto-assigning tables and groups.
 *
 * Rules (never violated):
 *  T1. A TABLE is assigned to the SMALLEST group whose rect contains the table's
 *      centre point. If no group contains it, groupId = null.
 *
 *  G1. A GROUP's parentGroupId is set to the SMALLEST group that contains the
 *      child's centre, excluding itself and its own descendants (no cycles).
 *
 *  S1. When a GROUP is dragged and dropped, it may only affect tables/sub-groups
 *      that were ALREADY INSIDE it (or its descendants) at drag-start.
 *      It must NOT steal tables or groups that belonged to other groups at drag-start.
 *
 *  S2. When a GROUP is RESIZED, it may absorb ONLY unowned tables (groupId === null).
 *      It never steals from another group.
 */

import type { Table, TableGroup } from '../types'
import { TABLE_WIDTH, TABLE_HEADER_H, TABLE_COL_PAD_TOP, TABLE_ROW_H } from '../types'

// ── Geometry ──────────────────────────────────────────────────────────────────

export interface Rect { x: number; y: number; w: number; h: number }

export function groupRect(g: TableGroup): Rect {
  return { x: g.position.x, y: g.position.y, w: g.size.w, h: g.size.h }
}

export function tableRect(t: Table): Rect {
  const h = TABLE_HEADER_H + TABLE_COL_PAD_TOP + t.columns.length * TABLE_ROW_H + 29
  return { x: t.position.x, y: t.position.y, w: TABLE_WIDTH, h }
}

export function rectCentre(r: Rect) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

export function pointInRect(r: Rect, p: { x: number; y: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

// ── Tree helpers ──────────────────────────────────────────────────────────────

/** All descendant group IDs of `id` (not including `id` itself). */
export function getDescendants(id: string, groups: TableGroup[]): Set<string> {
  const result = new Set<string>()
  const queue = [id]
  while (queue.length) {
    const cur = queue.shift()!
    for (const g of groups) {
      if (g.parentGroupId === cur && !result.has(g.id)) {
        result.add(g.id)
        queue.push(g.id)
      }
    }
  }
  return result
}

/** All group IDs in the subtree rooted at `id` (including `id`). */
export function getSubtree(id: string, groups: TableGroup[]): Set<string> {
  const s = getDescendants(id, groups)
  s.add(id)
  return s
}

// ── Smallest-containing group ─────────────────────────────────────────────────

/**
 * Find the smallest group (by area) whose rect contains `centre`,
 * excluding any group IDs in `exclude`.
 */
function smallestContaining(
  centre: { x: number; y: number },
  groups: TableGroup[],
  exclude: Set<string>,
): string | null {
  let bestId: string | null = null
  let bestArea = Infinity
  for (const g of groups) {
    if (exclude.has(g.id)) continue
    const r = groupRect(g)
    const area = r.w * r.h
    if (pointInRect(r, centre) && area < bestArea) {
      bestId = g.id
      bestArea = area
    }
  }
  return bestId
}

// ── Rule T1: resolve a table's group after it moves ──────────────────────────

/**
 * After a table is dropped, return which group it should belong to.
 * Always picks the smallest group containing the table's centre.
 * No steal-prevention needed — tables don't own anything.
 */
export function resolveTableGroup(
  table: Table,
  groups: TableGroup[],
): string | null {
  const centre = rectCentre(tableRect(table))
  return smallestContaining(centre, groups, new Set())
}

// ── Rule G1: resolve a group's parent after it moves ─────────────────────────

/**
 * After a group is dropped, return which group should be its parent.
 * Picks the smallest group containing the child's centre,
 * excluding the child itself and all its descendants (cycle prevention).
 */
export function resolveGroupParent(
  child: TableGroup,
  groups: TableGroup[],
): string | null {
  const centre = rectCentre(groupRect(child))
  // Exclude the child's entire subtree to prevent cycles
  const subtree = getSubtree(child.id, groups)
  return smallestContaining(centre, groups, subtree)
}

// ── Rule S1: after a group drag, update memberships without stealing ──────────

/**
 * Called after a group drag completes.
 *
 * `ownedTablesBefore`  — table IDs that were inside this group (or its
 *                        descendants) at drag-start. These are the only tables
 *                        we are allowed to re-assign.
 * `ownedGroupsBefore`  — same for sub-groups.
 *
 * For each owned table: re-resolve which group it belongs to now.
 * For unowned tables:   never touched.
 *
 * Returns:
 *   tableChanges  — tableId → new groupId
 *   groupChanges  — groupId → new parentGroupId  (for direct children only)
 */
export function applyGroupDrop(
  movedGroup: TableGroup,
  groups: TableGroup[],
  tables: Table[],
  ownedTablesBefore: Set<string>,
  ownedGroupsBefore: Set<string>,
): {
  tableChanges: Record<string, string | null>
  groupChanges: Record<string, string | null>
} {
  const tableChanges: Record<string, string | null> = {}
  const groupChanges: Record<string, string | null> = {}

  // Re-resolve every owned table — may have moved in/out of sub-groups
  for (const table of tables) {
    if (!ownedTablesBefore.has(table.id)) continue
    if ((table as any).groupLocked) continue   // locked — leave groupId as-is
    tableChanges[table.id] = resolveTableGroup(table, groups)
  }

  // Re-resolve direct children of the moved group only
  // (deeper descendants are handled recursively via their own parentGroupId)
  for (const g of groups) {
    if (!ownedGroupsBefore.has(g.id)) continue
    if (g.parentGroupId !== movedGroup.id) continue // only direct children
    groupChanges[g.id] = movedGroup.id // they stay with their parent; parent moved
  }

  // Resolve the moved group's own new parent
  groupChanges[movedGroup.id] = resolveGroupParent(movedGroup, groups)

  return { tableChanges, groupChanges }
}

// ── Rule S2: after a group resize, absorb only unowned tables ─────────────────

/**
 * Called continuously during resize and on resize commit.
 * Only touches tables with groupId === null (unowned).
 * Tables already belonging to another group are never touched.
 * Tables that were in this group but are now outside get released.
 *
 * Returns tableId → new groupId
 */
export function applyGroupResize(
  resizedGroup: TableGroup,
  groups: TableGroup[],
  tables: Table[],
): Record<string, string | null> {
  const changes: Record<string, string | null> = {}
  const r = groupRect(resizedGroup)

  for (const table of tables) {
    // Never touch locked tables
    if ((table as any).groupLocked) continue

    const centre = rectCentre(tableRect(table))
    const inside = pointInRect(r, centre)

    if (table.groupId === null && inside) {
      // Unowned and now inside — claim it
      changes[table.id] = resizedGroup.id
    } else if (table.groupId === resizedGroup.id && !inside) {
      // Was ours but now outside — release
      changes[table.id] = resolveTableGroup(table, groups)
    }
    // else: owned by someone else — never touch
  }

  return changes
}
