<template>
  <div
    class="fed-node"
    :class="{ selected, highlighted, 'is-entity': node.isEntity, 'is-ext': node.isExtension }"
    :style="{
      left:  node.position.x + 'px',
      top:   node.position.y + 'px',
      width: node.width + 'px',
      '--nc': node.color,
      '--nc-rgb': hexToRgb(node.color),
    }"
    @mousedown.stop="$emit('mousedown', $event)"
    @click.stop="$emit('select')"
  >
    <!-- Header -->
    <div class="fed-header">
      <div class="fed-badges">
        <span v-if="node.isExtension" class="badge ext-badge">extend</span>
        <span v-if="node.isEntity"    class="badge key-badge">@key</span>
      </div>
      <div class="fed-title">
        <span class="fed-name">{{ node.name }}</span>
        <span class="fed-svc">{{ serviceLabel }}</span>
      </div>
      <div class="node-actions">
        <button class="icon-btn" @click.stop="$emit('edit')">✎</button>
        <button class="icon-btn danger" @click.stop="$emit('delete')">✕</button>
      </div>
    </div>

    <!-- @key summary bar -->
    <div v-if="node.isEntity && node.keyFields.length" class="key-bar">
      <span class="key-icon">⚿</span>
      <span class="key-fields">{{ node.keyFields.join(', ') }}</span>
    </div>

    <!-- Fields -->
    <div class="section-divider">
      <span class="section-lbl">Fields</span>
      <span class="section-cnt">{{ node.fields.length }}</span>
    </div>

    <div v-for="field in node.fields" :key="field.id" class="field-row"
      :class="{ 'f-key': field.isKey, 'f-ext': field.isExternal }">
      <div class="connector conn-left"
        :class="{ connected: connectedAsTarget.has(field.id) }"
        @mouseup.stop="$emit('end-relation', field.id)" />

      <!-- Decorator icons -->
      <div class="dec-cluster">
        <span v-if="field.isKey"      class="dec k" title="@key">K</span>
        <span v-if="field.isExternal" class="dec e" title="@external">E</span>
        <span v-if="field.isRequired" class="dec r" title="@requires">R</span>
        <span v-if="!field.isKey && !field.isExternal && !field.isRequired" class="dec-empty" />
      </div>

      <span class="field-name">{{ field.name }}</span>
      <span class="field-type">{{ field.type }}</span>

      <div class="connector conn-right"
        :class="{ connected: connectedAsSource.has(field.id) }"
        @mousedown.stop="$emit('start-relation', field.id)" />
    </div>

    <div v-if="!node.fields.length" class="no-fields">No fields</div>

    <!-- Footer -->
    <div class="fed-footer">
      <span class="footer-stat">{{ node.fields.length }} fields</span>
      <span class="footer-kind">federation</span>
    </div>

    <div class="resize-handle" @mousedown.stop="$emit('resize-start', $event)" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FedTypeNode, FedService } from '../../../types/api'

const props = defineProps<{
  node: FedTypeNode; selected: boolean; highlighted: boolean
  connectedAsSource: Set<string>; connectedAsTarget: Set<string>
  services: FedService[]
}>()

defineEmits<{
  mousedown: [e: MouseEvent]; select: []; edit: []; delete: []
  'start-relation': [fieldId: string]; 'end-relation': [fieldId: string]; 'resize-start': [e: MouseEvent]
}>()

function hexToRgb(hex: string): string {
  if (!hex || hex[0] !== '#') return '139, 92, 246'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}
const serviceLabel = computed(() => props.services.find(s => s.id === props.node.serviceId)?.name ?? 'unassigned')
</script>

