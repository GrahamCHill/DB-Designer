<template>
  <aside class="qsidebar">
    <div class="qpanel">
      <div class="qbrand">
        <span class="qbrand-icon">Q</span>
        <span class="qbrand-name">Query Builder</span>
      </div>

      <div class="qs-section">
        <div class="qs-section-label">Schema Source</div>
        <div class="schema-source-row">
          <span v-if="schemaName" class="schema-loaded">Loaded: {{ schemaName }}</span>
          <span v-else class="schema-none">No schema loaded</span>
          <label class="btn-xs">
            Load .dbm.json
            <input type="file" accept=".json" style="display: none" @change="loadSchema" />
          </label>
        </div>
        <button v-if="!schemaName && dbStore.schema.tables.length" class="btn-use-current" @click="useCurrentSchema">
          Use current DB schema
        </button>
      </div>

      <div class="qs-section flex-grow">
        <div class="qs-section-label">Tables <span class="cnt">{{ schemaTables.length }}</span></div>
        <div class="table-palette">
          <div
            v-for="table in schemaTables"
            :key="table.name"
            class="palette-table"
            :class="{ 'on-canvas': isOnCanvas(table.name) }"
            draggable="true"
            :title="isOnCanvas(table.name) ? 'Already in query' : 'Click or drag to add'"
            @dragstart="onDragStart($event, table.name)"
            @click="addToCanvas(table.name)"
          >
            <span class="pt-dot" :style="{ background: table.color }" />
            <span class="pt-name">{{ table.name }}</span>
            <span class="pt-cols">{{ table.columns.length }}c</span>
            <span class="pt-add">{{ isOnCanvas(table.name) ? '�' : '+' }}</span>
          </div>
          <div v-if="!schemaTables.length" class="palette-empty">Load a schema first</div>
        </div>
      </div>

      <div v-if="query.tables.length" class="qs-section">
        <div class="qs-section-label-row">
          <span>WHERE</span>
          <button class="btn-add-clause" @click="query.addWhere()">+ Add</button>
        </div>
        <div v-for="where in query.wheres" :key="where.id" class="clause-row">
          <select v-model="where.tableAlias" class="clause-select sm">
            <option v-for="table in query.tables" :key="table.id" :value="table.alias">{{ table.alias }}</option>
          </select>
          <select v-model="where.column" class="clause-select sm">
            <option v-for="column in columnsFor(where.tableAlias)" :key="column" :value="column">{{ column }}</option>
          </select>
          <select v-model="where.op" class="clause-select op">
            <option v-for="op in ops" :key="op" :value="op">{{ op }}</option>
          </select>
          <input v-if="!['IS NULL', 'IS NOT NULL'].includes(where.op)" v-model="where.value" class="clause-input" placeholder="value" />
          <select v-if="query.wheres.indexOf(where) < query.wheres.length - 1" v-model="where.logic" class="clause-select logic">
            <option>AND</option>
            <option>OR</option>
          </select>
          <button class="del-btn" @click="query.removeWhere(where.id)">x</button>
        </div>
      </div>

      <div v-if="query.tables.length" class="qs-section">
        <div class="qs-section-label-row">
          <span>GROUP BY</span>
          <button class="btn-add-clause" @click="query.addGroup()">+ Add</button>
        </div>
        <div v-for="group in query.groups" :key="group.id" class="clause-row">
          <select v-model="group.tableAlias" class="clause-select sm">
            <option v-for="table in query.tables" :key="table.id" :value="table.alias">{{ table.alias }}</option>
          </select>
          <select v-model="group.column" class="clause-select sm">
            <option v-for="column in columnsFor(group.tableAlias)" :key="column" :value="column">{{ column }}</option>
          </select>
          <button class="del-btn" @click="query.removeGroup(group.id)">x</button>
        </div>
      </div>

      <div v-if="query.tables.length" class="qs-section">
        <div class="qs-section-label-row">
          <span>ORDER BY</span>
          <button class="btn-add-clause" @click="query.addOrder()">+ Add</button>
        </div>
        <div v-for="order in query.orders" :key="order.id" class="clause-row">
          <select v-model="order.tableAlias" class="clause-select sm">
            <option v-for="table in query.tables" :key="table.id" :value="table.alias">{{ table.alias }}</option>
          </select>
          <select v-model="order.column" class="clause-select sm">
            <option v-for="column in columnsFor(order.tableAlias)" :key="column" :value="column">{{ column }}</option>
          </select>
          <select v-model="order.dir" class="clause-select logic">
            <option>ASC</option>
            <option>DESC</option>
          </select>
          <button class="del-btn" @click="query.removeOrder(order.id)">x</button>
        </div>
      </div>

      <div v-if="query.tables.length" class="qs-section">
        <div class="qs-section-label">Options</div>
        <div class="options-row">
          <label class="opt-check">
            <input v-model="query.distinct" type="checkbox" /> DISTINCT
          </label>
          <label class="opt-num">LIMIT <input v-model.number="query.limit" type="number" min="1" class="num-input" placeholder="-" /></label>
          <label class="opt-num">OFFSET <input v-model.number="query.offset" type="number" min="0" class="num-input" placeholder="-" /></label>
        </div>
      </div>

      <div v-if="query.tables.length" class="qs-section">
        <button class="btn-reset" @click="query.reset">Reset Query</button>
      </div>

      <div class="qfooter">
        <span class="qfooter-autosave">auto-saved</span>
        <span class="qfooter-version">{{ appVersionLabel }}</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQueryStore } from '../../stores/query'
