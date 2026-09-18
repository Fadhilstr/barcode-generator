<template>
  <q-layout view="lHh Lpr lFf" class="bg-grey-1">
    <!-- App Header -->
    <q-header class="bg-wahana-navy text-white" height-hint="56">
      <q-toolbar class="q-px-md" style="min-height: 56px;">
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Buka menu navigasi"
          @click="toggleLeftDrawer"
          class="q-mr-sm text-grey-3"
        />

        <q-avatar size="30px" class="bg-wahana-yellow text-wahana-navy q-mr-sm" style="border-radius: 8px;">
          <q-icon name="qr_code_scanner" size="19px" />
        </q-avatar>

        <q-toolbar-title shrink>
          <span class="text-weight-bold text-subtitle1">Dijak Express</span>
          <span class="text-caption text-blue-grey-4 q-ml-sm gt-sm">Platform Barcode Logistik</span>
        </q-toolbar-title>

        <q-space />

        <q-btn-dropdown flat no-caps dense class="q-px-sm" aria-label="Menu akun">
          <template v-slot:label>
            <q-avatar size="30px" class="bg-blue-grey-800 text-weight-bold q-mr-sm" style="font-size: 13px;">
              {{ initials }}
            </q-avatar>
            <div class="gt-xs text-left">
              <div class="text-body2 text-weight-medium" style="line-height: 1.2;">{{ authStore.currentUser?.name }}</div>
              <div class="text-caption text-blue-grey-4" style="line-height: 1.2;">{{ roleLabel }}</div>
            </div>
          </template>

          <q-list style="min-width: 220px;" padding>
            <q-item>
              <q-item-section avatar>
                <q-avatar size="36px" class="bg-wahana-navy text-white text-weight-bold">{{ initials }}</q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium">{{ authStore.currentUser?.name }}</q-item-label>
                <q-item-label caption>@{{ authStore.currentUser?.username }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-separator class="q-my-xs" />
            <q-item clickable v-close-popup @click="handleLogout" class="text-negative">
              <q-item-section avatar><q-icon name="logout" size="18px" /></q-item-section>
              <q-item-section>Keluar / Ganti user</q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </q-toolbar>
    </q-header>

    <!-- Sidebar / Navigation Drawer -->
    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      class="bg-white"
      :width="264"
    >
      <div class="column full-height">
        <div class="q-pa-md row items-center q-gutter-x-sm">
          <q-avatar size="38px" class="bg-wahana-navy text-amber-4" style="border-radius: 10px;">
            <q-icon name="local_shipping" size="22px" />
          </q-avatar>
          <div>
            <div class="text-subtitle2 text-weight-bold">Dijak Express</div>
            <div class="text-caption text-grey-6">Platform Barcode Logistik</div>
          </div>
        </div>

        <q-separator />

        <q-scroll-area class="col">
          <q-list padding class="q-px-sm">
            <q-item-label header class="overline-label q-px-sm q-pt-md q-pb-xs">
              Menu {{ roleLabel }}
            </q-item-label>

            <!-- ADMIN MENU -->
            <template v-if="authStore.isAdmin">
              <q-item clickable v-ripple to="/admin" exact class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="dashboard" size="20px" color="grey-7" /></q-item-section>
                <q-item-section><q-item-label>Dashboard</q-item-label></q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/admin/monitoring" class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="insights" size="20px" color="grey-7" /></q-item-section>
                <q-item-section><q-item-label>Monitoring & Observability</q-item-label></q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/admin/petugas" class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="people" size="20px" color="grey-7" /></q-item-section>
                <q-item-section><q-item-label>Petugas</q-item-label></q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/admin/tasks" class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="assignment" size="20px" color="grey-7" /></q-item-section>
                <q-item-section><q-item-label>Task / Batch</q-item-label></q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/admin/users" class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="manage_accounts" size="20px" color="grey-7" /></q-item-section>
                <q-item-section><q-item-label>User Management</q-item-label></q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/admin/reports" class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="analytics" size="20px" color="grey-7" /></q-item-section>
                <q-item-section><q-item-label>Report</q-item-label></q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/admin/audit-logs" class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="receipt_long" size="20px" color="grey-7" /></q-item-section>
                <q-item-section><q-item-label>Audit Log</q-item-label></q-item-section>
              </q-item>
            </template>

            <!-- PETUGAS MENU -->
            <template v-else-if="authStore.isPetugas">
              <q-item clickable v-ripple to="/petugas" exact class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="dashboard" size="20px" color="grey-7" /></q-item-section>
                <q-item-section><q-item-label>Dashboard</q-item-label></q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/petugas/tasks" class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="assignment" size="20px" color="grey-7" /></q-item-section>
                <q-item-section><q-item-label>Tugas Saya</q-item-label></q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/petugas/scan" class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="qr_code_scanner" size="20px" color="grey-7" /></q-item-section>
                <q-item-section>
                  <q-item-label class="row items-center justify-between">
                    Scan Paket
                    <q-badge color="amber-2" text-color="amber-9" size="xs" label="Core" class="text-weight-bold" />
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/petugas/hasil" class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="fact_check" size="20px" color="grey-7" /></q-item-section>
                <q-item-section><q-item-label>Hasil Scan Saya</q-item-label></q-item-section>
              </q-item>
            </template>

            <!-- CUSTOMER MENU -->
            <template v-else-if="authStore.isCustomer">
              <q-item clickable v-ripple to="/customer" exact class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="dashboard" size="20px" color="grey-7" /></q-item-section>
                <q-item-section><q-item-label>Dashboard</q-item-label></q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/customer/buat-paket" class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="add_box" size="20px" color="grey-7" /></q-item-section>
                <q-item-section>
                  <q-item-label class="row items-center justify-between">
                    Buat Paket
                    <q-badge color="amber-2" text-color="amber-9" size="xs" label="Core" class="text-weight-bold" />
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/customer/paket" class="nav-item" active-class="is-active">
                <q-item-section avatar><q-icon name="inventory_2" size="20px" color="grey-7" /></q-item-section>
                <q-item-section><q-item-label>Paket Saya</q-item-label></q-item-section>
              </q-item>
            </template>

            <q-separator class="q-my-md" />

            <q-item clickable v-ripple class="nav-item text-negative" @click="handleLogout">
              <q-item-section avatar><q-icon name="logout" size="20px" /></q-item-section>
              <q-item-section><q-item-label>Keluar / Ganti User</q-item-label></q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>

        <q-separator />
        <div class="q-pa-sm q-px-md text-caption text-grey-5">
          Dijak Express &copy; 2026 &middot; v1.0
        </div>
      </div>
    </q-drawer>

    <!-- Main Content Area -->
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/authStore'

const $q = useQuasar()
const router = useRouter()
const authStore = useAuthStore()
const leftDrawerOpen = ref(false)

const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

const roleLabel = computed(() => {
  if (authStore.isAdmin) return 'Admin'
  if (authStore.isPetugas) return 'Petugas Scan'
  if (authStore.isCustomer) return 'Customer'
  return 'Guest'
})

const initials = computed(() => {
  const name = authStore.currentUser?.name || ''
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

const handleLogout = async () => {
  await authStore.logout()
  $q.notify({
    type: 'info',
    icon: 'logout',
    message: 'Anda telah keluar dari aplikasi.',
    position: 'top',
    timeout: 1800
  })
  router.push('/login')
}
</script>

<style scoped>
.nav-item :deep(.q-item__section--avatar) {
  min-width: 36px;
}
</style>
