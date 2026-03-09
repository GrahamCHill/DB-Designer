<template>
  <div class="panel-backdrop" @mousedown.self="$emit('close')">
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">Export</span>
        <div class="export-tabs">
          <button v-for="t in tabs" :key="t.id"
            class="exp-tab" :class="{ active: activeTab === t.id }"
            @click="activeTab = t.id">{{ t.label }}</button>
        </div>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="panel-body">
        <pre class="code-preview"><code>{{ activeOutput }}</code></pre>
      </div>

      <div class="panel-footer">
        <button class="btn-copy" @click="copy">{{ copied ? '✓ Copied' : '⎘ Copy' }}</button>
        <button class="btn-download" @click="download">↓ Download</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useApiStore } from '../../stores/api'

const emit  = defineEmits(['close'])
const store = useApiStore()

const activeTab = ref(
  store.mode === 'rest'       ? 'openapi'
  : store.mode === 'graphql'  ? 'gql'
  : 'fed'
)
const copied = ref(false)

const tabs = [
  { id: 'openapi', label: 'OpenAPI 3.0' },
  { id: 'gql',     label: 'GraphQL SDL' },
  { id: 'fed',     label: 'Federation SDL' },
]

const activeOutput = computed(() => {
  if (activeTab.value === 'openapi') return store.exportOpenApi()
  if (activeTab.value === 'gql')     return store.exportGqlSdl()
  return store.exportFedSdl()
})

const fileName = computed(() => {
  const name = store.project.name ?? 'api'
  if (activeTab.value === 'openapi') return `${name}.openapi.json`
  if (activeTab.value === 'gql')     return `${name}.graphql`
  return `${name}.federation.graphql`
})

async function copy() {
  await navigator.clipboard.writeText(activeOutput.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1800)
}

function download() {
  const blob = new Blob([activeOutput.value], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = fileName.value; a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.panel-backdrop {
  position: fixed; inset: 0; background: #00000080; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}
.panel {
  background: #10101a; border: 1px solid #2a2a3a; border-radius: 12px;
  width: 720px; max-height: 80vh; display: flex; flex-direction: column;
  box-shadow: 0 24px 80px #000000b0;
}
.panel-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; border-bottom: 1px solid #1e1e2a;
}
.panel-title { font-size: 14px; font-weight: 700; color: #f0f0f0; }
.export-tabs { display: flex; gap: 4px; flex: 1; }
.exp-tab {
  padding: 5px 12px; border-radius: 5px; border: 1px solid #2a2a3a;
  background: none; color: #555; cursor: pointer; font-size: 11px; font-weight: 600;
  transition: all 0.15s;
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
