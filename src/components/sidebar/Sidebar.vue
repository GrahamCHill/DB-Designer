<template>
  <aside class="sidebar">
    <!-- Brand -->
    <div class="brand">
      <span class="brand-icon">⬡</span>
      <span class="brand-name">DB Designer</span>
      <span class="brand-version">v2</span>
    </div>

    <!-- Project actions -->
    <div class="sidebar-section">
      <div class="project-row">
        <input class="project-name-input" v-model="store.schema.name" placeholder="Schema name" />
      </div>
      <div class="btn-row three">
        <button class="btn-ghost-sm" @click="newProject">⊕ New</button>
        <button class="btn-ghost-sm" @click="store.saveToFile()">↓ Save</button>
        <label class="btn-ghost-sm">
          ↑ Load
          <input type="file" accept=".json" style="display:none" @change="loadFile" />
        </label>
      </div>
    </div>

    <!-- Add -->
    <div class="sidebar-section">
      <button class="btn-primary" @click="addTable">
        <span class="btn-icon">⊞</span> New Table
      </button>
      <button class="btn-secondary-full" @click="addGroup">
        <span class="btn-icon">▣</span> New Group
      </button>
    </div>

    <!-- Groups — each is a drop zone, highlights when a table is dragged over -->
    <div v-if="store.schema.groups.length > 0" class="sidebar-section">
      <label class="section-label">Groups ({{ store.schema.groups.length }})</label>
      <div class="item-list">
        <div
          v-for="group in store.schema.groups"
          :key="group.id"
          class="list-item group-item"
          :class="{
            active:   store.selectedGroupId === group.id,
            'drop-target': dragOverGroupId === group.id,
          }"
          :style="dragOverGroupId === group.id ? { '--g-color': group.color } : {}"
          @click="store.selectedGroupId = group.id; store.selectedTableId = null"
          @dblclick="store.editingGroupId = group.id"
          @dragover.prevent="onGroupDragOver(group.id)"
          @dragleave="onGroupDragLeave(group.id)"
          @drop.prevent="onDropOnGroup(group.id)"
        >
          <span class="item-dot" :style="{ background: group.color }" />
          <span class="item-name">{{ group.name }}</span>
          <span class="item-count">{{ tablesInGroup(group.id).length }}</span>
        </div>

        <!-- "None" zone — drop here to remove from any group -->
        <div
          class="list-item group-item ungroup-zone"
          :class="{ 'drop-target': dragOverGroupId === '__none__' }"
          @dragover.prevent="onGroupDragOver('__none__')"
          @dragleave="onGroupDragLeave('__none__')"
          @drop.prevent="onDropOnGroup('__none__')"
        >
          <span class="item-dot" style="background: #333" />
          <span class="item-name" style="color:#555;font-style:italic">No group</span>
        </div>
      </div>
    </div>

    <!-- Tables -->
    <div class="sidebar-section flex-grow">
      <label class="section-label">Tables ({{ store.schema.tables.length }})</label>
      <div class="item-list scrollable">
        <div
          v-for="table in store.schema.tables"
          :key="table.id"
          class="list-item"
          :class="{
            active:   store.selectedTableId === table.id,
            locked:   table.groupLocked,
            'drag-preview': draggingTableId === table.id && dragOverGroupId !== null,
          }"
          @click="store.selectedTableId = table.id; store.selectedGroupId = null"
          @dblclick="store.editingTableId = table.id"
          :draggable="!table.groupLocked"
          @dragstart="onTableDragStart(table.id, $event)"
          @dragend="onTableDragEnd"
          :title="table.groupLocked ? `${table.name} · group locked` : table.name"
        >
          <span class="item-dot" :style="{ background: table.color }" />
          <span class="item-name">{{ table.name }}</span>

          <!-- Group tag — shows pending assignment during drag hover -->
          <span
            v-if="draggingTableId === table.id && dragOverGroupId !== null"
            class="item-group-tag pending"
            :style="{ color: pendingGroupColor }"
          >
            {{ pendingGroupName }}
          </span>
          <span
            v-else-if="table.groupId"
            class="item-group-tag"
            :style="{ color: groupColor(table.groupId) }"
          >
            {{ groupName(table.groupId) }}
          </span>

          <!-- Lock button (always visible on hover, or when locked) -->
          <button
            class="lock-btn"
            :class="{ 'is-locked': table.groupLocked }"
            :title="table.groupLocked ? 'Group locked — click to unlock' : 'Click to lock group'"
            @click.stop="store.toggleTableLock(table.id)"
          >{{ table.groupLocked ? '🔒' : '🔓' }}</button>

          <span class="item-count">{{ table.columns.length }}</span>
        </div>
        <div v-if="store.schema.tables.length === 0" class="list-empty">No tables yet</div>
      </div>
    </div>

    <!-- Inspector: selected table -->
    <div v-if="store.selectedTable && !store.selectedGroupId" class="sidebar-section inspector">
      <label class="section-label">Table</label>
      <div class="inspector-name" :style="{ color: store.selectedTable.color }">
        {{ store.selectedTable.name }}
      </div>
      <div class="inspector-stats">
        <div class="stat">
          <span class="stat-val">{{ store.selectedTable.columns.length }}</span>
          <span class="stat-lbl">cols</span>
        </div>
        <div class="stat">
          <span class="stat-val">{{ pkCount }}</span>
          <span class="stat-lbl">PKs</span>
        </div>
        <div class="stat">
          <span class="stat-val">{{ relCount }}</span>
          <span class="stat-lbl">rels</span>
        </div>
      </div>

      <!-- Group assignment — disabled when locked -->
      <label class="section-label" style="margin-top:8px">
        Group
        <span
          class="lock-inline"
          :class="{ locked: store.selectedTable.groupLocked }"
          @click="store.toggleTableLock(store.selectedTableId!)"
          :title="store.selectedTable.groupLocked ? 'Locked — click to unlock' : 'Click to lock'"
        >
          {{ store.selectedTable.groupLocked ? '🔒 Locked' : '🔓 Unlocked' }}
        </span>
      </label>
      <select
        class="field-select"
        v-model="tableGroupId"
        @change="onChangeTableGroup"
        :disabled="store.selectedTable.groupLocked"
        :title="store.selectedTable.groupLocked ? 'Unlock to change group' : ''"
      >
        <option value="">— None —</option>
        <option v-for="g in store.schema.groups" :key="g.id" :value="g.id">{{ g.name }}</option>
      </select>

      <div class="inspector-actions">
        <button class="btn-ghost-action" @click="store.editingTableId = store.selectedTableId">✎ Edit</button>
        <button class="btn-ghost-action danger" @click="confirmDeleteTable">✕ Delete</button>
      </div>
    </div>

    <!-- Inspector: selected group -->
    <div v-if="store.selectedGroup && !store.selectedTableId" class="sidebar-section inspector">
      <label class="section-label">Group</label>
      <div class="inspector-name" :style="{ color: store.selectedGroup.color }">
        {{ store.selectedGroup.name }}
      </div>
      <div class="inspector-stats">
        <div class="stat">
          <span class="stat-val">{{ tablesInGroup(store.selectedGroup.id).length }}</span>
          <span class="stat-lbl">tables</span>
        </div>
        <div class="stat">
          <span class="stat-val">{{ lockedInGroup(store.selectedGroup.id) }}</span>
          <span class="stat-lbl">locked</span>
        </div>
      </div>
      <div class="inspector-actions">
        <button class="btn-ghost-action" @click="store.editingGroupId = store.selectedGroupId">✎ Edit</button>
        <button class="btn-ghost-action danger" @click="confirmDeleteGroup">✕ Delete</button>
      </div>
    </div>

    <!-- Inspector: selected relation -->
    <div v-if="store.selectedRelationId && !store.selectedTable && !store.selectedGroup" class="sidebar-section inspector">
      <label class="section-label">Relation</label>
      <div v-if="selectedRelation" class="relation-display">
        <span class="rel-table">{{ sourceTable?.name }}</span>
        <span class="rel-col">.{{ sourceCol?.name }}</span>
        <span class="rel-arrow">→</span>
        <span class="rel-table">{{ targetTable?.name }}</span>
        <span class="rel-col">.{{ targetCol?.name }}</span>
      </div>
      <button class="btn-ghost-action danger" style="width:100%;margin-top:8px"
        @click="store.deleteRelation(store.selectedRelationId!)">
        ✕ Delete Relation
      </button>
    </div>

    <!-- Export + Connect -->
    <div class="sidebar-section">
      <button class="btn-export" @click="showExport = true">↑ Export SQL</button>
      <button class="btn-connect" @click="openDBConnect" style="margin-top:6px">⚡ Connect to DB</button>
    </div>

    <!-- Footer -->
    <div class="sidebar-footer">
      <span class="autosave-indicator">● auto-saved</span>
    </div>


    <ExportModal v-if="showExport" @close="showExport = false" />
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSchemaStore } from '../../stores/schema'
import ExportModal from '../modals/ExportModal.vue'
import type { Schema } from '../../types'

