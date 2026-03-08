<template>
  <div class="app">
    <Sidebar />
    <div class="main-area">
      <TabBar />
      <main class="main">
        <DiagramCanvas />
      </main>
    </div>

    <TableEditorModal
      v-if="store.editingTableId && editingTable"
      :table="editingTable"
      @close="store.editingTableId = null"
    />

    <DBConnectModal
      v-if="showDBConnect"
      @close="showDBConnect = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSchemaStore } from './stores/schema'
import Sidebar from './components/sidebar/Sidebar.vue'
import TabBar from './components/canvas/TabBar.vue'
import DiagramCanvas from './components/canvas/DiagramCanvas.vue'
import TableEditorModal from './components/modals/TableEditorModal.vue'
import DBConnectModal from './components/modals/DBConnectModal.vue'

const store = useSchemaStore()
const showDBConnect = ref(false)

const editingTable = computed(() =>
  store.schema.tables.find(t => t.id === store.editingTableId) ?? null
)

// Expose showDBConnect globally so Sidebar can trigger it
;(window as any).__dbModelerShowConnect = () => { showDBConnect.value = true }
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #app { height: 100%; width: 100%; overflow: hidden; }

body {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background: #0f0f12;
  color: #d0d0d8;
  -webkit-font-smoothing: antialiased;
}

.app { display: flex; height: 100vh; width: 100vw; overflow: hidden; }

.main-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.main { flex: 1; overflow: hidden; position: relative; }
</style>
