<template>
  <div class="login-shell flex flex-center q-pa-md">
    <div class="login-card shadow-6">
      <!-- Form Panel -->
      <div class="bg-white form-panel">
        <div class="form-inner">
          <div class="text-center q-mb-lg">
            <q-avatar size="48px" class="bg-wahana-yellow text-wahana-navy q-mb-sm shadow-1" style="border-radius: 12px;">
              <q-icon name="qr_code_scanner" size="28px" />
            </q-avatar>
            <div class="text-h6 text-weight-bold text-wahana-navy">Dijak Express</div>
          </div>

          <!-- STEP 1: LOGIN KREDENSIAL -->
          <div v-if="step === 'CREDENTIALS'">
            <div class="text-h6 text-weight-bold">Masuk ke akun Anda</div>
            <p class="text-body2 text-grey-6 q-mt-xs q-mb-lg">
              Gunakan username dan password yang diberikan operator.
            </p>

            <q-form @submit.prevent="handleLogin" class="column q-gutter-y-md">
              <q-input
                v-model="username"
                outlined
                label="Username / Email"
                placeholder="cth: ******* "
                autocomplete="username"
                autofocus
                :rules="[v => !!v || 'Username wajib diisi']"
              >
                <template v-slot:prepend><q-icon name="person" size="20px" class="text-grey-6" /></template>
              </q-input>

              <q-input
                v-model="password"
                outlined
                type="password"
                label="Password"
                placeholder="••••••••"
                autocomplete="current-password"
                :rules="[v => !!v || 'Password wajib diisi']"
              >
                <template v-slot:prepend><q-icon name="lock" size="20px" class="text-grey-6" /></template>
              </q-input>

              <div class="row justify-end q-mt-xs q-mb-xs">
                <q-btn flat dense no-caps color="primary" label="Lupa Password?" class="text-weight-bold" @click="goToForgotRequest" />
              </div>

              <q-btn
                type="submit"
                color="primary"
                size="lg"
                unelevated
                no-caps
                :loading="authStore.isLoading"
                class="full-width"
                label="Masuk"
              />
            </q-form>
          </div>

          <!-- STEP 2: VERIFIKASI OTP 6-DIGIT LOGIN -->
          <div v-else-if="step === 'OTP'">
            <div class="text-h6 text-weight-bold row items-center">
              <q-icon name="mark_email_read" color="primary" class="q-mr-xs" size="24px" />
              Verifikasi OTP Email
            </div>
            <p class="text-body2 text-grey-7 q-mt-xs q-mb-md">
              Kode OTP 6-digit telah dikirim via SMTP Gmail ke:
              <br><strong class="text-primary">{{ maskedEmail }}</strong>
            </p>

            <!-- Expire Badge -->
            <div class="q-mb-md flex items-center justify-between bg-blue-1 q-pa-sm border-radius-8" style="border-radius: 8px;">
              <span class="text-caption text-grey-8">Masa berlaku OTP:</span>
              <q-chip dense color="primary" text-color="white" icon="timer">
                {{ formatTimer(otpExpireSeconds) }}
              </q-chip>
            </div>

            <q-form @submit.prevent="handleVerifyOtp" class="column q-gutter-y-md">
              <q-input
                v-model="otpCode"
                outlined
                mask="######"
                maxlength="6"
                label="Kode OTP (6 Digit)"
                placeholder="· · · · · ·"
                autofocus
                class="text-h6 text-center"
                :rules="[
                  v => !!v || 'Kode OTP wajib diisi',
                  v => v.length === 6 || 'Kode OTP harus 6 digit angka'
                ]"
              >
                <template v-slot:prepend><q-icon name="key" size="20px" class="text-primary" /></template>
              </q-input>

              <q-btn
                type="submit"
                color="primary"
                size="lg"
                unelevated
                no-caps
                :loading="authStore.isLoading"
                :disabled="otpExpireSeconds <= 0"
                class="full-width"
                label="Verifikasi OTP"
              />

              <div class="row items-center justify-between q-mt-xs">
                <q-btn
                  type="button"
                  flat
                  dense
                  no-caps
                  color="grey-7"
                  icon="arrow_back"
                  label="Kembali"
                  @click="cancelOtp"
                />

                <q-btn
                  type="button"
                  outline
                  dense
                  no-caps
                  color="primary"
                  icon="refresh"
                  :disabled="resendCooldownSeconds > 0"
                  :label="resendCooldownSeconds > 0 ? `Kirim Ulang (${resendCooldownSeconds}s)` : 'Kirim Ulang OTP'"
                  @click="handleResendOtp"
                />
              </div>
            </q-form>

            <div v-if="otpExpireSeconds <= 0" class="text-caption text-negative text-center q-mt-md">
              <q-icon name="warning" /> Kode OTP telah expired. Silakan klik "Kirim Ulang OTP".
            </div>
          </div>

          <!-- STEP 3: LUPA PASSWORD — REQUEST OTP -->
          <div v-else-if="step === 'FORGOT_REQUEST'">
            <div class="text-h6 text-weight-bold row items-center">
              <q-icon name="lock_reset" color="primary" class="q-mr-xs" size="24px" />
              Lupa Password?
            </div>
            <p class="text-body2 text-grey-6 q-mt-xs q-mb-lg">
              Masukkan Username atau Gmail yang terdaftar pada akun Anda. Kami akan mengirimkan kode OTP reset password.
            </p>

            <q-form @submit.prevent="handleForgotRequest" class="column q-gutter-y-md">
              <q-input
                v-model="forgotIdentity"
                outlined
                label="Username / Gmail"
                placeholder="cth: budi atau budi@gmail.com"
                autofocus
                :rules="[v => !!v || 'Username atau Gmail wajib diisi']"
              >
                <template v-slot:prepend><q-icon name="person" size="20px" class="text-primary" /></template>
              </q-input>

              <q-btn
                type="submit"
                color="primary"
                size="lg"
                unelevated
                no-caps
                :loading="authStore.isLoading"
                class="full-width text-weight-bold"
                label="Kirim Kode OTP Reset"
              />

              <div class="row justify-center q-mt-sm">
                <q-btn flat dense no-caps color="grey-7" icon="arrow_back" label="Kembali ke Login" @click="cancelForgot" />
              </div>
            </q-form>
          </div>

          <!-- STEP 4: LUPA PASSWORD — VERIFIKASI OTP RESET -->
          <div v-else-if="step === 'FORGOT_OTP'">
            <div class="text-h6 text-weight-bold row items-center">
              <q-icon name="mark_email_read" color="primary" class="q-mr-xs" size="24px" />
              Verifikasi OTP Reset Password
            </div>
            <p class="text-body2 text-grey-7 q-mt-xs q-mb-md">
              Kode OTP 6-digit reset password telah dikirim ke:
              <br><strong class="text-primary">{{ maskedEmail }}</strong>
            </p>

            <div class="q-mb-md flex items-center justify-between bg-blue-1 q-pa-sm border-radius-8" style="border-radius: 8px;">
              <span class="text-caption text-grey-8">Masa berlaku OTP:</span>
              <q-chip dense color="primary" text-color="white" icon="timer">
                {{ formatTimer(otpExpireSeconds) }}
              </q-chip>
            </div>

            <q-form @submit.prevent="handleVerifyForgotOtp" class="column q-gutter-y-md">
              <q-input
                v-model="forgotOtpCode"
                outlined
                mask="######"
                maxlength="6"
                label="Kode OTP (6 Digit)"
                placeholder="· · · · · ·"
                autofocus
                class="text-h6 text-center"
                :rules="[
                  v => !!v || 'Kode OTP wajib diisi',
                  v => v.length === 6 || 'Kode OTP harus 6 digit angka'
                ]"
              >
                <template v-slot:prepend><q-icon name="key" size="20px" class="text-primary" /></template>
              </q-input>

              <q-btn
                type="submit"
                color="primary"
                size="lg"
                unelevated
                no-caps
                :loading="authStore.isLoading"
                :disabled="otpExpireSeconds <= 0"
                class="full-width text-weight-bold"
                label="Verifikasi OTP Reset"
              />

              <div class="row items-center justify-between q-mt-xs">
                <q-btn type="button" flat dense no-caps color="grey-7" icon="arrow_back" label="Batal" @click="cancelForgot" />
                <q-btn
                  type="button"
                  outline
                  dense
                  no-caps
                  color="primary"
                  icon="refresh"
                  :disabled="resendCooldownSeconds > 0"
                  :label="resendCooldownSeconds > 0 ? `Kirim Ulang (${resendCooldownSeconds}s)` : 'Kirim Ulang OTP'"
                  @click="handleForgotRequest"
                />
              </div>
            </q-form>

            <div v-if="otpExpireSeconds <= 0" class="text-caption text-negative text-center q-mt-md">
              <q-icon name="warning" /> Kode OTP telah expired. Silakan klik "Kirim Ulang OTP".
            </div>
          </div>

          <!-- STEP 5: LUPA PASSWORD — FORM PASSWORD BARU -->
          <div v-else-if="step === 'FORGOT_NEW_PASSWORD'">
            <div class="text-h6 text-weight-bold row items-center text-primary">
              <q-icon name="lock_reset" class="q-mr-xs" size="24px" />
              Buat Password Baru
            </div>
            <p class="text-body2 text-grey-7 q-mt-xs q-mb-md">
              OTP berhasil diverifikasi. Masukkan password baru untuk akun Anda.
            </p>

            <q-form @submit.prevent="handleResetPassword" class="column q-gutter-y-md">
              <q-input
                v-model="newPassword"
                outlined
                type="password"
                label="Password Baru"
                placeholder="Minimal 6 karakter"
                autofocus
                :rules="[
                  v => !!v || 'Password baru wajib diisi',
                  v => v.length >= 6 || 'Password minimal 6 karakter'
                ]"
              >
                <template v-slot:prepend><q-icon name="lock" size="20px" class="text-primary" /></template>
              </q-input>

              <q-input
                v-model="confirmPassword"
                outlined
                type="password"
                label="Konfirmasi Password Baru"
                placeholder="Ulangi password baru"
                :rules="[
                  v => !!v || 'Konfirmasi password wajib diisi',
                  v => v === newPassword || 'Konfirmasi password tidak cocok'
                ]"
              >
                <template v-slot:prepend><q-icon name="lock" size="20px" class="text-primary" /></template>
              </q-input>

              <q-btn
                type="submit"
                color="positive"
                size="lg"
                unelevated
                no-caps
                :loading="authStore.isLoading"
                class="full-width text-weight-bold"
                label="Simpan Password Baru"
              />
            </q-form>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/authStore'

