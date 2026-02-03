const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('pages/HomePage.vue') },
      { path: 'search', name: 'search', component: () => import('pages/SearchPage.vue') },
      { path: 'detail/:id', name: 'detail', component: () => import('pages/DetailPage.vue') },
      { path: 'publish', name: 'publish', component: () => import('pages/PublishPage.vue'), meta: { requiresAuth: true } },
      { path: 'messages', name: 'messages', component: () => import('pages/MessagesPage.vue'), meta: { requiresAuth: true } },
      { path: 'profile', name: 'profile', component: () => import('pages/ProfilePage.vue'), meta: { requiresAuth: true } },
      { path: 'login', name: 'login', component: () => import('pages/LoginPage.vue') }
    ]
  },
  {
    path: '/admin',
    component: () => import('layouts/AdminLayout.vue'),
    children: [
      { path: '', redirect: { name: 'admin-dashboard' } },
      { path: 'dashboard', name: 'admin-dashboard', component: () => import('pages/AdminDashboardPage.vue'), meta: { requiresAdmin: true } },
      { path: 'listings', name: 'admin-listings', component: () => import('pages/AdminListingsPage.vue'), meta: { requiresAdmin: true } },
      { path: 'users', name: 'admin-users', component: () => import('pages/AdminUsersPage.vue'), meta: { requiresAdmin: true } },
      { path: 'login', name: 'admin-login', component: () => import('pages/AdminLoginPage.vue') }
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
