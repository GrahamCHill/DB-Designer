<template>
  <aside class="sidebar">
    <!-- Top branding -->
    <div class="brand">
      <span class="brand-icon">⬡</span>
      <span class="brand-name">DB Modeler</span>
    </div>

    <!-- Actions -->
    <div class="sidebar-section">
      <button class="btn-primary" @click="addTable">
        <span>+</span> New Table
      </button>
      <div class="btn-row">
        <button class="btn-secondary" @click="showExport = true">↑ Export SQL</button>
        <button class="btn-secondary" @click="store.saveToFile()">⬇ Save</button>
        <label class="btn-secondary" title="Load schema">
          ↑ Load
          <input type="file" accept=".json" style="display:none" @change="loadFile" />
        </label>
      </div>
    </div>

    <!-- Schema name -->
    <div class="sidebar-section">
      <label class="field-label">Schema name</label>
      <input
        class="field-input"
        v-model="store.schema.name"
        placeholder="Untitled Schema"
      />
    </div>

    <!-- Tables list -->
    <div class="sidebar-section flex-grow">
      <label class="field-label">Tables ({{ store.schema.tables.length }})</label>
      <div class="tables-list">
        <div
          v-for="table in store.schema.tables"
          :key="table.id"
          class="table-item"
          :class="{ active: store.selectedTableId === table.id }"
          @click="store.selectedTableId = table.id"
          @dblclick="store.editingTableId = table.id"
        >
          <span class="table-dot" :style="{ background: table.color }" />
          <span class="table-item-name">{{ table.name }}</span>
          <span class="table-item-count">{{ table.columns.length }}</span>
        </div>
        <div v-if="store.schema.tables.length === 0" class="tables-empty">
          No tables yet
        </div>
      </div>
    </div>

    <!-- Selected table inspector -->
    <div v-if="store.selectedTable" class="sidebar-section inspector">
      <label class="field-label">Selected Table</label>
      <div class="inspector-name">{{ store.selectedTable.name }}</div>
      <div class="inspector-stats">
        <div class="stat">
          <span class="stat-val">{{ store.selectedTable.columns.length }}</span>
          <span class="stat-lbl">columns</span>
        </div>
        <div class="stat">
          <span class="stat-val">{{ pkCount }}</span>
          <span class="stat-lbl">primary keys</span>
        </div>
        <div class="stat">
          <span class="stat-val">{{ relCount }}</span>
          <span class="stat-lbl">relations</span>
        </div>
      </div>
      <div class="inspector-actions">
        <button class="btn-ghost" @click="store.editingTableId = store.selectedTableId">
          ✎ Edit Table
        </button>
        <button class="btn-ghost danger" @click="confirmDelete">
          ✕ Delete
        </button>
      </div>
    </div>

    <!-- Relation info -->
    <div v-if="store.selectedRelationId && !store.selectedTable" class="sidebar-section inspector">
      <label class="field-label">Selected Relation</label>
      <div v-if="selectedRelation" class="relation-info">
        <div class="rel-from">{{ sourceTable?.name }}.{{ sourceCol?.name }}</div>
        <div class="rel-arrow">→</div>
        <div class="rel-to">{{ targetTable?.name }}.{{ targetCol?.name }}</div>
      </div>
      <button class="btn-ghost danger" @click="store.deleteRelation(store.selectedRelationId!)">
        ✕ Delete Relation
      </button>
    </div>

    <!-- Footer -->
    <div class="sidebar-footer">
      <span>Phase 1 · DB Modeler</span>
    </div>

    <!-- Export Modal -->
    <ExportModal v-if="showExport" @close="showExport = false" />
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSchemaStore } from '../../stores/schema'
import ExportModal from '../modals/ExportModal.vue'
import type { Schema } from '../../types'

const store = useSchemaStore()
const showExport = ref(false)

function addTable() {
  const offset = store.schema.tables.length * 30
  store.createTable({ x: 80 + offset, y: 80 + offset })
}

const pkCount = computed(() =>
  store.selectedTable?.columns.filter(c => c.primaryKey).length ?? 0
)

const relCount = computed(() =>
  store.schema.relations.filter(
    r => r.sourceTableId === store.selectedTableId || r.targetTableId === store.selectedTableId
  ).length
)

const selectedRelation = computed(() =>
  store.schema.relations.find(r => r.id === store.selectedRelationId)
)