const $q = useQuasar()
const router = useRouter()
const authStore = useAuthStore()

const step = ref('CREDENTIALS') // 'CREDENTIALS' | 'OTP'
const username = ref('admin')
const password = ref('admin123')

// State OTP
const preauthToken = ref('')
const maskedEmail = ref('')
const otpCode = ref('')
const otpExpireSeconds = ref(300) // 5 menit
const resendCooldownSeconds = ref(0) // 60 detik

// State Lupa Password
const forgotIdentity = ref('')
const resetToken = ref('')
const resetVerifiedToken = ref('')
const forgotOtpCode = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

let expireInterval = null
let cooldownInterval = null


const startTimers = () => {
  stopTimers()
  otpExpireSeconds.value = 300
  resendCooldownSeconds.value = 60

  expireInterval = setInterval(() => {
    if (otpExpireSeconds.value > 0) {
      otpExpireSeconds.value--
    } else {
      clearInterval(expireInterval)
    }
  }, 1000)

  cooldownInterval = setInterval(() => {
    if (resendCooldownSeconds.value > 0) {
      resendCooldownSeconds.value--
    } else {
      clearInterval(cooldownInterval)
    }
  }, 1000)
}

const stopTimers = () => {
  if (expireInterval) {
    clearInterval(expireInterval)
    expireInterval = null
  }
  if (cooldownInterval) {
    clearInterval(cooldownInterval)
    cooldownInterval = null
  }
}

