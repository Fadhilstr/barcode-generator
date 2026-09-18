<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <!-- Header Page -->
    <div class="row items-center justify-between q-mb-md">
      <div>
        <div class="row items-center q-gutter-x-sm">
          <q-icon name="insights" size="28px" color="primary" />
          <h4 class="page-title q-my-none">Monitoring & Observability System</h4>
        </div>
        <div class="text-subtitle2 text-grey-7 q-mt-xs">
          Monitoring full-stack real-time: Prometheus (Metrics), Loki (Logs), dan Grafana Dashboard
        </div>
      </div>

      <div class="row items-center q-gutter-x-sm">
        <q-badge color="positive" class="q-py-xs q-px-sm text-weight-bold" rounded>
          <q-icon name="check_circle" size="14px" class="q-mr-xs" />
          OBSERVABILITY ACTIVE
        </q-badge>
        <q-chip color="wahana-navy" text-color="amber-4" class="font-mono text-weight-bold">
          ROLE: ADMIN ACCESS
        </q-chip>
      </div>
    </div>

    <!-- Tab Navigation: Observability vs Riwayat Data Scan -->
    <q-card flat bordered class="q-mb-md">
      <q-tabs
        v-model="activeTab"
        dense
        class="text-grey-7 bg-grey-1"
        active-color="primary"
        indicator-color="primary"
        align="left"
        narrow-indicator
      >
        <q-tab name="observability" icon="query_stats" label="Live Observability Dashboard (Grafana)" no-caps />
        <q-tab name="scans" icon="table_view" label="Riwayat Scan Event & Filter" no-caps />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated class="q-pa-none">
        <!-- Panel 1: Live Grafana + Loki Observability -->
        <q-tab-panel name="observability" class="q-pa-md">
          <!-- Control & Quick Link Bar -->
          <div class="row items-center justify-between q-mb-md bg-blue-grey-1 q-pa-sm rounded-borders">
            <div class="row items-center q-gutter-x-sm">
              <span class="text-caption text-weight-bold text-blue-grey-9">Service Status:</span>
              <q-badge outline color="positive" class="text-weight-bold">
                <span class="status-indicator bg-positive q-mr-xs"></span>
                Grafana :3000
              </q-badge>
              <q-badge outline color="primary" class="text-weight-bold">
                <span class="status-indicator bg-primary q-mr-xs"></span>
                Prometheus :9090
              </q-badge>
              <q-badge outline color="amber-9" class="text-weight-bold">
                <span class="status-indicator bg-amber-9 q-mr-xs"></span>
                Loki :3100
              </q-badge>
            </div>

            <div class="row items-center q-gutter-x-sm q-mt-xs q-mt-sm-none">
              <q-btn
                outline
                dense
                color="grey-8"
                icon="refresh"
                label="Reload Iframe"
                no-caps
                size="sm"
                @click="reloadIframe"
              />
              <q-btn
                unelevated
                color="primary"
                icon="open_in_new"
                label="Buka Grafana Full Screen"
                no-caps
                size="sm"
                href="http://localhost:3000/d/scanner-monitoring?orgId=1"
                target="_blank"
              />
              <q-btn
                outline
                color="secondary"
                icon="analytics"
                label="Prometheus Targets"
                no-caps
                size="sm"
                href="http://localhost:9090/targets"
                target="_blank"
              />
            </div>
          </div>

          <!-- Embedded Live Grafana Dashboard -->
          <div class="grafana-container rounded-borders overflow-hidden shadow-1 position-relative">
            <iframe
              ref="grafanaIframe"
              :src="grafanaEmbedUrl"
              class="grafana-frame"
              title="Grafana Observability Dashboard"
              frameborder="0"
            ></iframe>
          </div>

          <!-- Petunjuk operasional untuk Admin -->
          <div class="q-mt-md text-caption text-grey-7 row items-center justify-between">
            <div>
              <q-icon name="info" size="16px" color="primary" class="q-mr-xs" />
              Dashboard ini menyajikan metrics HTTP backend, scanner barcode performance per format, infrastructure container, dan streaming logs Loki secara real-time.
            </div>
            <div class="font-mono">Default Timezone: Asia/Jakarta</div>
          </div>
        </q-tab-panel>

        <!-- Panel 2: Existing ScanEventTable -->
        <q-tab-panel name="scans" class="q-pa-md">
          <ScanEventTable :scans="allScans" :show-petugas-filter="true" />
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../../stores/authStore'
import { useScanStore } from '../../stores/scanStore'
import ScanEventTable from '../../components/ScanEventTable.vue'

const authStore = useAuthStore()
const scanStore = useScanStore()

const activeTab = ref('observability')
const grafanaIframe = ref(null)

const grafanaBaseUrl = ref('http://localhost:3000/d/scanner-monitoring')
const iframeKey = ref(Date.now())

const grafanaEmbedUrl = computed(() => {
  return `${grafanaBaseUrl.value}?orgId=1&kiosk=tv&_k=${iframeKey.value}`
})

const reloadIframe = () => {
  iframeKey.value = Date.now()
  if (grafanaIframe.value) {
    grafanaIframe.value.src = grafanaEmbedUrl.value
  }
}

const allScans = computed(() => {
  return scanStore.getFilteredScans(authStore.currentUser)
})
</script>

<style scoped>
.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

.grafana-container {
  width: 100%;
  height: 820px;
  background-color: #111217;
}

.grafana-frame {
  width: 100%;
  height: 100%;
  border: none;
}

.status-indicator {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
</style>
