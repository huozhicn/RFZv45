import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { createPinia } from 'pinia'
import App from './App.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/tables/:tableName',
      component: App,  // App 本身通过 watch(route.path) 切换表
    },
    {
      path: '/:pathMatch(.*)*',
      component: App,
    },
  ],
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
