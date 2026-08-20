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

const phoneRegex = /^0\d{9}$/
const RESEND_SECONDS = 60

const profile = ref<CustomerProfile | null>(null)
const phone = ref('')
const otp = ref('')
const phoneError = ref('')
const otpError = ref('')
const globalError = ref('')
const successMessage = ref('')
const loadingProfile = ref(true)
const isSendingOtp = ref(false)
const isVerifying = ref(false)
const otpSent = ref(false)
const countdown = ref(0)

let countdownTimer: ReturnType<typeof setInterval> | null = null

const isPhoneValid = computed(() => {
  return phoneRegex.test(phone.value)
})

const isOtpValid = computed(() => {
  return /^\d{6}$/.test(otp.value)
})

const isCurrentPhone = computed(() => {
  return Boolean(
    profile.value?.phone &&
    phone.value === profile.value.phone,
  )
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

const canSendOtp = computed(() => {
  return (
    !loadingProfile.value &&
    !isSendingOtp.value &&
    !isVerifying.value &&
    countdown.value === 0 &&
    isPhoneValid.value &&
    !isCurrentPhone.value
  )
})

const canVerify = computed(() => {
  return (
    otpSent.value &&
    isOtpValid.value &&
    !isSendingOtp.value &&
    !isVerifying.value
  )
})

function getApiMessage(
  error: unknown,
  fallback: string,
): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
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

function handlePhoneInput(event: Event) {
  const input = event.target as HTMLInputElement

  phone.value = input.value
    .replace(/\D/g, '')
    .slice(0, 10)

  phoneError.value = ''
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
  if (!isPhoneValid.value) {
    phoneError.value =
      'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0'
    return
  }

  if (isCurrentPhone.value) {
    phoneError.value =
      'Số điện thoại mới phải khác số điện thoại hiện tại'
    return
  }

  if (countdown.value > 0) return

  isSendingOtp.value = true
  phoneError.value = ''
  otpError.value = ''
  globalError.value = ''
  successMessage.value = ''

  try {
    const response =
      await customerAccountService.requestOtp({
        type: 'change_phone',
        target_value: phone.value,
      })

    otpSent.value = true
    successMessage.value = response.message
    startCountdown()
  } catch (error: unknown) {
    phoneError.value =
      getFieldError(error, 'target_value')

    globalError.value = getApiMessage(
      error,
      'Không thể gửi mã OTP',
    )
  } finally {
    isSendingOtp.value = false
  }
}

async function verifyOtp() {
  if (!isOtpValid.value) {
    otpError.value = 'Mã OTP phải gồm đúng 6 chữ số'
    return
  }

  isVerifying.value = true
  otpError.value = ''
  globalError.value = ''
  successMessage.value = ''

  try {
    const newPhone = phone.value
    const response =
      await customerAccountService.changePhone({
        new_phone: newPhone,
        otp: otp.value,
      })

    if (profile.value) {
      profile.value.phone = newPhone
    }

    phone.value = ''
    otp.value = ''
    otpSent.value = false
    countdown.value = 0
    stopCountdown()
    successMessage.value = response.message
  } catch (error: unknown) {
    otpError.value =
      getFieldError(error, 'otp')

    phoneError.value =
      getFieldError(error, 'new_phone')

    globalError.value = getApiMessage(
      error,
      'Không thể đổi số điện thoại',
    )
  } finally {
    isVerifying.value = false
  }
}

onMounted(loadProfile)
onBeforeUnmount(stopCountdown)
</script>

<template>
  <CustomerContentCard
    title="Chỉnh sửa số điện thoại"
    description="Xác thực qua email trước khi thay đổi số điện thoại"
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

    <div class="phone-change-form">
      <div class="form-row">
        <label for="phone" class="form-label">
          Số điện thoại mới
        </label>

        <div class="field-content">
          <input
            id="phone"
            :value="phone"
            type="tel"
            inputmode="numeric"
            autocomplete="tel"
            maxlength="10"
            :disabled="loadingProfile || isVerifying"
            class="form-input"
            :class="{
              'is-valid': isPhoneValid,
              'is-invalid': phoneError,
            }"
            placeholder="Nhập số điện thoại mới"
            @input="handlePhoneInput"
          >

          <p
            v-if="phoneError"
            class="message error-message"
          >
            {{ phoneError }}
          </p>
        </div>
      </div>

      <div class="form-row">
        <div />

        <button
          type="button"
          class="primary-button"
          :class="{ enabled: canSendOtp }"
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
        <div class="section-divider" />

        <div class="verification-info">
          Mã OTP gồm 6 chữ số đã được gửi tới
          <strong>{{ maskedEmail }}</strong>.
          Mã có hiệu lực trong 5 phút.
        </div>

        <div class="form-row">
          <label for="otp" class="form-label">
            Mã OTP
          </label>

          <div class="field-content">
            <input
              id="otp"
              :value="otp"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              class="form-input otp-input"
              :class="{
                'is-valid': isOtpValid,
                'is-invalid': otpError,
              }"
              placeholder="Nhập 6 chữ số"
              @input="handleOtpInput"
            >

            <p
              v-if="otpError"
              class="message error-message"
            >
              {{ otpError }}
            </p>
          </div>
        </div>

        <div class="form-row">
          <div />

          <button
            type="button"
            class="primary-button"
            :class="{ enabled: canVerify }"
            :disabled="!canVerify"
            @click="verifyOtp"
          >
            {{
              isVerifying
                ? 'Đang xác thực...'
                : 'Xác nhận thay đổi'
            }}
          </button>
        </div>
      </template>
    </div>
  </CustomerContentCard>
