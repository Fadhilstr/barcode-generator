<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <h4 class="page-title">User Management</h4>
        <div class="text-subtitle2 text-grey-7">Kelola akun, role, dan hak akses pengguna sistem</div>
      </div>

      <q-btn
        color="primary"
        icon="person_add"
        label="Tambah User Baru" no-caps
        unelevated
        class="text-weight-bold"
        @click="openAddDialog"
      />
    </div>

    <q-separator class="q-mb-lg" />

    <!-- User Table (Requirement N) -->
    <q-card class="scan-card">
      <q-card-section>
        <q-table
          :rows="authStore.users"
          :columns="columns"
          row-key="id"
          flat
          bordered
          no-data-label="Belum ada data user"
        >
          <template v-slot:body-cell-id="props">
            <q-td :props="props" class="font-mono text-weight-bold text-primary">
              {{ props.row.id }}
            </q-td>
          </template>

          <template v-slot:body-cell-name="props">
            <q-td :props="props" class="text-weight-bold text-slate-900">
              {{ props.row.name }}
            </q-td>
          </template>

          <template v-slot:body-cell-username="props">
            <q-td :props="props" class="font-mono text-grey-8">
              {{ props.row.username }}
            </q-td>
          </template>

          <template v-slot:body-cell-email="props">
            <q-td :props="props" class="font-mono text-primary text-weight-bold">
              {{ props.row.email || '-' }}
            </q-td>
          </template>

          <template v-slot:body-cell-role="props">
            <q-td :props="props">
              <q-badge
                :color="props.row.role === 'ADMIN' ? 'red-8' : props.row.role === 'CUSTOMER' ? 'green-8' : 'blue-grey-6'"
                text-color="white"
                class="font-mono text-weight-bold"
              >
                {{ props.row.role }}
              </q-badge>
            </q-td>
          </template>

          <template v-slot:body-cell-status="props">
            <q-td :props="props" class="text-center">
              <StatusBadge :status="props.row.status" size="xs" />
            </q-td>
          </template>

          <template v-slot:body-cell-lastLogin="props">
            <q-td :props="props" class="font-mono text-caption text-grey-7">
              {{ props.row.lastLogin }}
            </q-td>
          </template>

          <template v-slot:body-cell-aksi="props">
            <q-td :props="props" class="text-center q-gutter-xs">
              <!-- Edit Button -->
              <q-btn
                color="primary"
                icon="edit"
                flat
                round
                dense
                @click="openEditDialog(props.row)"
              >
                <q-tooltip>Edit User</q-tooltip>
              </q-btn>

              <!-- Toggle Status Button -->
              <q-btn
                :color="props.row.status === 'DISABLED' ? 'positive' : 'warning'"
                :icon="props.row.status === 'DISABLED' ? 'check_circle' : 'block'"
                flat
                round
                dense
                @click="toggleDisable(props.row)"
              >
                <q-tooltip>{{ props.row.status === 'DISABLED' ? 'Aktifkan User' : 'Nonaktifkan User' }}</q-tooltip>
              </q-btn>

              <!-- Delete Button -->
              <q-btn
                color="negative"
                icon="delete"
                flat
                round
                dense
                :disable="props.row.id === authStore.currentUser?.id"
                @click="confirmDelete(props.row)"
              >
                <q-tooltip>{{ props.row.id === authStore.currentUser?.id ? 'Tidak dapat menghapus akun sendiri' : 'Hapus User' }}</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

    <!-- Add User Modal Dialog -->
    <q-dialog v-model="showAddDialog">
      <q-card style="min-width: 380px; border-radius: 16px;">
        <q-card-section class="row items-center justify-between q-pb-xs">
          <div class="text-h6 text-weight-bold row items-center">
            <q-icon name="person_add" color="primary" class="q-mr-xs" />
            Tambah User Baru
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-separator />

        <q-card-section class="q-pt-md">
          <q-form @submit.prevent="saveNewUser" class="q-gutter-y-md">
            <q-input v-model="form.name" outlined dense label="Nama Lengkap" required />
            <q-input
              v-model="form.email"
              outlined
              dense
              type="email"
              label="Gmail / Email Penerima OTP"
              placeholder="cth: budi@gmail.com"
              hint="Email ini digunakan untuk penerimaan kode OTP saat login & reset password"
              :rules="[
                v => !!v || 'Gmail wajib diisi',
                v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Format Gmail tidak valid'
              ]"
              required
            >
              <template v-slot:prepend><q-icon name="email" size="20px" class="text-primary" /></template>
            </q-input>
            <q-input v-model="form.username" outlined dense label="Username" required />
            <q-input v-model="form.password" outlined dense type="password" label="Password" required />
            <q-select
              v-model="form.role"
              :options="roleOptions"
              emit-value
              map-options
              outlined
              dense
              label="Role Pengguna"
            />
            <q-card-actions align="right" class="q-px-none q-pt-md">
              <q-btn flat label="Batal" no-caps color="grey-7" v-close-popup />
              <q-btn type="submit" label="Simpan User" no-caps color="primary" class="text-weight-bold" unelevated />
            </q-card-actions>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Edit User Modal Dialog -->
    <q-dialog v-model="showEditDialog">
      <q-card style="min-width: 380px; border-radius: 16px;">
        <q-card-section class="row items-center justify-between q-pb-xs">
          <div class="text-h6 text-weight-bold row items-center">
            <q-icon name="edit" color="primary" class="q-mr-xs" />
            Edit User ({{ selectedEditUser?.id }})
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-separator />

        <q-card-section class="q-pt-md">
          <q-form @submit.prevent="saveEditUser" class="q-gutter-y-md">
            <q-input v-model="editForm.name" outlined dense label="Nama Lengkap" required />
            <q-input
              v-model="editForm.email"
              outlined
              dense
              type="email"
              label="Gmail / Email Penerima OTP"
              hint="Ubah Gmail ini untuk memperbarui alamat tujuan pengiriman OTP user"
              :rules="[
                v => !!v || 'Gmail wajib diisi',
                v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Format Gmail tidak valid'
              ]"
              required
            >
              <template v-slot:prepend><q-icon name="email" size="20px" class="text-primary" /></template>
            </q-input>
            <q-input v-model="editForm.username" outlined dense label="Username" required />
            <q-input
              v-model="editForm.password"
              outlined
              dense
              type="password"
              label="Password Baru (Kosongkan jika tidak diubah)"
              hint="Opsional: isi hanya jika ingin mengganti password"
            />
            <q-select
              v-model="editForm.role"
              :options="roleOptions"
              emit-value
              map-options
              outlined
              dense
              label="Role Pengguna"
            />
            <q-card-actions align="right" class="q-px-none q-pt-md">
              <q-btn flat label="Batal" no-caps color="grey-7" v-close-popup />
              <q-btn type="submit" label="Simpan Perubahan" no-caps color="primary" class="text-weight-bold" unelevated />
            </q-card-actions>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Delete Confirmation Dialog -->
    <q-dialog v-model="showDeleteDialog">
      <q-card style="min-width: 360px; border-radius: 16px;">
        <q-card-section class="row items-center q-pb-xs">
          <q-avatar icon="warning" color="negative" text-color="white" size="40px" class="q-mr-md" />
          <div class="text-h6 text-weight-bold text-negative">Konfirmasi Hapus User</div>
        </q-card-section>

        <q-card-section class="q-pt-sm text-grey-8">
          Apakah Anda yakin ingin menghapus user <strong class="text-slate-900">{{ selectedDeleteUser?.name }}</strong> (<code>{{ selectedDeleteUser?.id }}</code>)?
          <div class="text-caption text-negative q-mt-xs">Tindakan ini tidak dapat dibatalkan.</div>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Batal" no-caps color="grey-7" v-close-popup />
          <q-btn
            label="Ya, Hapus"
            no-caps
            color="negative"
            class="text-weight-bold"
            unelevated
            @click="executeDelete"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../stores/authStore'
