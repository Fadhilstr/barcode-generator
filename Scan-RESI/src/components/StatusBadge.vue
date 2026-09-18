<template>
  <span class="status-badge" :class="`status--${tone}`">
    <span class="status-dot" />
    {{ formattedStatus }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    required: true,
    default: 'PROSES_SCAN'
  },
  size: {
    type: String,
    default: 'md'
  }
})

const tone = computed(() => {
  switch (props.status) {
    case 'PROSES_SCAN':
      return 'info'
    case 'SELESAI':
    case 'SUCCESS':
    case 'ONLINE':
      return 'positive'
    case 'DRAFT':
    case 'DUPLICATE':
      return 'warning'
    case 'OFFLINE':
      return 'neutral'
    case 'DISABLED':
      return 'negative'
    default:
      return 'neutral'
  }
})

const formattedStatus = computed(() => {
  const map = {
    PROSES_SCAN: 'Proses Scan',
    SELESAI: 'Selesai',
    DRAFT: 'Draft',
    SUCCESS: 'Success',
    DUPLICATE: 'Duplicate',
    ONLINE: 'Online',
    OFFLINE: 'Offline',
    DISABLED: 'Disabled'
  }
  return map[props.status] || props.status
})
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}

.status--positive {
  color: #15803d;
  background-color: #dcfce7;
}

.status--warning {
  color: #b45309;
  background-color: #fef3c7;
}

.status--negative {
  color: #b91c1c;
  background-color: #fee2e2;
}

.status--info {
  color: #1d4ed8;
  background-color: #dbeafe;
}

.status--neutral {
  color: #475569;
  background-color: #f1f5f9;
}
</style>
