import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { Schema } from '../types'

export interface Tab {
  id: string
  schemaId: string   // matches Schema.id
  label: string
  isDirty: boolean
}

const TABS_STORAGE_KEY = 'db-modeler-tabs'
const SCHEMA_STORAGE_PREFIX = 'db-modeler-schema-'
const ACTIVE_TAB_KEY = 'db-modeler-active-tab'

function blankSchema(name = 'Untitled'): Schema {
  return {
    id: uuidv4(),
    name,
    tables: [],
    relations: [],
    groups: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function loadTabsFromStorage(): { tabs: Tab[]; activeTabId: string } {
  try {
    const rawTabs = localStorage.getItem(TABS_STORAGE_KEY)
    const activeTabId = localStorage.getItem(ACTIVE_TAB_KEY) ?? ''
    if (rawTabs) {
      const tabs = JSON.parse(rawTabs) as Tab[]
      if (tabs.length > 0) {
        const activeId = tabs.find(t => t.id === activeTabId)?.id ?? tabs[0].id
        return { tabs, activeTabId: activeId }
      }
    }
  } catch { /* ignore */ }

  // Bootstrap with one blank tab
  const schema = blankSchema()
  const tab: Tab = { id: uuidv4(), schemaId: schema.id, label: schema.name, isDirty: false }
  persistSchema(schema)
  return { tabs: [tab], activeTabId: tab.id }
}

function persistSchema(schema: Schema) {
  try {
    localStorage.setItem(SCHEMA_STORAGE_PREFIX + schema.id, JSON.stringify(schema))
  } catch { /* ignore */ }
}

function loadSchema(schemaId: string): Schema | null {
  try {
    const raw = localStorage.getItem(SCHEMA_STORAGE_PREFIX + schemaId)
    if (raw) {
      const s = JSON.parse(raw) as Schema
      if (!s.groups) s.groups = []
      if (!s.relations) s.relations = []
      s.relations = s.relations.map(r => ({ waypoints: [], ...r }))
      s.tables = s.tables.map(t => {
        // @ts-ignore
        return ({
          groupId: null,
          immutable: false,
          ...t,
          columns: (t.columns ?? []).map(c => ({ immutable: false, ...c })),
        });
      })
      return s
    }
  } catch { /* ignore */ }
  return null
}

function deleteSchemaFromStorage(schemaId: string) {
  try { localStorage.removeItem(SCHEMA_STORAGE_PREFIX + schemaId) } catch { /* ignore */ }
}

export const useTabsStore = defineStore('tabs', () => {
  const { tabs: initialTabs, activeTabId: initialActiveId } = loadTabsFromStorage()

  const tabs = ref<Tab[]>(initialTabs)
  const activeTabId = ref<string>(initialActiveId)

  // In-memory schema cache: schemaId → Schema
  const schemaCache = ref<Record<string, Schema>>({})

  // Load all tab schemas into cache on init
  for (const tab of tabs.value) {
    const schema = loadSchema(tab.schemaId)
    if (schema) {
      schemaCache.value[schema.id] = schema
    } else {
      // Schema missing — recreate blank
      const s = blankSchema(tab.label)
      s.id = tab.schemaId
      schemaCache.value[s.id] = s
      persistSchema(s)
    }
  }

  const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value) ?? null)

  const activeSchema = computed<Schema | null>(() => {
    const tab = activeTab.value
    if (!tab) return null
    return schemaCache.value[tab.schemaId] ?? null
  })

  function saveTabs() {
    try {
      localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs.value))
      localStorage.setItem(ACTIVE_TAB_KEY, activeTabId.value)
    } catch { /* ignore */ }
  }

  function newTab(name = 'Untitled') {
    const schema = blankSchema(name)
    const tab: Tab = { id: uuidv4(), schemaId: schema.id, label: name, isDirty: false }
    schemaCache.value[schema.id] = schema
    persistSchema(schema)
    tabs.value.push(tab)
    activeTabId.value = tab.id
    saveTabs()
    return tab
  }

  function closeTab(tabId: string) {
    const idx = tabs.value.findIndex(t => t.id === tabId)
    if (idx === -1) return

    const tab = tabs.value[idx]
    deleteSchemaFromStorage(tab.schemaId)
    delete schemaCache.value[tab.schemaId]
    tabs.value.splice(idx, 1)

    if (tabs.value.length === 0) {
      // Always keep at least one tab
      newTab()
    } else if (activeTabId.value === tabId) {
      activeTabId.value = tabs.value[Math.max(0, idx - 1)].id
    }
    saveTabs()
  }

  function switchTab(tabId: string) {
    if (tabs.value.find(t => t.id === tabId)) {
      activeTabId.value = tabId
      saveTabs()
    }
  }

  function renameTab(tabId: string, label: string) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) {
      tab.label = label
      const schema = schemaCache.value[tab.schemaId]
      if (schema) { schema.name = label; persistSchema(schema) }
      saveTabs()
    }
  }

  function updateSchema(schema: Schema) {
    schemaCache.value[schema.id] = schema
    persistSchema(schema)
    const tab = tabs.value.find(t => t.schemaId === schema.id)
    if (tab) { tab.label = schema.name; tab.isDirty = false }
    saveTabs()
  }

  function loadSchemaIntoNewTab(schema: Schema) {
    schemaCache.value[schema.id] = schema
    persistSchema(schema)
    const tab: Tab = { id: uuidv4(), schemaId: schema.id, label: schema.name, isDirty: false }
    tabs.value.push(tab)
    activeTabId.value = tab.id
    saveTabs()
    return tab
  }

  return {
    tabs, activeTabId, activeTab, activeSchema,
    newTab, closeTab, switchTab, renameTab,
    updateSchema, loadSchemaIntoNewTab,
    schemaCache,
  }
})
