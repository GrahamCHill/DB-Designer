<template>
  <div
    class="svc-node"
    :class="{ selected }"
    :style="{
      left:   service.position.x + 'px',
      top:    service.position.y + 'px',
      width:  service.size.w + 'px',
      height: service.size.h + 'px',
      '--sc':  service.color,
      '--sc-rgb': hexToRgb(service.color),
    }"
    @click.stop="$emit('select')"
  >
    <!-- Drag header -->
    <div class="svc-header" @mousedown.stop="$emit('mousedown-header', $event)">
      <div class="svc-hex">⬡</div>
      <div class="svc-info">
        <span class="svc-name">{{ service.name }}</span>
        <span class="svc-url">{{ service.url }}</span>
      </div>
      <div class="svc-actions">
        <button class="icon-btn" @click.stop="$emit('edit')">✎</button>
        <button class="icon-btn danger" @click.stop="$emit('delete')">✕</button>
      </div>
    </div>

    <!-- Subtle inner grid pattern -->
    <div class="svc-body">
      <div v-if="typeCount === 0" class="svc-empty">
        <span class="svc-empty-icon">⬡</span>
        <span>Add types to this service</span>
      </div>
    </div>

    <div class="svc-footer">
      <span class="svc-stat">{{ typeCount }} type{{ typeCount !== 1 ? 's' : '' }}</span>
    </div>

    <div class="svc-resize" @mousedown.stop="$emit('mousedown-resize', $event)" />
  </div>
</template>

<script setup lang="ts">
import type { FedService } from '../../../types/api'
defineProps<{ service: FedService; selected: boolean; typeCount: number }>()
defineEmits<{
  'mousedown-header': [e: MouseEvent]; 'mousedown-resize': [e: MouseEvent]
  select: []; edit: []; delete: []
}>()

function hexToRgb(hex: string): string {
  if (!hex || hex[0] !== '#') return '62, 207, 142'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}
</script>

<style scoped>
.svc-node {
  position: absolute; border-radius: 16px;
  background: rgba(var(--sc-rgb, 13, 13, 18), 0.04);
  border: 1.5px solid rgba(var(--sc-rgb, 62, 207, 142), 0.3);
  box-shadow:
    0 0 0 1px rgba(var(--sc-rgb, 62, 207, 142), 0.1),
    inset 0 0 80px rgba(var(--sc-rgb, 62, 207, 142), 0.03);
  box-sizing: border-box; overflow: visible;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.svc-node.selected {
  border-color: var(--sc);
  box-shadow: 0 0 0 2.5px rgba(var(--sc-rgb, 62, 207, 142), 0.22),
              inset 0 0 80px rgba(var(--sc-rgb, 62, 207, 142), 0.05);
}

.svc-header {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  background: rgba(var(--sc-rgb, 10, 10, 16), 0.12);
  border-bottom: 1px solid rgba(var(--sc-rgb, 62, 207, 142), 0.22);
  border-radius: 15px 15px 0 0;
  cursor: grab;
}
.svc-header:active { cursor: grabbing; }

.svc-hex { font-size: 20px; color: var(--sc); flex-shrink: 0; opacity: 0.85; }

.svc-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.svc-name { font-size: 13px; font-weight: 800; color: #f0f0f8; font-family: 'JetBrains Mono', monospace; }
.svc-url  { font-size: 9.5px; color: #3a3a52; font-family: 'JetBrains Mono', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.svc-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
.svc-node:hover .svc-actions, .svc-node.selected .svc-actions { opacity: 1; }
.icon-btn { width: 22px; height: 22px; background: none; border: none; color: #555; cursor: pointer; font-size: 12px; border-radius: 5px; display: flex; align-items: center; justify-content: center; transition: color 0.15s, background 0.15s; }
.icon-btn:hover { color: #ddd; background: rgba(255,255,255,0.07); }
.icon-btn.danger:hover { color: #EF4444; background: #EF444418; }

.svc-body {
  position: absolute; inset: 44px 0 32px 0;
  background-image: radial-gradient(circle, rgba(var(--sc-rgb, 62, 207, 142), 0.06) 1px, transparent 1px);
  background-size: 20px 20px;
}
.svc-empty { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; opacity: 0.4; }
.svc-empty-icon { font-size: 28px; color: var(--sc); }
.svc-empty span { font-size: 11px; color: var(--sc); font-family: 'JetBrains Mono', monospace; white-space: nowrap; }

.svc-footer { position: absolute; bottom: 0; left: 0; right: 0; padding: 6px 14px; border-top: 1px solid rgba(var(--sc-rgb, 62, 207, 142), 0.15); border-radius: 0 0 15px 15px; }
.svc-stat { font-size: 10px; color: var(--sc); opacity: 0.45; font-family: 'JetBrains Mono', monospace; }

.svc-resize {
  position: absolute; bottom: 6px; right: 8px; width: 16px; height: 16px; cursor: se-resize; opacity: 0; transition: opacity 0.15s;
  background: radial-gradient(circle at 100% 100%, rgba(var(--sc-rgb, 62, 207, 142), 0.55) 35%, transparent 35%);
}
.svc-node:hover .svc-resize, .svc-node.selected .svc-resize { opacity: 1; }
</style>
