import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type {
  Schema,
  Table,
  Column,
  Relation,
  TableGroup,
  CommentBox,
  SQLDialect,
  ResourceNodeType,
  BridgeTableOptions,
  BridgeTableUseCase,
} from '../types'
import { TABLE_WIDTH, TABLE_HEADER_H, TABLE_COL_PAD_TOP, TABLE_ROW_H } from '../types'
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
const RESOURCE_COLORS: Record<ResourceNodeType, string> = {
  'blob-storage': '#0EA5E9',
  'nosql-database': '#F59E0B',
  'cache': '#8B5CF6',
  'message-queue': '#EC4899',
  'data-export': '#22C55E',
  'external-service': '#14B8A6',
}
const RESOURCE_LABELS: Record<ResourceNodeType, string> = {
  'blob-storage': 's3_blob',
  'nosql-database': 'nosql_store',
  'cache': 'cache',
  'message-queue': 'queue',
  'data-export': 'data_export',
  'external-service': 'external_service',
}
const RESOURCE_DISPLAY_LABELS: Record<ResourceNodeType, string> = {
  'blob-storage': 'S3 / Blob',
  'nosql-database': 'NoSQL Database',
  'cache': 'Cache',
  'message-queue': 'Message Queue',
  'data-export': 'Data Export',
  'external-service': 'External Service',
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeMermaidText(value: string): string {
  return value
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, '<br/>')
}

function mermaidNodeId(prefix: string, rawId: string): string {
  return `${prefix}_${rawId.replace(/[^a-zA-Z0-9_]/g, '_')}`
}

function resourceLabelForType(resourceType: ResourceNodeType | null | undefined): string {
  return RESOURCE_DISPLAY_LABELS[resourceType ?? 'external-service'] ?? 'External Service'
}

function resourcePortLabel(resourceType: ResourceNodeType | null | undefined): string {
  switch (resourceType) {
    case 'blob-storage': return 's3/blob read/write'
    case 'nosql-database': return 'document request'
    case 'cache': return 'cache lookup'
    case 'message-queue': return 'publish / consume'
    case 'data-export': return 'export payload'
    default: return 'request / response'
  }
}

function tableVisualHeight(table: Table): number {
  if ((table.kind ?? 'table') === 'resource') {
    const commentLines = Math.max(0, Math.ceil((table.comment?.length ?? 0) / 42))
    return 96 + commentLines * 16
  }
  return TABLE_HEADER_H + TABLE_COL_PAD_TOP + table.columns.length * TABLE_ROW_H + 12
}

function connectorPosition(table: Table, columnId: string, side: 'left' | 'right') {
  if ((table.kind ?? 'table') === 'resource') {
    return {
      x: table.position.x + (side === 'right' ? (table.width ?? TABLE_WIDTH) : 0),
      y: table.position.y + 72,
    }
  }

  const columnIndex = Math.max(0, table.columns.findIndex(column => column.id === columnId))
  return {
    x: table.position.x + (side === 'right' ? (table.width ?? TABLE_WIDTH) : 0),
    y: table.position.y + TABLE_HEADER_H + TABLE_COL_PAD_TOP + columnIndex * TABLE_ROW_H + TABLE_ROW_H / 2,
  }
}

function makeCurveSegment(a: { x: number; y: number }, b: { x: number; y: number }, move = true) {
  const cx = Math.max(Math.abs(b.x - a.x) * 0.5, 80)
  return `${move ? `M ${a.x} ${a.y} ` : ''}C ${a.x + cx} ${a.y}, ${b.x - cx} ${b.y}, ${b.x} ${b.y}`
}

function relationLabel(type: Relation['type']): string {
  if (type === 'one-to-one') return '1:1'
  if (type === 'one-to-many') return '1:N'
  return 'N:M'
}

function relationSourceSide(relation: Relation): 'left' | 'right' {
  return relation.sourceSide ?? 'left'
}

function relationTargetSide(relation: Relation): 'left' | 'right' {
  return relation.targetSide ?? 'right'
}

function svgText(value: string): string {
  return escapeXml(value || '')
}

