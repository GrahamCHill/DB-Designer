<template>
  <div
    class="comment-node"
    :class="{ selected }"
    :style="{
      left: `${comment.position.x}px`,
      top: `${comment.position.y}px`,
      width: `${comment.size.w}px`,
      height: `${comment.size.h}px`,
      '--comment-color': comment.color,
    }"
    @click.stop="$emit('select', $event)"
  >
    <div class="comment-header" @mousedown.stop="$emit('mousedown-header', $event)">
      <span class="comment-kicker">NOTE</span>
      <button class="comment-delete" @click.stop="$emit('delete')">x</button>
    </div>
    <textarea
      class="comment-text"
      :value="comment.text"
      placeholder="Explain a group, caveat, TODO, or content flow..."
      @mousedown.stop
      @click.stop="$emit('select', $event)"
      @input="$emit('update:text', ($event.target as HTMLTextAreaElement).value)"
    />
    <div class="comment-resize" @mousedown.stop="$emit('mousedown-resize', $event)">::</div>
  </div>
</template>

<script setup lang="ts">
import type { CommentBox } from '../../types'

defineProps<{
  comment: CommentBox
  selected: boolean
}>()

defineEmits<{
  select: [e: MouseEvent]
  delete: []
  'update:text': [value: string]
  'mousedown-header': [e: MouseEvent]
  'mousedown-resize': [e: MouseEvent]
}>()
</script>

<style scoped>
.comment-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: color-mix(in srgb, var(--comment-color, #FDE68A) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--comment-color, #FDE68A) 40%, transparent);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14);
  backdrop-filter: blur(6px);
}

.comment-node.selected {
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--comment-color, #FDE68A) 70%, white),
    0 14px 36px rgba(0, 0, 0, 0.2);
}

.comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px 6px;
  cursor: grab;
}

.comment-kicker {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(255, 248, 220, 0.86);
}

.comment-delete {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 13px;
}

.comment-text {
  flex: 1;
  min-height: 0;
  resize: none;
  margin: 0 10px 10px;
  border: none;
  outline: none;
  background: transparent;
  color: rgba(248, 250, 252, 0.92);
  font-size: 12px;
  line-height: 1.45;
  font-family: 'JetBrains Mono', monospace;
}

.comment-text::placeholder {
  color: rgba(226, 232, 240, 0.4);
}

.comment-resize {
  position: absolute;
  right: 10px;
  bottom: 6px;
  color: rgba(255, 255, 255, 0.45);
  cursor: nwse-resize;
  user-select: none;
}
</style>