const store = useSchemaStore()
const showExport = ref(false)

// ── Drag state ────────────────────────────────────────────────────────────────

/** Table ID currently being dragged in the sidebar */
const draggingTableId = ref<string | null>(null)
/** Group ID the drag is currently hovering over ('__none__' = ungroup zone) */
const dragOverGroupId = ref<string | null>(null)

function onTableDragStart(tableId: string, e: DragEvent) {
  e.dataTransfer?.setData('tableId', tableId)
  draggingTableId.value = tableId
}

function onTableDragEnd() {
  draggingTableId.value = null
  dragOverGroupId.value = null
}

function onGroupDragOver(groupId: string) {
  if (!draggingTableId.value) return
  const table = store.schema.tables.find(t => t.id === draggingTableId.value)
  // Don't highlight if table is locked
  if (table?.groupLocked) return
  dragOverGroupId.value = groupId
}

function onGroupDragLeave(groupId: string) {
  // Only clear if we're still over this group
  if (dragOverGroupId.value === groupId) {
    dragOverGroupId.value = null
  }
}

function onDropOnGroup(groupId: string) {
  if (!draggingTableId.value) return
  const table = store.schema.tables.find(t => t.id === draggingTableId.value)
  if (table?.groupLocked) {
    draggingTableId.value = null
    dragOverGroupId.value = null
    return
  }
  const targetGroupId = groupId === '__none__' ? null : groupId
  store.assignTableToGroup(draggingTableId.value, targetGroupId)
  draggingTableId.value = null
  dragOverGroupId.value = null
}

