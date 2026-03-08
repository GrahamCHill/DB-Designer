<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal">
        <div class="modal-header">
          <div class="header-left">
            <span class="modal-icon">⬡</span>
            <div>
              <div class="modal-title">Connect to Database</div>
              <div class="modal-sub">Import schema from a live database</div>
            </div>
          </div>
          <button class="close-btn" @click="$emit('close')">✕</button>
        </div>

        <div class="modal-body">
          <!-- Dialect tabs -->
          <div class="dialect-row">
            <button
              v-for="d in DIALECTS"
              :key="d.value"
              class="dialect-btn"
              :class="{ active: dialect === d.value }"
              @click="dialect = d.value"
            >
              <span class="dialect-icon">{{ d.icon }}</span>
              {{ d.label }}
            </button>
          </div>

          <!-- SQLite: just a file path -->
          <template v-if="dialect === 'sqlite'">
            <label class="field-label">Database file path</label>
            <div class="input-row">
              <input class="field-input" v-model="sqlitePath" placeholder="/path/to/database.db" />
              <button class="browse-btn" @click="browseSQLite">Browse…</button>
            </div>
          </template>

          <!-- Others: host/port/user/pass/db -->
          <template v-else>
            <div class="form-grid">
              <div class="form-field">
                <label class="field-label">Host</label>
                <input class="field-input" v-model="form.host" placeholder="localhost" />
              </div>
              <div class="form-field" style="max-width:100px">
                <label class="field-label">Port</label>
                <input class="field-input" v-model="form.port" :placeholder="defaultPort" type="number" />
              </div>
            </div>
            <div class="form-field">
              <label class="field-label">Database name</label>
              <input class="field-input" v-model="form.database" placeholder="mydb" />
            </div>
            <div class="form-grid">
              <div class="form-field">
                <label class="field-label">Username</label>
                <input class="field-input" v-model="form.username" placeholder="postgres" />
              </div>
              <div class="form-field">
                <label class="field-label">Password</label>
                <input class="field-input" v-model="form.password" type="password" placeholder="••••••••" />
              </div>
            </div>
            <div v-if="dialect === 'sqlserver'" class="form-field">
              <label class="field-label">Instance (optional)</label>
              <input class="field-input" v-model="form.instance" placeholder="SQLEXPRESS" />
            </div>
          </template>

          <!-- SSL toggle for networked DBs -->
          <div v-if="dialect !== 'sqlite'" class="ssl-row">
            <label class="toggle-label">
              <input type="checkbox" v-model="form.ssl" />
              <span class="toggle-text">Use SSL / TLS</span>
            </label>
          </div>

          <!-- Status / error -->
          <div v-if="status" class="status-bar" :class="statusClass">
            {{ status }}
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-test" @click="testConnection" :disabled="loading">
            <span v-if="loading" class="spinner">⟳</span>
            {{ loading ? 'Connecting…' : '⚡ Test Connection' }}
          </button>
          <div class="footer-right">
            <button class="btn-cancel" @click="$emit('close')">Cancel</button>
            <button class="btn-import" @click="importSchema" :disabled="loading || !connected">
              ↓ Import Schema
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useSchemaStore } from '../../stores/schema'
import type { Schema } from '../../types'

// Tauri invoke — gracefully degrades if not in Tauri context
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const w = window as any
  if (w.__TAURI__) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<T>(cmd, args)
  }
  throw new Error('Not running in Tauri — cannot connect to database')
}

type DBDialect = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver'

const DIALECTS = [
  { value: 'postgresql' as DBDialect, label: 'PostgreSQL', icon: '🐘', defaultPort: 5432 },
  { value: 'mysql'      as DBDialect, label: 'MySQL',      icon: '🐬', defaultPort: 3306 },
  { value: 'sqlite'     as DBDialect, label: 'SQLite',     icon: '🗄',  defaultPort: 0    },
  { value: 'sqlserver'  as DBDialect, label: 'SQL Server', icon: '🪟',  defaultPort: 1433 },
]

const emit = defineEmits<{ close: [] }>()
const store = useSchemaStore()

const dialect = ref<DBDialect>('postgresql')
const sqlitePath = ref('')
const form = reactive({
  host: 'localhost',
  port: '',
  database: '',
  username: '',
  password: '',
  instance: '',
  ssl: false,
})

const status = ref('')
const statusClass = ref('')
const loading = ref(false)
const connected = ref(false)

const defaultPort = computed(() =>
  DIALECTS.find(d => d.value === dialect.value)?.defaultPort?.toString() ?? ''
)

function buildConnectionArgs() {
  if (dialect.value === 'sqlite') {
    return { dialect: dialect.value, path: sqlitePath.value }
  }
  return {
    dialect: dialect.value,
    host: form.host,
    port: Number(form.port) || Number(defaultPort.value),
    database: form.database,
    username: form.username,
    password: form.password,
    ssl: form.ssl,
    instance: form.instance || null,
  }
}

async function testConnection() {
  loading.value = true
  connected.value = false
  status.value = 'Testing connection…'
  statusClass.value = 'info'
  try {
    const result = await tauriInvoke<{ ok: boolean; message: string }>('db_test_connection', buildConnectionArgs())
    if (result.ok) {
      status.value = '✓ Connection successful!'
      statusClass.value = 'success'
      connected.value = true
    } else {
      status.value = `✗ ${result.message}`
      statusClass.value = 'error'
    }
  } catch (e: any) {
    status.value = `✗ ${e?.message ?? String(e)}`
    statusClass.value = 'error'
  } finally {
    loading.value = false
  }
}

