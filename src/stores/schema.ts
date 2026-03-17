import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { Schema, Table, Column, Relation, TableGroup, SQLDialect } from '../types'
import { TABLE_WIDTH } from '../types'
import { canonicalSqlType, normalizeSqlType } from '../types/sqlTypes'
import { useTabsStore } from './tabs'
import { saveExportFile } from '../composables/useFileExport'
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
      id: '', name: '', dialect: 'postgresql', tables: [], relations: [], groups: [],
      createdAt: '', updatedAt: '',
    }
  )

  function sc() { return tabsStore.activeSchema! }

  function persist() {
    const s = tabsStore.activeSchema
    if (s) tabsStore.updateSchema({ ...s, updatedAt: new Date().toISOString() })
  }

  function withDialectMemory(column: Column, dialect: SQLDialect): Column {
    const normalizedType = normalizeSqlType(column.type, dialect)
    return {
      ...column,
      type: normalizedType,
      dialectTypes: {
        ...(column.dialectTypes ?? {}),
        [dialect]: normalizedType,
      },
    }
  }

  function defaultUuidTypeForDialect(dialect: SQLDialect): string {
    return normalizeSqlType('UUID', dialect)
  }

  function defaultUuidValueForDialect(dialect: SQLDialect, type: string): string {
    const normalized = normalizeSqlType(type, dialect).toUpperCase()
    if (normalized === 'UUID') return 'gen_random_uuid()'
    if (normalized === 'CHAR(36)') return 'UUID()'
    if (normalized === 'UNIQUEIDENTIFIER') return 'NEWID()'
    return ''
  }

  function isUuidSemanticColumn(column: Column): boolean {
    if (canonicalSqlType(column.type) === 'UUID') return true
    return Object.values(column.dialectTypes ?? {}).some(type => canonicalSqlType(type) === 'UUID')
  }

  function sqliteUuidCheck(columnName: string): string {
    return `CHECK (${columnName} IS NULL OR (length(${columnName}) = 36 AND substr(${columnName}, 9, 1) = '-' AND substr(${columnName}, 14, 1) = '-' AND substr(${columnName}, 19, 1) = '-' AND substr(${columnName}, 24, 1) = '-' AND lower(${columnName}) GLOB '[0-9a-f-]*'))`
  }

  function updateSchemaMeta(updates: Partial<Pick<Schema, 'name' | 'dialect'>>) {
    Object.assign(sc(), updates)
    persist()
  }

  function setSchemaDialect(dialect: SQLDialect) {
    const s = sc()
    const previousDialect = s.dialect ?? 'postgresql'
    s.dialect = dialect
    s.tables = s.tables.map(table => ({
      ...table,
      columns: table.columns.map(column => {
        const remembered = {
          ...(column.dialectTypes ?? {}),
          [previousDialect]: column.type,
        }

        return {
          ...column,
          dialectTypes: remembered,
          type: normalizeSqlType(remembered[dialect] ?? column.type, dialect),
        }
      }),
    }))
    persist()
  }

  // UI state
  const selectedTableId    = ref<string | null>(null)
  const selectedRelationId = ref<string | null>(null)
  const selectedGroupId    = ref<string | null>(null)
  const editingTableId     = ref<string | null>(null)
  const editingGroupId     = ref<string | null>(null)
  const showMinimap        = ref(true)
  const lightExportMode    = ref(false)

  const selectedTable = computed(() => schema.value.tables.find(t => t.id === selectedTableId.value) ?? null)
  const selectedGroup = computed(() => schema.value.groups.find(g => g.id === selectedGroupId.value) ?? null)

  function clearSelection() {
    selectedTableId.value = selectedRelationId.value = selectedGroupId.value =
      editingTableId.value = editingGroupId.value = null
  }

  // Tables

  function createTable(position = { x: 100, y: 100 }, groupId: string | null = null) {
    const s = sc()
    const idType = defaultUuidTypeForDialect(s.dialect ?? 'postgresql')
    const table: Table = {
      id: uuidv4(),
      name: `table_${s.tables.length + 1}`,
      comment: '',
      color: DEFAULT_COLORS[s.tables.length % DEFAULT_COLORS.length],
      position, groupId,
      groupLocked: false,
      immutable: false,
      width: TABLE_WIDTH,
      columns: [{
        id: uuidv4(),
        name: 'id',
        type: idType,
        dialectTypes: { [s.dialect ?? 'postgresql']: idType },
        nullable: false,
        primaryKey: true,
        unique: true,
        immutable: false,
        defaultValue: defaultUuidValueForDialect(s.dialect ?? 'postgresql', idType),
        comment: '',
      }],
    }
    s.tables.push(table)
    selectedTableId.value = table.id
    editingTableId.value  = table.id
    persist()
    return table
  }

  function updateTable(tableId: string, updates: Partial<Table>) {
    const t = sc().tables.find(t => t.id === tableId)
    if (t) {
      Object.assign(t, updates)
      t.columns = t.columns.map(column => withDialectMemory(column, sc().dialect ?? 'postgresql'))
      persist()
    }
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
      dialectTypes: { [sc().dialect ?? 'postgresql']: 'VARCHAR' },
      nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: '',
    }
    table.columns.push(col)
    persist()
    return col
  }

  function updateColumn(tableId: string, columnId: string, updates: Partial<Column>) {
    const col = sc().tables.find(t => t.id === tableId)?.columns.find(c => c.id === columnId)
    if (col) {
      Object.assign(col, updates)
      col.dialectTypes = {
        ...(col.dialectTypes ?? {}),
        [sc().dialect ?? 'postgresql']: col.type,
      }
      persist()
    }
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
    const rel: Relation = { id: uuidv4(), waypoints: [], ...relation }
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

  function exportSQL(dialect: SQLDialect = schema.value.dialect ?? 'postgresql'): string {
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
          let def = `  ${col.name} ${normalizeSqlType(col.type, dialect)}`
          if (col.primaryKey) def += ' PRIMARY KEY'
          if (!col.nullable && !col.primaryKey) def += ' NOT NULL'
          if (col.unique && !col.primaryKey) def += ' UNIQUE'
          if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`
          if (dialect === 'sqlite' && isUuidSemanticColumn(col)) def += ` ${sqliteUuidCheck(col.name)}`
          colDefs.push(def)
        }
        for (const rel of s.relations) {
          if (rel.targetTableId === table.id) {
            const src  = s.tables.find(t => t.id === rel.sourceTableId)
            const tcol = table.columns.find(c => c.id === rel.targetColumnId)
            const scol = src?.columns.find(c => c.id === rel.sourceColumnId)
            if (src && scol && tcol)
              colDefs.push(`  FOREIGN KEY (${tcol.name}) REFERENCES ${src.name}(${scol.name})`)
          }
        }
        lines.push(colDefs.join(',\n')); lines.push(');'); lines.push('')
      }
    }
    return lines.join('\n')
  }

  async function saveToFile() {
    const json = JSON.stringify(schema.value, null, 2)
    await saveExportFile({
      data: json,
      defaultPath: `${schema.value.name}.dbm.json`,
      filters: [{ name: 'DB Model JSON', extensions: ['json'] }],
      mimeType: 'application/json',
    })
  }

  function loadFromJSON(json: Schema) {
    if (!json.dialect) json.dialect = 'postgresql'
    if (!json.groups) json.groups = []
    if (!json.relations) json.relations = []
    // @ts-ignore
    json.groups = json.groups.map(g => ({ parentGroupId: null, ...g }))
    // @ts-ignore
    json.relations = json.relations.map(r => ({ waypoints: [], ...r }))
    // @ts-ignore
    json.tables = json.tables.map(t => ({
      ...t,
      groupId: t.groupId ?? null,
      groupLocked: t.groupLocked ?? false,
      immutable: t.immutable ?? false,
      width: t.width ?? TABLE_WIDTH,
      columns: (t.columns ?? []).map(c => ({
        ...c,
        immutable: c.immutable ?? false,
        dialectTypes: {
          ...(c.dialectTypes ?? {}),
          [json.dialect ?? 'postgresql']: c.type,
        },
      })),
    }))
    tabsStore.loadSchemaIntoNewTab(json)
    clearSelection()
  }

  function newSchema() { tabsStore.newTab(); clearSelection() }

  return {
    schema,
    selectedTableId, selectedRelationId, selectedGroupId, editingTableId, editingGroupId,
    selectedTable, selectedGroup, clearSelection, showMinimap, lightExportMode,
    createTable, updateTable, deleteTable,
    addColumn, updateColumn, deleteColumn,
    updateTablePosition, updateTableWidth, commitTableWidth,
    addRelation, updateRelation, deleteRelation,
    createGroup, updateGroup, deleteGroup,
    updateGroupPosition, commitGroupDrop,
    updateGroupSize, commitGroupSize,
    assignTableToGroup, toggleTableLock,
    updateSchemaMeta, setSchemaDialect,
    exportSQL, saveToFile, loadFromJSON, newSchema,
  }
})


