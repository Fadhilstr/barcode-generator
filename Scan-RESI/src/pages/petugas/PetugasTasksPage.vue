<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <h4 class="page-title">Tugas Saya</h4>
        <div class="text-subtitle2 text-grey-7">Daftar alokasi task/batch pengindaian paket milik Anda</div>
      </div>

      <q-btn
        color="primary"
        icon="qr_code_scanner"
        label="Scan Paket" no-caps
        to="/petugas/scan"
        unelevated
        class="text-weight-bold"
      />
    </div>

    <q-separator class="q-mb-lg" />

    <div class="row q-col-gutter-md">
      <div v-for="t in myTasks" :key="t.task_id" class="col-12 col-sm-6 col-md-4">
        <TaskCard :task="t" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../../stores/authStore'
import { useTaskStore } from '../../stores/taskStore'
import TaskCard from '../../components/TaskCard.vue'

const authStore = useAuthStore()
const taskStore = useTaskStore()

const myTasks = computed(() => {
  if (!authStore.currentUser) return []
  return taskStore.allTasks.filter((t) => t.user_id === authStore.currentUser.id)
})
</script>
