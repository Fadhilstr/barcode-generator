<template>
  <q-card class="scan-card q-pa-sm">
    <q-card-section>
      <div class="row items-center justify-between q-mb-xs">
        <div class="row items-center">
          <span class="font-mono text-caption text-weight-bold text-primary bg-blue-1 q-px-sm q-py-xs" style="border-radius: 6px;">
            {{ task.task_id }}
          </span>
          <span class="text-subtitle1 text-weight-medium text-slate-900 q-ml-sm">{{ task.user_name }}</span>
        </div>
        <StatusBadge :status="task.status" size="sm" />
      </div>

      <div class="row items-center text-caption text-grey-6 q-mb-md">
        <q-icon name="schedule" size="14px" class="q-mr-xs" />
        Shift {{ task.shift }} &middot; {{ task.tanggal }} &middot; {{ task.lokasi }}
      </div>

      <!-- Progress Section -->
      <div class="q-mb-xs">
        <div class="row items-center justify-between text-caption q-mb-xs">
          <span class="overline-label">Progress Scan</span>
          <span class="font-mono text-weight-bold text-slate-900">{{ task.progress }} / {{ task.target }}</span>
        </div>
        <q-linear-progress
          :value="progressPercent"
          color="primary"
          track-color="blue-grey-1"
          size="8px"
          style="border-radius: 4px;"
        />
      </div>

      <div class="row items-center justify-between text-caption text-grey-6 q-mt-xs">
        <span>Capaian {{ Math.round(progressPercent * 100) }}%</span>
        <span v-if="task.status === 'SELESAI'" class="text-positive text-weight-bold row items-center">
          <q-icon name="lock" size="12px" class="q-mr-xs" /> Terkunci
        </span>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import StatusBadge from './StatusBadge.vue'

const props = defineProps({
  task: {
    type: Object,
    required: true
  }
})

const progressPercent = computed(() => {
  if (!props.task.target || props.task.target === 0) return 0
  return Math.min(props.task.progress / props.task.target, 1)
})
</script>
