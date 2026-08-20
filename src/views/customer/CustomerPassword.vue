<template>
  <CustomerContentCard
    title="Đổi mật khẩu"
    description="Để bảo mật tài khoản, vui lòng không chia sẻ mật khẩu cho người khác."
  >
    <form class="password-form" @submit.prevent="submit">
      <div v-if="successMessage" class="message message--success">
        {{ successMessage }}
      </div>

      <div v-if="globalError" class="message message--error">
        {{ globalError }}
      </div>

      <div class="field">
        <label class="field__label" for="current-password">
          Mật khẩu hiện tại
        </label>

        <div class="password-input">
          <input
            id="current-password"
            v-model="form.currentPassword"
            :type="showCurrentPassword ? 'text' : 'password'"
            autocomplete="current-password"
            class="field__input"
            :class="{
              'field__input--error':
                Boolean(errors.currentPassword),
            }"
            placeholder="Nhập mật khẩu hiện tại"
            @input="clearError('currentPassword')"
          />

          <button
            class="password-input__toggle"
            type="button"
            :aria-label="showCurrentPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
            @click="showCurrentPassword = !showCurrentPassword"
          >
            {{
              showCurrentPassword ? 'Ẩn' : 'Hiện'
            }}
          </button>
        </div>

        <p v-if="errors.currentPassword" class="field__error">
          {{ errors.currentPassword }}
        </p>
      </div>

      <div class="field">
        <label class="field__label" for="new-password">
          Mật khẩu mới
        </label>

        <div class="password-input">
          <input
            id="new-password"
            v-model="form.newPassword"
            :type="showNewPassword ? 'text' : 'password'"
            autocomplete="new-password"
            class="field__input"
            :class="{'field__input--error': Boolean(errors.newPassword)}"
            placeholder="Nhập mật khẩu mới"
            @input="clearError('newPassword')"
          />

          <button
            class="password-input__toggle"
            type="button"
            :aria-label="showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
            @click="showNewPassword = !showNewPassword"
          >
            {{
              showNewPassword ? 'Ẩn' : 'Hiện'
            }}
          </button>
        </div>

        <p
          v-if="errors.newPassword"
          class="field__error"
        >
          {{ errors.newPassword }}
        </p>
      </div>

      <div class="field">
        <label class="field__label" for="confirm-password">
          Xác nhận mật khẩu mới
        </label>

        <div class="password-input">
          <input
            id="confirm-password"
            v-model="form.confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            autocomplete="new-password"
            class="field__input"
            :class="{
              'field__input--error':
                Boolean(errors.confirmPassword),
            }"
            placeholder="Nhập lại mật khẩu mới"
            @input="clearError('confirmPassword')"
          />

          <button
            class="password-input__toggle"
            type="button"
            :aria-label="showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
            @click="showConfirmPassword = !showConfirmPassword"
          >
            {{ showConfirmPassword ? 'Ẩn' : 'Hiện' }}
          </button>
        </div>

        <p v-if="errors.confirmPassword" class="field__error">
          {{ errors.confirmPassword }}
        </p>
      </div>

      <div class="form-actions">
        <button
          class="submit-button"
          type="submit"
          :disabled="!canSubmit"
        >
          {{ submitting ? 'Đang cập nhật...' : 'Đổi mật khẩu' }}
        </button>
      </div>
    </form>
  </CustomerContentCard>
</template>

<script setup lang="ts">
import { computed, reactive, ref} from 'vue'
import CustomerContentCard from '@/components/Customer/CustomerContentCard.vue'
import { customerAccountService } from '@/services/customer-account.service'

type PasswordField =
  | 'currentPassword'
  | 'newPassword'
  | 'confirmPassword'

const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  otp: ''
})

const errors = reactive<Record<PasswordField, string>>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const submitting = ref(false)
const successMessage = ref('')
const globalError = ref('')

const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const passwordRules = computed(() => ({
  length: form.newPassword.length >= 8,
  uppercase: /[A-Z]/.test(form.newPassword),
  number: /\d/.test(form.newPassword),
  special: /[^A-Za-z0-9]/.test(form.newPassword),
}))

const newPasswordValid = computed(() => {
  return (
    passwordRules.value.length &&
    passwordRules.value.uppercase &&
    passwordRules.value.number &&
    passwordRules.value.special
  )
})

const canSubmit = computed(() => {
  return (
    !submitting.value &&
    form.currentPassword.length > 0 &&
    newPasswordValid.value &&
    form.confirmPassword === form.newPassword
  )
})