import { useSchemaStore } from '../../stores/schema'

const query = useQueryStore()
const dbStore = useSchemaStore()
const appVersion = (import.meta.env.VITE_APP_VERSION || '').trim()
const appVersionLabel = appVersion ? `v${appVersion}` : 'dev'

const ops = ['=', '!=', '>', '>=', '<', '<=', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL']

interface SchemaTable {
  name: string
  color: string
  columns: { name: string }[]
}

const externalSchema = ref<SchemaTable[] | null>(null)
const schemaName = ref('')

const schemaTables = computed<SchemaTable[]>(() => {
  if (externalSchema.value) return externalSchema.value
  return dbStore.schema.tables.map((table) => ({
    name: table.name,
    color: table.color,
    columns: table.columns.map((column) => ({ name: column.name })),
  }))
})

function useCurrentSchema() {
  externalSchema.value = null
  schemaName.value = dbStore.schema.name || 'Current Schema'
}

function loadSchema(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const raw = JSON.parse(event.target?.result as string)
      const schema = raw.tables ? raw : raw.schema ?? raw
      externalSchema.value = (schema.tables ?? []).map((table: any) => ({
        name: table.name,
        color: table.color ?? '#3ECF8E',
        columns: (table.columns ?? []).map((column: any) => ({ name: column.name })),
      }))
      schemaName.value = schema.name ?? file.name
    } catch {
      alert('Could not parse schema file')
    }
  }
  reader.readAsText(file)
}

function isOnCanvas(name: string) {
  return query.tables.some((table) => table.schemaTable === name)
}

function addToCanvas(name: string) {
  const schemaTable = schemaTables.value.find((table) => table.name === name)
  if (!schemaTable) return
  const count = query.tables.length
  query.addTable(name, schemaTable.columns.map((column) => column.name), {
    x: 80 + (count % 4) * 60,
    y: 80 + Math.floor(count / 4) * 60,
  })
}

function onDragStart(e: DragEvent, name: string) {
  const schemaTable = schemaTables.value.find((table) => table.name === name)
  if (!schemaTable || !e.dataTransfer) return

  e.dataTransfer.setData('text/plain', name)
  e.dataTransfer.setData(
    'application/dbdesigner-query-table',
    JSON.stringify({ name, columns: schemaTable.columns.map((column) => column.name) }),
  )
  e.dataTransfer.effectAllowed = 'copy'
}

