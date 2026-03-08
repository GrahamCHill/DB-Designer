<template>
  <div class="app">
    <Sidebar />
    <main class="main">
      <DiagramCanvas />
    </main>

    <!-- Table editor modal -->
    <TableEditorModal
      v-if="store.editingTableId"
      :table="editingTable!"
      @close="store.editingTableId = null"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSchemaStore } from './stores/schema'
import Sidebar from './components/sidebar/Sidebar.vue'
import DiagramCanvas from './components/canvas/DiagramCanvas.vue'
import TableEditorModal from './components/modals/TableEditorModal.vue'

const store = useSchemaStore()

const editingTable = computed(() =>
  store.schema.tables.find(t => t.id === store.editingTableId) ?? null
)
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #app {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

body {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background: #0f0f12;
  color: #d0d0d8;
  -webkit-font-smoothing: antialiased;
}

.app {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.main {
  flex: 1;
  overflow: hidden;
  position: relative;
}
</style>
