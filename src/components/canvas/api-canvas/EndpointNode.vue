<template>
  <div
    class="ep-node"
    :class="{ selected, highlighted }"
    :style="{
      left:    node.position.x + 'px',
      top:     node.position.y + 'px',
      width:   node.width + 'px',
      '--mc':  methodColor,
      '--mc-rgb': hexToRgb(methodColor),
    }"
    @mousedown.stop="$emit('mousedown', $event)"
    @click.stop="$emit('select')"
  >
    <!-- Coloured method header -->
    <div class="ep-header">
      <div class="method-badge">{{ node.method }}</div>
      <div class="ep-title">
        <span class="ep-path">{{ node.path }}</span>
        <span v-if="node.summary" class="ep-summary">{{ node.summary }}</span>
      </div>
      <div class="node-actions">
        <button class="icon-btn" @click.stop="$emit('edit')">✎</button>
        <button class="icon-btn danger" @click.stop="$emit('delete')">✕</button>
      </div>
    </div>

    <!-- Tags -->
    <div v-if="node.tags.length" class="ep-tags">
      <span v-for="tag in node.tags" :key="tag" class="ep-tag">{{ tag }}</span>
    </div>

    <!-- Left connector -->
    <div class="connector conn-left" @mouseup.stop="$emit('end-relation', 'endpoint')" />

    <!-- Parameters -->
    <template v-if="node.params.length">
      <div class="section-divider">
        <span class="section-lbl">Parameters</span>
        <span class="section-cnt">{{ node.params.length }}</span>
      </div>
      <div v-for="param in node.params" :key="param.id" class="field-row">
        <span class="loc-chip" :class="param.in">{{ param.in[0].toUpperCase() }}</span>
        <span class="field-name">{{ param.name }}</span>
        <span class="field-type">{{ param.type }}</span>
        <div class="connector conn-right" :class="{ connected: connectedFields.has(param.id) }"
          @mousedown.stop="$emit('start-relation', param.id)" />
      </div>
    </template>

    <!-- Request body -->
    <template v-if="['POST','PUT','PATCH'].includes(node.method)">
      <div class="section-divider"><span class="section-lbl">Request Body</span></div>
      <div class="field-row">
        <span class="loc-chip body">B</span>
        <span class="field-name">{{ node.requestBodyRef ? refName(node.requestBodyRef) : 'untyped' }}</span>
        <div class="connector conn-right" :class="{ connected: !!node.requestBodyRef }"
          @mousedown.stop="$emit('start-relation', 'request-body')" />
      </div>
    </template>

    <!-- Responses -->
    <div class="section-divider">
      <span class="section-lbl">Responses</span>
      <span class="section-cnt">{{ node.responses.length }}</span>
    </div>
    <div v-for="res in node.responses" :key="res.id" class="field-row">
      <span class="status-chip" :class="statusClass(res.statusCode)">{{ res.statusCode }}</span>
      <span class="field-name">{{ res.description }}</span>
      <div class="connector conn-right" :class="{ connected: !!res.bodyTypeRef }"
        @mousedown.stop="$emit('start-relation', res.id)" />
    </div>

    <!-- Footer -->
    <div class="ep-footer">
      <span class="footer-stat">{{ node.params.length }}p · {{ node.responses.length }}r</span>
      <span class="footer-kind">endpoint</span>
    </div>

    <div class="resize-handle" @mousedown.stop="$emit('resize-start', $event)" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RestEndpointNode } from '../../../types/api'
import { METHOD_COLORS } from '../../../types/api'

const props = defineProps<{
  node: RestEndpointNode
  selected: boolean
  highlighted: boolean
  connectedFields: Set<string>
  allNodes: { id: string; kind: string; name?: string; path?: string }[]
}>()

defineEmits<{
  mousedown: [e: MouseEvent]; select: []; edit: []; delete: []
  'start-relation': [fieldId: string]; 'end-relation': [fieldId: string]; 'resize-start': [e: MouseEvent]
}>()

const methodColor = computed(() => METHOD_COLORS[props.node.method] ?? '#3ECF8E')

function hexToRgb(hex: string): string {
  if (!hex || hex[0] !== '#') return '62, 207, 142'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}
function refName(id: string) { return props.allNodes.find(n => n.id === id)?.name ?? '?' }
function statusClass(code: number) {
  if (code < 300) return 'ok'
  if (code < 400) return 'redirect'
  if (code < 500) return 'err4'
  return 'err5'
}
</script>

<style scoped>
.ep-node {
  position: absolute; border-radius: 12px;
  background: #13131c; border: 1.5px solid #22222e;
  box-shadow: 0 6px 32px #00000060;
  overflow: visible; cursor: grab; min-width: 260px; box-sizing: border-box;
  transition: border-color 0.18s, box-shadow 0.18s;
  font-family: 'JetBrains Mono', monospace;
}
.ep-node:active { cursor: grabbing; }
.ep-node.selected {
  border-color: var(--mc);
  box-shadow: 0 0 0 2.5px rgba(var(--mc-rgb, 62, 207, 142), 0.28), 0 8px 40px #00000080;
}
.ep-node.highlighted {
  box-shadow: 0 0 0 2px rgba(var(--mc-rgb, 62, 207, 142), 0.45),
              0 0 40px rgba(var(--mc-rgb, 62, 207, 142), 0.15);
}

