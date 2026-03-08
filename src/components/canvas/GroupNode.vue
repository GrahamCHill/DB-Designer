<template>
  <div
    class="group-node"
    :class="{ selected, nested: depth > 0 }"
    :style="{
      left:  group.position.x + 'px',
      top:   group.position.y + 'px',
      width: group.size.w + 'px',
      height: group.size.h + 'px',
      '--group-color': group.color,
      '--nest-depth': depth,
    }"
    @click.stop="$emit('select')"
  >
    <!-- Drag header -->
    <div
      class="group-header"
      @mousedown.stop="$emit('mousedown-header', $event)"
      @dblclick.stop="$emit('edit')"
    >
      <span class="group-icon">{{ depth > 0 ? '▤' : '▣' }}</span>
      <span class="group-name">{{ group.name }}</span>
      <span v-if="depth > 0" class="nest-badge" title="Nested group">{{ depth }}</span>
      <button class="group-edit-btn" @click.stop="$emit('edit')" title="Edit group">✎</button>
    </div>

    <!-- Resize handle -->
    <div
      class="resize-handle"
      @mousedown.stop="$emit('mousedown-resize', $event)"
      title="Drag to resize"
    >⌟</div>
  </div>
</template>

<script setup lang="ts">
import type { TableGroup } from '../../types'

defineProps<{
  group: TableGroup
  selected: boolean
  depth: number
}>()

defineEmits<{
  select: []
  edit: []
  'mousedown-header': [e: MouseEvent]
  'mousedown-resize': [e: MouseEvent]
}>()
</script>

<style scoped>
.group-node {
  position: absolute;
  border-radius: 12px;
  pointer-events: none;
  transition: box-shadow 0.2s;
  /* depth 0 = solid border; deeper = dashed */
  border: 1.5px solid color-mix(in srgb, var(--group-color, #3ECF8E) 35%, transparent);
  border-style: solid;
  background: color-mix(in srgb, var(--group-color, #3ECF8E) 2%, transparent);
}

.group-node.nested {
  border-style: dashed;
  background: color-mix(in srgb, var(--group-color, #3ECF8E) 4%, transparent);
}

.group-node.selected {
  box-shadow:
    0 0 0 2px var(--group-color),
    0 0 24px color-mix(in srgb, var(--group-color) 20%, transparent);
}

/* Header */
.group-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px 6px;
  cursor: grab;
  pointer-events: all;
  border-radius: 10px 10px 0 0;
  background: color-mix(in srgb, var(--group-color, #3ECF8E) 7%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--group-color, #3ECF8E) 18%, transparent);
  user-select: none;
}
.group-header:active { cursor: grabbing; }

.group-icon {
  font-size: 12px;
  color: var(--group-color);
  opacity: 0.8;
  flex-shrink: 0;
}

.group-name {
  flex: 1;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--group-color);
  opacity: 0.9;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nest-badge {
  font-size: 9px;
  font-weight: 700;
  color: var(--group-color);
  opacity: 0.5;
  background: color-mix(in srgb, var(--group-color) 15%, transparent);
  border-radius: 3px;
  padding: 1px 4px;
  flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
}

.group-edit-btn {
  background: none;
  border: none;
  color: var(--group-color);
  opacity: 0;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
  border-radius: 4px;
  pointer-events: all;
  transition: opacity 0.15s, background 0.15s;
}
.group-header:hover .group-edit-btn { opacity: 0.7; }
.group-edit-btn:hover { opacity: 1 !important; background: color-mix(in srgb, var(--group-color) 20%, transparent); }

/* Resize handle */
.resize-handle {
  position: absolute;
  bottom: 4px; right: 6px;
  font-size: 14px;
  color: var(--group-color);
  opacity: 0.35;
  cursor: se-resize;
  pointer-events: all;
  user-select: none;
  line-height: 1;
  transition: opacity 0.15s;
}
.group-node:hover .resize-handle { opacity: 0.75; }
</style>
