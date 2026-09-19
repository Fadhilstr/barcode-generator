<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <h4 class="page-title">Kelola Task / Batch System</h4>
        <div class="text-subtitle2 text-grey-7">Daftar alokasi tugas pengindaian paket di seluruh gerai/petugas</div>
      </div>

      <q-btn
        color="primary"
        icon="add_task"
        label="Buat Task Baru" no-caps
        unelevated
        class="text-weight-bold"
        @click="openAddTaskModal"
      />
    </div>

    <q-separator class="q-mb-lg" />

    <div v-if="taskStore.allTasks.length === 0" class="text-center text-grey-6 q-pa-xl bg-white rounded-borders shadow-1">
      <q-icon name="assignment" size="56px" color="grey-5" class="q-mb-sm" />
      <div class="text-h6 text-weight-bold text-slate-800">Belum Ada Task / Batch</div>
      <div class="text-body2 text-grey-6 q-mb-md">Klik tombol "Buat Task Baru" di atas untuk menugaskan alokasi scan ke petugas.</div>
      <q-btn color="primary" icon="add_task" label="Buat Task Baru" no-caps unelevated @click="openAddTaskModal" />
    </div>

    <div v-else class="row q-col-gutter-md">
      <div v-for="task in taskStore.allTasks" :key="task.task_id" class="col-12 col-sm-6 col-md-4">
        <TaskCard :task="task" />
      </div>
    </div>

    <!-- Create Task Dialog -->
    <q-dialog v-model="showAddModal">
      <q-card style="min-width: 360px; border-radius: 16px;">
        <q-card-section class="row items-center justify-between q-pb-xs">
          <div class="text-h6 text-weight-bold row items-center">
            <q-icon name="add_task" color="primary" class="q-mr-xs" />
            Buat Task / Batch Baru
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-separator />

        <q-card-section class="q-pt-md">
          <q-form @submit.prevent="saveNewTask" class="q-gutter-y-md">
            <q-select
              v-model="newTask.user_id"
              :options="petugasSelectOptions"
              emit-value
              map-options
              outlined
              dense
              label="Pilih Petugas"
              required
            />
            <q-input v-model.number="newTask.target" type="number" outlined dense label="Target Scan" required />
            <q-input v-model="newTask.shift" outlined dense label="Shift (e.g. Pagi, Sore)" required />
            <q-input v-model="newTask.lokasi" outlined dense label="Lokasi Gerai/Rayon" required />
            <q-card-actions align="right" class="q-px-none">
              <q-btn flat label="Batal" no-caps color="grey-7" v-close-popup />
              <q-btn type="submit" label="Simpan Task" no-caps color="primary" class="text-weight-bold" unelevated />
            </q-card-actions>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../stores/authStore'
import { useTaskStore } from '../../stores/taskStore'
import TaskCard from '../../components/TaskCard.vue'

const $q = useQuasar()
const authStore = useAuthStore()
const taskStore = useTaskStore()

const showAddModal = ref(false)
const newTask = ref({
  user_id: '',
  target: 100,
  shift: 'Pagi',
  lokasi: 'CIPUTAT'
})

const petugasSelectOptions = computed(() => {
  return authStore.allPetugas.map((p) => ({
    label: `${p.name} (${p.id})`,
    value: p.id
  }))
})

const openAddTaskModal = () => {
  if (authStore.allPetugas.length === 0) {
    $q.notify({
      type: 'warning',
      icon: 'people',
      message: 'Belum ada akun Petugas Scan.',
      caption: 'Silakan buat user Petugas terlebih dahulu di menu User Management.',
      position: 'top',
      timeout: 3000
    })
    return
  }
  newTask.value = {
    user_id: authStore.allPetugas[0]?.id || '',
    target: 100,
    shift: 'Pagi',
    lokasi: 'CIPUTAT'
  }
  showAddModal.value = true
}

const saveNewTask = async () => {
  const petugas = authStore.users.find((u) => u.id === newTask.value.user_id)
  const res = await taskStore.createNewTask({
    ...newTask.value,
    user_name: petugas ? petugas.name : 'Petugas'
  })

  if (res.success) {
    $q.notify({
      type: 'positive',
      icon: 'check_circle',
      message: `Task ${res.task.task_id} berhasil dibuat.`,
      position: 'top',
      timeout: 2000
    })
    showAddModal.value = false
  } else {
    $q.notify({
      type: 'negative',
      icon: 'error',
      message: res.message || 'Gagal membuat task.',
      position: 'top',
      timeout: 2500
    })
  }
}
</script>
