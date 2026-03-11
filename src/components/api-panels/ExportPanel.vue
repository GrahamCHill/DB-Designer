<template>
  <div class="panel-backdrop" @mousedown.self="$emit('close')">
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">Export</span>
        <div class="export-tabs">
          <button
            v-for="target in exportTargets"
            :key="target.id"
            class="exp-tab"
            :class="{ active: activeTab === target.id }"
            @click="activeTab = target.id"
          >
            {{ target.label }}
          </button>
        </div>
        <button class="close-btn" @click="$emit('close')">x</button>
      </div>

      <div class="panel-body">
        <pre class="code-preview"><code>{{ activeOutput }}</code></pre>
      </div>

      <div class="panel-footer">
        <button class="btn-copy" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</button>
        <button class="btn-download" @click="download">Download</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useApiExports } from '../../composables/useApiExports'
import type { ApiExportTarget } from '../../types/api'
import { saveExportFile } from '../../composables/useFileExport'

const { exportTargets, exportOutput, exportDownloadName, exportTargetForMode } = useApiExports()

const activeTab = ref<ApiExportTarget>(exportTargetForMode())
const copied = ref(false)

watch(exportTargets, (targets) => {
  if (!targets.some(target => target.id === activeTab.value)) {
    activeTab.value = exportTargetForMode()
  }
}, { immediate: true })

const activeOutput = computed(() => exportOutput(activeTab.value))

async function copy() {
  await navigator.clipboard.writeText(activeOutput.value)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1800)
}

async function download() {
  const fileName = exportDownloadName(activeTab.value)
  const extension = fileName.split('.').pop() ?? 'txt'

  await saveExportFile({
    data: activeOutput.value,
    defaultPath: fileName,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    mimeType: 'text/plain',
  })
}
</script>

<style scoped>
.panel-backdrop {
  position: fixed; inset: 0; background: #00000080; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}
.panel {
  background: #10101a; border: 1px solid #2a2a3a; border-radius: 12px;
  width: 820px; max-width: calc(100vw - 40px); max-height: 80vh; display: flex; flex-direction: column;
  box-shadow: 0 24px 80px #000000b0;
}
.panel-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; border-bottom: 1px solid #1e1e2a;
}
.panel-title { font-size: 14px; font-weight: 700; color: #f0f0f0; }
.export-tabs { display: flex; gap: 4px; flex: 1; overflow-x: auto; }
.exp-tab {
  padding: 5px 12px; border-radius: 5px; border: 1px solid #2a2a3a;
  background: none; color: #555; cursor: pointer; font-size: 11px; font-weight: 600;
  transition: all 0.15s; white-space: nowrap;
}
.exp-tab:hover  { color: #e0e0e0; background: #1e1e2a; }
.exp-tab.active { color: #3ECF8E; border-color: #3ECF8E40; background: #0f1f18; }
.close-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 14px; }
.close-btn:hover { color: #e0e0e0; }
.panel-body { flex: 1; overflow: auto; padding: 0; }
.code-preview {
  margin: 0; padding: 18px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px; line-height: 1.6; color: #b0c0b8;
  white-space: pre; tab-size: 2;
  background: transparent;
}
.panel-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 18px; border-top: 1px solid #1e1e2a;
}
.btn-copy {
  background: none; border: 1px solid #2a2a3a; color: #888;
  border-radius: 6px; padding: 7px 16px; font-size: 12px; cursor: pointer;
  transition: all 0.15s; min-width: 90px;
}
.btn-copy:hover { color: #e0e0e0; background: #1e1e2a; }
.btn-download {
  background: #3ECF8E; color: #0a1a12; border: none;
  border-radius: 6px; padding: 7px 20px; font-size: 12px; font-weight: 700; cursor: pointer;
}
.btn-download:hover { background: #45e09a; }
</style>

