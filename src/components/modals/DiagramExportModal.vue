<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal">
        <div class="modal-header">
          <div>
            <div class="modal-title">Export Diagram</div>
            <div class="modal-sub">{{ store.schema.name }}</div>
          </div>
          <button class="close-btn" @click="$emit('close')">x</button>
        </div>

        <div class="modal-body">
          <aside class="format-list">
            <button
              v-for="option in formatOptions"
              :key="option.value"
              class="format-card"
              :class="{ active: format === option.value }"
              @click="selectFormat(option.value)"
            >
              <span class="format-badge">{{ option.badge }}</span>
              <span class="format-name">{{ option.label }}</span>
              <span class="format-desc">{{ option.description }}</span>
            </button>
          </aside>

          <section class="preview-panel">
            <div class="preview-header">
              <div class="preview-copy">
                <div class="preview-title">{{ activeOption.label }}</div>
                <div class="preview-sub">{{ activeOption.description }}</div>
              </div>

              <div class="preview-actions">
                <div v-if="format === 'sql'" class="dialect-tabs">
                  <button
                    v-for="d in dialects"
                    :key="d.value"
                    :class="['dialect-tab', { active: dialect === d.value }]"
                    @click="dialect = d.value"
                  >{{ d.label }}</button>
                </div>

                <label v-if="supportsStyleMode" class="style-toggle">
                  <input v-model="styledOutput" type="checkbox" />
                  <span>Use styled output</span>
                </label>

                <button v-if="!isBinaryFormat" class="btn-copy" @click="copy">
                  {{ copied ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>

            <div v-if="isBinaryFormat" class="binary-preview">
              <div class="binary-hero">{{ activeOption.badge }}</div>
              <div class="binary-copy">
                Export the current DB canvas as {{ activeOption.label }} using the current image export theme.
              </div>
              <label class="binary-toggle">
                <input v-model="store.lightExportMode" type="checkbox" />
                <span>Use light image export mode</span>
              </label>
              <div class="binary-note">
                This uses the same canvas capture flow as the image export buttons did before.
              </div>
            </div>

            <pre v-else class="export-output" :class="`format-${format}`">{{ exportedText }}</pre>
          </section>
        </div>

        <div class="modal-footer">
          <span class="footer-note">{{ footerLabel }}</span>
          <button class="btn-download" @click="download">{{ downloadLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSchemaStore } from '../../stores/schema'
import { saveExportFile } from '../../composables/useFileExport'
import type { SQLDialect } from '../../types'

type ExportFormat = 'sql' | 'mermaid' | 'svg' | 'png' | 'jpg'

const props = defineProps<{
  exportImage: (format: 'png' | 'jpg') => Promise<void>
}>()

const store = useSchemaStore()

defineEmits<{
  (e: 'close'): void
}>()

const formatOptions: {
  value: ExportFormat
  label: string
  badge: string
  description: string
}[] = [
  { value: 'png', label: 'PNG Image', badge: 'PNG', description: 'Raster export for docs, slides, and sharing.' },
  { value: 'jpg', label: 'JPG Image', badge: 'JPG', description: 'Compressed image export for lightweight sharing.' },
  { value: 'svg', label: 'SVG Diagram', badge: 'SVG', description: 'Scalable vector export with readable light styling.' },
  { value: 'mermaid', label: 'Mermaid Diagram', badge: 'MMD', description: 'Text diagram export for docs and markdown flows.' },
  { value: 'sql', label: 'SQL Export', badge: 'SQL', description: 'A copy of the SQL export flow directly in this dialog.' },
]

const dialects: { label: string; value: SQLDialect }[] = [
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'SQLite', value: 'sqlite' },
  { label: 'SQL Server', value: 'sqlserver' },
]

const format = ref<ExportFormat>('png')
const dialect = ref<SQLDialect>(store.schema.dialect ?? 'postgresql')
const styledOutput = ref(true)
const copied = ref(false)

watch(() => store.schema.dialect, (value) => {
  if (value) dialect.value = value
}, { immediate: true })

const activeOption = computed(() => formatOptions.find(option => option.value === format.value) ?? formatOptions[0])
const isBinaryFormat = computed(() => format.value === 'png' || format.value === 'jpg')
const supportsStyleMode = computed(() => format.value === 'svg' || format.value === 'mermaid')
const exportedText = computed(() => {
  if (format.value === 'sql') return store.exportSQL(dialect.value)
  if (format.value === 'svg') return store.exportSVG(styledOutput.value)
  return store.exportMermaid(styledOutput.value)
})
const footerLabel = computed(() =>
  isBinaryFormat.value ? 'Exports from the current DB canvas view.' : `${exportedText.value.split('\n').length} lines`
)
const downloadLabel = computed(() => {
  if (format.value === 'sql') return 'Download .sql'
  if (format.value === 'mermaid') return 'Download .mmd'
  if (format.value === 'svg') return 'Download .svg'
  return `Save ${format.value.toUpperCase()}`
})

function selectFormat(next: ExportFormat) {
  format.value = next
}

async function copy() {
  await navigator.clipboard.writeText(exportedText.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

async function download() {
  if (format.value === 'png' || format.value === 'jpg') {
    await props.exportImage(format.value)
    return
  }

  const extension = format.value === 'mermaid' ? 'mmd' : format.value
  const mimeType = format.value === 'svg' ? 'image/svg+xml' : 'text/plain'
  await saveExportFile({
    data: exportedText.value,
    defaultPath: `${store.schema.name || 'schema'}.${extension}`,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    mimeType,
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
  padding: 18px;
}

.modal {
  background: #121319;
  border: 1px solid #2a2a35;
  border-radius: 16px;
  width: min(1040px, 100%);
  max-height: min(860px, calc(100vh - 36px));
  display: flex;
  flex-direction: column;
  box-shadow: 0 28px 90px #00000090;
  overflow: hidden;
}

.modal-header {
  padding: 18px 22px;
  border-bottom: 1px solid #1e1e28;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: #f8fafc;
}

.modal-sub {
  font-size: 11px;
  color: #748092;
  font-family: monospace;
}

.close-btn {
  background: #171922;
  border: 1px solid #2b3140;
  color: #94a3b8;
  font-size: 15px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  transition: all 0.15s;
  flex-shrink: 0;
}

.close-btn:hover {
  color: #f8fafc;
  border-color: #475569;
}

.modal-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
}

.format-list {
  border-right: 1px solid #1e1e28;
  overflow-y: auto;
  background: #101117;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: #2f3a4b #101117;
}

.format-list::-webkit-scrollbar,
.export-output::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.format-list::-webkit-scrollbar-track,
.export-output::-webkit-scrollbar-track {
  background: #11151d;
}

.format-list::-webkit-scrollbar-thumb,
.export-output::-webkit-scrollbar-thumb {
  background: #2f3a4b;
  border-radius: 999px;
  border: 2px solid #11151d;
}

.format-list::-webkit-scrollbar-thumb:hover,
.export-output::-webkit-scrollbar-thumb:hover {
  background: #41526a;
}

.format-card {
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid #1a1c25;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.format-card:hover {
  background: #171922;
}

.format-card.active {
  background: linear-gradient(180deg, #193225, #151a21);
  box-shadow: inset 3px 0 0 #3ECF8E;
}

.format-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #3ECF8E;
  background: #102017;
  border: 1px solid #244430;
  padding: 4px 8px;
  border-radius: 999px;
}

.format-name {
  font-size: 15px;
  font-weight: 700;
  color: #f8fafc;
}

.format-desc {
  font-size: 12px;
  line-height: 1.5;
  color: #94a3b8;
}

.preview-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.preview-header {
  padding: 18px 20px 14px;
  border-bottom: 1px solid #1e1e28;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.preview-copy {
  min-width: 0;
}

.preview-title {
  font-size: 15px;
  font-weight: 700;
  color: #f8fafc;
}

.preview-sub {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 3px;
  line-height: 1.5;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-left: auto;
}

.dialect-tabs {
  display: flex;
  background: #0f0f12;
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
  flex-wrap: wrap;
}

.dialect-tab {
  background: none;
  border: none;
  color: #7a869a;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.dialect-tab.active {
  background: #1e1e28;
  color: #3ECF8E;
}

.style-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid #2b3140;
  border-radius: 9px;
  background: #11151d;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.style-toggle input {
  accent-color: #3ECF8E;
}

.export-output {
  margin: 0;
  padding: 20px;
  overflow: auto;
  flex: 1;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: #2f3a4b #11151d;
  font-size: 12.5px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.format-sql {
  color: #dff6e8;
  background: #0f1511;
}

.format-mermaid {
  color: #dcfce7;
  background: #101712;
}

.format-svg {
  color: #dbeafe;
  background: #0f1720;
}

.binary-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px;
  text-align: center;
  color: #dbe4ef;
}

.binary-hero {
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #3ECF8E;
}

.binary-copy {
  max-width: 420px;
  font-size: 14px;
  line-height: 1.65;
}

.binary-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #171c24;
  border: 1px solid #2d3645;
  color: #dbe4ef;
  font-size: 13px;
  cursor: pointer;
}

.binary-toggle input {
  accent-color: #3ECF8E;
  cursor: pointer;
}

.binary-note {
  font-size: 12px;
  color: #94a3b8;
}

.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid #1e1e28;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.footer-note {
  font-size: 11px;
  color: #748092;
}

.btn-copy {
  background: #1c2230;
  border: 1px solid #324154;
  color: #dbeafe;
  border-radius: 9px;
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-copy:hover {
  color: #ffffff;
  border-color: #4b6482;
}

.btn-download {
  background: #3ECF8E;
  color: #092014;
  border: none;
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-download:hover {
  background: #52d999;
}

@media (max-width: 900px) {
  .modal-body {
    grid-template-columns: 1fr;
  }

  .format-list {
    border-right: none;
    border-bottom: 1px solid #1e1e28;
    max-height: 240px;
  }
}
</style>