import StatusBadge from '../../components/StatusBadge.vue'

const $q = useQuasar()
const authStore = useAuthStore()

const roleOptions = [
  { label: 'Petugas Scan', value: 'PETUGAS_SCAN' },
  { label: 'Customer', value: 'CUSTOMER' },
  { label: 'Admin', value: 'ADMIN' }
]

const showAddDialog = ref(false)
const form = ref({
  name: '',
  username: '',
  email: '',
  password: '',
  role: 'PETUGAS_SCAN'
})

const showEditDialog = ref(false)
const selectedEditUser = ref(null)
const editForm = ref({
  name: '',
  username: '',
  email: '',
  password: '',
  role: 'PETUGAS_SCAN'
})

const showDeleteDialog = ref(false)
const selectedDeleteUser = ref(null)

const columns = [
  { name: 'id', label: 'User ID', field: 'id', align: 'left', sortable: true },
  { name: 'name', label: 'Nama', field: 'name', align: 'left', sortable: true },
  { name: 'username', label: 'Username', field: 'username', align: 'left', sortable: true },
  { name: 'email', label: 'Gmail / Email', field: 'email', align: 'left', sortable: true },
  { name: 'role', label: 'Role', field: 'role', align: 'center', sortable: true },
  { name: 'status', label: 'Status', field: 'status', align: 'center', sortable: true },
  { name: 'lastLogin', label: 'Last Login', field: 'lastLogin', align: 'center' },
  { name: 'aksi', label: 'Aksi', field: 'aksi', align: 'center' }
]

