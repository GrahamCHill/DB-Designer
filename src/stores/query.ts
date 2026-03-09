import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QColumn {
  table: string     // alias
  column: string
  alias: string
  selected: boolean
  aggregate: '' | 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'
}

export interface QTable {
  id: string
  schemaTable: string   // original table name from schema
  alias: string
  position: { x: number; y: number }
  width: number
  columns: QColumn[]    // columns from the schema, selectable
}

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'

export interface QJoin {
  id: string
  leftTableId: string
  leftColumn: string
  rightTableId: string
  rightColumn: string
  joinType: JoinType
}

export type WhereOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL'
export type WhereLogic = 'AND' | 'OR'

export interface QWhere {
  id: string
  tableAlias: string
  column: string
  op: WhereOp
  value: string
  logic: WhereLogic   // connector to the next clause
}

export interface QOrderBy {
  id: string
  tableAlias: string
  column: string
  dir: 'ASC' | 'DESC'
}

export interface QGroupBy {
  id: string
  tableAlias: string
  column: string
}

export interface QueryState {
  tables:  QTable[]
  joins:   QJoin[]
  wheres:  QWhere[]
  orders:  QOrderBy[]
  groups:  QGroupBy[]
  limit:   number | null
  offset:  number | null
  distinct: boolean
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useQueryStore = defineStore('query', () => {

  const tables  = ref<QTable[]>([])
  const joins   = ref<QJoin[]>([])
  const wheres  = ref<QWhere[]>([])
  const orders  = ref<QOrderBy[]>([])
  const groups  = ref<QGroupBy[]>([])
  const limit   = ref<number | null>(null)
  const offset  = ref<number | null>(null)
  const distinct = ref(false)

  const selectedTableId = ref<string | null>(null)
  const selectedJoinId  = ref<string | null>(null)
  const drawingJoin = ref<{ fromTableId: string; fromColumn: string; mouseX: number; mouseY: number } | null>(null)

  // ── Add table from schema ──────────────────────────────────────────────────
  function addTable(schemaTable: string, columns: string[], pos = { x: 100, y: 100 }): QTable {
    manualSql.value = null
    const existing = tables.value.filter(t => t.schemaTable === schemaTable)
    const alias = existing.length === 0 ? schemaTable : `${schemaTable}_${existing.length + 1}`
    const t: QTable = {
      id: uuidv4(),
      schemaTable,
      alias,
      position: pos,
      width: 220,
      columns: columns.map(c => ({
        table: alias, column: c, alias: '', selected: false, aggregate: '',
      })),
    }
    tables.value.push(t)
    selectedTableId.value = t.id
    return t
  }

  function removeTable(id: string) {
    manualSql.value = null
    tables.value  = tables.value.filter(t => t.id !== id)
    joins.value   = joins.value.filter(j => j.leftTableId !== id && j.rightTableId !== id)
    wheres.value  = wheres.value.filter(w => {
      const t = tables.value.find(t => t.id === id)
      return t ? w.tableAlias !== t.alias : true
    })
    if (selectedTableId.value === id) selectedTableId.value = null
  }

  function updateTablePosition(id: string, pos: { x: number; y: number }) {
    const t = tables.value.find(t => t.id === id)
    if (t) t.position = pos
  }

  function toggleColumn(tableId: string, column: string) {
    manualSql.value = null
    const t = tables.value.find(t => t.id === tableId)
    if (!t) return
    const c = t.columns.find(c => c.column === column)
    if (c) c.selected = !c.selected
  }

  function setColumnAggregate(tableId: string, column: string, agg: QColumn['aggregate']) {
    manualSql.value = null
    const t = tables.value.find(t => t.id === tableId)
    if (!t) return
    const c = t.columns.find(c => c.column === column)
    if (c) { c.aggregate = agg; c.selected = true }
  }

  function setColumnAlias(tableId: string, column: string, alias: string) {
    manualSql.value = null
    const t = tables.value.find(t => t.id === tableId)
    if (!t) return
    const c = t.columns.find(c => c.column === column)
    if (c) c.alias = alias
  }

  // ── Joins ──────────────────────────────────────────────────────────────────
  function addJoin(leftTableId: string, leftColumn: string, rightTableId: string, rightColumn: string): QJoin {
    manualSql.value = null
    const j: QJoin = { id: uuidv4(), leftTableId, leftColumn, rightTableId, rightColumn, joinType: 'INNER' }
    joins.value.push(j)
    selectedJoinId.value = j.id
    return j
  }

  function updateJoinType(id: string, t: JoinType) {
    manualSql.value = null
    const j = joins.value.find(j => j.id === id)
    if (j) j.joinType = t
  }

  function removeJoin(id: string) {
    manualSql.value = null
    joins.value = joins.value.filter(j => j.id !== id)
    if (selectedJoinId.value === id) selectedJoinId.value = null
  }

  // ── WHERE ──────────────────────────────────────────────────────────────────
  function addWhere() {
    manualSql.value = null
    const first = tables.value[0]
    wheres.value.push({
      id: uuidv4(),
      tableAlias: first?.alias ?? '',
      column: first?.columns[0]?.column ?? '',
      op: '=',
      value: '',
      logic: 'AND',
    })
  }

  function updateWhere(id: string, patch: Partial<QWhere>) {
    manualSql.value = null
    const w = wheres.value.find(w => w.id === id)
    if (w) Object.assign(w, patch)
  }

  function removeWhere(id: string) { 
    manualSql.value = null
    wheres.value = wheres.value.filter(w => w.id !== id) 
  }

  // ── ORDER BY ───────────────────────────────────────────────────────────────
  function addOrder() {
    manualSql.value = null
    const first = tables.value[0]
    orders.value.push({ id: uuidv4(), tableAlias: first?.alias ?? '', column: first?.columns[0]?.column ?? '', dir: 'ASC' })
  }

  function updateOrder(id: string, patch: Partial<QOrderBy>) {
    manualSql.value = null
    const o = orders.value.find(o => o.id === id)
    if (o) Object.assign(o, patch)
  }

  function removeOrder(id: string) { 
    manualSql.value = null
    orders.value = orders.value.filter(o => o.id !== id) 
  }

  // ── GROUP BY ───────────────────────────────────────────────────────────────
  function addGroup() {
    manualSql.value = null
    const first = tables.value[0]
    groups.value.push({ id: uuidv4(), tableAlias: first?.alias ?? '', column: first?.columns[0]?.column ?? '' })
  }

  function updateGroup(id: string, patch: Partial<QGroupBy>) {
    manualSql.value = null
    const g = groups.value.find(g => g.id === id)
    if (g) Object.assign(g, patch)
  }

  function removeGroup(id: string) { 
    manualSql.value = null
    groups.value = groups.value.filter(g => g.id !== id) 
  }

  const manualSql = ref<string | null>(null)
  const sql = computed({
    get: () => {
      console.log('SQL Getter called. Tables:', tables.value.length, 'ManualSql:', manualSql.value !== null)
      if (manualSql.value !== null) return manualSql.value
      if (tables.value.length === 0) return '-- Drag tables onto the canvas to start designing your query'

      const lines: string[] = []
      lines.push('-- Generated SQL Query')

      // SELECT
      const selectedCols = tables.value.flatMap(t =>
        t.columns.filter(c => c.selected).map(c => {
          const ref = `${t.alias}.${c.column}`
          const expr = c.aggregate ? `${c.aggregate}(${ref})` : ref
          const as = c.alias ? ` AS ${c.alias}` : ''
          return `  ${expr}${as}`
        })
      )

      const selectBody = selectedCols.length > 0 ? selectedCols.join(',\n') : `  *`
      lines.push(`SELECT${distinct.value ? ' DISTINCT' : ''}`)
      lines.push(selectBody)

      // FROM
      if (tables.value.length > 0) {
        const base = tables.value[0]
        const baseRef = base.schemaTable === base.alias ? base.alias : `${base.schemaTable} AS ${base.alias}`
        lines.push(`FROM ${baseRef}`)
      }

      // JOINs
      for (const join of joins.value) {
        const lt = tables.value.find(t => t.id === join.leftTableId)
        const rt = tables.value.find(t => t.id === join.rightTableId)
        if (!lt || !rt) continue
        const rtRef = rt.schemaTable === rt.alias ? rt.alias : `${rt.schemaTable} AS ${rt.alias}`
        lines.push(`${join.joinType} JOIN ${rtRef}`)
        lines.push(`  ON ${lt.alias}.${join.leftColumn} = ${rt.alias}.${join.rightColumn}`)
      }

      // WHERE
      if (wheres.value.length > 0) {
        lines.push('WHERE')
        wheres.value.forEach((w, i) => {
          const needsValue = !['IS NULL', 'IS NOT NULL'].includes(w.op)
          const val = needsValue ? (w.op === 'LIKE' ? `'${w.value}'` : w.op === 'IN' ? `(${w.value})` : `'${w.value}'`) : ''
          const clause = `  ${w.tableAlias}.${w.column} ${w.op}${val ? ' ' + val : ''}`
          const connector = i < wheres.value.length - 1 ? ` ${w.logic}` : ''
          lines.push(clause + connector)
        })
      }

      // GROUP BY
      if (groups.value.length > 0) {
        lines.push('GROUP BY')
        lines.push(groups.value.map(g => `  ${g.tableAlias}.${g.column}`).join(',\n'))
      }

      // ORDER BY
      if (orders.value.length > 0) {
        lines.push('ORDER BY')
        lines.push(orders.value.map(o => `  ${o.tableAlias}.${o.column} ${o.dir}`).join(',\n'))
      }

      // LIMIT / OFFSET
      if (limit.value !== null) lines.push(`LIMIT ${limit.value}`)
      if (offset.value !== null) lines.push(`OFFSET ${offset.value}`)

      return lines.join('\n') + ';'
    },
    set: (val: string) => {
      manualSql.value = val
    }
  })

  function reset() {
    tables.value = []; joins.value = []; wheres.value = []
    orders.value = []; groups.value = []
    limit.value = null; offset.value = null; distinct.value = false
    selectedTableId.value = null; selectedJoinId.value = null
    manualSql.value = null
  }

  function resetManualSql() {
    manualSql.value = null
  }

  return {
    tables, joins, wheres, orders, groups, limit, offset, distinct,
    selectedTableId, selectedJoinId, drawingJoin, sql,
    addTable, removeTable, updateTablePosition, toggleColumn,
    setColumnAggregate, setColumnAlias,
    addJoin, updateJoinType, removeJoin,
    addWhere, updateWhere, removeWhere,
    addOrder, updateOrder, removeOrder,
    addGroup, updateGroup, removeGroup,
    reset, resetManualSql,
  }
})
