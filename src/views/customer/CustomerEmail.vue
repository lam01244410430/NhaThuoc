<script setup lang="ts">
import axios from 'axios'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue'

import CustomerContentCard
  from '@/components/Customer/CustomerContentCard.vue'
import {
  customerAccountService,
  type CustomerProfile,
} from '@/services/customer-account.service'

const RESEND_SECONDS = 60
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const profile = ref<CustomerProfile | null>(null)
const newEmail = ref('')
const currentPassword = ref('')
const otp = ref('')
const emailError = ref('')
const passwordError = ref('')
const otpError = ref('')
const globalError = ref('')
const successMessage = ref('')
const loadingProfile = ref(true)
const isSendingOtp = ref(false)
const isChangingEmail = ref(false)
const otpSent = ref(false)
const countdown = ref(0)

let countdownTimer: ReturnType<typeof setInterval> | null = null

const normalizedEmail = computed(() => {
  return newEmail.value.trim().toLowerCase()
})

const maskedNormalizedEmail = computed(() => {
  const email = profile.value?.email?.trim()

  if (!email) return 'email của tài khoản'

  const atIndex = email.lastIndexOf('@')
  if (atIndex <= 1) return email

  const localPart = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)

  return `${localPart.slice(0, 2)}***@${domain}`
})

const isEmailValid = computed(() => {
  return emailRegex.test(normalizedEmail.value)
})

const isCurrentEmail = computed(() => {
  return normalizedEmail.value ===
    profile.value?.email?.trim().toLowerCase()
})

const maskedEmail = computed(() => {
  const email = profile.value?.email?.trim()

  if (!email) return 'email của tài khoản'

  const atIndex = email.lastIndexOf('@')
  if (atIndex <= 1) return email

  const localPart = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)

  return `${localPart.slice(0, 2)}***@${domain}`
})

const isOtpValid = computed(() => {
  return /^\d{6}$/.test(otp.value)
})

const canSendOtp = computed(() => {
  return (
    !loadingProfile.value &&
    !isSendingOtp.value &&
    !isChangingEmail.value &&
    countdown.value === 0 &&
    isEmailValid.value &&
    !isCurrentEmail.value
  )
})

const canSubmit = computed(() => {
  return (
    otpSent.value &&
    isOtpValid.value &&
    !isSendingOtp.value &&
    !isChangingEmail.value
  )
})

function getApiMessage(
  error: unknown,
  fallback: string,
): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback
  }

  return error instanceof Error
    ? error.message
    : fallback
}

function getFieldError(
  error: unknown,
  field: string,
): string {
  if (!axios.isAxiosError(error)) return ''

  const errors = error.response?.data?.errors as
    | Record<string, string[] | undefined>
    | undefined

  return errors?.[field]?.[0] ?? ''
}

