<script setup lang="ts">
import axios from 'axios'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue'
import { useRouter } from 'vue-router'

import CustomerContentCard
  from '@/components/Customer/CustomerContentCard.vue'
import {
  customerAccountService,
  type CustomerProfile,
} from '@/services/customer-account.service'
import { useAuthStore } from '@/stores/auth'

type ProfileField = 'name'

const MAX_AVATAR_SIZE = 1024 * 1024
const ALLOWED_AVATAR_TYPES = [
  'image/jpeg',
  'image/png',
]

const router = useRouter()
const authStore = useAuthStore()

const profile = ref<CustomerProfile | null>(null)
const loading = ref(true)
const submitting = ref(false)
const globalError = ref('')
const successMessage = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarPreview = ref('')
const avatarError = ref('')

const form = reactive({
  name: '',
})

const errors = reactive<Record<ProfileField, string>>({
  name: '',
})

const username = computed(() => {
  return profile.value?.username || 'Chưa thiết lập'
})

const avatar = computed(() => {
  return avatarPreview.value || profile.value?.avatar || ''
})

const maskedEmail = computed(() => {
  const value = profile.value?.email?.trim()

  if (!value) return 'Chưa cập nhật'

  const atIndex = value.lastIndexOf('@')

  if (atIndex <= 0) return value

  const localPart = value.slice(0, atIndex)
  const domain = value.slice(atIndex + 1)
  const visibleStart = localPart.slice(0, 2)
  const visibleEnd = localPart.length > 2
    ? localPart.slice(-1)
    : ''

  return `${visibleStart}******${visibleEnd}@${domain}`
})

const maskedPhone = computed(() => {
  const value = profile.value?.phone?.trim()

  if (!value) return 'Chưa cập nhật'

  if (value.length <= 5) {
    return `${value.slice(0, 2)}***`
  }

  return `${value.slice(0, 2)}******${value.slice(-2)}`
})

const maskedDateOfBirth = computed(() => {
  const value = profile.value?.date_of_birth

  if (!value) return 'Chưa cập nhật'

  const year = value.slice(0, 4)

  return /^\d{4}$/.test(year)
    ? `**/**/${year}`
    : 'Chưa cập nhật'
})

const hasChanges = computed(() => {
  if (!profile.value) return false

  return form.name.trim() !== profile.value.name
})

const canSubmit = computed(() => {
  return (
    !loading.value &&
    !submitting.value &&
    hasChanges.value &&
    form.name.trim().length >= 3
  )
})

function applyProfile(data: CustomerProfile) {
  profile.value = data
  form.name = data.name
}

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

function clearFieldError(field: ProfileField) {
  errors[field] = ''
  globalError.value = ''
  successMessage.value = ''
}

function validate(): boolean {
  errors.name = ''
  globalError.value = ''

  const normalizedName = form.name.trim()

  if (!normalizedName) {
    errors.name = 'Vui lòng nhập họ và tên'
  } else if (normalizedName.length < 3) {
    errors.name = 'Họ và tên phải có ít nhất 3 ký tự'
  } else if (normalizedName.length > 100) {
    errors.name =
      'Họ và tên không được vượt quá 100 ký tự'
  }

  return !Object.values(errors).some(Boolean)
}

async function loadProfile() {
  loading.value = true
  globalError.value = ''

  try {
    const data =
      await customerAccountService.getProfile()

    applyProfile(data)
  } catch (error: unknown) {
    globalError.value = getApiMessage(
      error,
      'Không thể tải thông tin hồ sơ',
    )
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  if (
    submitting.value ||
    !hasChanges.value ||
    !validate()
  ) {
    return
  }

  submitting.value = true
  globalError.value = ''
  successMessage.value = ''

  try {
    const response =
      await customerAccountService.updateProfile({
        name: form.name.trim(),
      })

    if (response.data) {
      applyProfile(response.data)
    } else {
      await loadProfile()
    }

    await authStore.fetchMe()
    successMessage.value =
      response.message || 'Cập nhật hồ sơ thành công'
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const fieldErrors =
        error.response?.data?.errors as
          | Record<string, string[] | undefined>
          | undefined

      errors.name = fieldErrors?.name?.[0] ?? ''
    }

    globalError.value = getApiMessage(
      error,
      'Không thể cập nhật hồ sơ',
    )
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  if (profile.value) {
    applyProfile(profile.value)
  }

  errors.name = ''
  globalError.value = ''
  successMessage.value = ''
}

function openAvatarPicker() {
  avatarInput.value?.click()
}

function clearAvatarPreview() {
  if (avatarPreview.value) {
    URL.revokeObjectURL(avatarPreview.value)
    avatarPreview.value = ''
  }
}

function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  avatarError.value = ''

  if (!file) return

  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    avatarError.value =
      'Ảnh đại diện chỉ hỗ trợ định dạng JPEG hoặc PNG'
    input.value = ''
    return
  }

  if (file.size > MAX_AVATAR_SIZE) {
    avatarError.value =
      'Dung lượng ảnh đại diện không được vượt quá 1 MB'
    input.value = ''
    return
  }

  clearAvatarPreview()
  avatarPreview.value = URL.createObjectURL(file)
}

