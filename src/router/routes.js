const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../pages/LoginPage.vue')
  },

  // ADMIN PORTAL
  {
    path: '/admin',
    component: () => import('../layouts/MainLayout.vue'),
    meta: { requiresAuth: true, role: 'ADMIN' },
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('../pages/admin/AdminDashboard.vue') },
      { path: 'monitoring', name: 'admin-monitoring', component: () => import('../pages/admin/AdminMonitoringPage.vue') },
      { path: 'petugas', name: 'admin-petugas', component: () => import('../pages/admin/AdminPetugasPage.vue') },
      { path: 'users', name: 'admin-users', component: () => import('../pages/admin/AdminUserManagementPage.vue') },
      { path: 'tasks', name: 'admin-tasks', component: () => import('../pages/admin/AdminTasksPage.vue') },
      { path: 'reports', name: 'admin-reports', component: () => import('../pages/admin/AdminReportsPage.vue') },
      { path: 'audit-logs', name: 'admin-audit', component: () => import('../pages/admin/AdminAuditLogsPage.vue') }
    ]
  },

  // CUSTOMER PORTAL — pembuat paket & pemilik nomor resi
  {
    path: '/customer',
    component: () => import('../layouts/MainLayout.vue'),
    meta: { requiresAuth: true, role: 'CUSTOMER' },
    children: [
      { path: '', name: 'customer-dashboard', component: () => import('../pages/customer/CustomerDashboard.vue') },
      { path: 'buat-paket', name: 'customer-buat-paket', component: () => import('../pages/customer/CustomerBuatPaketPage.vue') },
      { path: 'paket', name: 'customer-paket', component: () => import('../pages/customer/CustomerPaketPage.vue') }
    ]
  },

  // PETUGAS OPERASIONAL PORTAL
  {
    path: '/petugas',
    component: () => import('../layouts/MainLayout.vue'),
    meta: { requiresAuth: true, role: 'PETUGAS_SCAN' },
    children: [
      { path: '', name: 'petugas-dashboard', component: () => import('../pages/petugas/PetugasDashboard.vue') },
      { path: 'tasks', name: 'petugas-tasks', component: () => import('../pages/petugas/PetugasTasksPage.vue') },
      { path: 'scan', name: 'petugas-scan', component: () => import('../pages/petugas/PetugasScanPage.vue') },
      { path: 'hasil', name: 'petugas-hasil', component: () => import('../pages/petugas/PetugasHasilPage.vue') }
    ]
  },

  // Root redirect
  {
    path: '/',
    redirect: '/login'
  },

  // Catch All 404
  {
    path: '/:catchAll(.*)*',
    component: () => import('../pages/ErrorNotFound.vue')
  }
]

export default routes