function stopCountdown() {
  if (countdownTimer !== null) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function startCountdown() {
  stopCountdown()
  countdown.value = RESEND_SECONDS

  countdownTimer = setInterval(() => {
    countdown.value -= 1

    if (countdown.value <= 0) {
      countdown.value = 0
      stopCountdown()
    }
  }, 1000)
}

async function loadProfile() {
  loadingProfile.value = true
  globalError.value = ''

  try {
    profile.value =
      await customerAccountService.getProfile()
  } catch (error: unknown) {
    globalError.value = getApiMessage(
      error,
      'Không thể tải thông tin tài khoản',
    )
  } finally {
    loadingProfile.value = false
  }
}

function handleEmailInput() {
  emailError.value = ''
  globalError.value = ''
  successMessage.value = ''

  if (otpSent.value) {
    otpSent.value = false
    otp.value = ''
    otpError.value = ''
  }
}

function handleOtpInput(event: Event) {
  const input = event.target as HTMLInputElement

  otp.value = input.value
    .replace(/\D/g, '')
    .slice(0, 6)

  otpError.value = ''
  globalError.value = ''
}

async function sendOtp() {
  if (!isEmailValid.value) {
    emailError.value = 'Email mới không đúng định dạng'
    return
  }

  if (isCurrentEmail.value) {
    emailError.value = 'Email mới phải khác email hiện tại'
    return
  }

  if (countdown.value > 0) return

  isSendingOtp.value = true
  emailError.value = ''
  otpError.value = ''
  globalError.value = ''
  successMessage.value = ''

  try {
    const response =
      await customerAccountService.requestOtp({
        type: 'change_email',
        target_value: normalizedEmail.value,
      })

    otpSent.value = true
    successMessage.value = response.message
    startCountdown()
  } catch (error: unknown) {
    emailError.value =
      getFieldError(error, 'target_value')

    globalError.value = getApiMessage(
      error,
      'Không thể gửi mã OTP',
    )
  } finally {
    isSendingOtp.value = false
  }
}

async function changeEmail() {
  if (!isOtpValid.value) {
    otpError.value = 'Mã OTP phải gồm đúng 6 chữ số'
    return
  }

  isChangingEmail.value = true
  emailError.value = ''
  passwordError.value = ''
  otpError.value = ''
  globalError.value = ''
  successMessage.value = ''

  try {
    const email = normalizedEmail.value
    const response =
      await customerAccountService.changeEmail({
        new_email: email,
        current_password:
          currentPassword.value || undefined,
        otp: otp.value,
      })

    if (profile.value) {
      profile.value.email = email
    }

    newEmail.value = ''
    currentPassword.value = ''
    otp.value = ''
    otpSent.value = false
    countdown.value = 0
    stopCountdown()
    successMessage.value = response.message
  } catch (error: unknown) {
    emailError.value =
      getFieldError(error, 'new_email')
    passwordError.value =
      getFieldError(error, 'current_password')
    otpError.value =
      getFieldError(error, 'otp')

    globalError.value = getApiMessage(
      error,
      'Không thể đổi email',
    )
  } finally {
    isChangingEmail.value = false
  }
}

onMounted(loadProfile)
onBeforeUnmount(stopCountdown)
</script>

<template>
  <CustomerContentCard
    title="Đổi email"
    description="Xác minh email mới bằng mã OTP trước khi cập nhật"
  >
    <div
      v-if="globalError"
      class="notice notice--error"
      role="alert"
    >
      {{ globalError }}
    </div>

    <div
      v-if="successMessage"
      class="notice notice--success"
      role="status"
    >
      {{ successMessage }}
    </div>

    <form
      class="email-form"
      @submit.prevent="changeEmail"
    >
      <div class="form-row">
        <label>Email hiện tại</label>

        <div class="field-content readonly-value">
          {{ maskedEmail || 'Đang tải...' }}
        </div>
      </div>

      <div class="form-row">
        <label for="new-email">Email mới</label>

        <div class="field-content">
          <input
            id="new-email"
            v-model="newEmail"
            type="email"
            autocomplete="email"
            maxlength="254"
            class="form-input"
            :class="{ 'is-invalid': emailError }"
            :disabled="loadingProfile || isChangingEmail"
            placeholder="Nhập email mới"
            @input="handleEmailInput"
          >

          <p
            v-if="emailError"
            class="field-error"
          >
            {{ emailError }}
          </p>
        </div>
      </div>

      <div class="form-row">
        <div />

        <button
          type="button"
          class="primary-button"
          :disabled="!canSendOtp"
          @click="sendOtp"
        >
          <template v-if="isSendingOtp">
            Đang gửi...
          </template>

          <template v-else-if="countdown > 0">
            Gửi lại sau {{ countdown }}s
          </template>

          <template v-else>
            {{ otpSent ? 'Gửi lại mã OTP' : 'Gửi mã OTP' }}
          </template>
        </button>
      </div>

      <template v-if="otpSent">
        <div class="divider" />

        <p class="otp-info">
          Mã OTP đã được gửi tới
          <strong>{{ normalizedEmail }}</strong>.
          Mã có hiệu lực trong 5 phút.
        </p>

        <div class="form-row">
          <label for="current-password">
            Mật khẩu hiện tại
          </label>

          <div class="field-content">
            <input
              id="current-password"
              v-model="currentPassword"
              type="password"
              autocomplete="current-password"
              class="form-input"
              :class="{
                'is-invalid': passwordError,
              }"
              placeholder="Bỏ trống nếu tài khoản không có mật khẩu"
              @input="passwordError = ''"
            >

            <p
              v-if="passwordError"
              class="field-error"
            >
              {{ passwordError }}
            </p>
          </div>
        </div>

        <div class="form-row">
          <label for="email-otp">Mã OTP</label>

          <div class="field-content">
            <input
              id="email-otp"
              :value="otp"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              class="form-input otp-input"
              :class="{ 'is-invalid': otpError }"
              placeholder="Nhập 6 chữ số"
              @input="handleOtpInput"
            >

            <p
              v-if="otpError"
              class="field-error"
            >
              {{ otpError }}
            </p>
          </div>
        </div>

        <div class="form-row">
          <div />

          <button
            type="submit"
            class="primary-button"
            :disabled="!canSubmit"
          >
            {{
              isChangingEmail
                ? 'Đang cập nhật...'
                : 'Xác nhận đổi email'
            }}
          </button>
        </div>
      </template>
    </form>
  </CustomerContentCard>