function columnsFor(alias: string) {
  return query.tables.find((table) => table.alias === alias)?.columns.map((column) => column.column) ?? []
}
</script>

<style scoped>
.qsidebar {
  display: flex;
  flex-direction: row;
  height: 100%;
  background: #0d0d12;
  border-right: 1px solid #1a1a24;
}

.qpanel {
  display: flex;
  flex-direction: column;
  width: 260px;
  height: 100%;
  overflow: hidden;
}

.qbrand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 14px 11px;
  border-bottom: 1px solid #1a1a24;
}

.qbrand-icon {
  color: #3ecf8e;
  font-size: 16px;
}

.qbrand-name {
  color: #e0e0e0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.qs-section {
  padding: 10px 12px;
  border-bottom: 1px solid #181820;
}

.qs-section.flex-grow {
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.qs-section-label,
.qs-section-label-row {
  color: #444;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.qs-section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 7px;
}

.qs-section-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.cnt {
  padding: 1px 5px;
  border-radius: 8px;
  background: #1e1e28;
  color: #555;
  font-size: 9px;
}

.schema-source-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 5px;
}

.schema-loaded {
  color: #3ecf8e;
  font-size: 10px;
}

.schema-none {
  color: #444;
  font-size: 10px;
  font-style: italic;
}

.btn-xs,
.btn-use-current,
.btn-add-clause,
.btn-reset {
  border-radius: 5px;
  cursor: pointer;
}

.btn-xs {
  border: 1px solid #2a2a3a;
  background: #1a1a24;
  color: #666;
  font-size: 9.5px;
  padding: 3px 8px;
}

.btn-use-current {
  width: 100%;
  border: 1px dashed #2a2a3a;
  background: none;
  color: #555;
  font-size: 10px;
  padding: 5px;
}

.table-palette {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.palette-table {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.palette-table:hover {
  background: #18181f;
}

.palette-table.on-canvas {
  border-color: #3ecf8e20;
  background: #0a1810;
}

.pt-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.pt-name {
  flex: 1;
  color: #b0b0c8;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  text-align: left;
}

.pt-cols,
.pt-add {
  color: #38384e;
  font-size: 9.5px;
}

.pt-add {
  width: 12px;
  font-size: 14px;
  text-align: center;
}

.palette-empty {
  padding: 16px;
  color: #2a2a3a;
  font-size: 11px;
  font-style: italic;
  text-align: center;
}

.clause-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.clause-select,
.clause-input,
.num-input {
  border: 1px solid #252535;
  border-radius: 4px;
  background: #18181f;
  color: #c0c0cc;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 3px 5px;
}

.clause-select.sm {
  max-width: 80px;
}

.clause-select.op {
  max-width: 90px;
}

.clause-select.logic {
  max-width: 55px;
}

.clause-input {
  flex: 1;
  min-width: 50px;
}

.del-btn {
  border: none;
  background: none;
  color: #444;
  cursor: pointer;
  font-size: 11px;
  padding: 0 2px;
}

.options-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.opt-check,
.opt-num {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
}

.opt-check {
  color: #666;
}

.opt-num {
  color: #555;
}

.num-input {
  width: 48px;
}

.btn-add-clause {
  border: 1px solid #252535;
  background: none;
  color: #3ecf8e;
  font-size: 9px;
  padding: 2px 7px;
}

.btn-reset {
  width: 100%;
  border: 1px solid #ef444430;
  background: none;
  color: #ef444480;
  font-size: 10px;
  padding: 6px;
}

.qfooter {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #181820;
}

.qfooter-autosave {
  font-size: 10px;
  color: #3ecf8e80;
  letter-spacing: 0.02em;
}

.qfooter-version {
  margin-left: auto;
  font-size: 10px;
  color: #7a7a8c;
  background: #1a1a22;
  padding: 2px 6px;
  border-radius: 8px;
  letter-spacing: 0.06em;
}
</style>