function goToEmail() {
  router.push({ name: 'customer-email' })
}

function goToPhone() {
  router.push({ name: 'customer-phone' })
}

onMounted(loadProfile)
onBeforeUnmount(clearAvatarPreview)
</script>

<template>
  <CustomerContentCard
    title="Hồ sơ của tôi"
    description="Quản lý thông tin hồ sơ để bảo mật tài khoản"
  >
    <div
      v-if="loading"
      class="profile-state"
      role="status"
    >
      <div class="loading-spinner" />
      <span>Đang tải hồ sơ...</span>
    </div>

    <div
      v-else-if="!profile"
      class="profile-state profile-state--error"
    >
      <p>{{ globalError }}</p>

      <button
        type="button"
        class="secondary-button"
        @click="loadProfile"
      >
        Thử lại
      </button>
    </div>

    <template v-else>
      <div
        v-if="successMessage"
        class="alert alert--success"
        role="status"
      >
        {{ successMessage }}
      </div>

      <div
        v-if="globalError"
        class="alert alert--error"
        role="alert"
      >
        {{ globalError }}
      </div>

      <div class="profile-grid">
        <form
          class="profile-form"
          @submit.prevent="saveProfile"
        >
          <div class="form-row">
            <label for="username">Tên đăng nhập</label>

            <div class="field-content">
              <input
                id="username"
                :value="username"
                type="text"
                class="form-control form-control--readonly"
                readonly
              >
            </div>
          </div>

          <div class="form-row">
            <label for="full-name">
              Họ và tên
              <span aria-hidden="true">*</span>
            </label>

            <div class="field-content">
              <input
                id="full-name"
                v-model="form.name"
                type="text"
                class="form-control"
                :class="{
                  'form-control--error': errors.name,
                }"
                maxlength="100"
                autocomplete="name"
                placeholder="Nhập họ và tên"
                @input="clearFieldError('name')"
              >

              <p
                v-if="errors.name"
                class="field-error"
              >
                {{ errors.name }}
              </p>
            </div>
          </div>

          <div class="form-row">
            <label>Email</label>

            <div class="field-content inline-field">
              <span class="masked-value">
                {{ maskedEmail }}
              </span>

              <button
                type="button"
                class="change-button"
                @click="goToEmail"
              >
                Thay đổi
              </button>
            </div>
          </div>

          <div class="form-row">
            <label>Số điện thoại</label>

            <div class="field-content inline-field">
              <span class="masked-value">
                {{ maskedPhone }}
              </span>

              <button
                type="button"
                class="change-button"
                @click="goToPhone"
              >
                Thay đổi
              </button>
            </div>
          </div>

          <div class="form-row">
            <label>Ngày sinh</label>

            <div class="field-content inline-field">
              <span class="masked-value">
                {{ maskedDateOfBirth }}
              </span>
            </div>
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class="primary-button"
              :disabled="!canSubmit"
            >
              {{ submitting ? 'Đang lưu...' : 'Lưu' }}
            </button>

            <button
              type="button"
              class="secondary-button"
              :disabled="submitting || !hasChanges"
              @click="resetForm"
            >
              Hoàn tác
            </button>
          </div>
        </form>

        <aside class="avatar-panel">
          <div class="avatar-preview">
            <img
              v-if="avatar"
              :src="avatar"
              :alt="`Ảnh đại diện của ${form.name}`"
            >

            <span v-else aria-hidden="true">👤</span>
          </div>

          <input
            ref="avatarInput"
            type="file"
            class="visually-hidden"
            accept="image/jpeg,image/png"
            @change="handleAvatarChange"
          >

          <button
            type="button"
            class="avatar-button"
            @click="openAvatarPicker"
          >
            Chọn Ảnh
          </button>

          <p class="avatar-hint">
            Dung lượng file tối đa 1 MB<br>
            Định dạng: JPEG, PNG
          </p>

          <p
            v-if="avatarError"
            class="avatar-error"
            role="alert"
          >
            {{ avatarError }}
          </p>
        </aside>
      </div>
    </template>
  </CustomerContentCard>
