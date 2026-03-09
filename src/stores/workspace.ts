import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Workspace = 'db' | 'api' | 'query' | 'codegen'

export const useWorkspaceStore = defineStore('workspace', () => {
  const active = ref<Workspace>('db')

  function setWorkspace(w: Workspace) {
    active.value = w
    try { localStorage.setItem('db-modeler-workspace', w) } catch {}
  }

  try {
    const saved = localStorage.getItem('db-modeler-workspace') as Workspace | null
    if (saved && ['db','api','query','codegen'].includes(saved)) active.value = saved
  } catch {}

  return { active, setWorkspace }
})
