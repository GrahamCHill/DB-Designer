import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { Schema, Table, Column, Relation, TableGroup, SQLDialect } from '../types'
import { TABLE_WIDTH } from '../types'
import { useTabsStore } from './tabs'
import {
  resolveTableGroup,
  applyGroupDrop,
  applyGroupResize,
} from '../composables/useContainment'

const DEFAULT_COLORS = ['#3ECF8E','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#06B6D4','#EC4899','#10B981']
const GROUP_COLORS   = ['#3ECF8E','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#06B6D4','#EC4899','#F97316']

export const useSchemaStore = defineStore('schema', () => {
  const tabsStore = useTabsStore()

  const schema = computed<Schema>(() =>
    tabsStore.activeSchema ?? {
      id: '', name: '', tables: [], relations: [], groups: [],
      createdAt: '', updatedAt: '',
    }
  )

  function sc() { return tabsStore.activeSchema! }

  function persist() {
    const s = tabsStore.activeSchema
    if (s) tabsStore.updateSchema({ ...s, updatedAt: new Date().toISOString() })
  }

  // UI state
  const selectedTableId    = ref<string | null>(null)
  const selectedRelationId = ref<string | null>(null)
  const selectedGroupId    = ref<string | null>(null)
  const editingTableId     = ref<string | null>(null)
  const editingGroupId     = ref<string | null>(null)

  const selectedTable = computed(() => schema.value.tables.find(t => t.id === selectedTableId.value) ?? null)
  const selectedGroup = computed(() => schema.value.groups.find(g => g.id === selectedGroupId.value) ?? null)

  function clearSelection() {
    selectedTableId.value = selectedRelationId.value = selectedGroupId.value =
      editingTableId.value = editingGroupId.value = null
  }

  // Tables

  function createTable(position = { x: 100, y: 100 }, groupId: string | null = null) {
    const s = sc()
    const table: Table = {
      id: uuidv4(),
      name: `table_${s.tables.length + 1}`,
      comment: '',
      color: DEFAULT_COLORS[s.tables.length % DEFAULT_COLORS.length],
      position, groupId,
      groupLocked: false,
      width: TABLE_WIDTH,
      columns: [{ id: uuidv4(), name: 'id', type: 'UUID', nullable: false,
        primaryKey: true, unique: true, defaultValue: 'gen_random_uuid()', comment: '' }],
    }
    s.tables.push(table)
    selectedTableId.value = table.id
    editingTableId.value  = table.id
    persist()
    return table
  }

  function updateTable(tableId: string, updates: Partial<Table>) {
    const t = sc().tables.find(t => t.id === tableId)
    if (t) { Object.assign(t, updates); persist() }
  }

  function deleteTable(tableId: string) {
    const s = sc()
    s.tables    = s.tables.filter(t => t.id !== tableId)
    s.relations = s.relations.filter(r => r.sourceTableId !== tableId && r.targetTableId !== tableId)
    if (selectedTableId.value === tableId) selectedTableId.value = null
    if (editingTableId.value  === tableId) editingTableId.value  = null
    persist()
  }

  function addColumn(tableId: string) {
    const table = sc().tables.find(t => t.id === tableId)
    if (!table) return
    const col: Column = {
      id: uuidv4(), name: `column_${table.columns.length + 1}`, type: 'VARCHAR',
      nullable: true, primaryKey: false, unique: false, defaultValue: '', comment: '',
    }
    table.columns.push(col)
    persist()
    return col
  }

  function updateColumn(tableId: string, columnId: string, updates: Partial<Column>) {
    const col = sc().tables.find(t => t.id === tableId)?.columns.find(c => c.id === columnId)
    if (col) { Object.assign(col, updates); persist() }
  }

  function deleteColumn(tableId: string, columnId: string) {
    const t = sc().tables.find(t => t.id === tableId)
    if (t) { t.columns = t.columns.filter(c => c.id !== columnId); persist() }
  }

  // During drag: just move. On commit (drop): resolve group via T1.
  function updateTablePosition(
    tableId: string,
    position: { x: number; y: number },
    commit = false,
  ) {
    const s = sc()
    const table = s.tables.find(t => t.id === tableId)
    if (!table) return
    table.position = position
    if (commit && !table.groupLocked) {
      table.groupId = resolveTableGroup({ ...table, position }, s.groups)
      persist()
    } else if (commit) {
      persist() // still persist position, just not group change
    }
  }

  function updateTableWidth(tableId: string, width: number) {
    const t = sc().tables.find(t => t.id === tableId)
    if (t) t.width = Math.max(240, width)
  }

  function commitTableWidth() {
    persist()
  }

  // Relations

  function addRelation(relation: Omit<Relation, 'id'>) {
    const rel: Relation = { id: uuidv4(), ...relation }
    sc().relations.push(rel)
    persist()
    return rel
  }

  function updateRelation(relationId: string, updates: Partial<Relation>) {
    const rel = sc().relations.find(r => r.id === relationId)
    if (rel) { Object.assign(rel, updates); persist() }
  }

  function deleteRelation(relationId: string) {
    const s = sc()
    s.relations = s.relations.filter(r => r.id !== relationId)
    persist()
  }

  // Groups

  function createGroup(position = { x: 60, y: 60 }) {
    const s = sc()
    const group: TableGroup = {
      id: uuidv4(),
      name: `group_${s.groups.length + 1}`,
      color: GROUP_COLORS[s.groups.length % GROUP_COLORS.length],
      position, size: { w: 400, h: 300 },
      parentGroupId: null,
    }
    s.groups.push(group)
    selectedGroupId.value = group.id
    editingGroupId.value  = group.id
    persist()
    return group
  }

  function updateGroup(groupId: string, updates: Partial<TableGroup>) {
    const g = sc().groups.find(g => g.id === groupId)
    if (g) { Object.assign(g, updates); persist() }
  }

  function deleteGroup(groupId: string, removeTables = false) {
    const s = sc()
    const thisGroup = s.groups.find(g => g.id === groupId)
    // Promote direct children to this group's parent
    for (const g of s.groups) {
      if (g.parentGroupId === groupId) g.parentGroupId = thisGroup?.parentGroupId ?? null
    }
    s.groups = s.groups.filter(g => g.id !== groupId)
    if (removeTables) {
      const tableIds = s.tables.filter(t => t.groupId === groupId).map(t => t.id)
      s.tables    = s.tables.filter(t => t.groupId !== groupId)
      s.relations = s.relations.filter(r =>
        !tableIds.includes(r.sourceTableId) && !tableIds.includes(r.targetTableId))
    } else {
      s.tables.forEach(t => { if (t.groupId === groupId) t.groupId = null })
    }
    if (selectedGroupId.value === groupId) selectedGroupId.value = null
    if (editingGroupId.value  === groupId) editingGroupId.value  = null
    persist()
  }

  // Position update during drag — no containment yet
  function updateGroupPosition(groupId: string, position: { x: number; y: number }) {
    const g = sc().groups.find(g => g.id === groupId)
    if (g) g.position = position
  }

  // Commit after drag drop — rule S1: only reassign what was ours before
  function commitGroupDrop(
    groupId: string,
    ownedTablesBefore: Set<string>,
    ownedGroupsBefore: Set<string>,
  ) {
    const s = sc()
    const movedGroup = s.groups.find(g => g.id === groupId)
    if (!movedGroup) return

    const { tableChanges, groupChanges } = applyGroupDrop(
      movedGroup, s.groups, s.tables, ownedTablesBefore, ownedGroupsBefore
    )

    for (const [tid, gid] of Object.entries(tableChanges)) {
      const t = s.tables.find(t => t.id === tid)
      if (t) t.groupId = gid
    }
    for (const [gid, pgid] of Object.entries(groupChanges)) {
      const g = s.groups.find(g => g.id === gid)
      if (g) g.parentGroupId = pgid
    }

    persist()
  }

  // Resize live — rule S2: absorb only unowned tables
  function updateGroupSize(groupId: string, size: { w: number; h: number }) {
    const s = sc()
    const group = s.groups.find(g => g.id === groupId)
    if (!group) return
    group.size = size
    const changes = applyGroupResize(group, s.groups, s.tables)
    for (const [tid, gid] of Object.entries(changes)) {
      const t = s.tables.find(t => t.id === tid)
      if (t) t.groupId = gid
    }
  }

  // @ts-ignore_groupId
  function commitGroupSize(groupId: string) {
    persist()
  }

  function assignTableToGroup(tableId: string, groupId: string | null) {
    const t = sc().tables.find(t => t.id === tableId)
    if (t && !t.groupLocked) { t.groupId = groupId; persist() }
  }

  function toggleTableLock(tableId: string) {
    const t = sc().tables.find(t => t.id === tableId)
    if (t) { t.groupLocked = !t.groupLocked; persist() }
  }

  // SQL Export

  function exportSQL(dialect: SQLDialect = 'postgresql'): string {
    const s = schema.value
    const lines: string[] = [`-- Generated by DB Designer`, `-- Dialect: ${dialect}`, `-- ${new Date().toISOString()}`, '']
    const grouped = new Map<string | null, Table[]>()
    for (const t of s.tables) {
      const key = t.groupId ?? null
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(t)
    }
    for (const [gid, tables] of grouped) {
      if (gid) {
        const grp = s.groups.find(g => g.id === gid)
        if (grp) lines.push(`-- ── Group: ${grp.name} ──────────────────────────\n`)
      }
      for (const table of tables) {
        lines.push(`CREATE TABLE ${table.name} (`)
        const colDefs: string[] = []
        for (const col of table.columns) {
          let def = `  ${col.name} ${col.type}`
          if (col.primaryKey) def += ' PRIMARY KEY'
          if (!col.nullable && !col.primaryKey) def += ' NOT NULL'
          if (col.unique && !col.primaryKey) def += ' UNIQUE'
          if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`
          colDefs.push(def)
        }
        for (const rel of s.relations) {
          if (rel.sourceTableId === table.id) {
            const tgt  = s.tables.find(t => t.id === rel.targetTableId)
            const scol = table.columns.find(c => c.id === rel.sourceColumnId)
            const tcol = tgt?.columns.find(c => c.id === rel.targetColumnId)
            if (tgt && scol && tcol)
              colDefs.push(`  FOREIGN KEY (${scol.name}) REFERENCES ${tgt.name}(${tcol.name})`)
          }
        }
        lines.push(colDefs.join(',\n')); lines.push(');'); lines.push('')
      }
    }
    return lines.join('\n')
  }

  function saveToFile() {
    const json = JSON.stringify(schema.value, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${schema.value.name}.dbm.json`; a.click()
    URL.revokeObjectURL(url)
  }

  function loadFromJSON(json: Schema) {
    if (!json.groups) json.groups = []
    // @ts-ignore
    json.groups = json.groups.map(g => ({ parentGroupId: null, ...g }))
    // @ts-ignore
    json.tables = json.tables.map(t => ({ groupId: null, groupLocked: false, width: TABLE_WIDTH, ...t }))
    tabsStore.loadSchemaIntoNewTab(json)
    clearSelection()
  }

  function newSchema() { tabsStore.newTab(); clearSelection() }

  return {
    schema,
    selectedTableId, selectedRelationId, selectedGroupId, editingTableId, editingGroupId,
    selectedTable, selectedGroup, clearSelection,
    createTable, updateTable, deleteTable,
    addColumn, updateColumn, deleteColumn,
    updateTablePosition, updateTableWidth, commitTableWidth,
    addRelation, updateRelation, deleteRelation,
    createGroup, updateGroup, deleteGroup,
    updateGroupPosition, commitGroupDrop,
    updateGroupSize, commitGroupSize,
    assignTableToGroup, toggleTableLock,
    exportSQL, saveToFile, loadFromJSON, newSchema,
  }
})
