<template>
  <aside class="qsidebar">
    <div class="qpanel">
      <!-- Header -->
      <div class="qbrand">
        <span class="qbrand-icon">⊞</span>
        <span class="qbrand-name">Query Builder</span>
      </div>

      <!-- Load schema -->
      <div class="qs-section">
        <div class="qs-section-label">Schema Source</div>
        <div class="schema-source-row">
          <span v-if="schemaName" class="schema-loaded">● {{ schemaName }}</span>
          <span v-else class="schema-none">No schema loaded</span>
          <label class="btn-xs">
            Load .dbm.json
            <input type="file" accept=".json" style="display:none" @change="loadSchema" />
          </label>
        </div>
        <button v-if="!schemaName && dbStore.schema.tables.length" class="btn-use-current" @click="useCurrentSchema">
          Use current DB schema
        </button>
      </div>

      <!-- Table palette — drag onto canvas -->
      <div class="qs-section flex-grow">
        <div class="qs-section-label">Tables <span class="cnt">{{ schemaTables.length }}</span></div>
        <div class="table-palette">
          <div v-for="t in schemaTables" :key="t.name"
            class="palette-table"
            :class="{ 'on-canvas': isOnCanvas(t.name) }"
            draggable="true"
            @dragstart="onDragStart($event, t.name)"
            @click="addToCanvas(t.name)"
            :title="isOnCanvas(t.name) ? 'Already on canvas — click to add another' : 'Click or drag to add'"
          >
            <span class="pt-dot" :style="{ background: t.color }"/>
            <span class="pt-name">{{ t.name }}</span>
            <span class="pt-cols">{{ t.columns.length }}c</span>
            <span class="pt-add">+</span>
          </div>
          <div v-if="!schemaTables.length" class="palette-empty">Load a schema first</div>
        </div>
      </div>

      <!-- WHERE conditions -->
      <div class="qs-section" v-if="query.tables.length">
        <div class="qs-section-label-row">
          <span>WHERE</span>
          <button class="btn-add-clause" @click="query.addWhere()">+ Add</button>
        </div>
        <div v-for="w in query.wheres" :key="w.id" class="clause-row">
          <select class="clause-select sm" v-model="w.tableAlias">
            <option v-for="t in query.tables" :key="t.id" :value="t.alias">{{ t.alias }}</option>
          </select>
          <select class="clause-select sm" v-model="w.column">
            <option v-for="c in columnsFor(w.tableAlias)" :key="c" :value="c">{{ c }}</option>
          </select>
          <select class="clause-select op" v-model="w.op">
            <option v-for="op in ops" :key="op" :value="op">{{ op }}</option>
          </select>
          <input v-if="!['IS NULL','IS NOT NULL'].includes(w.op)"
            class="clause-input" v-model="w.value" placeholder="value" />
          <select v-if="query.wheres.indexOf(w) < query.wheres.length - 1"
            class="clause-select logic" v-model="w.logic">
            <option>AND</option><option>OR</option>
          </select>
          <button class="del-btn" @click="query.removeWhere(w.id)">✕</button>
        </div>
      </div>

      <!-- GROUP BY -->
      <div class="qs-section" v-if="query.tables.length">
        <div class="qs-section-label-row">
          <span>GROUP BY</span>
          <button class="btn-add-clause" @click="query.addGroup()">+ Add</button>
        </div>
        <div v-for="g in query.groups" :key="g.id" class="clause-row">
          <select class="clause-select sm" v-model="g.tableAlias">
            <option v-for="t in query.tables" :key="t.id" :value="t.alias">{{ t.alias }}</option>
          </select>
          <select class="clause-select sm" v-model="g.column">
            <option v-for="c in columnsFor(g.tableAlias)" :key="c" :value="c">{{ c }}</option>
          </select>
          <button class="del-btn" @click="query.removeGroup(g.id)">✕</button>
        </div>
      </div>

      <!-- ORDER BY -->
      <div class="qs-section" v-if="query.tables.length">
        <div class="qs-section-label-row">
          <span>ORDER BY</span>
          <button class="btn-add-clause" @click="query.addOrder()">+ Add</button>
        </div>
        <div v-for="o in query.orders" :key="o.id" class="clause-row">
          <select class="clause-select sm" v-model="o.tableAlias">
            <option v-for="t in query.tables" :key="t.id" :value="t.alias">{{ t.alias }}</option>
          </select>
          <select class="clause-select sm" v-model="o.column">
            <option v-for="c in columnsFor(o.tableAlias)" :key="c" :value="c">{{ c }}</option>
          </select>
          <select class="clause-select logic" v-model="o.dir">
            <option>ASC</option><option>DESC</option>
          </select>
          <button class="del-btn" @click="query.removeOrder(o.id)">✕</button>
        </div>
      </div>

      <!-- LIMIT / OFFSET / DISTINCT -->
      <div class="qs-section" v-if="query.tables.length">
        <div class="qs-section-label">Options</div>
        <div class="options-row">
          <label class="opt-check">
            <input type="checkbox" v-model="query.distinct" /> DISTINCT
          </label>
          <label class="opt-num">LIMIT <input type="number" min="1" v-model.number="query.limit" placeholder="—" class="num-input" /></label>
          <label class="opt-num">OFFSET <input type="number" min="0" v-model.number="query.offset" placeholder="—" class="num-input" /></label>
        </div>
      </div>

      <!-- Reset -->
      <div class="qs-section" v-if="query.tables.length">
        <button class="btn-reset" @click="query.reset">⊘ Reset Query</button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQueryStore }     from '../../stores/query'