export const useSchemaStore = defineStore('schema', () => {
  const tabsStore = useTabsStore()
  const HISTORY_LIMIT = 100

  const schema = computed<Schema>(() =>
    tabsStore.activeSchema ?? {
      id: '', name: '', dialect: 'postgresql', tables: [], relations: [], groups: [], comments: [],
      createdAt: '', updatedAt: '',
    }
  )

  function sc() {
    if (tabsStore.activeSchema) return tabsStore.activeSchema
    tabsStore.newTab()
    return tabsStore.activeSchema!
  }

  function cloneSchemaState(value: Schema): Schema {
    return JSON.parse(JSON.stringify(value)) as Schema
  }

  const undoStack = ref<Schema[]>([])
  const redoStack = ref<Schema[]>([])
  const skipNextHistoryRecord = ref(false)
  const lastCommittedSnapshot = ref<Schema | null>(null)

  function rememberHistorySnapshot() {
    if (skipNextHistoryRecord.value) {
      skipNextHistoryRecord.value = false
      return
    }
    if (!lastCommittedSnapshot.value) return
    undoStack.value = [...undoStack.value, cloneSchemaState(lastCommittedSnapshot.value)].slice(-HISTORY_LIMIT)
    redoStack.value = []
  }

  function persist(recordHistory = true) {
    const s = tabsStore.activeSchema
    if (!s) return
    if (recordHistory) rememberHistorySnapshot()
    else skipNextHistoryRecord.value = false
    tabsStore.updateSchema({ ...s, updatedAt: new Date().toISOString() })
    lastCommittedSnapshot.value = cloneSchemaState(tabsStore.activeSchema ?? s)
  }

  function resetHistory() {
    undoStack.value = []
    redoStack.value = []
    skipNextHistoryRecord.value = false
  }

  function applyHistorySnapshot(nextSchema: Schema, oppositeStack: typeof undoStack) {
    const currentSchema = tabsStore.activeSchema
    if (!currentSchema) return
    if (lastCommittedSnapshot.value) {
      oppositeStack.value = [...oppositeStack.value, cloneSchemaState(lastCommittedSnapshot.value)].slice(-HISTORY_LIMIT)
    }
    skipNextHistoryRecord.value = true
    tabsStore.updateSchema({
      ...cloneSchemaState(nextSchema),
      updatedAt: new Date().toISOString(),
    })
    lastCommittedSnapshot.value = cloneSchemaState(tabsStore.activeSchema ?? nextSchema)
    clearSelection()
    draftTableIds.value = new Set()
    draftGroupIds.value = new Set()
  }

  function undo() {
    const previous = undoStack.value[undoStack.value.length - 1]
    if (!previous) return
    undoStack.value = undoStack.value.slice(0, -1)
    applyHistorySnapshot(previous, redoStack)
  }

  function redo() {
    const next = redoStack.value[redoStack.value.length - 1]
    if (!next) return
    redoStack.value = redoStack.value.slice(0, -1)
    applyHistorySnapshot(next, undoStack)
  }

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  watch(() => tabsStore.activeTabId, () => {
    resetHistory()
    lastCommittedSnapshot.value = tabsStore.activeSchema ? cloneSchemaState(tabsStore.activeSchema) : null
  }, { immediate: true })

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
  const selectedCommentId  = ref<string | null>(null)
  const multiSelectedTableIds = ref<Set<string>>(new Set())
  const multiSelectedGroupIds = ref<Set<string>>(new Set())
  const multiSelectedCommentIds = ref<Set<string>>(new Set())
  const copiedCanvasSelection = ref<{ tableIds: string[]; groupIds: string[]; commentIds: string[] } | null>(null)
  const editingTableId     = ref<string | null>(null)
  const editingGroupId     = ref<string | null>(null)
  const draftTableIds      = ref<Set<string>>(new Set())
  const draftGroupIds      = ref<Set<string>>(new Set())
  const showMinimap        = ref(true)
  const lightExportMode    = ref(false)

  const selectedTable = computed(() => schema.value.tables.find(t => t.id === selectedTableId.value) ?? null)
  const selectedGroup = computed(() => schema.value.groups.find(g => g.id === selectedGroupId.value) ?? null)
  const selectedComment = computed(() => schema.value.comments.find(comment => comment.id === selectedCommentId.value) ?? null)
  const sqlTables = computed(() => schema.value.tables.filter(table => (table.kind ?? 'table') === 'table'))
  const resourceTables = computed(() => schema.value.tables.filter(table => (table.kind ?? 'table') === 'resource'))

  function clearSelection() {
    selectedTableId.value = selectedRelationId.value = selectedGroupId.value = selectedCommentId.value =
      editingTableId.value = editingGroupId.value = null
    multiSelectedTableIds.value = new Set()
    multiSelectedGroupIds.value = new Set()
    multiSelectedCommentIds.value = new Set()
  }

  function clearMultiSelection() {
    multiSelectedTableIds.value = new Set()
    multiSelectedGroupIds.value = new Set()
    multiSelectedCommentIds.value = new Set()
  }

  function uniqueCopyName(name: string, existingNames: string[]) {
    const normalizedExisting = new Set(existingNames.map(value => value.toLowerCase()))
    const baseName = name.replace(/_\d+$/, '')
    let copyIndex = 2
    let candidate = `${baseName}_${copyIndex}`
    while (normalizedExisting.has(candidate.toLowerCase())) {
      copyIndex++
      candidate = `${baseName}_${copyIndex}`
    }
    return candidate
  }

  function uniqueTableName(baseName: string) {
    const existingNames = sc().tables.map(table => table.name)
    if (!existingNames.some(name => name.toLowerCase() === baseName.toLowerCase())) return baseName
    return uniqueCopyName(baseName, existingNames)
  }

  function uniqueColumnNameForTable(table: Table, baseName: string) {
    const existing = new Set(table.columns.map(column => column.name.toLowerCase()))
    if (!existing.has(baseName.toLowerCase())) return baseName
    let index = 2
    let candidate = `${baseName}_${index}`
    while (existing.has(candidate.toLowerCase())) {
      index++
      candidate = `${baseName}_${index}`
    }
    return candidate
  }

  function bridgeColumnName(tableName: string, columnName: string) {
    return `${tableName}_${columnName}`
      .replace(/[^a-zA-Z0-9_]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()
  }

  function bridgeTemplateColumns(
    useCase: BridgeTableUseCase,
    dialect: SQLDialect,
  ): Array<Omit<Column, 'id'>> {
    const timestampType = dialect === 'postgresql'
      ? 'TIMESTAMPTZ'
      : dialect === 'sqlserver'
        ? 'DATETIME2'
        : 'DATETIME'
    const nowValue = dialect === 'postgresql'
      ? 'NOW()'
      : dialect === 'sqlserver'
        ? 'SYSDATETIME()'
        : 'CURRENT_TIMESTAMP'

    switch (useCase) {
      case 'membership':
        return [
          { name: 'role', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Membership role or access level.' },
          { name: 'joined_at', type: timestampType, dialectTypes: { [dialect]: timestampType }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: nowValue, comment: 'When the member relationship started.' },
        ]
      case 'line-items':
        return [
          { name: 'quantity', type: 'INTEGER', dialectTypes: { [dialect]: normalizeSqlType('INTEGER', dialect) }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: '1', comment: 'Number of referenced items.' },
          { name: 'unit_price', type: 'DECIMAL', dialectTypes: { [dialect]: normalizeSqlType('DECIMAL', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Captured price per item at the time of association.' },
        ]
      case 'enrollment':
        return [
          { name: 'status', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: "'active'", comment: 'Enrollment lifecycle state.' },
          { name: 'enrolled_at', type: timestampType, dialectTypes: { [dialect]: timestampType }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: nowValue, comment: 'When the enrollment was created.' },
        ]
      case 'assignment':
        return [
          { name: 'assigned_at', type: timestampType, dialectTypes: { [dialect]: timestampType }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: nowValue, comment: 'When the assignment was made.' },
          { name: 'assignment_note', type: 'TEXT', dialectTypes: { [dialect]: normalizeSqlType('TEXT', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Optional context for the assignment.' },
        ]
      case 'vector-rag':
        return [
          { name: 'chunk_index', type: 'INTEGER', dialectTypes: { [dialect]: normalizeSqlType('INTEGER', dialect) }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: '0', comment: 'Chunk order within the source document or record.' },
          { name: 'content_text', type: 'TEXT', dialectTypes: { [dialect]: normalizeSqlType('TEXT', dialect) }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Normalized chunk text used for retrieval and answer grounding.' },
          { name: 'embedding_vector', type: dialect === 'postgresql' ? 'VECTOR' : 'TEXT', dialectTypes: { [dialect]: dialect === 'postgresql' ? 'VECTOR' : 'TEXT' }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Embedding payload or vector reference for semantic search.' },
          { name: 'metadata_json', type: dialect === 'postgresql' ? 'JSONB' : 'JSON', dialectTypes: { [dialect]: normalizeSqlType(dialect === 'postgresql' ? 'JSONB' : 'JSON', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: dialect === 'postgresql' ? "'{}'" : dialect === 'mysql' ? "'{}'" : '', comment: 'Chunk metadata such as source page, PDF name, section, tags, or tenant.' },
          { name: 'source_uri', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Original file, object store, or canonical URI for this source.' },
        ]
      case 'audit-trail':
        return [
          { name: 'event_type', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Created, updated, deleted, approved, or other domain event.' },
          { name: 'changed_at', type: timestampType, dialectTypes: { [dialect]: timestampType }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: nowValue, comment: 'When the audited change was recorded.' },
          { name: 'changed_by', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'User, service account, or system actor that made the change.' },
          { name: 'change_summary', type: 'TEXT', dialectTypes: { [dialect]: normalizeSqlType('TEXT', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Human-readable summary of what changed.' },
          { name: 'change_payload', type: dialect === 'postgresql' ? 'JSONB' : 'JSON', dialectTypes: { [dialect]: normalizeSqlType(dialect === 'postgresql' ? 'JSONB' : 'JSON', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: dialect === 'postgresql' ? "'{}'" : dialect === 'mysql' ? "'{}'" : '', comment: 'Structured before/after values, request metadata, or compliance details.' },
        ]
      default:
        return []
    }
  }

  function bridgeUseCaseComment(useCase: BridgeTableUseCase, sourceName: string, targetName: string, notes?: string) {
    const base = {
      generic: `Bridge table linking ${sourceName} and ${targetName}.`,
      membership: `Membership bridge tracking how ${sourceName} connect to ${targetName}.`,
      'line-items': `Line-item bridge linking ${sourceName} to ${targetName}.`,
      enrollment: `Enrollment bridge connecting ${sourceName} with ${targetName}.`,
      assignment: `Assignment bridge mapping ${sourceName} to ${targetName}.`,
      'vector-rag': `Vector/RAG bridge linking ${sourceName} to ${targetName} with chunk, embedding, and retrieval metadata.`,
      'audit-trail': `Audit bridge recording change history between ${sourceName} and ${targetName}.`,
    }[useCase]
    return notes?.trim() ? `${base} ${notes.trim()}` : base
  }

  function preferredReferenceColumn(table: Table, preferredColumnId: string) {
    const primaryKeys = table.columns.filter(column => column.primaryKey)
    if (primaryKeys.length > 0) {
      return primaryKeys.find(column => column.id === preferredColumnId) ?? primaryKeys[0]
    }

    const uniqueColumns = table.columns.filter(column => column.unique)
    if (uniqueColumns.length > 0) {
      return uniqueColumns.find(column => column.id === preferredColumnId) ?? uniqueColumns[0]
    }

    return table.columns.find(column => column.id === preferredColumnId) ?? table.columns[0] ?? null
  }

  function makeDefaultIdColumn(dialect: SQLDialect): Column {
    const idType = defaultUuidTypeForDialect(dialect)
    return {
      id: uuidv4(),
      name: 'id',
      type: idType,
      dialectTypes: { [dialect]: idType },
      nullable: false,
      primaryKey: true,
      unique: true,
      immutable: false,
      defaultValue: defaultUuidValueForDialect(dialect, idType),
      comment: '',
    }
  }

  function createSystemTable(
    name: string,
    position: { x: number; y: number },
    columns: Array<Omit<Column, 'id'>>,
    comment = '',
    groupId: string | null = null,
  ) {
    const s = sc()
    const dialect = s.dialect ?? 'postgresql'
    const table: Table = {
      id: uuidv4(),
      kind: 'table',
      resourceType: null,
      name: uniqueTableName(name),
      comment,
      color: DEFAULT_COLORS[s.tables.length % DEFAULT_COLORS.length],
      position,
      groupId,
      groupLocked: false,
      immutable: false,
      width: TABLE_WIDTH,
      columns: [
        makeDefaultIdColumn(dialect),
        ...columns.map(column => ({
          ...column,
          id: uuidv4(),
        })),
      ],
    }
    s.tables.push(table)
    return table
  }

  function appendReferenceColumn(
    table: Table,
    referencedTable: Table,
    referencedColumn: Column,
    dialect: SQLDialect,
    explicitName?: string,
  ) {
    const name = uniqueColumnNameForTable(
      table,
      explicitName ?? bridgeColumnName(referencedTable.name, referencedColumn.name),
    )
    const column = withDialectMemory({
      id: uuidv4(),
      name,
      type: referencedColumn.type,
      dialectTypes: {
        ...(referencedColumn.dialectTypes ?? {}),
        [dialect]: normalizeSqlType(referencedColumn.type, dialect),
      },
      nullable: false,
      primaryKey: false,
      unique: false,
      immutable: false,
      defaultValue: '',
      comment: `References ${referencedTable.name}.${referencedColumn.name}`,
    }, dialect)
    table.columns.push(column)
    return column
  }

  function addReferenceRelation(
    referencedTable: Table,
    referencedColumn: Column,
    owningTable: Table,
    owningColumn: Column,
    label = '',
  ) {
    sc().relations.push({
      id: uuidv4(),
      sourceTableId: referencedTable.id,
      sourceColumnId: referencedColumn.id,
      sourceSide: 'left',
      targetTableId: owningTable.id,
      targetColumnId: owningColumn.id,
      targetSide: 'right',
      type: 'one-to-many',
      label,
      waypoints: [],
    })
  }

  function preferredReferenceColumnByTableId(tableId: string, preferredColumnId?: string | null) {
    const table = sc().tables.find(entry => entry.id === tableId)
    if (!table || (table.kind ?? 'table') !== 'table') return null
    return {
      table,
      column: preferredReferenceColumn(table, preferredColumnId ?? ''),
    }
  }

  // Tables

  function createTable(position = { x: 100, y: 100 }, groupId: string | null = null) {
    const s = sc()
    const table: Table = {
      id: uuidv4(),
      kind: 'table',
      resourceType: null,
      name: `table_${s.tables.length + 1}`,
      comment: '',
      color: DEFAULT_COLORS[s.tables.length % DEFAULT_COLORS.length],
      position, groupId,
      groupLocked: false,
      immutable: false,
      width: TABLE_WIDTH,
      columns: [makeDefaultIdColumn(s.dialect ?? 'postgresql')],
    }
    s.tables.push(table)
    draftTableIds.value = new Set([...draftTableIds.value, table.id])
    clearMultiSelection()
    selectedTableId.value = table.id
    editingTableId.value  = table.id
    persist()
    return table
  }

  function createResource(
    resourceType: ResourceNodeType,
    position = { x: 100, y: 100 },
    groupId: string | null = null,
  ) {
    const s = sc()
    const resource: Table = {
      id: uuidv4(),
      kind: 'resource',
      resourceType,
      name: `${RESOURCE_LABELS[resourceType]}_${resourceTables.value.length + 1}`,
      comment: '',
      color: RESOURCE_COLORS[resourceType],
      position,
      groupId,
      groupLocked: false,
      immutable: false,
      width: 280,
      columns: [{
        id: uuidv4(),
        name: 'request',
        type: 'RESOURCE',
        dialectTypes: {},
        nullable: true,
        primaryKey: false,
        unique: false,
        immutable: true,
        defaultValue: '',
        comment: '',
      }],
    }
    s.tables.push(resource)
    draftTableIds.value = new Set([...draftTableIds.value, resource.id])
    clearMultiSelection()
    selectedTableId.value = resource.id
    editingTableId.value = resource.id
    persist()
    return resource
  }

  function updateTable(tableId: string, updates: Partial<Table>) {
    const t = sc().tables.find(t => t.id === tableId)
    if (t) {
      Object.assign(t, updates)
      if ((t.kind ?? 'table') === 'resource') {
        t.resourceType ??= 'external-service'
        t.columns = t.columns.length > 0
          ? [t.columns[0]]
          : [{
              id: uuidv4(),
              name: 'request',
              type: 'RESOURCE',
              dialectTypes: {},
              nullable: true,
              primaryKey: false,
              unique: false,
              immutable: true,
              defaultValue: '',
              comment: '',
            }]
      } else {
        t.columns = t.columns.map(column => withDialectMemory(column, sc().dialect ?? 'postgresql'))
      }
      if (draftTableIds.value.has(tableId)) {
        const next = new Set(draftTableIds.value)
        next.delete(tableId)
        draftTableIds.value = next
      }
      persist()
    }
  }

  function deleteTable(tableId: string) {
    const s = sc()
    s.tables    = s.tables.filter(t => t.id !== tableId)
    s.relations = s.relations.filter(r => r.sourceTableId !== tableId && r.targetTableId !== tableId)
    if (draftTableIds.value.has(tableId)) {
      const next = new Set(draftTableIds.value)
      next.delete(tableId)
      draftTableIds.value = next
    }
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
    const rel: Relation = {
      id: uuidv4(),
      waypoints: [],
      sourceSide: 'left',
      targetSide: 'right',
      ...relation,
    }
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

  function createBridgeTableBetweenTables(
    sourceTableId: string,
    targetTableId: string,
    options: BridgeTableOptions,
    preferredSourceColumnId?: string | null,
    preferredTargetColumnId?: string | null,
  ) {
    const s = sc()
    const sourceRef = preferredReferenceColumnByTableId(sourceTableId, preferredSourceColumnId)
    const targetRef = preferredReferenceColumnByTableId(targetTableId, preferredTargetColumnId)
    if (!sourceRef || !targetRef || !sourceRef.column || !targetRef.column) return null

    const sourceTable = sourceRef.table
    const targetTable = targetRef.table
    const sourceColumn = sourceRef.column
    const targetColumn = targetRef.column
    const groupId = sourceTable.groupId && sourceTable.groupId === targetTable.groupId ? sourceTable.groupId : null
    const dialect = s.dialect ?? 'postgresql'
    const sourceTableWidth = sourceTable.width ?? TABLE_WIDTH
    const targetTableWidth = targetTable.width ?? TABLE_WIDTH
    const bridgeX = Math.max(
      sourceTable.position.x + sourceTableWidth,
      targetTable.position.x + targetTableWidth,
    ) + 140
    const bridgeY = Math.round((sourceTable.position.y + targetTable.position.y) / 2)
    const bridgeTable: Table = {
      id: uuidv4(),
      kind: 'table',
      resourceType: null,
      name: uniqueTableName(options.tableName?.trim() || `${sourceTable.name}_${targetTable.name}`),
      comment: bridgeUseCaseComment(options.useCase, sourceTable.name, targetTable.name, options.notes),
      color: DEFAULT_COLORS[s.tables.length % DEFAULT_COLORS.length],
      position: { x: bridgeX, y: bridgeY },
      groupId,
      groupLocked: false,
      immutable: false,
      width: TABLE_WIDTH,
      columns: [makeDefaultIdColumn(dialect)],
    }
    const bridgeSourceColumn = appendReferenceColumn(bridgeTable, sourceTable, sourceColumn, dialect)
    const bridgeTargetColumn = appendReferenceColumn(bridgeTable, targetTable, targetColumn, dialect)
    for (const template of bridgeTemplateColumns(options.useCase, dialect)) {
      bridgeTable.columns.push({
        ...template,
        id: uuidv4(),
      })
    }

    s.tables.push(bridgeTable)
    draftTableIds.value = new Set([...draftTableIds.value, bridgeTable.id])
    addReferenceRelation(sourceTable, sourceColumn, bridgeTable, bridgeSourceColumn)
    addReferenceRelation(targetTable, targetColumn, bridgeTable, bridgeTargetColumn)

    selectedRelationId.value = null
    selectedTableId.value = bridgeTable.id
    editingTableId.value = bridgeTable.id
    clearMultiSelection()
    persist(false)
    return bridgeTable
  }

  function createBridgeTableForRelation(relationId: string, options: BridgeTableOptions) {
    const relation = sc().relations.find(entry => entry.id === relationId)
    if (!relation || relation.type !== 'many-to-many') return null
    sc().relations = sc().relations.filter(entry => entry.id !== relationId)
    return createBridgeTableBetweenTables(
      relation.sourceTableId,
      relation.targetTableId,
      options,
      relation.sourceColumnId,
      relation.targetColumnId,
    )
  }

  function createRagSystem(position = { x: 100, y: 100 }) {
    const s = sc()
    const dialect = s.dialect ?? 'postgresql'
    const docTable = createSystemTable(
      'knowledge_documents',
      position,
      [
        { name: 'title', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Display title for the document, file, PDF, note, or record set.' },
        { name: 'source_uri', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: true, primaryKey: false, unique: true, immutable: false, defaultValue: '', comment: 'Original object store path, URL, S3 key, or canonical file location.' },
        { name: 'ingestion_status', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: "'pending'", comment: 'Current processing status: pending | processing | ready | failed.' },
        { name: 'mime_type', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Document type such as application/pdf, text/markdown, or text/html.' },
        { name: 'metadata_json', type: dialect === 'postgresql' ? 'JSONB' : 'JSON', dialectTypes: { [dialect]: normalizeSqlType(dialect === 'postgresql' ? 'JSONB' : 'JSON', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: dialect === 'postgresql' ? "'{}'" : dialect === 'mysql' ? "'{}'" : '', comment: 'Shared metadata such as tenant, tags, ingestion labels, or source system identifiers.' },
      ],
      'Source documents for multi-file and multi-PDF retrieval.'
    )
    const chunkTable = createSystemTable(
      'document_chunks',
      { x: position.x + 420, y: position.y + 40 },
      [
        { name: 'chunk_index', type: 'INTEGER', dialectTypes: { [dialect]: normalizeSqlType('INTEGER', dialect) }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: '0', comment: 'Chunk order inside the source document.' },
        { name: 'page_number', type: 'INTEGER', dialectTypes: { [dialect]: normalizeSqlType('INTEGER', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Page number for PDFs or other paginated sources.' },
        { name: 'content_text', type: 'TEXT', dialectTypes: { [dialect]: normalizeSqlType('TEXT', dialect) }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Normalized chunk text that will be embedded and cited in answers.' },
        { name: 'embedding_vector', type: dialect === 'postgresql' ? 'VECTOR(1536)' : 'TEXT', dialectTypes: { [dialect]: dialect === 'postgresql' ? 'VECTOR(1536)' : 'TEXT' }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Stored embedding, vector reference, or serialized embedding payload.' },
        { name: 'token_count', type: 'INTEGER', dialectTypes: { [dialect]: normalizeSqlType('INTEGER', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Approximate chunk token count for packing and retrieval tuning.' },
        { name: 'metadata_json', type: dialect === 'postgresql' ? 'JSONB' : 'JSON', dialectTypes: { [dialect]: normalizeSqlType(dialect === 'postgresql' ? 'JSONB' : 'JSON', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: dialect === 'postgresql' ? "'{}'" : dialect === 'mysql' ? "'{}'" : '', comment: 'Per-chunk metadata such as headings, bounding boxes, speaker, table region, or extraction quality.' },
        { name: 'created_at', type: dialect === 'postgresql' ? 'TIMESTAMPTZ' : dialect === 'sqlserver' ? 'DATETIME2' : 'DATETIME', dialectTypes: { [dialect]: dialect === 'postgresql' ? 'TIMESTAMPTZ' : dialect === 'sqlserver' ? 'DATETIME2' : 'DATETIME' }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: dialect === 'postgresql' ? 'NOW()' : dialect === 'sqlserver' ? 'SYSDATETIME()' : 'CURRENT_TIMESTAMP', comment: 'When the chunk was created or last updated.' },
      ],
      'Chunked document content for vector search and grounding.'
    )
    const queryTable = createSystemTable(
      'rag_queries',
      { x: position.x, y: position.y + 280 },
      [
        { name: 'session_id', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Optional link to a conversation session or user identifier.' },
        { name: 'query_text', type: 'TEXT', dialectTypes: { [dialect]: normalizeSqlType('TEXT', dialect) }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'User or system prompt used for retrieval.' },
        { name: 'query_embedding', type: dialect === 'postgresql' ? 'VECTOR(1536)' : 'TEXT', dialectTypes: { [dialect]: dialect === 'postgresql' ? 'VECTOR(1536)' : 'TEXT' }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Optional query embedding for semantic retrieval tracing.' },
        { name: 'created_at', type: dialect === 'postgresql' ? 'TIMESTAMPTZ' : dialect === 'sqlserver' ? 'DATETIME2' : 'DATETIME', dialectTypes: { [dialect]: dialect === 'postgresql' ? 'TIMESTAMPTZ' : dialect === 'sqlserver' ? 'DATETIME2' : 'DATETIME' }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: dialect === 'postgresql' ? 'NOW()' : dialect === 'sqlserver' ? 'SYSDATETIME()' : 'CURRENT_TIMESTAMP', comment: 'When the query was issued.' },
      ],
      'Captured retrieval queries and prompts.'
    )
    const resultTable = createSystemTable(
      'rag_query_results',
      { x: position.x + 420, y: position.y + 320 },
      [
        { name: 'score', type: 'FLOAT', dialectTypes: { [dialect]: dialect === 'postgresql' ? 'FLOAT8' : normalizeSqlType('FLOAT', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Similarity score, reranker score, or hybrid retrieval ranking.' },
        { name: 'rank_position', type: 'INTEGER', dialectTypes: { [dialect]: normalizeSqlType('INTEGER', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Final ordering of returned chunks for the query.' },
        { name: 'used_in_answer', type: normalizeSqlType('BOOLEAN', dialect), dialectTypes: { [dialect]: normalizeSqlType('BOOLEAN', dialect) }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: dialect === 'sqlserver' ? '0' : 'FALSE', comment: 'Whether this retrieved chunk was actually used in the final answer.' },
      ],
      'Join table capturing which chunks were retrieved for each RAG query.'
    )

    const docPk = preferredReferenceColumn(docTable, 'id')!
    const chunkDocFk = appendReferenceColumn(chunkTable, docTable, docPk, dialect, 'document_id')
    addReferenceRelation(docTable, docPk, chunkTable, chunkDocFk)

    const queryPk = preferredReferenceColumn(queryTable, 'id')!
    const chunkPk = preferredReferenceColumn(chunkTable, 'id')!
    const resultQueryFk = appendReferenceColumn(resultTable, queryTable, queryPk, dialect, 'query_id')
    const resultChunkFk = appendReferenceColumn(resultTable, chunkTable, chunkPk, dialect, 'chunk_id')
    addReferenceRelation(queryTable, queryPk, resultTable, resultQueryFk)
    addReferenceRelation(chunkTable, chunkPk, resultTable, resultChunkFk)

    selectedTableId.value = docTable.id
    editingTableId.value = docTable.id
    clearMultiSelection()
    persist()
    return { docTable, chunkTable, queryTable, resultTable }
  }

  function createAuditSystem(position = { x: 100, y: 100 }) {
    const s = sc()
    const dialect = s.dialect ?? 'postgresql'
    const eventTable = createSystemTable(
      'audit_events',
      position,
      [
        { name: 'entity_type', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Domain entity being audited (e.g., order, user).' },
        { name: 'entity_id', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Identifier of the entity that changed.' },
        { name: 'event_type', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Action: CREATE, UPDATE, DELETE, LOGIN, etc.' },
        { name: 'severity', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: "'INFO'", comment: 'Audit level: INFO, WARN, ERROR, CRITICAL.' },
        { name: 'changed_by', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'User or service that performed the action.' },
        { name: 'changed_at', type: dialect === 'postgresql' ? 'TIMESTAMPTZ' : dialect === 'sqlserver' ? 'DATETIME2' : 'DATETIME', dialectTypes: { [dialect]: dialect === 'postgresql' ? 'TIMESTAMPTZ' : dialect === 'sqlserver' ? 'DATETIME2' : 'DATETIME' }, nullable: false, primaryKey: false, unique: false, immutable: false, defaultValue: dialect === 'postgresql' ? 'NOW()' : dialect === 'sqlserver' ? 'SYSDATETIME()' : 'CURRENT_TIMESTAMP', comment: 'Timestamp of the event.' },
        { name: 'source_ip', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'IP address of the requester.' },
        { name: 'user_agent', type: 'TEXT', dialectTypes: { [dialect]: normalizeSqlType('TEXT', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Browser or client user agent.' },
        { name: 'tags_json', type: dialect === 'postgresql' ? 'JSONB' : 'JSON', dialectTypes: { [dialect]: normalizeSqlType(dialect === 'postgresql' ? 'JSONB' : 'JSON', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: dialect === 'postgresql' ? "'[]'" : dialect === 'mysql' ? "'[]'" : '', comment: 'Labels for filtering (e.g., compliance, security).' },
      ],
      'Detailed audit log for system and entity changes.'
    )
    const detailTable = createSystemTable(
      'audit_event_changes',
      { x: position.x + 420, y: position.y + 60 },
      [
        { name: 'field_name', type: 'VARCHAR', dialectTypes: { [dialect]: 'VARCHAR' }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Field or attribute that changed, when tracking per-field deltas.' },
        { name: 'old_value', type: 'TEXT', dialectTypes: { [dialect]: normalizeSqlType('TEXT', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Serialized old value before the change.' },
        { name: 'new_value', type: 'TEXT', dialectTypes: { [dialect]: normalizeSqlType('TEXT', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: '', comment: 'Serialized new value after the change.' },
        { name: 'change_payload', type: dialect === 'postgresql' ? 'JSONB' : 'JSON', dialectTypes: { [dialect]: normalizeSqlType(dialect === 'postgresql' ? 'JSONB' : 'JSON', dialect) }, nullable: true, primaryKey: false, unique: false, immutable: false, defaultValue: dialect === 'postgresql' ? "'{}'" : dialect === 'mysql' ? "'{}'" : '', comment: 'Structured diff payload, before/after document, or compliance evidence.' },
      ],
      'Per-field or per-section change details for each audit event.'
    )

    const eventPk = preferredReferenceColumn(eventTable, 'id')!
    const detailFk = appendReferenceColumn(detailTable, eventTable, eventPk, dialect, 'audit_event_id')
    addReferenceRelation(eventTable, eventPk, detailTable, detailFk)

    selectedTableId.value = eventTable.id
    editingTableId.value = eventTable.id
    clearMultiSelection()
    persist()
    return { eventTable, detailTable }
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
    draftGroupIds.value = new Set([...draftGroupIds.value, group.id])
    clearMultiSelection()
    selectedGroupId.value = group.id
    editingGroupId.value  = group.id
    persist()
    return group
  }

  function updateGroup(groupId: string, updates: Partial<TableGroup>) {
    const g = sc().groups.find(g => g.id === groupId)
    if (g) {
      Object.assign(g, updates)
      if (draftGroupIds.value.has(groupId)) {
        const next = new Set(draftGroupIds.value)
        next.delete(groupId)
        draftGroupIds.value = next
      }
      persist()
    }
  }

  function deleteGroup(groupId: string, removeTables = false) {
    const s = sc()
    const thisGroup = s.groups.find(g => g.id === groupId)
    // Promote direct children to this group's parent
    for (const g of s.groups) {
      if (g.parentGroupId === groupId) g.parentGroupId = thisGroup?.parentGroupId ?? null
    }
    s.groups = s.groups.filter(g => g.id !== groupId)
    if (draftGroupIds.value.has(groupId)) {
      const next = new Set(draftGroupIds.value)
      next.delete(groupId)
      draftGroupIds.value = next
    }
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

  function createComment(position = { x: 120, y: 120 }) {
    const comment: CommentBox = {
      id: uuidv4(),
      text: 'Add design note, caveat, or explainer...',
      position,
      size: { w: 280, h: 120 },
      color: '#FDE68A',
    }
    sc().comments.push(comment)
    clearMultiSelection()
    selectedCommentId.value = comment.id
    selectedTableId.value = null
    selectedGroupId.value = null
    selectedRelationId.value = null
    persist()
    return comment
  }

  function updateComment(commentId: string, updates: Partial<CommentBox>) {
    const comment = sc().comments.find(entry => entry.id === commentId)
    if (!comment) return
    Object.assign(comment, updates)
    persist()
  }

  function deleteComment(commentId: string) {
    const s = sc()
    s.comments = s.comments.filter(entry => entry.id !== commentId)
    if (selectedCommentId.value === commentId) selectedCommentId.value = null
    if (multiSelectedCommentIds.value.has(commentId)) {
      const next = new Set(multiSelectedCommentIds.value)
      next.delete(commentId)
      multiSelectedCommentIds.value = next
    }
    persist()
  }

  function updateCommentPosition(commentId: string, position: { x: number; y: number }, commit = false) {
    const comment = sc().comments.find(entry => entry.id === commentId)
    if (!comment) return
    comment.position = position
    if (commit) persist()
  }

  function updateCommentSize(commentId: string, size: { w: number; h: number }) {
    const comment = sc().comments.find(entry => entry.id === commentId)
    if (!comment) return
    comment.size = {
      w: Math.max(180, size.w),
      h: Math.max(80, size.h),
    }
  }

  function commitCommentSize() {
    persist()
  }

  // Position update during drag: no containment yet
  function updateGroupPosition(groupId: string, position: { x: number; y: number }) {
    const g = sc().groups.find(g => g.id === groupId)
    if (g) g.position = position
  }

  // Commit after drag drop: rule S1, only reassign what was ours before
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

  // Resize live: rule S2, absorb only unowned tables
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

  function orderTablesForSqlExport(tables: Table[], relations: Relation[]): Table[] {
    const tableById = new Map(tables.map(table => [table.id, table]))
    const dependencyCountByTableId = new Map<string, number>()
    const dependentsByTableId = new Map<string, Set<string>>()
    const originalIndexByTableId = new Map(tables.map((table, index) => [table.id, index]))

    for (const table of tables) {
      dependencyCountByTableId.set(table.id, 0)
      dependentsByTableId.set(table.id, new Set())
    }

    for (const relation of relations) {
      if (relation.sourceTableId === relation.targetTableId) continue
      if (!tableById.has(relation.sourceTableId) || !tableById.has(relation.targetTableId)) continue

      const referencedTableId = relation.sourceTableId
      const dependentTableId = relation.targetTableId
      const dependents = dependentsByTableId.get(referencedTableId)!
      if (dependents.has(dependentTableId)) continue

      dependents.add(dependentTableId)
      dependencyCountByTableId.set(
        dependentTableId,
        (dependencyCountByTableId.get(dependentTableId) ?? 0) + 1,
      )
    }

    const ready = tables
      .filter(table => (dependencyCountByTableId.get(table.id) ?? 0) === 0)
      .sort((left, right) =>
        (originalIndexByTableId.get(left.id) ?? 0) - (originalIndexByTableId.get(right.id) ?? 0))

    const ordered: Table[] = []

    while (ready.length) {
      const table = ready.shift()!
      ordered.push(table)

      const dependents = [...(dependentsByTableId.get(table.id) ?? [])]
        .sort((left, right) =>
          (originalIndexByTableId.get(left) ?? 0) - (originalIndexByTableId.get(right) ?? 0))

      for (const dependentId of dependents) {
        const remainingDependencyCount = (dependencyCountByTableId.get(dependentId) ?? 0) - 1
        dependencyCountByTableId.set(dependentId, remainingDependencyCount)
        if (remainingDependencyCount === 0) {
          const dependentTable = tableById.get(dependentId)
          if (dependentTable) ready.push(dependentTable)
        }
      }

      ready.sort((left, right) =>
        (originalIndexByTableId.get(left.id) ?? 0) - (originalIndexByTableId.get(right.id) ?? 0))
    }

    if (ordered.length === tables.length) return ordered

    const orderedIds = new Set(ordered.map(table => table.id))
    return [...ordered, ...tables.filter(table => !orderedIds.has(table.id))]
  }

  function constraintNameForRelation(tableName: string, columnName: string, relationId: string): string {
    const suffix = relationId.replace(/-/g, '').slice(0, 8)
    return `fk_${tableName}_${columnName}_${suffix}`
  }

  function supportsDeferredForeignKeys(dialect: SQLDialect): boolean {
    return dialect !== 'sqlite'
  }

  function exportSQL(dialect: SQLDialect = schema.value.dialect ?? 'postgresql'): string {
    const s = schema.value
    const lines: string[] = [`-- Generated by DB Designer`, `-- Dialect: ${dialect}`, `-- ${new Date().toISOString()}`, '']
    const exportTables = s.tables.filter(table => (table.kind ?? 'table') === 'table')
    const exportRelations = s.relations.filter(relation => {
      const source = s.tables.find(table => table.id === relation.sourceTableId)
      const target = s.tables.find(table => table.id === relation.targetTableId)
      return (source?.kind ?? 'table') === 'table' && (target?.kind ?? 'table') === 'table'
    })
    const orderedTables = orderTablesForSqlExport(exportTables, exportRelations)
    const groupsById = new Map(s.groups.map(group => [group.id, group]))
    const commentsByGroupId = new Map<string, CommentBox[]>()
    for (const c of s.comments) {
      const tableInGroup = s.tables.find(_t =>
        _t.groupId &&
        c.position.x >= s.groups.find(g => g.id === _t.groupId)!.position.x &&
        c.position.x <= s.groups.find(g => g.id === _t.groupId)!.position.x + s.groups.find(g => g.id === _t.groupId)!.size.w &&
        c.position.y >= s.groups.find(g => g.id === _t.groupId)!.position.y &&
        c.position.y <= s.groups.find(g => g.id === _t.groupId)!.position.y + s.groups.find(g => g.id === _t.groupId)!.size.h
      )
      if (tableInGroup) {
        // found
      }
    }
    // RE-EVALUATE: The CommentBox doesn't have a groupId. I need to find which group it's inside.
    for (const g of s.groups) {
      const inGroup = s.comments.filter(c =>
        c.position.x >= g.position.x &&
        c.position.x <= g.position.x + g.size.w &&
        c.position.y >= g.position.y &&
        c.position.y <= g.position.y + g.size.h
      )
      if (inGroup.length > 0) commentsByGroupId.set(g.id, inGroup)
    }

    const tableById = new Map(exportTables.map(table => [table.id, table]))
    const createdTableIds = new Set<string>()
    const deferredConstraints: string[] = []
    let previousGroupId: string | null | undefined = undefined

    for (const table of orderedTables) {
      const groupId = table.groupId ?? null
      if (groupId !== previousGroupId) {
        if (groupId) {
          const group = groupsById.get(groupId)
          if (group) {
            lines.push(`-- Group: ${group.name}`)
            const groupComments = commentsByGroupId.get(groupId)
            if (groupComments) {
              for (const gc of groupComments) {
                const commentLines = gc.text.split('\n')
                for (const cl of commentLines) lines.push(`-- ${cl}`)
              }
            }
            lines.push('')
          }
        } else if (previousGroupId !== undefined) {
          lines.push('-- Ungrouped Tables', '')
        }
        previousGroupId = groupId
      }

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
      for (const rel of exportRelations) {
        if (rel.targetTableId === table.id) {
          const src  = tableById.get(rel.sourceTableId)
          const tcol = table.columns.find(c => c.id === rel.targetColumnId)
          const scol = src?.columns.find(c => c.id === rel.sourceColumnId)
          if (!src || !scol || !tcol || rel.type === 'many-to-many') continue

          const constraintClause =
            `FOREIGN KEY (${tcol.name}) REFERENCES ${src.name}(${scol.name}) ON DELETE CASCADE`

          if (src.id === table.id || createdTableIds.has(src.id)) {
            colDefs.push(`  ${constraintClause}`)
            continue
          }

          if (supportsDeferredForeignKeys(dialect)) {
            deferredConstraints.push(
              `ALTER TABLE ${table.name} ADD CONSTRAINT ${constraintNameForRelation(table.name, tcol.name, rel.id)} ${constraintClause};`,
            )
          } else {
            lines.push(`-- Warning: ${table.name}.${tcol.name} references ${src.name}.${scol.name} before it is created in this export.`)
          }
        }
      }
      lines.push(colDefs.join(',\n')); lines.push(');'); lines.push('')
      createdTableIds.add(table.id)
    }

    if (deferredConstraints.length > 0) {
      lines.push('-- Deferred foreign key constraints', '')
      lines.push(...deferredConstraints, '')
    }

    // Indices (especially for PGVector HNSW)
    const hnswIndices: string[] = []
    if (dialect === 'postgresql') {
      for (const t of exportTables) {
        for (const col of t.columns) {
          if (col.type.toUpperCase().startsWith('VECTOR')) {
            hnswIndices.push(`CREATE INDEX ON ${t.name} USING hnsw (${col.name} vector_cosine_ops);`)
          }
        }
      }
    }
    if (hnswIndices.length > 0) {
      lines.push('-- Vector indices', '')
      lines.push(...hnswIndices, '')
    }

    if (resourceTables.value.length > 0) {
      lines.push('-- External resources (not emitted as SQL tables)', '')
      for (const resource of resourceTables.value) {
        lines.push(`-- ${resource.name} [${resource.resourceType ?? 'external-service'}]`)
      }
      lines.push('')
    }
    return `${lines.join('\n').trim()}\n`
  }

  function exportMermaid(styled = true): string {
    const s = schema.value
    const tableById = new Map(s.tables.map(table => [table.id, table]))
    const childGroupsByParentId = new Map<string | null, typeof s.groups>()
    for (const group of s.groups) {
      const key = group.parentGroupId ?? null
      const current = childGroupsByParentId.get(key) ?? []
      childGroupsByParentId.set(key, [...current, group])
    }

    const lines: string[] = ['flowchart LR']
    if (styled) {
      lines.push(
        '  classDef table fill:#13231d,stroke:#3ECF8E,color:#d7f8e7,stroke-width:1px;',
        '  classDef resource fill:#122235,stroke:#38BDF8,color:#d7efff,stroke-width:1px;',
        '  classDef export fill:#14311f,stroke:#22C55E,color:#dcfce7,stroke-width:1px;',
        '  classDef group fill:#0f1218,stroke:#4b5563,color:#cbd5e1,stroke-dasharray: 6 4;',
        '',
      )
    } else {
      lines.push('')
    }

    const tableNodeIds = new Map<string, string>()
    for (const table of s.tables) {
      tableNodeIds.set(table.id, mermaidNodeId((table.kind ?? 'table') === 'resource' ? 'resource' : 'table', table.id))
    }

    const renderTableNode = (table: Table) => {
      const nodeId = tableNodeIds.get(table.id)!
      if ((table.kind ?? 'table') === 'resource') {
        const label = `${resourceLabelForType(table.resourceType)}<br/><b>${escapeMermaidText(table.name)}</b><br/>${escapeMermaidText(resourcePortLabel(table.resourceType))}`
        const className = table.resourceType === 'data-export' ? 'export' : 'resource'
        lines.push(`  ${nodeId}(["${label}"])`)
        if (styled) lines.push(`  class ${nodeId} ${className};`)
        return
      }

      const columnLines = table.columns.map(column => {
        const flags = [
          column.primaryKey ? 'PK' : '',
          column.unique && !column.primaryKey ? 'UNIQUE' : '',
          column.nullable ? 'NULL' : 'NOT NULL',
        ].filter(Boolean).join(' ')
        return `${escapeMermaidText(column.name)}: ${escapeMermaidText(column.type)}${flags ? ` ${flags}` : ''}`
      })
      const label = `<b>${escapeMermaidText(table.name)}</b><br/>${columnLines.join('<br/>')}`
      lines.push(`  ${nodeId}["${label}"]`)
      if (styled) lines.push(`  class ${nodeId} table;`)
    }

    const renderGroup = (groupId: string | null, depth = 0) => {
      const indent = '  '.repeat(depth + 1)
      const childGroups = childGroupsByParentId.get(groupId) ?? []
      const tables = s.tables.filter(table => (table.groupId ?? null) === groupId)

      for (const group of childGroups) {
        const mermaidGroupId = mermaidNodeId('group', group.id)
        lines.push(`${indent}subgraph ${mermaidGroupId}["${escapeMermaidText(group.name)}"]`)
        renderGroup(group.id, depth + 1)
        lines.push(`${indent}end`)
        if (styled) lines.push(`${indent}class ${mermaidGroupId} group;`)
      }

      for (const table of tables) {
        renderTableNode(table)
      }
    }

    renderGroup(null)
    lines.push('')

    const resolveMermaidRelation = (
      sourceTable: Table,
      targetTable: Table,
      sourceColumn: Column | undefined,
      targetColumn: Column | undefined,
    ) => {
      const sourceNodeId = tableNodeIds.get(sourceTable.id)!
      const targetNodeId = tableNodeIds.get(targetTable.id)!
      const sourceIsResource = (sourceTable.kind ?? 'table') === 'resource'
      const targetIsResource = (targetTable.kind ?? 'table') === 'resource'
      const sourceOwnsKey = !!(sourceColumn && (sourceColumn.primaryKey || sourceColumn.unique))
      const targetOwnsKey = !!(targetColumn && (targetColumn.primaryKey || targetColumn.unique))

      // Stored relation meaning:
      // source_table.source_column REFERENCES target_table.target_column
      // For normal FK relations, Mermaid must render parent(target) --> child(source).
      if (!sourceIsResource && !targetIsResource) {
        return {
          fromNodeId: targetNodeId,
          toNodeId: sourceNodeId,
          text: sourceColumn && targetColumn ? `${targetColumn.name} <- ${sourceColumn.name}` : '',
        }
      }

      // Resource relations split into two cases:
      // 1. table column stores/sends a value into the resource => table -> resource
      // 2. resource owns a key referenced by a keyed table column => resource -> table
      if (sourceIsResource && !targetIsResource) {
        if (targetOwnsKey) {
          return {
            fromNodeId: sourceNodeId,
            toNodeId: targetNodeId,
            text: sourceColumn && targetColumn ? `${sourceColumn.name} -> ${targetColumn.name}` : '',
          }
        }
        return {
          fromNodeId: targetNodeId,
          toNodeId: sourceNodeId,
          text: sourceColumn && targetColumn ? `${targetColumn.name} -> ${sourceColumn.name}` : '',
        }
      }

      if (targetIsResource && !sourceIsResource) {
        if (sourceOwnsKey) {
          return {
            fromNodeId: targetNodeId,
            toNodeId: sourceNodeId,
            text: sourceColumn && targetColumn ? `${targetColumn.name} -> ${sourceColumn.name}` : '',
          }
        }
        return {
          fromNodeId: sourceNodeId,
          toNodeId: targetNodeId,
          text: sourceColumn && targetColumn ? `${sourceColumn.name} -> ${targetColumn.name}` : '',
        }
      }

      // Resource-to-resource fallback: preserve stored direction.
      return {
        fromNodeId: sourceNodeId,
        toNodeId: targetNodeId,
        text: sourceColumn && targetColumn ? `${sourceColumn.name} -> ${targetColumn.name}` : '',
      }
    }

    for (const relation of s.relations) {
      const sourceTable = tableById.get(relation.sourceTableId)
      const targetTable = tableById.get(relation.targetTableId)
      if (!sourceTable || !targetTable) continue

      const sourceColumn = sourceTable.columns.find(column => column.id === relation.sourceColumnId)
      const targetColumn = targetTable.columns.find(column => column.id === relation.targetColumnId)
      const relationDirection = resolveMermaidRelation(sourceTable, targetTable, sourceColumn, targetColumn)
      const relationText = [
        relation.label?.trim() || '',
        relationDirection.text,
        relationLabel(relation.type),
      ].filter(Boolean).join(' | ')
      lines.push(`  ${relationDirection.fromNodeId} -->|"${escapeMermaidText(relationText)}"| ${relationDirection.toNodeId}`)
    }

    return lines.join('\n')
  }

  function exportSVG(styled = true): string {
    const s = schema.value
    const margin = 48
    const tableById = new Map(s.tables.map(table => [table.id, table]))
    const items: { x: number; y: number; w: number; h: number }[] = [
      ...s.tables.map(table => ({
        x: table.position.x,
        y: table.position.y,
        w: table.width ?? TABLE_WIDTH,
        h: tableVisualHeight(table),
      })),
      ...s.groups.map(group => ({
        x: group.position.x,
        y: group.position.y,
        w: group.size.w,
        h: group.size.h,
      })),
      ...s.comments.map(comment => ({
        x: comment.position.x,
        y: comment.position.y,
        w: comment.size.w,
        h: comment.size.h,
      })),
    ]

    if (items.length === 0) {
      items.push({ x: 0, y: 0, w: 800, h: 600 })
    }

    const minX = Math.min(...items.map(item => item.x)) - margin
    const minY = Math.min(...items.map(item => item.y)) - margin
    const maxX = Math.max(...items.map(item => item.x + item.w)) + margin
    const maxY = Math.max(...items.map(item => item.y + item.h)) + margin
    const width = Math.max(400, maxX - minX)
    const height = Math.max(300, maxY - minY)
    const offsetX = -minX
    const offsetY = -minY

    const lines: string[] = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${svgText(s.name || 'DB Designer export')}">`,
      '  <defs>',
      ...(styled
        ? [
            '    <linearGradient id="dbd-bg" x1="0" y1="0" x2="1" y2="1">',
            '      <stop offset="0%" stop-color="#f8fbff" />',
            '      <stop offset="100%" stop-color="#e7eef7" />',
            '    </linearGradient>',
          ]
        : []),
      '    <marker id="dbd-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">',
      `      <polygon points="0 0, 10 3.5, 0 7" fill="${styled ? '#0f172a' : '#111111'}" opacity="0.95" />`,
      '    </marker>',
      '    <style>',
      '      text { font-family: Arial, sans-serif; }',
      '      .title { font-size: 22px; font-weight: 700; fill: #0f172a; }',
      '      .subtitle { font-size: 12px; fill: #475569; }',
      '      .group-label { font-size: 12px; font-weight: 700; fill: #1e293b; letter-spacing: 0.08em; text-transform: uppercase; }',
      '      .table-name { font-size: 14px; font-weight: 700; fill: #0f172a; }',
      '      .table-kicker { font-size: 10px; fill: #475569; letter-spacing: 0.12em; text-transform: uppercase; }',
      '      .column-text { font-size: 12px; fill: #0f172a; }',
      '      .comment-text { font-size: 11px; fill: #475569; }',
      '      .relation-text { font-size: 11px; fill: #0f172a; font-weight: 700; }',
      '    </style>',
      '  </defs>',
      `  <rect width="100%" height="100%" fill="${styled ? 'url(#dbd-bg)' : '#ffffff'}" />`,
      `  <text x="28" y="34" class="title">${svgText(s.name || 'DB Designer Diagram')}</text>`,
      `  <text x="28" y="54" class="subtitle">Generated ${svgText(new Date().toISOString())}</text>`,
    ]

    for (const group of s.groups) {
      const x = group.position.x + offsetX
      const y = group.position.y + offsetY
      lines.push(`  <rect x="${x}" y="${y}" width="${group.size.w}" height="${group.size.h}" rx="18" fill="${styled ? 'rgba(255,255,255,0.7)' : 'transparent'}" stroke="${styled ? group.color : '#64748b'}" stroke-opacity="${styled ? '0.72' : '1'}" stroke-width="1.6" stroke-dasharray="10 6" />`)
      lines.push(`  <text x="${x + 18}" y="${y + 28}" class="group-label">${svgText(group.name)}</text>`)
    }

    for (const comment of s.comments) {
      const x = comment.position.x + offsetX
      const y = comment.position.y + offsetY
      const color = comment.color || '#FDE68A'
      lines.push(`  <rect x="${x}" y="${y}" width="${comment.size.w}" height="${comment.size.h}" rx="16" fill="${styled ? color : '#ffffff'}" fill-opacity="${styled ? '0.14' : '1'}" stroke="${styled ? color : '#64748b'}" stroke-opacity="${styled ? '0.5' : '1'}" stroke-width="1.2" />`)
      lines.push(`  <text x="${x + 16}" y="${y + 24}" class="table-kicker">NOTE</text>`)
      const textLines = (comment.text || '').split(/\r?\n/).slice(0, 6)
      textLines.forEach((line, index) => {
        lines.push(`  <text x="${x + 16}" y="${y + 46 + index * 16}" class="comment-text">${svgText(line)}</text>`)
      })
    }

    for (const relation of s.relations) {
      const sourceTable = tableById.get(relation.sourceTableId)
      const targetTable = tableById.get(relation.targetTableId)
      if (sourceTable && targetTable) {
        const shiftedSource = {
          x: connectorPosition(sourceTable, relation.sourceColumnId, relationSourceSide(relation)).x + offsetX,
          y: connectorPosition(sourceTable, relation.sourceColumnId, relationSourceSide(relation)).y + offsetY,
        }
        const shiftedTarget = {
          x: connectorPosition(targetTable, relation.targetColumnId, relationTargetSide(relation)).x + offsetX,
          y: connectorPosition(targetTable, relation.targetColumnId, relationTargetSide(relation)).y + offsetY,
        }
        const shiftedPoints = [
          shiftedSource,
          ...(relation.waypoints ?? []).map(point => ({ x: point.x + offsetX, y: point.y + offsetY })),
          shiftedTarget,
        ]
        const shiftedPath = shiftedPoints.length === 2
          ? makeCurveSegment(shiftedPoints[0], shiftedPoints[1])
          : shiftedPoints
              .slice(0, -1)
              .map((point, index) => makeCurveSegment(point, shiftedPoints[index + 1], index === 0))
              .join(' ')
        lines.push(`  <path d="${shiftedPath}" fill="none" stroke="#0f172a" stroke-opacity="0.88" stroke-width="2.1" stroke-dasharray="${styled ? '5 3' : 'none'}" marker-end="url(#dbd-arrow)" />`)

        const source = connectorPosition(sourceTable, relation.sourceColumnId, relationSourceSide(relation))
        const target = connectorPosition(targetTable, relation.targetColumnId, relationTargetSide(relation))
        const midX = (source.x + target.x) / 2 + offsetX
        const midY = (source.y + target.y) / 2 + offsetY - 8
        const sourceColumn = sourceTable.columns.find(column => column.id === relation.sourceColumnId)
        const targetColumn = targetTable.columns.find(column => column.id === relation.targetColumnId)
        const relationText = [
          relationLabel(relation.type),
          sourceColumn && targetColumn ? `${sourceColumn.name} -> ${targetColumn.name}` : '',
        ].filter(Boolean).join(' | ')
        lines.push(`  <text x="${midX}" y="${midY}" text-anchor="middle" class="relation-text">${svgText(relationText)}</text>`)
      }
    }

    for (const table of s.tables) {
      const x = table.position.x + offsetX
      const y = table.position.y + offsetY
      const widthPx = table.width ?? TABLE_WIDTH
      const heightPx = tableVisualHeight(table)

      if ((table.kind ?? 'table') === 'resource') {
        lines.push(`  <rect x="${x}" y="${y}" width="${widthPx}" height="${heightPx}" rx="16" fill="#ffffff" stroke="${styled ? table.color : '#111111'}" stroke-opacity="0.82" stroke-width="1.6" />`)
        lines.push(`  <text x="${x + 16}" y="${y + 22}" class="table-kicker">${svgText(resourceLabelForType(table.resourceType))}</text>`)
        lines.push(`  <text x="${x + 16}" y="${y + 42}" class="table-name">${svgText(table.name)}</text>`)
        lines.push(`  <rect x="${x + 14}" y="${y + 54}" width="${widthPx - 28}" height="34" rx="10" fill="${styled ? '#f8fafc' : '#ffffff'}" stroke="${styled ? table.color : '#64748b'}" stroke-opacity="0.5" stroke-dasharray="${styled ? '5 4' : 'none'}" />`)
        lines.push(`  <text x="${x + widthPx / 2}" y="${y + 75}" text-anchor="middle" class="column-text">${svgText(resourcePortLabel(table.resourceType))}</text>`)
        if (table.comment) {
          lines.push(`  <text x="${x + 16}" y="${y + 106}" class="comment-text">${svgText(table.comment)}</text>`)
        }
        continue
      }

      lines.push(`  <rect x="${x}" y="${y}" width="${widthPx}" height="${heightPx}" rx="14" fill="#ffffff" stroke="${styled ? table.color : '#111111'}" stroke-opacity="0.85" stroke-width="1.6" />`)
      lines.push(`  <rect x="${x}" y="${y}" width="${widthPx}" height="${TABLE_HEADER_H}" rx="14" fill="${styled ? table.color : '#111111'}" fill-opacity="${styled ? '0.18' : '0.06'}" />`)
      lines.push(`  <text x="${x + 16}" y="${y + 18}" class="table-kicker">TABLE</text>`)
      lines.push(`  <text x="${x + 16}" y="${y + 34}" class="table-name">${svgText(table.name)}</text>`)

      table.columns.forEach((column, index) => {
        const rowY = y + TABLE_HEADER_H + TABLE_COL_PAD_TOP + index * TABLE_ROW_H
        const flags = [
          column.primaryKey ? 'PK' : '',
          column.unique && !column.primaryKey ? 'UNIQUE' : '',
          column.nullable ? 'NULL' : 'NOT NULL',
        ].filter(Boolean).join(' ')
        lines.push(`  <line x1="${x + 10}" y1="${rowY}" x2="${x + widthPx - 10}" y2="${rowY}" stroke="#cbd5e1" stroke-width="1" />`)
        lines.push(`  <text x="${x + 16}" y="${rowY + 21}" class="column-text">${svgText(column.name)}</text>`)
        lines.push(`  <text x="${x + widthPx - 16}" y="${rowY + 21}" text-anchor="end" class="column-text">${svgText(`${column.type}${flags ? ` | ${flags}` : ''}`)}</text>`)
      })
    }

    lines.push('</svg>')
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
    if (!json.comments) json.comments = []
    // @ts-ignore
    json.groups = json.groups.map(g => ({ parentGroupId: null, ...g }))
    // @ts-ignore
    json.relations = json.relations.map(r => ({
      waypoints: [],
      sourceSide: 'left',
      targetSide: 'right',
      ...r,
    }))
    // @ts-ignore
    json.comments = json.comments.map(comment => ({
      ...comment,
      size: comment.size ?? { w: 280, h: 120 },
      color: comment.color ?? '#FDE68A',
    }))
    // @ts-ignore
    json.tables = json.tables.map(t => ({
      ...t,
      kind: t.kind ?? 'table',
      resourceType: t.resourceType ?? null,
      groupId: t.groupId ?? null,
      groupLocked: t.groupLocked ?? false,
      immutable: t.immutable ?? false,
      width: t.width ?? TABLE_WIDTH,
      columns: (t.columns ?? []).map(c => ({
        ...c,
        nullable: c.nullable ?? true,
        immutable: c.immutable ?? false,
        dialectTypes: {
          ...(c.dialectTypes ?? {}),
          [json.dialect ?? 'postgresql']: c.type,
        },
      })),
    }))
    tabsStore.loadSchemaIntoNewTab(json)
    resetHistory()
    clearSelection()
  }

  function newSchema() {
    tabsStore.newTab()
    resetHistory()
    clearSelection()
  }

  function selectAllCanvas() {
    multiSelectedTableIds.value = new Set(sc().tables.map(table => table.id))
    multiSelectedGroupIds.value = new Set(sc().groups.map(group => group.id))
    multiSelectedCommentIds.value = new Set(sc().comments.map(comment => comment.id))
    selectedTableId.value = null
    selectedGroupId.value = null
    selectedCommentId.value = null
    selectedRelationId.value = null
  }

  function selectedCanvasItemIds() {
    const tableIds = multiSelectedTableIds.value.size > 0
      ? [...multiSelectedTableIds.value]
      : selectedTableId.value
        ? [selectedTableId.value]
        : []
    const groupIds = multiSelectedGroupIds.value.size > 0
      ? [...multiSelectedGroupIds.value]
      : selectedGroupId.value
        ? [selectedGroupId.value]
        : []
    const commentIds = multiSelectedCommentIds.value.size > 0
      ? [...multiSelectedCommentIds.value]
      : selectedCommentId.value
        ? [selectedCommentId.value]
        : []
    return { tableIds, groupIds, commentIds }
  }

  function copySelectedCanvasItems() {
    const { tableIds, groupIds, commentIds } = selectedCanvasItemIds()
    if (tableIds.length === 0 && groupIds.length === 0 && commentIds.length === 0) return
    copiedCanvasSelection.value = { tableIds: [...tableIds], groupIds: [...groupIds], commentIds: [...commentIds] }
  }

  function hasCopiedCanvasItems() {
    return !!copiedCanvasSelection.value &&
      (copiedCanvasSelection.value.tableIds.length > 0 || copiedCanvasSelection.value.groupIds.length > 0 || copiedCanvasSelection.value.commentIds.length > 0)
  }

  function duplicateCanvasItems(selectedTableIds: string[], selectedGroupIds: string[], selectedCommentIds: string[]) {
    const s = sc()

    if (selectedTableIds.length === 0 && selectedGroupIds.length === 0 && selectedCommentIds.length === 0) return

    const existingTableNames = s.tables.map(table => table.name)
    const existingGroupNames = s.groups.map(group => group.name)
    const groupIdMap = new Map<string, string>()
    const tableIdMap = new Map<string, string>()
    const nextGroups: TableGroup[] = []
    const nextTables: Table[] = []
    const nextComments: CommentBox[] = []

    for (const groupId of selectedGroupIds) {
      const group = s.groups.find(entry => entry.id === groupId)
      if (!group) continue
      const clonedId = uuidv4()
      groupIdMap.set(group.id, clonedId)
      const clonedGroup: TableGroup = {
        ...group,
        id: clonedId,
        name: uniqueCopyName(group.name, [...existingGroupNames, ...nextGroups.map(entry => entry.name)]),
        position: { x: group.position.x + 36, y: group.position.y + 36 },
        parentGroupId: group.parentGroupId,
      }
      nextGroups.push(clonedGroup)
    }

    for (const group of nextGroups) {
      if (group.parentGroupId && groupIdMap.has(group.parentGroupId)) {
        group.parentGroupId = groupIdMap.get(group.parentGroupId)!
      }
    }

    for (const tableId of selectedTableIds) {
      const table = s.tables.find(entry => entry.id === tableId)
      if (!table) continue
      const clonedId = uuidv4()
      tableIdMap.set(table.id, clonedId)
      const clonedTable: Table = {
        ...table,
        id: clonedId,
        name: uniqueCopyName(table.name, [...existingTableNames, ...nextTables.map(entry => entry.name)]),
        position: { x: table.position.x + 36, y: table.position.y + 36 },
        groupId: table.groupId && groupIdMap.has(table.groupId) ? groupIdMap.get(table.groupId)! : table.groupId,
        columns: table.columns.map(column => ({ ...column, id: uuidv4() })),
      }
      nextTables.push(clonedTable)
    }

    for (const commentId of selectedCommentIds) {
      const comment = s.comments.find(entry => entry.id === commentId)
      if (!comment) continue
      nextComments.push({
        ...comment,
        id: uuidv4(),
        position: { x: comment.position.x + 36, y: comment.position.y + 36 },
      })
    }

    const nextRelations: Relation[] = []
    for (const relation of s.relations) {
      if (!tableIdMap.has(relation.sourceTableId) || !tableIdMap.has(relation.targetTableId)) continue
      const sourceTable = s.tables.find(entry => entry.id === relation.sourceTableId)
      const targetTable = s.tables.find(entry => entry.id === relation.targetTableId)
      const clonedSourceTable = nextTables.find(entry => entry.id === tableIdMap.get(relation.sourceTableId))
      const clonedTargetTable = nextTables.find(entry => entry.id === tableIdMap.get(relation.targetTableId))
      if (!sourceTable || !targetTable || !clonedSourceTable || !clonedTargetTable) continue

      const sourceColumnIndex = sourceTable.columns.findIndex(column => column.id === relation.sourceColumnId)
      const targetColumnIndex = targetTable.columns.findIndex(column => column.id === relation.targetColumnId)
      if (sourceColumnIndex === -1 || targetColumnIndex === -1) continue

      nextRelations.push({
        ...relation,
        id: uuidv4(),
        sourceTableId: clonedSourceTable.id,
        sourceColumnId: clonedSourceTable.columns[sourceColumnIndex].id,
        targetTableId: clonedTargetTable.id,
        targetColumnId: clonedTargetTable.columns[targetColumnIndex].id,
        waypoints: relation.waypoints ? relation.waypoints.map(point => ({ x: point.x + 36, y: point.y + 36 })) : [],
      })
    }

    s.groups.push(...nextGroups)
    s.tables.push(...nextTables)
    s.comments.push(...nextComments)
    s.relations.push(...nextRelations)
    multiSelectedGroupIds.value = new Set(nextGroups.map(group => group.id))
    multiSelectedTableIds.value = new Set(nextTables.map(table => table.id))
    multiSelectedCommentIds.value = new Set(nextComments.map(comment => comment.id))
    selectedGroupId.value = null
    selectedTableId.value = null
    selectedCommentId.value = null
    selectedRelationId.value = null
    persist()
  }

  function duplicateSelectedCanvasItems() {
    const { tableIds, groupIds, commentIds } = selectedCanvasItemIds()
    duplicateCanvasItems(tableIds, groupIds, commentIds)
  }

  function pasteCopiedCanvasItems() {
    if (!copiedCanvasSelection.value) return
    duplicateCanvasItems(copiedCanvasSelection.value.tableIds, copiedCanvasSelection.value.groupIds, copiedCanvasSelection.value.commentIds)
  }

  function toggleTableSelection(tableId: string) {
    const next = new Set(multiSelectedTableIds.value)
    if (selectedTableId.value && selectedTableId.value !== tableId) next.add(selectedTableId.value)
    if (next.has(tableId)) next.delete(tableId)
    else next.add(tableId)
    multiSelectedTableIds.value = next
    selectedTableId.value = null
    selectedGroupId.value = null
    selectedRelationId.value = null
  }

  function toggleGroupSelection(groupId: string) {
    const next = new Set(multiSelectedGroupIds.value)
    if (selectedGroupId.value && selectedGroupId.value !== groupId) next.add(selectedGroupId.value)
    if (next.has(groupId)) next.delete(groupId)
    else next.add(groupId)
    multiSelectedGroupIds.value = next
    selectedTableId.value = null
    selectedGroupId.value = null
    selectedRelationId.value = null
  }

  function toggleCommentSelection(commentId: string) {
    const next = new Set(multiSelectedCommentIds.value)
    if (selectedCommentId.value && selectedCommentId.value !== commentId) next.add(selectedCommentId.value)
    if (next.has(commentId)) next.delete(commentId)
    else next.add(commentId)
    multiSelectedCommentIds.value = next
    selectedCommentId.value = null
    selectedTableId.value = null
    selectedGroupId.value = null
    selectedRelationId.value = null
  }

  function isDraftTable(tableId: string) {
    return draftTableIds.value.has(tableId)
  }

  function isDraftGroup(groupId: string) {
    return draftGroupIds.value.has(groupId)
  }

  function discardDraftTable(tableId: string) {
    if (isDraftTable(tableId)) deleteTable(tableId)
    else if (editingTableId.value === tableId) editingTableId.value = null
  }

  function discardDraftGroup(groupId: string) {
    if (isDraftGroup(groupId)) deleteGroup(groupId, false)
    else if (editingGroupId.value === groupId) editingGroupId.value = null
  }

  return {
    schema,
    selectedTableId, selectedRelationId, selectedGroupId, selectedCommentId, editingTableId, editingGroupId,
    multiSelectedTableIds, multiSelectedGroupIds, multiSelectedCommentIds,
    selectedTable, selectedGroup, selectedComment, clearSelection, showMinimap, lightExportMode,
    sqlTables, resourceTables,
    createTable, updateTable, deleteTable,
    createResource,
    addColumn, updateColumn, deleteColumn,
    updateTablePosition, updateTableWidth, commitTableWidth,
    addRelation, updateRelation, deleteRelation,
    createBridgeTableBetweenTables,
    createBridgeTableForRelation,
    createRagSystem, createAuditSystem,
    createGroup, updateGroup, deleteGroup,
    createComment, updateComment, deleteComment, updateCommentPosition, updateCommentSize, commitCommentSize,
    updateGroupPosition, commitGroupDrop,
    updateGroupSize, commitGroupSize,
    assignTableToGroup, toggleTableLock,
    updateSchemaMeta, setSchemaDialect,
    canUndo, canRedo, undo, redo,
    clearMultiSelection, selectAllCanvas, duplicateSelectedCanvasItems,
    copySelectedCanvasItems, pasteCopiedCanvasItems, hasCopiedCanvasItems,
    toggleTableSelection, toggleGroupSelection, toggleCommentSelection,
    isDraftTable, isDraftGroup, discardDraftTable, discardDraftGroup,
    exportSQL, exportMermaid, exportSVG, saveToFile, loadFromJSON, newSchema,
  }
})
