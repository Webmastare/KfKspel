import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '@/pages/LandingPage.vue'
import KfKblock from '@/pages/Kfkblock.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: LandingPage
    },
    {
      path: '/kfkblock',
      name: 'KfKblock',
      component: KfKblock
    }
  ],
})

export default router
