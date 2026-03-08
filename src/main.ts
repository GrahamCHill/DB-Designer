import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// Boot tabs store first so schema store can reference it
import { useTabsStore } from './stores/tabs'
useTabsStore(pinia);
app.mount('#app')