<style scoped>
.fed-node {
  position: absolute; border-radius: 12px;
  background: #13131c; border: 1.5px solid #22222e;
  box-shadow: 0 6px 32px #00000060;
  overflow: visible; cursor: grab; min-width: 260px; box-sizing: border-box;
  transition: border-color 0.18s, box-shadow 0.18s;
  font-family: 'JetBrains Mono', monospace;
}
.fed-node:active { cursor: grabbing; }
.fed-node.is-entity { box-shadow: 0 0 16px rgba(var(--nc-rgb, 139, 92, 246), 0.14), 0 6px 32px #00000060; }
.fed-node.is-ext { border-style: dashed; border-color: #2a2a40; }
.fed-node.selected {
  border-color: var(--nc); border-style: solid;
  box-shadow: 0 0 0 2.5px rgba(var(--nc-rgb, 139, 92, 246), 0.28), 0 8px 40px #00000080;
}
.fed-node.highlighted {
  box-shadow: 0 0 0 2px rgba(var(--nc-rgb, 139, 92, 246), 0.45),
              0 0 40px rgba(var(--nc-rgb, 139, 92, 246), 0.15);
}

.fed-header {
  display: flex; align-items: center; gap: 8px; padding: 11px 12px 9px;
  background: linear-gradient(135deg,
    rgba(var(--nc-rgb, 139, 92, 246), 0.2) 0%,
    rgba(var(--nc-rgb, 139, 92, 246), 0.07) 100%);
  border-bottom: 1px solid rgba(var(--nc-rgb, 139, 92, 246), 0.2);
  border-radius: 11px 11px 0 0;
}

.fed-badges { display: flex; flex-direction: column; gap: 3px; flex-shrink: 0; }
.badge { font-size: 8px; font-weight: 800; padding: 2px 5px; border-radius: 3px; letter-spacing: 0.06em; text-transform: uppercase; }
.key-badge { background: #F59E0B18; color: #F59E0B; border: 1px solid #F59E0B35; }
.ext-badge { background: #8B5CF618; color: #8B5CF6; border: 1px solid #8B5CF635; }

.fed-title { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fed-name { font-size: 13px; font-weight: 800; color: #f0f0f8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fed-svc { font-size: 9px; color: var(--nc); opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.node-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
.fed-node:hover .node-actions, .fed-node.selected .node-actions { opacity: 1; }
.icon-btn { width: 22px; height: 22px; background: none; border: none; color: #555; cursor: pointer; font-size: 12px; border-radius: 5px; display: flex; align-items: center; justify-content: center; transition: color 0.15s, background 0.15s; }
.icon-btn:hover { color: #ddd; background: rgba(255,255,255,0.07); }
.icon-btn.danger:hover { color: #EF4444; background: #EF444418; }

.key-bar { display: flex; align-items: center; gap: 6px; padding: 5px 12px; background: #F59E0B08; border-bottom: 1px solid #F59E0B20; }
.key-icon { font-size: 12px; color: #F59E0B; }
.key-fields { font-size: 10.5px; color: #F59E0B80; }

.section-divider { display: flex; align-items: center; justify-content: space-between; padding: 5px 12px 3px; background: #0d0d13; }
.section-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #38384e; }
.section-cnt { font-size: 9px; color: #2a2a40; background: #161622; padding: 1px 5px; border-radius: 8px; }

.field-row { display: flex; align-items: center; gap: 6px; padding: 0 12px; height: 32px; position: relative; transition: background 0.1s; }
.field-row:hover { background: #181824; }
.field-row.f-key  { background: #F59E0B06; }
.field-row.f-ext  { opacity: 0.55; }

.dec-cluster { display: flex; gap: 2px; align-items: center; width: 36px; flex-shrink: 0; }
.dec { font-size: 8px; font-weight: 900; width: 14px; height: 14px; border-radius: 3px; display: flex; align-items: center; justify-content: center; }
.dec.k { background: #F59E0B20; color: #F59E0B; }
.dec.e { background: #55555520; color: #777; }
.dec.r { background: #8B5CF620; color: #8B5CF6; }
.dec-empty { width: 14px; }

.field-name { flex: 1; font-size: 12px; color: #b0b0c8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.field-type { font-size: 11px; color: var(--nc); opacity: 0.6; flex-shrink: 0; }

.connector { position: absolute; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #2a2a3a; background: #13131c; cursor: crosshair; z-index: 10; transition: border-color 0.12s, background 0.12s, transform 0.12s; }
.conn-right { right: -6px; }
.conn-left  { left: -6px; }
.connector.connected { border-color: var(--nc); background: var(--nc); }
.conn-right:hover { border-color: #F59E0B !important; background: #F59E0B !important; transform: scale(1.5); }
.conn-left:hover  { border-color: #F59E0B !important; background: #F59E0B !important; transform: scale(1.5); }

.no-fields { padding: 12px; text-align: center; font-size: 11px; color: #28283a; font-style: italic; }

.fed-footer { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; border-top: 1px solid #181824; background: #0d0d13; border-radius: 0 0 11px 11px; }
.footer-stat { font-size: 10px; color: #30304a; }
.footer-kind { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(var(--nc-rgb, 139, 92, 246), 0.35); }

.resize-handle {
  position: absolute; bottom: 4px; right: 5px; width: 13px; height: 13px; cursor: se-resize; opacity: 0; transition: opacity 0.15s;
  background: radial-gradient(circle at 100% 100%, rgba(var(--nc-rgb, 139, 92, 246), 0.6) 30%, transparent 30%);
}
.fed-node:hover .resize-handle, .fed-node.selected .resize-handle { opacity: 1; }
</style>
