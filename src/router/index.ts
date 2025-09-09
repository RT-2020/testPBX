import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/load',
    },
    {
      path: '/load',
      name: 'LoadTester',
      component: () => import('../pages/LoadTester.vue'),
    },
    {
      path: '/video',
      name: 'VideoCall',
      component: () => import('../pages/VideoCall.vue'),
    },
    {
      path: '/outbound',
      name: 'OutboundCall',
      component: () => import('../pages/OutboundCall.vue'),
    },
  ],
})

export default router
