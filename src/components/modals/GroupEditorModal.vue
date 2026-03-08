<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Edit Group</span>
          <button class="close-btn" @click="$emit('close')">✕</button>
        </div>

        <div class="modal-body">
          <label class="field-label">Group Name</label>
          <input
            class="field-input"
            v-model="localName"
            placeholder="e.g. Users, Products, Auth…"
            @keydown.enter="save"
            autofocus
          />

          <label class="field-label mt">Color</label>
          <div class="color-picker">
            <button
              v-for="color in COLORS"
              :key="color"
              class="color-dot"
              :class="{ active: localColor === color }"
              :style="{ background: color }"
              @click="localColor = color"
            />
          </div>

          <label class="field-label mt">Tables in this group</label>
          <div class="tables-in-group">
            <div v-if="groupTables.length === 0" class="empty-note">
              No tables assigned yet. Drag tables onto this group on the canvas.
            </div>
            <div v-for="t in groupTables" :key="t.id" class="group-table-row">
              <span class="dot" :style="{ background: t.color }" />
              <span class="tname">{{ t.name }}</span>
              <button class="remove-btn" @click="store.assignTableToGroup(t.id, null)" title="Remove from group">✕</button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-danger" @click="deleteGroup">Delete Group</button>
          <div class="footer-right">
            <button class="btn-cancel" @click="$emit('close')">Cancel</button>
            <button class="btn-save" @click="save">Save</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSchemaStore } from '../../stores/schema'
import type { TableGroup } from '../../types'

const COLORS = [
  '#3ECF8E', '#3B82F6', '#8B5CF6', '#F59E0B',
  '#EF4444', '#06B6D4', '#EC4899', '#F97316',
  '#84CC16', '#14B8A6',
]

const props = defineProps<{ group: TableGroup }>()
const emit = defineEmits<{ close: [] }>()
const store = useSchemaStore()

const localName = ref(props.group.name)
const localColor = ref(props.group.color)

const groupTables = computed(() =>
  store.schema.tables.filter(t => t.groupId === props.group.id)
)

function save() {
  store.updateGroup(props.group.id, { name: localName.value, color: localColor.value })
  emit('close')
}

function deleteGroup() {
  const hasTables = groupTables.value.length > 0
  if (hasTables) {
    const choice = confirm(`This group has ${groupTables.value.length} table(s).\n\nOK = delete tables too\nCancel = keep tables (ungroup only)`)
    store.deleteGroup(props.group.id, choice)
  } else {
    store.deleteGroup(props.group.id, false)
  }
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: #00000070;
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal {
  background: #16161a;
  border: 1px solid #2a2a35;
  border-radius: 12px;
  width: 420px;
  max-width: 95vw;
  box-shadow: 0 24px 80px #00000099;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #1e1e28;
}

.modal-title {
  font-size: 14px;
  font-weight: 700;
  color: #f0f0f0;
}

.close-btn {
  background: none;
  border: none;
  color: #444;
  font-size: 15px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: color 0.15s;
}
.close-btn:hover { color: #e0e0e0; }

.modal-body {
  padding: 16px 18px;
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

.field-label.mt { margin-top: 16px; }

.field-input {
  width: 100%;
  background: #1a1a22;
  border: 1px solid #2a2a35;
  border-radius: 6px;
  color: #e0e0e0;
  padding: 8px 10px;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.field-input:focus { border-color: #3ECF8E50; }

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}

.color-dot:hover, .color-dot.active {
  transform: scale(1.25);
  border-color: #ffffff80;
}

.tables-in-group {
  background: #0f0f12;
  border: 1px solid #1e1e28;
  border-radius: 6px;
  max-height: 140px;
  overflow-y: auto;
}

.empty-note {
  padding: 12px;
  font-size: 11px;
  color: #444;
  text-align: center;
  font-style: italic;
}

.group-table-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-bottom: 1px solid #1a1a22;
}

.group-table-row:last-child { border-bottom: none; }

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tname {
  flex: 1;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  color: #c0c0cc;
}

.remove-btn {
  background: none;
  border: none;
  color: #333;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
  border-radius: 3px;
  transition: color 0.15s;
}
.remove-btn:hover { color: #EF4444; }

.modal-footer {
  padding: 12px 18px;
  border-top: 1px solid #1e1e28;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-right { display: flex; gap: 8px; }

.btn-cancel {
  background: none;
  border: 1px solid #2a2a35;
  color: #888;
  border-radius: 7px;
  padding: 7px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-cancel:hover { color: #e0e0e0; background: #1e1e28; }

.btn-save {
  background: #3ECF8E;
  color: #0a1a12;
  border: none;
  border-radius: 7px;
  padding: 7px 16px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-save:hover { background: #45e09a; }

.btn-danger {
  background: none;
  border: 1px solid #EF444440;
  color: #EF4444;
  border-radius: 7px;
  padding: 7px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-danger:hover { background: #EF444415; }
</style>
