<template>
  <q-page class="q-pa-md q-pa-lg-xl">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <h4 class="page-title">Portal Customer</h4>
        <div class="text-subtitle2 text-grey-7">
          Selamat datang, {{ authStore.currentUser?.name }} — buat paket & lacak pengiriman Anda
        </div>
      </div>

      <q-btn
        color="primary"
        icon="add_box"
        label="Buat Paket Baru" no-caps
        unelevated
        to="/customer/buat-paket"
        class="text-weight-bold"
      />
    </div>

    <q-separator class="q-mb-lg" />

    <!-- Statistik Paket Saya -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-sm-6 col-md-4">
        <q-card class="scan-card text-center q-pa-sm">
          <q-card-section>
            <div class="overline-label">Total Paket Saya</div>
            <div class="kpi-value text-slate-900 font-mono">
              {{ stats.total }}
            </div>
            <div class="text-caption text-grey-6">Nomor resi dibuat backend</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-sm-6 col-md-4">
        <q-card class="scan-card text-center q-pa-sm">
          <q-card-section>
            <div class="overline-label">Terdaftar</div>
            <div class="kpi-value text-slate-900 font-mono">
              {{ stats.terdaftar }}
            </div>
            <div class="text-caption text-grey-6">Siap diproses & discan petugas</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-sm-12 col-md-4">
        <q-card class="scan-card text-center q-pa-sm">
          <q-card-section>
            <div class="overline-label">Draft</div>
            <div class="kpi-value text-amber-8 font-mono q-my-xs">
              {{ stats.draft }}
            </div>
            <div class="text-caption text-grey-6">Menunggu data barang disimpan</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Panduan Alur -->
    <q-card class="scan-card q-pa-md">
      <q-card-section>
        <div class="text-subtitle1 text-weight-bold text-slate-800 row items-center q-mb-md">
          <q-icon name="route" color="primary" size="22px" class="q-mr-sm" />
          Alur Pembuatan Paket
        </div>

        <div class="row q-col-gutter-sm">
          <div v-for="(step, i) in steps" :key="i" class="col-12 col-sm-6 col-md-3">
            <q-card flat bordered class="bg-white full-height q-pa-sm">
              <q-card-section>
                <q-avatar size="32px" color="amber-2" text-color="amber-9" class="text-weight-bolder q-mb-sm">
                  {{ i + 1 }}
                </q-avatar>
                <div class="text-weight-bold text-slate-900">{{ step.title }}</div>
                <div class="text-caption text-grey-7 q-mt-xs">{{ step.desc }}</div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <q-banner class="bg-blue-1 text-slate-800 q-mt-md rounded-borders">
          <template v-slot:avatar><q-icon name="info" color="primary" /></template>
          Nomor resi selalu dibuat oleh <b>sistem (backend)</b> — barcode hanya gambar dari
          nomor tersebut. Petugas tidak dapat memakai resi sebelum Anda menyimpan data barang.
        </q-banner>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/authStore'
import { usePaketStore } from '../../stores/paketStore'

const authStore = useAuthStore()
const paketStore = usePaketStore()

const stats = computed(() => {
  const mine = paketStore.getScopedPakets(authStore.currentUser)
  const terdaftar = mine.filter((p) => p.status === 'TERDAFTAR')
  return {
    total: mine.length,
    terdaftar: terdaftar.length,
    draft: mine.length - terdaftar.length
  }
})

const steps = [
  { title: 'Generate Resi', desc: 'Klik tombol generate — sistem membuat nomor resi unik untuk Anda.' },
  { title: 'Barcode Terbit', desc: 'Barcode CODE128 otomatis dirender dari nomor resi tersebut.' },
  { title: 'Input Barang', desc: 'Lengkapi nama barang, pengirim, penerima, berat & layanan.' },
  { title: 'Simpan', desc: 'Status jadi TERDAFTAR — paket siap discan petugas cabang.' }
]

onMounted(() => {
  paketStore.fetchPakets()
})
</script>