onUnmounted(() => {
  stopTimers()
})

const formatTimer = (seconds) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const handleLogin = async () => {
  const res = await authStore.login(username.value, password.value)
  processLoginResult(res)
}


const processLoginResult = (res) => {
  if (res.success) {
    if (res.requires_otp) {
      // Beralih ke Step OTP
      preauthToken.value = res.preauth_token
      maskedEmail.value = res.masked_email || 'email Anda'
      step.value = 'OTP'
      otpCode.value = ''
      startTimers()

      $q.notify({
        type: 'info',
        icon: 'mark_email_read',
        message: res.message || 'Masukkan kode OTP yang dikirim ke email Anda.',
        position: 'top',
        timeout: 3000
      })
    } else {
      // Sesi langsung aktif jika OTP tidak diwajibkan
      $q.notify({
        type: 'positive',
        icon: 'check_circle',
        message: res.message,
        position: 'top',
        timeout: 1800
      })
      redirectByRole(res.role)
    }
  } else {
    $q.notify({
      type: 'negative',
      icon: 'error',
      message: res.message || 'Login gagal. Periksa koneksi ke server.',
      position: 'top',
      timeout: 2500
    })
  }
}

const handleVerifyOtp = async () => {
  if (!otpCode.value || otpCode.value.length !== 6) return

  const res = await authStore.verifyOtp(preauthToken.value, otpCode.value)
  if (res.success) {
    stopTimers()
    $q.notify({
      type: 'positive',
      icon: 'verified_user',
      message: res.message || 'Verifikasi OTP Berhasil!',
      position: 'top',
      timeout: 2000
    })
    redirectByRole(res.role)
  } else {
    $q.notify({
      type: 'negative',
      icon: 'gpp_bad',
      message: res.message || 'Kode OTP salah atau kedaluwarsa.',
      position: 'top',
      timeout: 3000
    })
  }
}