import { useSchemaStore }    from '../../stores/schema'
import { useWorkspaceStore } from '../../stores/workspace'

const query   = useQueryStore()
const dbStore = useSchemaStore()
const wsStore = useWorkspaceStore()

const ops = ['=','!=','>','>=','<','<=','LIKE','IN','IS NULL','IS NOT NULL']

// ── Schema source ─────────────────────────────────────────────────────────────
interface SchemaTable { name: string; color: string; columns: { name: string }[] }

const externalSchema = ref<SchemaTable[] | null>(null)
const schemaName     = ref('')

const schemaTables = computed<SchemaTable[]>(() => {
  if (externalSchema.value) return externalSchema.value
  return dbStore.schema.tables.map(t => ({
    name: t.name,
    color: t.color,
    columns: t.columns.map(c => ({ name: c.name })),
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
  reader.onload = ev => {
    try {
      const raw = JSON.parse(ev.target?.result as string)
      // Support both tab-based and single schema formats
      const schema = raw.tables ? raw : raw.schema ?? raw
      externalSchema.value = (schema.tables ?? []).map((t: any) => ({
        name: t.name,
        color: t.color ?? '#3ECF8E',
        columns: (t.columns ?? []).map((c: any) => ({ name: c.name })),
      }))
      schemaName.value = schema.name ?? file.name
    } catch { alert('Could not parse schema file') }
  }
  reader.readAsText(file)
}

// ── Canvas helpers ─────────────────────────────────────────────────────────────
let canvasDropPos = { x: 120, y: 80 }

function isOnCanvas(name: string) {
  return query.tables.some(t => t.schemaTable === name)
}

function addToCanvas(name: string) {
  const st = schemaTables.value.find(t => t.name === name)
  if (!st) return
  const n = query.tables.length
  query.addTable(name, st.columns.map(c => c.name), {
    x: 80 + (n % 4) * 60, y: 80 + Math.floor(n / 4) * 60,
  })
}

function onDragStart(e: DragEvent, name: string) {
  e.dataTransfer!.setData('text/plain', name)
  e.dataTransfer!.effectAllowed = 'copy'
}

// ── Columns helper ─────────────────────────────────────────────────────────────
function columnsFor(alias: string) {
  return query.tables.find(t => t.alias === alias)?.columns.map(c => c.column) ?? []
}
</script>

<style scoped>
.qsidebar {
  display: flex; flex-direction: row; height: 100%;
  background: #0d0d12; border-right: 1px solid #1a1a24;
}

/* Main panel */
.qpanel {
  width: 260px; display: flex; flex-direction: column; height: 100%; overflow: hidden;
}

.qbrand {
  display: flex; align-items: center; gap: 8px;
  padding: 13px 14px 11px; border-bottom: 1px solid #1a1a24;
}
.qbrand-icon { font-size: 16px; color: #3ECF8E; }
.qbrand-name { font-size: 12px; font-weight: 700; color: #e0e0e0; letter-spacing: 0.04em; }

.qs-section { padding: 10px 12px; border-bottom: 1px solid #181820; }
.qs-section.flex-grow { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.qs-section-label {
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  color: #444; margin-bottom: 7px; display: flex; align-items: center; gap: 6px;
}
.qs-section-label-row {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #444;
}
.cnt { background: #1e1e28; color: #555; font-size: 9px; padding: 1px 5px; border-radius: 8px; }

/* Schema source */
.schema-source-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 5px; }
.schema-loaded { font-size: 10px; color: #3ECF8E; }
.schema-none   { font-size: 10px; color: #444; font-style: italic; }
.btn-xs {
  font-size: 9.5px; background: #1a1a24; border: 1px solid #2a2a3a; color: #666;
  border-radius: 4px; padding: 3px 8px; cursor: pointer; white-space: nowrap;
  transition: color 0.15s;
}
.btn-xs:hover { color: #3ECF8E; }
.btn-use-current {
  width: 100%; background: none; border: 1px dashed #2a2a3a; color: #555;
  border-radius: 5px; padding: 5px; font-size: 10px; cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.btn-use-current:hover { color: #3ECF8E; border-color: #3ECF8E40; }

/* Table palette */
.table-palette { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.table-palette::-webkit-scrollbar { width: 3px; }
.table-palette::-webkit-scrollbar-thumb { background: #252535; border-radius: 2px; }

.palette-table {
  display: flex; align-items: center; gap: 7px; padding: 6px 8px;
  border-radius: 6px; cursor: pointer; border: 1px solid transparent;
  transition: background 0.1s, border-color 0.1s; user-select: none;
}
.palette-table:hover { background: #18181f; }
.palette-table.on-canvas { border-color: #3ECF8E20; background: #0a1810; }
.pt-dot  { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.pt-name { flex: 1; font-size: 11.5px; color: #b0b0c8; font-family: 'JetBrains Mono', monospace; }
.pt-cols { font-size: 9.5px; color: #38384e; }
.pt-add  { font-size: 14px; color: #38384e; transition: color 0.15s; }
.palette-table:hover .pt-add { color: #3ECF8E; }
.palette-empty { font-size: 11px; color: #2a2a3a; font-style: italic; text-align: center; padding: 16px; }

/* Clause rows */
.clause-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; flex-wrap: wrap; }
.clause-select, .clause-input {
  background: #18181f; border: 1px solid #252535; border-radius: 4px;
  color: #c0c0cc; font-size: 10px; font-family: 'JetBrains Mono', monospace;
  padding: 3px 5px; outline: none;
}
.clause-select.sm    { max-width: 80px; }
.clause-select.op    { max-width: 90px; }
.clause-select.logic { max-width: 55px; }
.clause-input { flex: 1; min-width: 50px; }
.del-btn { background: none; border: none; color: #444; cursor: pointer; font-size: 11px; padding: 0 2px; }
.del-btn:hover { color: #EF4444; }
.btn-add-clause {
  background: none; border: 1px solid #252535; color: #3ECF8E;
  border-radius: 4px; padding: 2px 7px; font-size: 9px; cursor: pointer;
}
.btn-add-clause:hover { background: #3ECF8E12; }

/* Options */
.options-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.opt-check { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #666; cursor: pointer; }
.opt-num { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #555; }
.num-input { width: 48px; background: #18181f; border: 1px solid #252535; border-radius: 4px; color: #c0c0cc; font-size: 10px; padding: 2px 5px; font-family: 'JetBrains Mono', monospace; }

.btn-reset {
  width: 100%; background: none; border: 1px solid #EF444430; color: #EF444480;
  border-radius: 5px; padding: 6px; font-size: 10px; cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.btn-reset:hover { color: #EF4444; border-color: #EF444460; }
</style>
