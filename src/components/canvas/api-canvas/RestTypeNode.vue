<template>
  <div
    class="rest-type-node"
    :class="{ selected, highlighted }"
    :style="{
      left:    node.position.x + 'px',
      top:     node.position.y + 'px',
      width:   node.width + 'px',
      '--tc':  node.color || '#3B82F6',
      '--tc-rgb': hexToRgb(node.color || '#3B82F6'),
    }"
    @mousedown.stop="$emit('mousedown', $event)"
    @click.stop="$emit('select')"
  >
    <!-- Header -->
    <div class="rest-type-header">
      <div class="type-icon">⊞</div>
      <div class="rest-type-title">
        <span class="rest-type-name">{{ node.name }}</span>
        <span class="rest-type-kind">type</span>
      </div>
      <div class="node-actions">
        <button class="icon-btn" @click.stop="$emit('edit')">✎</button>
        <button class="icon-btn danger" @click.stop="$emit('delete')">✕</button>
      </div>
    </div>

    <!-- Fields -->
    <div class="section-divider">
      <span class="section-lbl">Fields</span>
      <span class="section-cnt">{{ node.fields.length }}</span>
    </div>
    <div
      v-for="field in node.fields"
      :key="field.id"
      class="field-row"
    >
      <div class="connector conn-left"
        :class="{ connected: connectedFields.has(field.id) }"
        @mouseup.stop="$emit('end-relation', field.id)" />
      
      <span class="field-name">{{ field.name }}</span>
      <span class="field-type">{{ field.type }}</span>

      <div class="connector conn-right"
        :class="{ connected: connectedFields.has(field.id) }"
        @mousedown.stop="$emit('start-relation', field.id)" />
    </div>

    <div v-if="!node.fields.length" class="no-fields">No fields yet</div>

    <!-- Footer -->
    <div class="rest-type-footer">
      <span class="footer-stat">{{ node.fields.length }} fields</span>
      <span class="footer-kind">rest type</span>
    </div>

    <div class="resize-handle" @mousedown.stop="$emit('resize-start', $event)" />
  </div>
</template>

<script setup lang="ts">
import type { RestTypeNode } from '../../../types/api'

defineProps<{
  node: RestTypeNode
  selected: boolean
  highlighted: boolean
  connectedFields: Set<string>
}>()

defineEmits<{
  mousedown: [e: MouseEvent]; select: []; edit: []; delete: []
  'start-relation': [fieldId: string]; 'end-relation': [fieldId: string]; 'resize-start': [e: MouseEvent]
}>()

function hexToRgb(hex: string): string {
  if (!hex || hex[0] !== '#') return '59, 130, 246'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}
</script>

<style scoped>
.rest-type-node {
  position: absolute; border-radius: 12px;
  background: #13131c; border: 1.5px solid #22222e;
  box-shadow: 0 6px 32px #00000060;
  overflow: visible; cursor: grab; min-width: 260px; box-sizing: border-box;
  transition: border-color 0.18s, box-shadow 0.18s;
  font-family: 'JetBrains Mono', monospace;
}
.rest-type-node:active { cursor: grabbing; }
.rest-type-node.selected {
  border-color: var(--tc);
  box-shadow: 0 0 0 2.5px rgba(var(--tc-rgb, 59, 130, 246), 0.28), 0 8px 40px #00000080;
}
.rest-type-node.highlighted {
  box-shadow: 0 0 0 2px rgba(var(--tc-rgb, 59, 130, 246), 0.45),
              0 0 40px rgba(var(--tc-rgb, 59, 130, 246), 0.15);
}

.rest-type-header {
  display: flex; align-items: center; gap: 10px; padding: 12px 12px 10px;
  background: linear-gradient(135deg,
    rgba(var(--tc-rgb, 59, 130, 246), 0.22) 0%,
    rgba(var(--tc-rgb, 59, 130, 246), 0.08) 100%);
  border-bottom: 1px solid rgba(var(--tc-rgb, 59, 130, 246), 0.2);
  border-radius: 11px 11px 0 0;
}

.type-icon {
  width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
  background: rgba(var(--tc-rgb, 59, 130, 246), 0.2);
  border: 1px solid rgba(var(--tc-rgb, 59, 130, 246), 0.35);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; color: var(--tc); font-weight: 900;
}

.rest-type-title { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rest-type-name { font-size: 13px; font-weight: 800; color: #f0f0f8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rest-type-kind { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--tc); opacity: 0.7; }

.node-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
.rest-type-node:hover .node-actions, .rest-type-node.selected .node-actions { opacity: 1; }
.icon-btn { width: 22px; height: 22px; background: none; border: none; color: #555; cursor: pointer; font-size: 12px; border-radius: 5px; display: flex; align-items: center; justify-content: center; transition: color 0.15s, background 0.15s; }
.icon-btn:hover { color: #ddd; background: rgba(255,255,255,0.07); }
.icon-btn.danger:hover { color: #EF4444; background: #EF444418; }

.section-divider { display: flex; align-items: center; justify-content: space-between; padding: 5px 12px 3px; background: #0d0d13; }
.section-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #38384e; }
.section-cnt { font-size: 9px; color: #2a2a40; background: #161622; padding: 1px 5px; border-radius: 8px; }

.field-row { display: flex; align-items: center; gap: 7px; padding: 0 12px; height: 32px; position: relative; transition: background 0.1s; }
.field-row:hover { background: #181824; }

.field-name { flex: 1; font-size: 12px; color: #b0b0c8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.field-type { font-size: 11px; color: var(--tc); opacity: 0.65; flex-shrink: 0; }

.no-fields { padding: 12px; text-align: center; font-size: 11px; color: #28283a; font-style: italic; }

.connector { position: absolute; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #2a2a3a; background: #13131c; cursor: crosshair; z-index: 10; transition: border-color 0.12s, background 0.12s, transform 0.12s; }
.conn-right { right: -6px; }
.conn-left  { left: -6px; }
.connector.connected { border-color: var(--tc); background: var(--tc); }
.conn-right:hover { border-color: #fff !important; background: #fff !important; transform: scale(1.5); }
.conn-left:hover  { border-color: #fff !important; background: #fff !important; transform: scale(1.5); }

.rest-type-footer { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; border-top: 1px solid #181824; background: #0d0d13; border-radius: 0 0 11px 11px; }
.footer-stat { font-size: 10px; color: #30304a; }
.footer-kind { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(var(--tc-rgb, 59, 130, 246), 0.35); }

.resize-handle {
  position: absolute; bottom: 4px; right: 5px; width: 13px; height: 13px; cursor: se-resize; opacity: 0; transition: opacity 0.15s;
  background: radial-gradient(circle at 100% 100%, rgba(var(--tc-rgb, 59, 130, 246), 0.6) 30%, transparent 30%);
}
.rest-type-node:hover .resize-handle, .rest-type-node.selected .resize-handle { opacity: 1; }
</style>