</template>

<style scoped lang="scss">
.email-form {
  display: flex;
  max-width: 680px;
  flex-direction: column;
  gap: 20px;
}

.notice {
  max-width: 600px;
  margin-bottom: 20px;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 13px;
}

.notice--success {
  border-color: #b7e4bf;
  background: #edf9ef;
  color: #237a32;
}

.notice--error {
  border-color: #ffc9c4;
  background: #fff1f0;
  color: #b42318;
}

.form-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 430px);
  align-items: start;
  gap: 20px;
}

.form-row > label {
  padding-top: 12px;
  color: #344054;
  font-size: 14px;
  font-weight: 600;
  text-align: right;
}

.field-content {
  width: 100%;
  max-width: 430px;
  min-width: 0;
}

.readonly-value {
  min-height: 44px;
  padding-top: 12px;
  color: #475467;
  font-size: 14px;
}

.form-input {
  width: 100%;
  height: 44px;
  box-sizing: border-box;
  padding: 0 14px;
  border: 1px solid #d0d5dd;
  border-radius: 4px;
  outline: none;
  background: #ffffff;
  color: #1d2939;
  font: inherit;
  font-size: 14px;
}

.form-input:focus {
  border-color: #39b54a;
  box-shadow: 0 0 0 3px rgb(57 181 74 / 10%);
}

.form-input:disabled {
  background: #f5f6f7;
  cursor: not-allowed;
}

.form-input.is-invalid {
  border-color: #dc3545;
}

.field-error {
  margin: 7px 0 0;
  color: #dc3545;
  font-size: 12.5px;
}

.primary-button {
  width: fit-content;
  min-height: 42px;
  padding: 0 20px;
  border: 1px solid #39b54a;
  border-radius: 4px;
  background: #39b54a;
  color: #ffffff;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.primary-button:hover:not(:disabled) {
  border-color: #2f9f40;
  background: #2f9f40;
}

.primary-button:disabled {
  border-color: #d7dadd;
  background: #d7dadd;
  cursor: not-allowed;
}

.divider {
  height: 1px;
  background: #eceff1;
}

.otp-info {
  margin: 0 0 0 170px;
  color: #62686f;
  font-size: 13px;
  line-height: 1.6;
}

.otp-input {
  letter-spacing: 5px;
  font-size: 17px;
  font-weight: 600;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .form-row > label {
    padding-top: 0;
    text-align: left;
  }

  .field-content {
    max-width: none;
  }

  .otp-info {
    margin-left: 0;
  }
}
</style>

