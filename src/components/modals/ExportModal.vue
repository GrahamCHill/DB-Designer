<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal">
        <div class="modal-header">
          <div>
            <div class="modal-title">Export SQL</div>
            <div class="modal-sub">{{ store.schema.name }}</div>
          </div>
          <div class="dialect-tabs">
            <button
              v-for="d in dialects"
              :key="d.value"
              :class="['dialect-tab', { active: dialect === d.value }]"
              @click="dialect = d.value"
            >{{ d.label }}</button>
          </div>
          <button class="close-btn" @click="$emit('close')">✕</button>
        </div>

        <div class="modal-body">
          <pre class="sql-output">{{ sql }}</pre>
        </div>

        <div class="modal-footer">
          <span class="line-count">{{ lineCount }} lines</span>
          <div class="footer-actions">
            <button class="btn-copy" @click="copy">
              {{ copied ? '✓ Copied!' : '⎘ Copy' }}
            </button>
            <button class="btn-download" @click="download">↓ Download .sql</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSchemaStore } from '../../stores/schema'
import type { SQLDialect } from '../../types'
import { saveExportFile } from '../../composables/useFileExport'

const store = useSchemaStore()

defineEmits<{
  (e: 'close'): void
}>()

const dialects: { label: string; value: SQLDialect }[] = [
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'SQLite', value: 'sqlite' },
  { label: 'SQL Server', value: 'sqlserver' },
]

const dialect = ref<SQLDialect>(store.schema.dialect ?? 'postgresql')
const copied = ref(false)

watch(() => store.schema.dialect, (value) => {
  if (value) dialect.value = value
}, { immediate: true })

const sql = computed(() => store.exportSQL(dialect.value))
const lineCount = computed(() => sql.value.split('\n').length)

async function copy() {
  await navigator.clipboard.writeText(sql.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

async function download() {
  await saveExportFile({
    data: sql.value,
    defaultPath: `${store.schema.name}.sql`,
    filters: [{ name: 'SQL', extensions: ['sql'] }],
    mimeType: 'text/plain',
  })
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: #00000088;
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #16161a;
  border: 1px solid #2a2a35;
  border-radius: 12px;
  width: 680px;
  max-width: 95vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 80px #00000090;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #1e1e28;
  display: flex;
  align-items: center;
  gap: 16px;
}

.modal-title {
  font-size: 15px;
  font-weight: 700;
  color: #f0f0f0;
}

.modal-sub {
  font-size: 11px;
  color: #444;
  font-family: monospace;
}

.dialect-tabs {
  display: flex;
  background: #0f0f12;
  border-radius: 7px;
  padding: 3px;
  gap: 2px;
  margin-left: auto;
}

.dialect-tab {
  background: none;
  border: none;
  color: #555;
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s;
}

.dialect-tab.active {
  background: #1e1e28;
  color: #3ECF8E;
}

.close-btn {
  background: none;
  border: none;
  color: #444;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: color 0.15s;
}

.close-btn:hover { color: #e0e0e0; }

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.modal-body::-webkit-scrollbar { width: 4px; }
.modal-body::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 2px; }

.sql-output {
  margin: 0;
  padding: 20px;
  font-size: 12.5px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: #c0d0c0;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid #1e1e28;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.line-count {
  font-size: 11px;
  color: #444;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.btn-copy {
  background: #1e1e28;
  border: 1px solid #2a2a35;
  color: #888;
  border-radius: 7px;
  padding: 7px 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-copy:hover {
  color: #e0e0e0;
}

.btn-download {
  background: #3ECF8E;
  color: #0a1a12;
  border: none;
  border-radius: 7px;
  padding: 7px 16px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-download:hover { background: #45e09a; }
</style>

