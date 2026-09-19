<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <!-- Header Page -->
    <div class="row items-center justify-between q-mb-lg">
      <div>
        <div class="row items-center q-gutter-x-sm">
          <q-icon name="insights" size="30px" color="primary" />
          <h4 class="page-title q-my-none">Monitoring & Observability System</h4>
        </div>
        <div class="text-subtitle2 text-grey-7 q-mt-xs">
          Pusat pemantauan metrik, log terpusat, dan performa scanner logistik real-time
        </div>
      </div>

      <div class="row items-center q-gutter-x-sm q-mt-sm q-mt-sm-none">
        <q-badge color="positive" class="q-py-xs q-px-sm text-weight-bold" rounded>
          <q-icon name="check_circle" size="14px" class="q-mr-xs" />
          ALL SERVICES ACTIVE
        </q-badge>
        <q-chip color="wahana-navy" text-color="amber-4" class="font-mono text-weight-bold">
          ROLE: ADMIN ACCESS
        </q-chip>
      </div>
    </div>

    <!-- Tab Navigation: Observability Portals vs Riwayat Data Scan -->
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
        <q-tab name="observability" icon="dashboard_customize" label="Portal Observabilitas & Dashboard" no-caps />
        <q-tab name="scans" icon="table_view" label="Riwayat Scan Event & Filter" no-caps />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated class="q-pa-none">
        <!-- Panel 1: Dedicated Observability Service Cards -->
        <q-tab-panel name="observability" class="q-pa-lg bg-grey-1">
          <!-- Top Quick Status Banner -->
          <q-banner rounded class="bg-blue-grey-1 text-blue-grey-10 q-mb-lg border-subtle">
            <template v-slot:avatar>
              <q-icon name="info" color="primary" size="24px" />
            </template>
            <div class="text-body2 text-weight-medium">
              Sistem Observabilitas berjalan terisolasi di background container Docker. Klik tombol akses di bawah untuk membuka dashboard analitik di tab browser baru secara optimal.
            </div>
            <div class="row items-center q-gutter-x-md q-mt-sm text-caption text-grey-8">
              <span><strong>Timezone:</strong> Asia/Jakarta (WIB)</span>
              <span>&bull;</span>
              <span><strong>Metrics Scrape:</strong> Setiap 5 Detik</span>
              <span>&bull;</span>
              <span><strong>Log Stream:</strong> Loki Ingestion Aktif</span>
            </div>
          </q-banner>

          <!-- Grid Cards 4 Layanan Observabilitas -->
          <div class="row q-col-gutter-lg">
            <!-- 1. GRAFANA CARD -->
            <div class="col-12 col-md-6">
              <q-card class="portal-card full-height column justify-between shadow-1">
                <q-card-section class="q-pb-sm">
                  <div class="row items-center justify-between q-mb-sm">
                    <div class="row items-center q-gutter-x-sm">
                      <q-avatar size="44px" color="orange-1" text-color="orange-9" rounded>
                        <q-icon name="query_stats" size="26px" />
                      </q-avatar>
                      <div>
                        <div class="text-subtitle1 text-weight-bold text-slate-900">Grafana Dashboard</div>
                        <div class="text-caption text-grey-6 font-mono">/grafana/ &bull; Visualisasi Lengkap</div>
                      </div>
                    </div>
                    <q-badge color="positive" outline class="text-weight-bold">
                      <span class="status-dot bg-positive q-mr-xs"></span>
                      ONLINE
                    </q-badge>
                  </div>

                  <p class="text-body2 text-grey-8 q-mt-md q-mb-sm">
                    Visualisasi terpadu untuk metrik pemindaian barcode resi, analitik format barcode (Code 128, QR, GS1, EAN), response time API, dan streaming log realtime.
                  </p>

                  <div class="q-gutter-xs q-mt-sm">
                    <q-chip size="sm" dense color="blue-1" text-color="blue-9" icon="qr_code">Scanner Barcode KPI</q-chip>
                    <q-chip size="sm" dense color="green-1" text-color="green-9" icon="speed">Decode Duration (ms)</q-chip>
                    <q-chip size="sm" dense color="amber-1" text-color="amber-9" icon="api">API Latency & Errors</q-chip>
                    <q-chip size="sm" dense color="purple-1" text-color="purple-9" icon="terminal">Loki Logs Live</q-chip>
                  </div>
                </q-card-section>

                <q-separator />

                <q-card-actions align="between" class="q-pa-md bg-slate-50">
                  <span class="text-caption text-grey-6">UID: scanner-monitoring</span>
                  <div class="q-gutter-x-sm">
                    <q-btn
                      unelevated
                      color="orange-9"
                      icon-right="open_in_new"
                      label="Buka Grafana Full Screen"
                      no-caps
                      size="sm"
                      class="text-weight-bold q-px-sm"
                      :href="grafanaDashboardUrl"
                      target="_blank"
                    />
                  </div>
                </q-card-actions>
              </q-card>
            </div>

            <!-- 2. PROMETHEUS CARD -->
            <div class="col-12 col-md-6">
              <q-card class="portal-card full-height column justify-between shadow-1">
                <q-card-section class="q-pb-sm">
                  <div class="row items-center justify-between q-mb-sm">
                    <div class="row items-center q-gutter-x-sm">
                      <q-avatar size="44px" color="red-1" text-color="deep-orange-9" rounded>
                        <q-icon name="analytics" size="26px" />
                      </q-avatar>
                      <div>
                        <div class="text-subtitle1 text-weight-bold text-slate-900">Prometheus Metrics</div>
                        <div class="text-caption text-grey-6 font-mono">Port 9090 &bull; Time-Series DB</div>
                      </div>
                    </div>
                    <q-badge color="primary" outline class="text-weight-bold">
                      <span class="status-dot bg-primary q-mr-xs"></span>
                      3/3 TARGETS UP
                    </q-badge>
                  </div>

                  <p class="text-body2 text-grey-8 q-mt-md q-mb-sm">
                    Mesin penyimpan metrik time-series. Memantau endpoint Perl uWSGI, cAdvisor container hardware, dan target sistem secara real-time dengan query PromQL.
                  </p>

                  <div class="q-gutter-xs q-mt-sm">
                    <q-chip size="sm" dense color="blue-grey-1" text-color="blue-grey-9" icon="sensors">backend:5000/metrics</q-chip>
                    <q-chip size="sm" dense color="blue-grey-1" text-color="blue-grey-9" icon="memory">cadvisor:8080/metrics</q-chip>
                    <q-chip size="sm" dense color="blue-grey-1" text-color="blue-grey-9" icon="dns">PromQL Query Engine</q-chip>
                  </div>
                </q-card-section>

                <q-separator />

                <q-card-actions align="between" class="q-pa-md bg-slate-50">
                  <q-btn
                    flat
                    dense
                    color="grey-8"
                    icon="track_changes"
                    label="Lihat Targets"
                    no-caps
                    size="sm"
                    href="http://localhost:9090/targets"
                    target="_blank"
                  />
                  <q-btn
                    unelevated
                    color="deep-orange-9"
                    icon-right="open_in_new"
                    label="Buka Prometheus UI"
                    no-caps
                    size="sm"
                    class="text-weight-bold q-px-sm"
                    href="http://localhost:9090"
                    target="_blank"
                  />
                </q-card-actions>
              </q-card>
            </div>

            <!-- 3. LOKI CARD -->
            <div class="col-12 col-md-6">
              <q-card class="portal-card full-height column justify-between shadow-1">
                <q-card-section class="q-pb-sm">
                  <div class="row items-center justify-between q-mb-sm">
                    <div class="row items-center q-gutter-x-sm">
                      <q-avatar size="44px" color="amber-1" text-color="amber-10" rounded>
                        <q-icon name="receipt_long" size="26px" />
                      </q-avatar>
                      <div>
                        <div class="text-subtitle1 text-weight-bold text-slate-900">Loki Log Aggregator</div>
                        <div class="text-caption text-grey-6 font-mono">Port 3100 &bull; Centralized Logging</div>
                      </div>
                    </div>
                    <q-badge color="positive" outline class="text-weight-bold">
                      <span class="status-dot bg-positive q-mr-xs"></span>
                      INGESTION READY
                    </q-badge>
                  </div>

                  <p class="text-body2 text-grey-8 q-mt-md q-mb-sm">
                    Pengumpul log terpusat via Promtail. Mengindeks log aplikasi scanner, log transaksi resi, audit autentikasi, serta log akses Nginx Gateway secara efisien.
                  </p>

                  <div class="q-gutter-xs q-mt-sm">
                    <q-chip size="sm" dense color="grey-2" text-color="grey-9" icon="label">service=backend</q-chip>
                    <q-chip size="sm" dense color="grey-2" text-color="grey-9" icon="label">service=nginx</q-chip>
                    <q-chip size="sm" dense color="grey-2" text-color="grey-9" icon="bug_report">level=ERROR/WARN</q-chip>
                  </div>
                </q-card-section>

                <q-separator />

                <q-card-actions align="between" class="q-pa-md bg-slate-50">
                  <q-btn
                    flat
                    dense
                    color="grey-8"
                    icon="health_and_safety"
                    label="Status Ready"
                    no-caps
                    size="sm"
                    href="http://localhost:3100/ready"
                    target="_blank"
                  />
                  <q-btn
                    outline
                    color="amber-10"
                    icon-right="search"
                    label="Eksplor Log di Grafana"
                    no-caps
                    size="sm"
                    class="text-weight-bold q-px-sm"
                    :href="lokiExploreUrl"
                    target="_blank"
                  />
                </q-card-actions>
              </q-card>
            </div>

            <!-- 4. CADVISOR CARD -->
            <div class="col-12 col-md-6">
              <q-card class="portal-card full-height column justify-between shadow-1">
                <q-card-section class="q-pb-sm">
                  <div class="row items-center justify-between q-mb-sm">
                    <div class="row items-center q-gutter-x-sm">
                      <q-avatar size="44px" color="blue-1" text-color="primary" rounded>
                        <q-icon name="dns" size="26px" />
                      </q-avatar>
                      <div>
                        <div class="text-subtitle1 text-weight-bold text-slate-900">cAdvisor Container Monitor</div>
                        <div class="text-caption text-grey-6 font-mono">Port 8088 &bull; Docker Hardware Metrics</div>
                      </div>
                    </div>
                    <q-badge color="positive" outline class="text-weight-bold">
                      <span class="status-dot bg-positive q-mr-xs"></span>
                      RUNNING
                    </q-badge>
                  </div>

                  <p class="text-body2 text-grey-8 q-mt-md q-mb-sm">
                    Pemantau hardware & cgroups container Docker. Mengukur penggunaan CPU, Memory RAM, Network Throughput, dan I/O filesystem untuk semua service Wahana.
                  </p>

                  <div class="q-gutter-xs q-mt-sm">
                    <q-chip size="sm" dense color="blue-grey-1" text-color="blue-grey-9" icon="memory">RAM Usage</q-chip>
                    <q-chip size="sm" dense color="blue-grey-1" text-color="blue-grey-9" icon="speed">CPU Throttling</q-chip>
                    <q-chip size="sm" dense color="blue-grey-1" text-color="blue-grey-9" icon="swap_vert">Network I/O</q-chip>
                  </div>
                </q-card-section>

                <q-separator />

                <q-card-actions align="between" class="q-pa-md bg-slate-50">
                  <span class="text-caption text-grey-6">Container Scope: wahana_*</span>
                  <q-btn
                    unelevated
                    color="primary"
                    icon-right="open_in_new"
                    label="Buka cAdvisor UI"
                    no-caps
                    size="sm"
                    class="text-weight-bold q-px-sm"
                    href="http://localhost:8088/docker/"
                    target="_blank"
                  />
                </q-card-actions>
              </q-card>
            </div>
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

const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
const grafanaDashboardUrl = `${baseUrl}/grafana/d/scanner-monitoring/scanner-barcode-express-e28094-system-monitoring?orgId=1`
const lokiExploreUrl = `${baseUrl}/grafana/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Loki%22,%7B%22expr%22:%22%7Bservice%3D~%5C%22backend%7Cscanner%7Cobservability%5C%22%7D%22%7D%5D`

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

.portal-card {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  background-color: #ffffff;
}

.portal-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgba(11, 35, 65, 0.1), 0 8px 10px -6px rgba(11, 35, 65, 0.05);
}

.border-subtle {
  border: 1px solid #cbd5e1;
}

.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
</style>