const handleResendOtp = async () => {
  if (resendCooldownSeconds.value > 0) return

  const res = await authStore.resendOtp(preauthToken.value)
  if (res.success) {
    startTimers()
    $q.notify({
      type: 'positive',
      icon: 'mark_email_read',
      message: res.message || 'Kode OTP baru telah dikirim!',
      position: 'top',
      timeout: 2500
    })
  } else {
    $q.notify({
      type: 'negative',
      icon: 'error',
      message: res.message || 'Gagal mengirim ulang OTP.',
      position: 'top',
      timeout: 2500
    })
  }
}

const cancelOtp = () => {
  stopTimers()
  step.value = 'CREDENTIALS'
  preauthToken.value = ''
  otpCode.value = ''
}

const goToForgotRequest = () => {
  step.value = 'FORGOT_REQUEST'
  forgotIdentity.value = username.value || ''
}

const cancelForgot = () => {
  stopTimers()
  step.value = 'CREDENTIALS'
  forgotIdentity.value = ''
  resetToken.value = ''
  resetVerifiedToken.value = ''
  forgotOtpCode.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
}

const handleForgotRequest = async () => {
  if (!forgotIdentity.value) return
  const res = await authStore.forgotPasswordRequest(forgotIdentity.value)
  if (res.success) {
    resetToken.value = res.reset_token
    maskedEmail.value = res.masked_email || 'Gmail Anda'
    step.value = 'FORGOT_OTP'
    forgotOtpCode.value = ''
    startTimers()
    $q.notify({
      type: 'info',
      icon: 'mark_email_read',
      message: res.message || 'Kode OTP reset password telah dikirim ke email Anda.',
      position: 'top',
      timeout: 3000
    })
  } else {
    cancelForgot()
    $q.notify({
      type: 'negative',
      icon: 'error',
      message: res.message || 'Gagal meminta reset password.',
      position: 'top',
      timeout: 2500
    })
  }
}

const handleVerifyForgotOtp = async () => {
  if (!forgotOtpCode.value || forgotOtpCode.value.length !== 6) return
  const res = await authStore.verifyForgotOtp(resetToken.value, forgotOtpCode.value)
  if (res.success) {
    stopTimers()
    resetVerifiedToken.value = res.reset_verified_token
    step.value = 'FORGOT_NEW_PASSWORD'
    newPassword.value = ''
    confirmPassword.value = ''
    $q.notify({
      type: 'positive',
      icon: 'verified_user',
      message: res.message || 'OTP Berhasil Diverifikasi! Silakan buat password baru.',
      position: 'top',
      timeout: 2000
    })
  } else {
    $q.notify({
      type: 'negative',
      icon: 'gpp_bad',
      message: res.message || 'Kode OTP salah atau kedaluwarsa.',
      position: 'top',
      timeout: 3000
    })
  }
}

const handleResetPassword = async () => {
  if (!newPassword.value || newPassword.value.length < 6) {
    $q.notify({
      type: 'warning',
      icon: 'warning',
      message: 'Password baru minimal 6 karakter.',
      position: 'top',
      timeout: 2000
    })
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    $q.notify({
      type: 'warning',
      icon: 'warning',
      message: 'Konfirmasi password baru tidak cocok.',
      position: 'top',
      timeout: 2000
    })
    return
  }

  const res = await authStore.resetPassword(
    resetVerifiedToken.value,
    newPassword.value,
    confirmPassword.value
  )

  if (res.success) {
    $q.notify({
      type: 'positive',
      icon: 'check_circle',
      message: res.message || 'Password berhasil diubah. Silakan login kembali.',
      position: 'top',
      timeout: 3000
    })
    cancelForgot()
  } else {
    $q.notify({
      type: 'negative',
      icon: 'error',
      message: res.message || 'Gagal mengubah password.',
      position: 'top',
      timeout: 3000
    })
  }
}

const redirectByRole = (role) => {
  if (role === 'ADMIN') router.push('/admin')
  else if (role === 'CUSTOMER') router.push('/customer')
  else router.push('/petugas')
}
</script>

<style scoped>
.login-shell {
  min-height: 100vh;
  min-height: 100dvh;
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(11, 35, 65, 0.08), transparent 60%),
    #eef2f7;
}

.login-card {
  width: 100%;
  max-width: 440px;
  margin: auto;
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--dj-border);
}

.form-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.form-inner {
  width: 100%;
  padding: 40px 32px;
}
</style>