// Pending group name/color shown in the table row during hover
const pendingGroupName = computed(() => {
  if (!dragOverGroupId.value || dragOverGroupId.value === '__none__') return 'No group'
  return store.schema.groups.find(g => g.id === dragOverGroupId.value)?.name ?? ''
})

const pendingGroupColor = computed(() => {
  if (!dragOverGroupId.value || dragOverGroupId.value === '__none__') return '#555'
  return store.schema.groups.find(g => g.id === dragOverGroupId.value)?.color ?? '#888'
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function addTable() {
  const n = store.schema.tables.length
  store.createTable({ x: 80 + (n % 5) * 40, y: 80 + (n % 5) * 40 })
}

function addGroup() {
  const n = store.schema.groups.length
  store.createGroup({ x: 60 + n * 30, y: 60 + n * 30 })
}

function newProject() {
  if (confirm('Start a new schema? Unsaved changes will be lost.')) {
    store.newSchema()
  }
}

function tablesInGroup(groupId: string) {
  return store.schema.tables.filter(t => t.groupId === groupId)
}

function lockedInGroup(groupId: string) {
  return store.schema.tables.filter(t => t.groupId === groupId && t.groupLocked).length
}

function groupName(groupId: string) {
  return store.schema.groups.find(g => g.id === groupId)?.name ?? ''
}

function groupColor(groupId: string) {
  return store.schema.groups.find(g => g.id === groupId)?.color ?? '#888'
}

const pkCount = computed(() => store.selectedTable?.columns.filter(c => c.primaryKey).length ?? 0)
const relCount = computed(() =>
  store.schema.relations.filter(
    r => r.sourceTableId === store.selectedTableId || r.targetTableId === store.selectedTableId
  ).length
)

const tableGroupId = ref(store.selectedTable?.groupId ?? '')
watch(() => store.selectedTable, t => { tableGroupId.value = t?.groupId ?? '' })

function onChangeTableGroup() {
  if (store.selectedTableId) {
    store.assignTableToGroup(store.selectedTableId, tableGroupId.value || null)
  }
}

const selectedRelation = computed(() => store.schema.relations.find(r => r.id === store.selectedRelationId))
const sourceTable = computed(() => store.schema.tables.find(t => t.id === selectedRelation.value?.sourceTableId))
const sourceCol   = computed(() => sourceTable.value?.columns.find(c => c.id === selectedRelation.value?.sourceColumnId))
const targetTable = computed(() => store.schema.tables.find(t => t.id === selectedRelation.value?.targetTableId))
const targetCol   = computed(() => targetTable.value?.columns.find(c => c.id === selectedRelation.value?.targetColumnId))

function confirmDeleteTable() {
  if (store.selectedTableId && confirm(`Delete "${store.selectedTable?.name}"?`)) {
    store.deleteTable(store.selectedTableId)
  }
}

function confirmDeleteGroup() {
  if (!store.selectedGroupId) return
  const n = tablesInGroup(store.selectedGroupId).length
  if (n > 0) {
    const choice = confirm(`Group has ${n} table(s).\n\nOK = delete tables too\nCancel = keep tables (ungroup only)`)
    store.deleteGroup(store.selectedGroupId, choice)
  } else {
    store.deleteGroup(store.selectedGroupId, false)
  }
}

function openDBConnect() {
  ;(window as any).__dbDesignerShowConnect?.()
}

function loadFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = ev => {
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
  background: #0f0f12;
  border-right: 1px solid #1c1c24;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Brand */
.brand { display: flex; align-items: center; gap: 8px; padding: 14px 14px 12px; border-bottom: 1px solid #1c1c24; }
.brand-icon    { font-size: 18px; color: #3ECF8E; }
.brand-name    { font-size: 13px; font-weight: 700; color: #f0f0f0; letter-spacing: 0.04em; flex: 1; }
.brand-version { font-size: 10px; color: #333; background: #1a1a22; padding: 2px 6px; border-radius: 8px; }

/* Sections */
.sidebar-section { padding: 10px 12px; border-bottom: 1px solid #181820; }
.sidebar-section.flex-grow { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

/* Project row */
.project-row { margin-bottom: 6px; }
.project-name-input {
  width: 100%; background: #18181f; border: 1px solid #25252f;
  border-radius: 6px; color: #e0e0e0; padding: 7px 10px;
  font-size: 12.5px; font-family: 'JetBrains Mono', monospace;
  outline: none; transition: border-color 0.15s; box-sizing: border-box;
}
.project-name-input:focus { border-color: #3ECF8E40; }

.btn-row { display: flex; gap: 5px; }
.btn-row.three > * { flex: 1; }
.btn-ghost-sm {
  background: #18181f; border: 1px solid #25252f; color: #666;
  border-radius: 5px; padding: 5px 4px; font-size: 10.5px;
  cursor: pointer; text-align: center; transition: color 0.15s, background 0.15s;
}
.btn-ghost-sm:hover { color: #e0e0e0; background: #22222c; }

.btn-primary {
  width: 100%; background: #3ECF8E; color: #0a1a12; border: none;
  border-radius: 7px; padding: 8px 12px; font-size: 12.5px; font-weight: 700;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  gap: 6px; margin-bottom: 6px; transition: background 0.15s, transform 0.1s;
}
.btn-primary:hover  { background: #45e09a; }
.btn-primary:active { transform: scale(0.98); }

.btn-secondary-full {
  width: 100%; background: #18181f; color: #888;
  border: 1px solid #25252f; border-radius: 7px; padding: 7px 12px;
  font-size: 12.5px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: color 0.15s, border-color 0.15s;
}
.btn-secondary-full:hover { color: #e0e0e0; border-color: #3a3a50; }
.btn-icon { font-size: 13px; }

.section-label {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 9.5px; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: #444; margin-bottom: 7px;
}

/* Lists */
.item-list { display: flex; flex-direction: column; gap: 1px; }
.item-list.scrollable { flex: 1; overflow-y: auto; }
.item-list.scrollable::-webkit-scrollbar       { width: 3px; }
.item-list.scrollable::-webkit-scrollbar-thumb { background: #25252f; border-radius: 2px; }

.list-item {
  display: flex; align-items: center; gap: 7px;
  padding: 6px 8px; border-radius: 5px;
  cursor: pointer; transition: background 0.1s;
  position: relative;
}
.list-item:hover  { background: #18181f; }
.list-item.active { background: #1a2620; }

/* Locked table row — muted look */
.list-item.locked { opacity: 0.75; }
.list-item.locked .item-name { color: #888; }

/* While dragging, the row shows a pending assignment — dim it slightly */
.list-item.drag-preview { opacity: 0.6; }

/* Group drop targets */
.group-item.drop-target {
  background: color-mix(in srgb, var(--g-color, #3ECF8E) 12%, transparent) !important;
  border: 1px dashed color-mix(in srgb, var(--g-color, #3ECF8E) 50%, transparent);
  border-radius: 5px;
}
.ungroup-zone.drop-target {
  background: #EF444415 !important;
  border: 1px dashed #EF444440;
}

.item-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
}

.item-name {
  flex: 1; font-size: 12px; color: #b0b0bc;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.item-group-tag {
  font-size: 9px; font-weight: 600; opacity: 0.8;
  white-space: nowrap; letter-spacing: 0.04em; flex-shrink: 0;
}

/* Pending tag animates in */
.item-group-tag.pending {
  opacity: 1;
  font-style: italic;
  animation: fadein 0.1s ease;
}
@keyframes fadein { from { opacity: 0 } to { opacity: 1 } }

/* Lock button */
.lock-btn {
  background: none; border: none;
  font-size: 11px; cursor: pointer;
  opacity: 0; padding: 1px 3px; border-radius: 3px;
  transition: opacity 0.15s, background 0.15s;
  flex-shrink: 0; line-height: 1;
}
.list-item:hover .lock-btn,
.list-item.locked .lock-btn { opacity: 1; }
.lock-btn.is-locked { opacity: 1; }
.lock-btn:hover { background: #25252f; }

.item-count {
  font-size: 10px; color: #333; background: #18181f;
  padding: 1px 5px; border-radius: 8px; flex-shrink: 0;
}

.list-empty {
  font-size: 11px; color: #333; text-align: center;
  padding: 12px 0; font-style: italic;
}

/* Inspector */
.inspector { background: #0c0c0f; }
.inspector-name {
  font-size: 13px; font-weight: 700;
  font-family: 'JetBrains Mono', monospace; margin-bottom: 10px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.inspector-stats { display: flex; gap: 6px; margin-bottom: 10px; }
.stat { flex: 1; background: #18181f; border-radius: 5px; padding: 5px 4px; text-align: center; }
.stat-val { display: block; font-size: 15px; font-weight: 700; color: #e0e0e0; }
.stat-lbl { display: block; font-size: 9px; color: #444; text-transform: uppercase; letter-spacing: 0.05em; }

/* Lock inline label in inspector */
.lock-inline {
  font-size: 9px; font-weight: 600; letter-spacing: 0.04em;
  cursor: pointer; padding: 2px 6px; border-radius: 4px;
  background: #18181f; color: #444; border: 1px solid #25252f;
  transition: all 0.15s; text-transform: none;
}
.lock-inline:hover        { color: #e0e0e0; background: #22222c; }
.lock-inline.locked       { color: #F59E0B; border-color: #F59E0B30; background: #F59E0B10; }
.lock-inline.locked:hover { background: #F59E0B20; }

.field-select {
  width: 100%; background: #18181f; border: 1px solid #25252f;
  border-radius: 5px; color: #c0c0cc; padding: 6px 8px;
  font-size: 12px; outline: none; margin-bottom: 8px;
  font-family: 'JetBrains Mono', monospace;
  transition: opacity 0.15s;
}
.field-select:disabled { opacity: 0.4; cursor: not-allowed; }

.inspector-actions { display: flex; gap: 6px; }
.btn-ghost-action {
  flex: 1; background: none; border: 1px solid #25252f; color: #666;
  border-radius: 6px; padding: 5px; font-size: 11px;
  cursor: pointer; transition: all 0.15s;
}
.btn-ghost-action:hover { color: #e0e0e0; background: #18181f; }
.btn-ghost-action.danger:hover { color: #EF4444; border-color: #EF444440; background: #EF444410; }

.relation-display {
  display: flex; flex-wrap: wrap; align-items: center;
  gap: 3px; margin-bottom: 4px; font-size: 11px;
}
.rel-table { color: #3ECF8E; font-family: monospace; }
.rel-col   { color: #888; font-family: monospace; }
.rel-arrow { color: #444; }

.btn-export {
  width: 100%; background: #1a2a22; border: 1px solid #3ECF8E40;
  color: #3ECF8E; border-radius: 7px; padding: 8px; font-size: 12px;
  font-weight: 600; cursor: pointer; transition: background 0.15s;
}
.btn-export:hover { background: #1e3028; }

.btn-connect {
  width: 100%; background: #1a1a28; border: 1px solid #3B82F640;
  color: #3B82F6; border-radius: 7px; padding: 8px; font-size: 12px;
  font-weight: 600; cursor: pointer; transition: background 0.15s;
}
.btn-connect:hover { background: #1a1e2e; }

.sidebar-footer { padding: 8px 14px; border-top: 1px solid #181820; display: flex; justify-content: flex-end; }
.autosave-indicator { font-size: 10px; color: #3ECF8E50; letter-spacing: 0.02em; }
</style>