async function importSchema() {
  loading.value = true
  status.value = 'Importing schema…'
  statusClass.value = 'info'
  try {
    const schema = await tauriInvoke<Schema>('db_import_schema', buildConnectionArgs())
    store.loadFromJSON(schema)
    status.value = `✓ Imported ${schema.tables.length} tables`
    statusClass.value = 'success'
    setTimeout(() => emit('close'), 800)
  } catch (e: any) {
    status.value = `✗ ${e?.message ?? String(e)}`
    statusClass.value = 'error'
  } finally {
    loading.value = false
  }
}

async function browseSQLite() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const path = await open({ filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }] })
    if (typeof path === 'string') sqlitePath.value = path
  } catch {
    // Not in Tauri or dialog not available
    const input = prompt('Enter the path to your SQLite file:')
    if (input) sqlitePath.value = input
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: #00000080;
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000;
}

.modal {
  background: #16161a;
  border: 1px solid #2a2a35;
  border-radius: 12px;
  width: 540px; max-width: 95vw;
  box-shadow: 0 24px 80px #00000099;
  overflow: hidden;
}

.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #1e1e28;
}

.header-left { display: flex; align-items: center; gap: 12px; }
.modal-icon { font-size: 22px; color: #3ECF8E; }
.modal-title { font-size: 15px; font-weight: 700; color: #f0f0f0; }
.modal-sub { font-size: 11px; color: #444; margin-top: 2px; }

.close-btn {
  background: none; border: none; color: #444; font-size: 15px;
  cursor: pointer; padding: 4px 6px; border-radius: 4px; transition: color 0.15s;
}
.close-btn:hover { color: #e0e0e0; }

.modal-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }

.dialect-row { display: flex; gap: 6px; }

.dialect-btn {
  flex: 1; background: #1a1a22; border: 1px solid #2a2a35;
  color: #666; border-radius: 7px; padding: 8px 6px;
  font-size: 11px; cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.dialect-btn:hover { color: #c0c0cc; border-color: #3a3a50; }
.dialect-btn.active {
  background: #1a2820; color: #3ECF8E; border-color: #3ECF8E50;
}
.dialect-icon { font-size: 14px; }

.field-label {
  display: block; font-size: 10px; font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase; color: #555; margin-bottom: 6px;
}

.field-input {
  width: 100%; background: #1a1a22; border: 1px solid #2a2a35;
  border-radius: 6px; color: #e0e0e0; padding: 8px 10px; font-size: 12.5px;
  font-family: 'JetBrains Mono', monospace; outline: none;
  transition: border-color 0.15s; box-sizing: border-box;
}
.field-input:focus { border-color: #3ECF8E50; }

.form-grid { display: flex; gap: 10px; }
.form-field { flex: 1; }

.input-row { display: flex; gap: 8px; align-items: center; }

.browse-btn {
  background: #1a1a22; border: 1px solid #2a2a35; color: #888;
  border-radius: 6px; padding: 8px 12px; font-size: 12px; cursor: pointer;
  white-space: nowrap; transition: all 0.15s; flex-shrink: 0;
}
.browse-btn:hover { color: #e0e0e0; background: #22222c; }

.ssl-row { display: flex; align-items: center; }
.toggle-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.toggle-label input { accent-color: #3ECF8E; }
.toggle-text { font-size: 12px; color: #666; }

.status-bar {
  padding: 8px 12px; border-radius: 6px;
  font-size: 12px; font-family: 'JetBrains Mono', monospace;
}
.status-bar.info    { background: #1a1a28; color: #888; border: 1px solid #2a2a35; }
.status-bar.success { background: #1a2820; color: #3ECF8E; border: 1px solid #3ECF8E30; }
.status-bar.error   { background: #1f1414; color: #EF4444; border: 1px solid #EF444430; }

.modal-footer {
  padding: 14px 20px; border-top: 1px solid #1e1e28;
  display: flex; justify-content: space-between; align-items: center;
}
.footer-right { display: flex; gap: 8px; }

.btn-test {
  background: #1a1a22; border: 1px solid #2a2a35; color: #888;
  border-radius: 7px; padding: 8px 16px; font-size: 12.5px; cursor: pointer;
  display: flex; align-items: center; gap: 6px; transition: all 0.15s;
}
.btn-test:hover:not(:disabled) { color: #e0e0e0; border-color: #3a3a50; }
.btn-test:disabled { opacity: 0.5; cursor: default; }

.spinner { display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.btn-cancel {
  background: none; border: 1px solid #2a2a35; color: #888;
  border-radius: 7px; padding: 8px 14px; font-size: 12.5px; cursor: pointer; transition: all 0.15s;
}
.btn-cancel:hover { color: #e0e0e0; background: #1e1e28; }

.btn-import {
  background: #3ECF8E; color: #0a1a12; border: none;
  border-radius: 7px; padding: 8px 18px; font-size: 12.5px; font-weight: 700;
  cursor: pointer; transition: background 0.15s;
}
.btn-import:hover:not(:disabled) { background: #45e09a; }
.btn-import:disabled { opacity: 0.4; cursor: default; }
</style>