const clearError = (field: PasswordField,) => {
  errors[field] = ''
  globalError.value = ''
  successMessage.value = ''
}

const validate = (): boolean => {
  errors.currentPassword = ''
  errors.newPassword = ''
  errors.confirmPassword = ''
  globalError.value = ''

  if (!form.currentPassword) {
    errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại'
  }

  if (!form.newPassword) {
    errors.newPassword = 'Vui lòng nhập mật khẩu mới'
  } else if (!newPasswordValid.value) {
    errors.newPassword = 'Mật khẩu mới chưa đáp ứng yêu cầu bảo mật'
  }

  if ( form.newPassword === form.currentPassword) {
    errors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại'
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới'
  } else if (form.confirmPassword !== form.newPassword) {
    errors.confirmPassword = 'Mật khẩu xác nhận không khớp'
  }

  return !Object.values(
    errors,
  ).some(Boolean)
}

const resetForm = () => {
  form.currentPassword = ''
  form.newPassword = ''
  form.confirmPassword = ''

  showCurrentPassword.value = false
  showNewPassword.value = false
  showConfirmPassword.value = false
}

const submit = async () => {
  if (submitting.value || !validate()) {
    return
  }

  submitting.value = true
  successMessage.value = ''
  globalError.value = ''

  try {
    const result = await customerAccountService
      .changePassword({
        current_password: form.currentPassword,
        new_password: form.newPassword,
        confirm_password: form.confirmPassword,
        otp: form.otp
      })

    successMessage.value = result.message

    resetForm()
  } catch (error: unknown) {
    const responseError =
      error as {
        response?: {
          data?: {
            message?: string
            errors?: Record<
              string,
              string[]
            >
          }
        }
      }

    const apiErrors = responseError.response?.data?.errors

    if (apiErrors?.current_password?.[0]) {
      errors.currentPassword = apiErrors.current_password[0]
    }

    if (apiErrors?.new_password?.[0]) {
      errors.newPassword = apiErrors.new_password[0]
    }

    if (apiErrors?.confirm_password?.[0]) {
      errors.confirmPassword = apiErrors.confirm_password[0]
    }

    globalError.value = responseError.response?.data?.message ?? 'Không thể đổi mật khẩu'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.password-form {
  width: 100%;
  max-width: 620px;
  padding: 8px 0 20px;
}

.message {
  margin-bottom: 20px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.5;
}

.message--success {
  background: #edf9ef;
  color: #238636;
}

.message--error {
  background: #fff1f0;
  color: #cf1322;
}

.field {
  margin-bottom: 22px;
}

.field__label {
  display: block;
  margin-bottom: 8px;
  color: #222;
  font-size: 14px;
  font-weight: 600;
}

.password-input {
  position: relative;
  width: 100%;
  max-width: 430px;
}

.field__input {
  width: 100%;
  height: 46px;
  box-sizing: border-box;
  padding: 0 70px 0 14px;
  border: 1px solid #d8d8d8;
  border-radius: 4px;
  outline: none;
  background: #ffffff;
  color: #222222;
  font: inherit;
  font-size: 14px;
}

.field__input:focus {
  border-color: #39b54a;
  box-shadow:
    0 0 0 3px
    rgb(57 181 74 / 12%);
}

.field__input--error {
  border-color: #dc3545;
}

.password-input__toggle {
  position: absolute;
  top: 50%;
  right: 12px;
  z-index: 2;
  min-width: 42px;
  padding: 4px 6px;
  border: 0;
  background: transparent;
  color: #39b54a;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transform: translateY(-50%);
}

.field__error {
  margin: 7px 0 0;
  color: #dc3545;
  font-size: 13px;
}

.password-rules {
  display: grid;
  grid-template-columns:
    repeat(
      2,
      minmax(0, 1fr)
    );
  gap: 6px 16px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.password-rules__item {
  color: #8a8a8a;
  font-size: 12px;
}

.password-rules__item::before {
  margin-right: 6px;
  content: '•';
}

.password-rules__item--valid {
  color: #2f9e44;
}

.password-rules__item--valid::before {
  content: '✓';
}

.form-actions {
  padding-top: 4px;
}

.submit-button {
  min-width: 150px;
  height: 44px;
  padding: 0 22px;
  border: 0;
  border-radius: 10px;
  background: #39b54a;
  color: #fff;
  font-family: Inter, Arial, sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.submit-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 640px) {
  .password-rules {
    grid-template-columns: 1fr;
  }
}
</style>