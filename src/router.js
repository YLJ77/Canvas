import Vue from 'vue'
import Router from 'vue-router'
import Home from './views/drawingBoard/index.vue'
import SuperMario from './views/superMario/index'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/mario/index')
    },
    {
      path: '/mario',
      name: 'mario',
      // route level code-splitting
      // this generates a separate chunk (about.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      // component: () => import(/* webpackChunkName: "about" */ './views/superMario/index.vue')
      component: SuperMario
    }
  ]
})
