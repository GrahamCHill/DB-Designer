<template>
  <div class="tab-bar">
    <div class="tabs-scroll">
      <div
        v-for="tab in tabsStore.tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: tabsStore.activeTabId === tab.id }"
        @click="tabsStore.switchTab(tab.id)"
        @dblclick="startRename(tab.id, tab.label)"
      >
        <span class="tab-icon">⬡</span>
        <input
          v-if="renamingTabId === tab.id"
          class="tab-rename-input"
          v-model="renameValue"
          @keydown.enter="commitRename"
          @keydown.escape="renamingTabId = null"
          @blur="commitRename"
          ref="renameInputEl"
          @click.stop
        />
        <span v-else class="tab-label">{{ tab.label }}</span>
        <span v-if="tab.isDirty" class="tab-dirty" title="Unsaved changes">●</span>
        <button
          class="tab-close"
          @click.stop="closeTab(tab.id)"
          title="Close tab"
        >✕</button>
      </div>
    </div>

    <button class="new-tab-btn" @click="tabsStore.newTab()" title="New diagram">+</button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useTabsStore } from '../../stores/tabs'

const tabsStore = useTabsStore()
const renamingTabId = ref<string | null>(null)
const renameValue = ref('')
const renameInputEl = ref<HTMLInputElement>()

function startRename(tabId: string, currentLabel: string) {
  renamingTabId.value = tabId
  renameValue.value = currentLabel
  nextTick(() => renameInputEl.value?.select())
}

function commitRename() {
  if (renamingTabId.value && renameValue.value.trim()) {
    tabsStore.renameTab(renamingTabId.value, renameValue.value.trim())
  }
  renamingTabId.value = null
}

function closeTab(tabId: string) {
  if (tabsStore.tabs.length === 1) return // keep at least one
  tabsStore.closeTab(tabId)
}
</script>

<style scoped>
.tab-bar {
  display: flex;
  align-items: stretch;
  background: #0c0c0f;
  border-bottom: 1px solid #1c1c24;
  height: 38px;
  min-height: 38px;
  overflow: hidden;
  flex-shrink: 0;
}

.tabs-scroll {
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  flex: 1;
  scrollbar-width: none;
}

.tabs-scroll::-webkit-scrollbar { display: none; }

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  min-width: 120px;
  max-width: 200px;
  border-right: 1px solid #1c1c24;
  cursor: pointer;
  color: #555;
  font-size: 12px;
  position: relative;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
  user-select: none;
}

.tab:hover {
  background: #14141a;
  color: #888;
}

.tab.active {
  background: #0f0f12;
  color: #e0e0e0;
  border-bottom: 2px solid #3ECF8E;
}

.tab-icon {
  font-size: 11px;
  color: #3ECF8E;
  opacity: 0.6;
  flex-shrink: 0;
}

.tab.active .tab-icon {
  opacity: 1;
}

.tab-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', monospace;
}

.tab-rename-input {
  flex: 1;
  background: #1a1a22;
  border: 1px solid #3ECF8E60;
  border-radius: 3px;
  color: #e0e0e0;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  padding: 2px 5px;
  outline: none;
  min-width: 0;
}

.tab-dirty {
  font-size: 8px;
  color: #F59E0B;
  flex-shrink: 0;
}

.tab-close {
  background: none;
  border: none;
  color: #333;
  font-size: 10px;
  cursor: pointer;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
  opacity: 0;
}

.tab:hover .tab-close,
.tab.active .tab-close {
  opacity: 1;
}

.tab-close:hover {
  color: #EF4444;
  background: #EF444420;
}

.new-tab-btn {
  background: none;
  border: none;
  border-left: 1px solid #1c1c24;
  color: #444;
  font-size: 18px;
  cursor: pointer;
  width: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
}

.new-tab-btn:hover {
  color: #3ECF8E;
  background: #14141a;
}
</style>