const openAddDialog = () => {
  form.value = { name: '', username: '', email: '', password: '', role: 'PETUGAS_SCAN' }
  showAddDialog.value = true
}

const saveNewUser = async () => {
  const res = await authStore.addUser(form.value)
  if (res.success) {
    $q.notify({
      type: 'positive',
      icon: 'check_circle',
      message: `User ${res.user.name} berhasil ditambahkan.`,
      position: 'top',
      timeout: 2000
    })
    showAddDialog.value = false
  } else {
    $q.notify({
      type: 'negative',
      icon: 'error',
      message: res.message || 'Gagal menambahkan user.',
      position: 'top',
      timeout: 2500
    })
  }
}

const openEditDialog = (user) => {
  selectedEditUser.value = user
  editForm.value = {
    name: user.name,
    username: user.username,
    email: user.email || '',
    password: '',
    role: user.role
  }
  showEditDialog.value = true
}

const saveEditUser = async () => {
  if (!selectedEditUser.value) return
  const payload = {
    name: editForm.value.name,
    username: editForm.value.username,
    email: editForm.value.email,
    role: editForm.value.role
  }
  if (editForm.value.password) {
    payload.password = editForm.value.password
  }

  const res = await authStore.updateUser(selectedEditUser.value.id, payload)
  if (res.success) {
    $q.notify({
      type: 'positive',
      icon: 'check_circle',
      message: `Data user ${editForm.value.name} berhasil diperbarui.`,
      position: 'top',
      timeout: 2000
    })
    showEditDialog.value = false
  } else {
    $q.notify({
      type: 'negative',
      icon: 'error',
      message: res.message || 'Gagal memperbarui user.',
      position: 'top',
      timeout: 2500
    })
  }
}

const confirmDelete = (user) => {
  selectedDeleteUser.value = user
  showDeleteDialog.value = true
}

const executeDelete = async () => {
  if (!selectedDeleteUser.value) return
  const res = await authStore.deleteUser(selectedDeleteUser.value.id)
  if (res.success) {
    $q.notify({
      type: 'positive',
      icon: 'delete',
      message: res.message || 'User berhasil dihapus.',
      position: 'top',
      timeout: 2000
    })
    showDeleteDialog.value = false
  } else {
    $q.notify({
      type: 'negative',
      icon: 'error',
      message: res.message || 'Gagal menghapus user.',
      position: 'top',
      timeout: 3000
    })
  }
}

const toggleDisable = async (user) => {
  const res = await authStore.toggleUserStatus(user.id)
  if (res.success) {
    $q.notify({
      type: 'info',
      icon: 'sync',
      message: `Status user ${user.name} diubah menjadi ${res.newStatus}.`,
      position: 'top',
      timeout: 1800
    })
  } else {
    $q.notify({
      type: 'negative',
      icon: 'error',
      message: res.message || 'Gagal mengubah status user.',
      position: 'top',
      timeout: 2500
    })
  }
}
</script>