const sourceTable = computed(() =>
  store.schema.tables.find(t => t.id === selectedRelation.value?.sourceTableId)
)
const sourceCol = computed(() =>
  sourceTable.value?.columns.find(c => c.id === selectedRelation.value?.sourceColumnId)
)
const targetTable = computed(() =>
  store.schema.tables.find(t => t.id === selectedRelation.value?.targetTableId)
)
const targetCol = computed(() =>
  targetTable.value?.columns.find(c => c.id === selectedRelation.value?.targetColumnId)
)

function confirmDelete() {
  if (store.selectedTableId && confirm(`Delete table "${store.selectedTable?.name}"?`)) {
    store.deleteTable(store.selectedTableId)
  }
}

function loadFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const json = JSON.parse(ev.target?.result as string) as Schema
      store.loadFromJSON(json)
    } catch {
      alert('Invalid schema file')
    }
  }
  reader.readAsText(file)
}
</script>

<style scoped>
.sidebar {
  width: 240px;
  min-width: 240px;
  background: #111114;
  border-right: 1px solid #1e1e28;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #1e1e28;
}

.brand-icon {
  font-size: 20px;
  color: #3ECF8E;
}

.brand-name {
  font-size: 14px;
  font-weight: 700;
  color: #f0f0f0;
  letter-spacing: 0.04em;
}

.sidebar-section {
  padding: 12px 14px;
  border-bottom: 1px solid #1a1a22;
}

.sidebar-section.flex-grow {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.field-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #555;
  margin-bottom: 8px;
}

.field-input {
  width: 100%;
  background: #1a1a22;
  border: 1px solid #2a2a35;
  border-radius: 6px;
  color: #e0e0e0;
  padding: 7px 10px;
  font-size: 12.5px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: #3ECF8E50;
}

.btn-primary {
  width: 100%;
  background: #3ECF8E;
  color: #0a1a12;
  border: none;
  border-radius: 7px;
  padding: 9px 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background 0.15s, transform 0.1s;
  margin-bottom: 8px;
}

.btn-primary:hover {
  background: #45e09a;
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-row {
  display: flex;
  gap: 6px;
}

.btn-secondary {
  flex: 1;
  background: #1e1e28;
  color: #888;
  border: 1px solid #2a2a35;
  border-radius: 6px;
  padding: 6px 4px;
  font-size: 11px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  text-align: center;
}

.btn-secondary:hover {
  color: #e0e0e0;
  background: #252530;
}

.tables-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tables-list::-webkit-scrollbar { width: 4px; }
.tables-list::-webkit-scrollbar-track { background: transparent; }
.tables-list::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 2px; }

.table-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}

.table-item:hover {
  background: #1a1a22;
}

.table-item.active {
  background: #1a2820;
}

.table-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.table-item-name {
  flex: 1;
  font-size: 12.5px;
  color: #c0c0cc;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.table-item-count {
  font-size: 10px;
  color: #444;
  background: #1e1e28;
  padding: 1px 5px;
  border-radius: 8px;
}

.tables-empty {
  font-size: 12px;
  color: #333;
  text-align: center;
  padding: 16px 0;
  font-style: italic;
}

.inspector {
  background: #0f0f12;
}

.inspector-name {
  font-size: 13px;
  font-weight: 700;
  color: #3ECF8E;
  font-family: 'JetBrains Mono', monospace;
  margin-bottom: 10px;
}

.inspector-stats {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.stat {
  flex: 1;
  background: #1a1a22;
  border-radius: 6px;
  padding: 6px 4px;
  text-align: center;
}

.stat-val {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: #e0e0e0;
}

.stat-lbl {
  display: block;
  font-size: 9px;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.inspector-actions {
  display: flex;
  gap: 6px;
}

.btn-ghost {
  flex: 1;
  background: none;
  border: 1px solid #2a2a35;
  color: #888;
  border-radius: 6px;
  padding: 6px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-ghost:hover {
  color: #e0e0e0;
  background: #1e1e28;
}

.btn-ghost.danger:hover {
  color: #EF4444;
  border-color: #EF444440;
  background: #EF444410;
}

.relation-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
  font-family: monospace;
}

.rel-from, .rel-to { color: #3ECF8E; }
.rel-arrow { color: #555; }

.sidebar-footer {
  padding: 10px 14px;
  font-size: 10px;
  color: #333;
  text-align: center;
  border-top: 1px solid #1a1a22;
}
</style>