</template>

<style scoped lang="scss">
.profile-state {
  display: flex;
  min-height: 360px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #667085;
}

.profile-state--error {
  flex-direction: column;
  color: #b42318;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #dcefe0;
  border-top-color: #39b54a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.alert {
  margin-bottom: 24px;
  padding: 13px 16px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.5;
}

.alert--success {
  border-color: #b7e4bf;
  background: #edf9ef;
  color: #237a32;
}

.alert--error {
  border-color: #ffc9c4;
  background: #fff1f0;
  color: #b42318;
}

.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 230px;
  gap: 50px;
}

.profile-form {
  display: flex;
  width: 100%;
  max-width: 680px;
  flex-direction: column;
  gap: 22px;
  margin-left: auto;
}

.form-row {
  display: grid;
  grid-template-columns: 145px minmax(0, 430px);
  align-items: start;
  justify-content: end;
  gap: 24px;
}

.form-row > label {
  padding-top: 12px;
  color: #344054;
  font-size: 14px;
  font-weight: 500;
  text-align: right;
}

.form-row > label span {
  color: #dc3545;
}

.field-content {
  width: 100%;
  max-width: 430px;
  min-width: 0;
}

.form-control {
  width: 100%;
  min-height: 46px;
  padding: 10px 13px;
  border: 1px solid #d0d5dd;
  border-radius: 4px;
  box-sizing: border-box;
  outline: none;
  background: #ffffff;
  color: #1d2939;
  font: inherit;
  font-size: 14px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.form-control:focus {
  border-color: #39b54a;
  box-shadow: 0 0 0 3px rgb(57 181 74 / 12%);
}

.form-control--readonly {
  background: #f7f8fa;
  color: #667085;
  cursor: not-allowed;
}

.form-control--error {
  border-color: #dc3545;
}

.inline-field {
  display: flex;
  width: fit-content;
  max-width: 430px;
  min-height: 46px;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
}

.masked-value {
  overflow: hidden;
  color: #475467;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.change-button {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid #b8d9be;
  border-radius: 4px;
  background: #ffffff;
  color: #278c36;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.change-button:hover {
  border-color: #39b54a;
  background: #f3faf4;
  color: #0d5c31;
}

.field-error {
  margin: 7px 0 0;
  color: #dc3545;
  font-size: 12.5px;
  line-height: 1.5;
}

.form-actions {
  display: flex;
  justify-content: flex-start;
  gap: 12px;
  padding-top: 4px;
  padding-left: 169px;
}

.primary-button,
.secondary-button,
.avatar-button {
  min-height: 43px;
  padding: 0 20px;
  border-radius: 4px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.primary-button {
  border: 1px solid #39b54a;
  background: #39b54a;
  color: #ffffff;
}

.primary-button:hover:not(:disabled) {
  border-color: #2f9f40;
  background: #2f9f40;
}

.secondary-button,
.avatar-button {
  border: 1px solid #d0d5dd;
  background: #ffffff;
  color: #344054;
}

.secondary-button:hover:not(:disabled),
.avatar-button:hover {
  border-color: #39b54a;
  color: #278c36;
}

.primary-button:disabled,
.secondary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.avatar-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-left: 34px;
  border-left: 1px solid #eaecf0;
  text-align: center;
}

.avatar-preview {
  display: flex;
  width: 118px;
  height: 118px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 18px;
  border: 1px solid #dfe6e1;
  border-radius: 50%;
  background: #f3f7f4;
  color: #8a968d;
  font-size: 48px;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-button {
  min-height: 38px;
  padding: 0 18px;
}

.avatar-hint,
.avatar-error {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.7;
}

.avatar-hint {
  color: #98a2b3;
}

.avatar-error {
  color: #dc3545;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }

  .avatar-panel {
    grid-row: 1;
    padding: 0 0 26px;
    border-bottom: 1px solid #eaecf0;
    border-left: 0;
  }
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .form-row > label {
    padding-top: 0;
  }

  .form-actions {
    flex-direction: column;
    padding-left: 0;
  }

  .field-content {
    max-width: none;
  }

  .primary-button,
  .secondary-button {
    width: 100%;
  }
}
</style>
