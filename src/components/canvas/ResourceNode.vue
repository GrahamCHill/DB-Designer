<template>
  <div
    class="resource-node"
    :class="{ selected, highlighted, 'read-only': readOnly }"
    :style="{
      left: table.position.x + 'px',
      top: table.position.y + 'px',
      width: table.width + 'px',
      '--resource-color': table.color,
      '--resource-color-rgb': hexToRgb(table.color),
    }"
    @mousedown.stop="$emit('mousedown', $event)"
    @click.stop="$emit('select', $event)"
  >
    <div class="resource-header">
      <div class="resource-copy">
        <span class="resource-kicker">{{ resourceLabel }}</span>
        <span class="resource-name">{{ table.name }}</span>
      </div>
      <div class="resource-actions">
        <button v-if="!readOnly" class="icon-btn" @click.stop="$emit('edit')" title="Edit resource">Edit</button>
      </div>
    </div>

    <div class="resource-body">
      <div class="resource-port-row">
        <div
          v-if="!readOnly"
          class="connector connector-left"
          :class="{ connected: connectedAsTarget.has(portId) }"
          title="Inbound dependency"
          @mouseup.stop="$emit('end-relation', portId)"
        />
        <span class="resource-port">{{ portLabel }}</span>
        <div
          v-if="!readOnly"
          class="connector connector-right"
          :class="{ connected: connectedAsSource.has(portId) }"
          title="Outbound dependency"
          @mousedown.stop="$emit('start-relation', { columnId: portId, event: $event })"
        />
      </div>
      <div v-if="table.comment" class="resource-comment">{{ table.comment }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Table } from '../../types'

const props = defineProps<{
  table: Table
  selected: boolean
  highlighted: boolean
  connectedAsSource: Set<string>
  connectedAsTarget: Set<string>
  readOnly?: boolean
}>()

defineEmits<{
  mousedown: [e: MouseEvent]
  select: [e: MouseEvent]
  edit: []
  'start-relation': [columnId: string]
  'end-relation': [columnId: string]
}>()

const resourceLabel = computed(() => {
  switch (props.table.resourceType) {
    case 'blob-storage': return 'S3 / Blob'
    case 'nosql-database': return 'NoSQL Database'
    case 'cache': return 'Cache'
    case 'message-queue': return 'Message Queue'
    case 'data-export': return 'Data Export'
    default: return 'External Service'
  }
})

const portId = computed(() => props.table.columns[0]?.id ?? '')
const portLabel = computed(() => {
  switch (props.table.resourceType) {
    case 'blob-storage': return 's3/blob read/write'
    case 'nosql-database': return 'document request'
    case 'cache': return 'cache lookup'
    case 'message-queue': return 'publish / consume'
    case 'data-export': return 'export payload'
    default: return 'request / response'
  }
})

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}
</script>

<style scoped>
.resource-node {
  position: absolute;
  border: 1px solid rgba(var(--resource-color-rgb, 14, 165, 233), 0.35);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(var(--resource-color-rgb, 14, 165, 233), 0.15), #12131a 60%);
  box-shadow: 0 12px 34px #0000006a;
  overflow: visible;
  cursor: grab;
}
.resource-node.selected,
.resource-node.highlighted {
  box-shadow:
    0 0 0 2px rgba(var(--resource-color-rgb, 14, 165, 233), 0.4),
    0 12px 34px #00000074;
}
.resource-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px 8px;
}
.resource-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.resource-kicker {
  color: rgba(var(--resource-color-rgb, 14, 165, 233), 0.82);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.resource-name {
  color: #f8fafc;
  font-size: 13px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.resource-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.resource-node:hover .resource-actions,
.resource-node.selected .resource-actions {
  opacity: 1;
}
.icon-btn {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 9px;
  min-width: 32px;
  height: 22px;
  padding: 0 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.icon-btn:hover { color: #fff; background: #2a2a35; }
.icon-btn.danger:hover { color: #f87171; }
.resource-body {
  padding: 0 14px 14px;
}
.resource-port-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  border: 1px dashed rgba(var(--resource-color-rgb, 14, 165, 233), 0.32);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.55);
}
.resource-port {
  color: #cbd5e1;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
}
.resource-comment {
  margin-top: 10px;
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.45;
}
.connector {
  position: absolute;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 2px solid rgba(var(--resource-color-rgb, 14, 165, 233), 0.45);
  background: #0f172a;
  cursor: crosshair;
}
.connector-left { left: -7px; }
.connector-right { right: -7px; }
.connector.connected,
.connector:hover {
  background: var(--resource-color);
  border-color: var(--resource-color);
  box-shadow: 0 0 10px rgba(var(--resource-color-rgb, 14, 165, 233), 0.45);
}
.resource-node.read-only {
  cursor: pointer;
}
</style>