</template>

<style lang="scss" scoped>
.phone-change-form {
  display: flex;
  max-width: 680px;
  flex-direction: column;
  gap: 20px;
  padding: 8px 0;
}

.notice {
  max-width: 600px;
  margin-bottom: 20px;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
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
  grid-template-columns: 150px minmax(0, 1fr);
  align-items: flex-start;
  gap: 20px;
}

.form-label {
  padding-top: 11px;
  color: #555555;
  font-size: 14px;
  font-weight: 500;
  text-align: right;
}

.field-content {
  width: 100%;
  max-width: 430px;
}

.form-input {
  width: 100%;
  height: 44px;
  box-sizing: border-box;
  padding: 0 14px;
  border: 1px solid #d9dde3;
  border-radius: 4px;
  outline: none;
  background: #ffffff;
  color: #222222;
  font-family:
    Inter,
    Arial,
    sans-serif;
  font-size: 14px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.form-input:disabled {
  background: #f5f6f7;
  color: #8a8f96;
  cursor: not-allowed;
}

.form-input::placeholder {
  color: #a7adb4;
}

.form-input:focus {
  border-color: #39b54a;
  box-shadow: 0 0 0 3px rgb(57 181 74 / 10%);
}

.form-input.is-valid {
  border-color: #39b54a;
}

.form-input.is-invalid {
  border-color: #e5484d;
}

.message {
  margin: 7px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
}

.error-message {
  color: #e5484d;
}

.primary-button {
  width: fit-content;
  min-width: 156px;
  height: 42px;
  padding: 0 22px;
  border: 1px solid #d7dadd;
  border-radius: 4px;
  background: #d7dadd;
  color: #ffffff;
  font-family:
    Inter,
    Arial,
    sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: not-allowed;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.primary-button.enabled {
  border-color: #39b54a;
  background: #39b54a;
  cursor: pointer;
}

.primary-button.enabled:hover {
  border-color: #2f9f40;
  background: #2f9f40;
}

.section-divider {
  height: 1px;
  margin: 4px 0;
  background: #eceff1;
}

.verification-info {
  margin-left: 170px;
  color: #62686f;
  font-size: 13px;
  line-height: 1.6;
}

.verification-info strong {
  color: #333333;
  font-weight: 600;
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

  .form-label {
    padding-top: 0;
    text-align: left;
  }

  .field-content {
    max-width: none;
  }

  .verification-info {
    margin-left: 0;
  }
}
</style>