.ep-header {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 12px 10px;
  background: linear-gradient(135deg,
    rgba(var(--mc-rgb, 62, 207, 142), 0.2) 0%,
    rgba(var(--mc-rgb, 62, 207, 142), 0.07) 100%);
  border-bottom: 1px solid rgba(var(--mc-rgb, 62, 207, 142), 0.22);
  border-radius: 11px 11px 0 0;
}

.method-badge {
  font-size: 10px; font-weight: 900; letter-spacing: 0.08em;
  padding: 4px 9px; border-radius: 6px;
  background: var(--mc); color: #060610; flex-shrink: 0; margin-top: 1px;
}

.ep-title { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ep-path { font-size: 12.5px; font-weight: 700; color: #f0f0f8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ep-summary { font-size: 10.5px; color: #5a5a72; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.node-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
.ep-node:hover .node-actions, .ep-node.selected .node-actions { opacity: 1; }
.icon-btn { width: 22px; height: 22px; background: none; border: none; color: #555; cursor: pointer; font-size: 12px; border-radius: 5px; display: flex; align-items: center; justify-content: center; transition: color 0.15s, background 0.15s; }
.icon-btn:hover { color: #ddd; background: rgba(255,255,255,0.07); }
.icon-btn.danger:hover { color: #EF4444; background: #EF444418; }

.ep-tags { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 12px; border-bottom: 1px solid #1a1a26; }
.ep-tag { font-size: 9.5px; padding: 2px 7px; border-radius: 10px; background: rgba(var(--mc-rgb, 62, 207, 142), 0.12); color: var(--mc); border: 1px solid rgba(var(--mc-rgb, 62, 207, 142), 0.28); font-weight: 600; }

.section-divider { display: flex; align-items: center; justify-content: space-between; padding: 5px 12px 3px; background: #0d0d13; }
.section-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #38384e; }
.section-cnt { font-size: 9px; color: #2a2a40; background: #161622; padding: 1px 5px; border-radius: 8px; }

.field-row { display: flex; align-items: center; gap: 7px; padding: 0 12px; height: 32px; position: relative; transition: background 0.1s; }
.field-row:hover { background: #181824; }

.loc-chip { font-size: 9px; font-weight: 800; width: 18px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.loc-chip.path   { background: #3B82F618; color: #3B82F6; }
.loc-chip.query  { background: #8B5CF618; color: #8B5CF6; }
.loc-chip.header { background: #F59E0B18; color: #F59E0B; }
.loc-chip.body   { background: #3ECF8E18; color: #3ECF8E; }

.status-chip { font-size: 9.5px; font-weight: 800; padding: 2px 6px; border-radius: 5px; flex-shrink: 0; letter-spacing: 0.04em; }
.status-chip.ok       { background: #3ECF8E18; color: #3ECF8E; }
.status-chip.redirect { background: #F59E0B18; color: #F59E0B; }
.status-chip.err4     { background: #EF444418; color: #EF4444; }
.status-chip.err5     { background: #8B5CF618; color: #8B5CF6; }

.field-name { flex: 1; font-size: 12px; color: #b0b0c8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.field-type { font-size: 11px; color: rgba(var(--mc-rgb, 62, 207, 142), 0.55); flex-shrink: 0; }

.connector { position: absolute; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #2a2a3a; background: #13131c; cursor: crosshair; z-index: 10; transition: border-color 0.12s, background 0.12s, transform 0.12s; }
.conn-right { right: -6px; }
.conn-left  { left: -6px; top: 50%; transform: translateY(-50%); }
.connector.connected { border-color: var(--mc); background: var(--mc); }
.conn-right:hover { border-color: #fff !important; background: #fff !important; transform: scale(1.5); }
.conn-left:hover  { border-color: #fff !important; background: #fff !important; transform: translateY(-50%) scale(1.5); }

.ep-footer { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; border-top: 1px solid #181824; background: #0d0d13; border-radius: 0 0 11px 11px; }
.footer-stat { font-size: 10px; color: #30304a; }
.footer-kind { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(var(--mc-rgb, 62, 207, 142), 0.35); }

.resize-handle {
  position: absolute; bottom: 4px; right: 5px; width: 13px; height: 13px; cursor: se-resize; opacity: 0; transition: opacity 0.15s;
  background: radial-gradient(circle at 100% 100%, rgba(var(--mc-rgb, 62, 207, 142), 0.6) 30%, transparent 30%);
}
.ep-node:hover .resize-handle, .ep-node.selected .resize-handle { opacity: 1; }
</style>
