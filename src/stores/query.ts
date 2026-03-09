import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'

export interface QColumn {
  table: string
  column: string
  alias: string
  selected: boolean
  aggregate: '' | 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'
}

export interface QTable {
  id: string
  schemaTable: string
  alias: string
  position: { x: number; y: number }
  width: number
  columns: QColumn[]
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
  logic: WhereLogic
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

export const useQueryStore = defineStore('query', () => {
  const tables = ref<QTable[]>([])
  const joins = ref<QJoin[]>([])
  const wheres = ref<QWhere[]>([])
  const orders = ref<QOrderBy[]>([])
  const groups = ref<QGroupBy[]>([])
  const limit = ref<number | null>(null)
  const offset = ref<number | null>(null)
  const distinct = ref(false)

  const selectedTableId = ref<string | null>(null)
  const selectedJoinId = ref<string | null>(null)
  const drawingJoin = ref<{ fromTableId: string; fromColumn: string; mouseX: number; mouseY: number } | null>(null)
  const manualSql = ref<string | null>(null)

  function addTable(schemaTable: string, columns: string[], pos = { x: 100, y: 100 }): QTable {
    manualSql.value = null

    const existing = tables.value.find((table) => table.schemaTable === schemaTable)
    if (existing) {
      selectedTableId.value = existing.id
      selectedJoinId.value = null
      return existing
    }

    const table: QTable = {
      id: uuidv4(),
      schemaTable,
      alias: schemaTable,
      position: pos,
      width: 220,
      columns: columns.map((column) => ({
        table: schemaTable,
        column,
        alias: '',
        selected: false,
        aggregate: '',
      })),
    }

    tables.value.push(table)
    selectedTableId.value = table.id
    selectedJoinId.value = null
    return table
  }

  function removeTable(id: string) {
    manualSql.value = null
    const removed = tables.value.find((table) => table.id === id)
    if (!removed) return

    tables.value = tables.value.filter((table) => table.id !== id)
    joins.value = joins.value.filter((join) => join.leftTableId !== id && join.rightTableId !== id)
    wheres.value = wheres.value.filter((where) => where.tableAlias !== removed.alias)
    orders.value = orders.value.filter((order) => order.tableAlias !== removed.alias)
    groups.value = groups.value.filter((group) => group.tableAlias !== removed.alias)

    if (selectedTableId.value === id) selectedTableId.value = null
    if (selectedJoinId.value && !joins.value.some((join) => join.id === selectedJoinId.value)) {
      selectedJoinId.value = null
    }
  }

  function updateTablePosition(id: string, pos: { x: number; y: number }) {
    const table = tables.value.find((entry) => entry.id === id)
    if (table) table.position = pos
  }

  function toggleColumn(tableId: string, column: string) {
    manualSql.value = null
    const table = tables.value.find((entry) => entry.id === tableId)
    if (!table) return
    const selected = table.columns.find((entry) => entry.column === column)
    if (selected) selected.selected = !selected.selected
  }

  function setColumnAggregate(tableId: string, column: string, agg: QColumn['aggregate']) {
    manualSql.value = null
    const table = tables.value.find((entry) => entry.id === tableId)
    if (!table) return
    const selected = table.columns.find((entry) => entry.column === column)
    if (selected) {
      selected.aggregate = agg
      selected.selected = true
    }
  }

  function setColumnAlias(tableId: string, column: string, alias: string) {
    manualSql.value = null
    const table = tables.value.find((entry) => entry.id === tableId)
    if (!table) return
    const selected = table.columns.find((entry) => entry.column === column)
    if (selected) selected.alias = alias
  }

  function addJoin(leftTableId: string, leftColumn: string, rightTableId: string, rightColumn: string): QJoin {
    manualSql.value = null
    const join: QJoin = { id: uuidv4(), leftTableId, leftColumn, rightTableId, rightColumn, joinType: 'INNER' }
    joins.value.push(join)
    selectedJoinId.value = join.id
    selectedTableId.value = null
    return join
  }

  function updateJoinType(id: string, type: JoinType) {
    manualSql.value = null
    const join = joins.value.find((entry) => entry.id === id)
    if (join) join.joinType = type
  }

  function removeJoin(id: string) {
    manualSql.value = null
    joins.value = joins.value.filter((join) => join.id !== id)
    if (selectedJoinId.value === id) selectedJoinId.value = null
  }

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
    const where = wheres.value.find((entry) => entry.id === id)
    if (where) Object.assign(where, patch)
  }

  function removeWhere(id: string) {
    manualSql.value = null
    wheres.value = wheres.value.filter((where) => where.id !== id)
  }

  function addOrder() {
    manualSql.value = null
    const first = tables.value[0]
    orders.value.push({
      id: uuidv4(),
      tableAlias: first?.alias ?? '',
      column: first?.columns[0]?.column ?? '',
      dir: 'ASC',
    })
  }

  function updateOrder(id: string, patch: Partial<QOrderBy>) {
    manualSql.value = null
    const order = orders.value.find((entry) => entry.id === id)
    if (order) Object.assign(order, patch)
  }

  function removeOrder(id: string) {
    manualSql.value = null
    orders.value = orders.value.filter((order) => order.id !== id)
  }

  function addGroup() {
    manualSql.value = null
    const first = tables.value[0]
    groups.value.push({
      id: uuidv4(),
      tableAlias: first?.alias ?? '',
      column: first?.columns[0]?.column ?? '',
    })
  }

  function updateGroup(id: string, patch: Partial<QGroupBy>) {
    manualSql.value = null
    const group = groups.value.find((entry) => entry.id === id)
    if (group) Object.assign(group, patch)
  }

  function removeGroup(id: string) {
    manualSql.value = null
    groups.value = groups.value.filter((group) => group.id !== id)
  }

  const sql = computed({
    get: () => {
      if (manualSql.value !== null) return manualSql.value
      if (tables.value.length === 0) return '-- Drag tables onto the canvas to start designing your query'

      const lines: string[] = []
      lines.push('-- Generated SQL Query')

      const selectedCols = tables.value.flatMap((table) =>
        table.columns.filter((column) => column.selected).map((column) => {
          const ref = `${table.alias}.${column.column}`
          const expr = column.aggregate ? `${column.aggregate}(${ref})` : ref
          const as = column.alias ? ` AS ${column.alias}` : ''
          return `  ${expr}${as}`
        }),
      )

      lines.push(`SELECT${distinct.value ? ' DISTINCT' : ''}`)
      lines.push(selectedCols.length > 0 ? selectedCols.join(',\n') : '  *')

      const base = tables.value[0]
      const baseRef = base.schemaTable === base.alias ? base.alias : `${base.schemaTable} AS ${base.alias}`
      lines.push(`FROM ${baseRef}`)

      for (const join of joins.value) {
        const left = tables.value.find((table) => table.id === join.leftTableId)
        const right = tables.value.find((table) => table.id === join.rightTableId)
        if (!left || !right) continue
        const rightRef = right.schemaTable === right.alias ? right.alias : `${right.schemaTable} AS ${right.alias}`
        lines.push(`${join.joinType} JOIN ${rightRef}`)
        lines.push(`  ON ${left.alias}.${join.leftColumn} = ${right.alias}.${join.rightColumn}`)
      }

      if (wheres.value.length > 0) {
        lines.push('WHERE')
        wheres.value.forEach((where, index) => {
          const needsValue = !['IS NULL', 'IS NOT NULL'].includes(where.op)
          const value = needsValue
            ? where.op === 'LIKE'
              ? `'${where.value}'`
              : where.op === 'IN'
                ? `(${where.value})`
                : `'${where.value}'`
            : ''
          const clause = `  ${where.tableAlias}.${where.column} ${where.op}${value ? ` ${value}` : ''}`
          const connector = index < wheres.value.length - 1 ? ` ${where.logic}` : ''
          lines.push(clause + connector)
        })
      }

      if (groups.value.length > 0) {
        lines.push('GROUP BY')
        lines.push(groups.value.map((group) => `  ${group.tableAlias}.${group.column}`).join(',\n'))
      }

      if (orders.value.length > 0) {
        lines.push('ORDER BY')
        lines.push(orders.value.map((order) => `  ${order.tableAlias}.${order.column} ${order.dir}`).join(',\n'))
      }

      if (limit.value !== null) lines.push(`LIMIT ${limit.value}`)
      if (offset.value !== null) lines.push(`OFFSET ${offset.value}`)

      return `${lines.join('\n')};`
    },
    set: (value: string) => {
      manualSql.value = value
    },
  })

  function reset() {
    tables.value = []
    joins.value = []
    wheres.value = []
    orders.value = []
    groups.value = []
    limit.value = null
    offset.value = null
    distinct.value = false
    selectedTableId.value = null
    selectedJoinId.value = null
    manualSql.value = null
  }

  function resetManualSql() {
    manualSql.value = null
  }

  return {
    tables,
    joins,
    wheres,
    orders,
    groups,
    limit,
    offset,
    distinct,
    selectedTableId,
    selectedJoinId,
    drawingJoin,
    sql,
    addTable,
    removeTable,
    updateTablePosition,
    toggleColumn,
    setColumnAggregate,
    setColumnAlias,
    addJoin,
    updateJoinType,
    removeJoin,
    addWhere,
    updateWhere,
    removeWhere,
    addOrder,
    updateOrder,
    removeOrder,
    addGroup,
    updateGroup,
    removeGroup,
    reset,
    resetManualSql,
  }
})
