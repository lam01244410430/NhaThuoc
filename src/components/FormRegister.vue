<template>
  <div>
    <div id="cardLogin" class="card border-0 scale-in-bl p-4">
      <form id="formLogin" @submit.prevent="onSubmit">
        <h1 class="text-center mb-3">Create Account</h1>
        <h2 class="text-center mb-4">Join us today!</h2>

        <div
          v-if="showError"
          class="alert alert-danger alert-dismissible fade show mb-3"
          role="alert"
        >
          {{ globalErrorMessage }}
          <button
            type="button"
            class="btn-close"
            aria-label="Đóng"
            @click="showError = false"
          />
        </div>

        <div class="mb-3">
          <input
            id="username"
            v-model.trim="form.username"
            type="text"
            autocomplete="username"
            class="form-control input"
            :class="{ 'is-invalid': errors.username }"
            placeholder="Username"
            @input="clearError('username')"
          />
          <div v-if="errors.username" class="invalid-feedback">
            {{ errors.username }}
          </div>
        </div>

        <div class="mb-3">
          <input
            id="name"
            v-model.trim="form.name"
            type="text"
            autocomplete="name"
            class="form-control input"
            :class="{ 'is-invalid': errors.name }"
            placeholder="Full name"
            @input="clearError('name')"
          />
          <div v-if="errors.name" class="invalid-feedback">
            {{ errors.name }}
          </div>
        </div>

        <div class="mb-3">
          <input
            id="email"
            v-model.trim="form.email"
            type="email"
            autocomplete="email"
            class="form-control input"
            :class="{ 'is-invalid': errors.email }"
            placeholder="Email Address"
            @input="clearError('email')"
          />
          <div v-if="errors.email" class="invalid-feedback">
            {{ errors.email }}
          </div>
        </div>

        <div class="mb-3">
          <input
            id="phone"
            v-model.trim="form.phone"
            type="tel"
            autocomplete="tel"
            class="form-control input"
            :class="{ 'is-invalid': errors.phone }"
            placeholder="Phone (optional)"
            @input="clearError('phone')"
          />
          <div v-if="errors.phone" class="invalid-feedback">
            {{ errors.phone }}
          </div>
        </div>

        <div class="mb-3">
          <input
            id="password"
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            class="form-control input"
            :class="{ 'is-invalid': errors.password }"
            placeholder="Password"
            @input="clearError('password')"
          />
          <div v-if="errors.password" class="invalid-feedback">
            {{ errors.password }}
          </div>
        </div>

        <div class="mb-3">
          <input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            autocomplete="new-password"
            class="form-control input"
            :class="{ 'is-invalid': errors.confirmPassword }"
            placeholder="Confirm Password"
            @input="clearError('confirmPassword')"
          />
          <div v-if="errors.confirmPassword" class="invalid-feedback">
            {{ errors.confirmPassword }}
          </div>
        </div>

        <div class="d-flex justify-content-center mt-3">
          <button
            type="submit"
            class="arrow-btn border-0"
            :disabled="isLoading"
            aria-label="Đăng ký"
          >
            <span
              v-if="isLoading"
              class="spinner-border spinner-border-sm"
              role="status"
              aria-hidden="true"
            />
            <font-awesome-icon v-else icon="fa-solid fa-arrow-right" />
          </button>
        </div>

        <div class="d-flex justify-content-center flex-wrap mt-4 register">
          <span class="me-2">Already have an account?</span>
          <router-link to="/login" class="loginAccount">Login</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

type RegisterField = 'username' | 'name' | 'email' | 'phone' | 'password' | 'confirmPassword'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  username: '',
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

const errors = reactive<Record<RegisterField, string>>({
  username: '',
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

const isLoading = ref(false)
const showError = ref(false)
const globalErrorMessage = ref('')

const clearError = (field: RegisterField) => {
  errors[field] = ''
  showError.value = false
}

const normalizePhone = (value: string): string => {
  const normalized = value.trim().replace(/[\s.-]/g, '')
  return normalized.startsWith('+84') ? `0${normalized.slice(3)}` : normalized
}

const validateForm = (): boolean => {
  Object.keys(errors).forEach((key) => {
    errors[key as RegisterField] = ''
  })

  const username = form.username.trim().toLowerCase()
  const name = form.name.trim()
  const email = form.email.trim().toLowerCase()
  const phone = normalizePhone(form.phone)

  if (username.length < 4 || username.length > 50) {
    errors.username = 'Username phải có từ 4 đến 50 ký tự'
  } else if (!/^[a-z0-9_]+$/.test(username)) {
    errors.username = 'Username chỉ gồm chữ thường, chữ số và dấu gạch dưới'
  } else if (/\s/.test(username)) {
    errors.username = 'Username không được chưa dấu cách'
  }

  if (name.length < 2 || name.length > 100) {
    errors.name = 'Tên phải có từ 2 đến 100 ký tự'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Định dạng email không hợp lệ'
  }

  if (phone && !/^0\d{9}$/.test(phone)) {
    errors.phone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0'
  }

  if (form.password.length < 8 || form.password.length > 72) {
    errors.password = 'Mật khẩu phải có từ 8 đến 72 ký tự'
  } else if (!/[A-Z]/.test(form.password)) {
    errors.password = 'Mật khẩu phải có ít nhất một chữ hoa'
  } else if (!/[a-z]/.test(form.password)) {
    errors.password = 'Mật khẩu phải có ít nhất một chữ thường'
  } else if (!/\d/.test(form.password)) {
    errors.password = 'Mật khẩu phải có ít nhất một chữ số'
  } else if (!/[^A-Za-z0-9]/.test(form.password)) {
    errors.password = 'Mật khẩu phải có ít nhất một ký tự đặc biệt'
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Vui lòng xác nhận mật khẩu'
  } else if (form.confirmPassword !== form.password) {
    errors.confirmPassword = 'Mật khẩu xác nhận không khớp'
  }

  return !Object.values(errors).some(Boolean)
}

const onSubmit = async (): Promise<void> => {
  if (!validateForm()) return
  isLoading.value = true
  showError.value = false
  globalErrorMessage.value = ''

  try {
    await authStore.register({
      username: form.username.trim().toLowerCase(),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: normalizePhone(form.phone) || undefined,
      password: form.password,
    })

    await router.replace({
      name: 'login',
      query: {
        registered: '1',
        identity: form.email.trim().toLowerCase(),
      },
    })
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data
      const backendErrors = data?.error
      if (backendErrors) {
        errors.username = backendErrors.username?.[0] || ''
        errors.name = backendErrors.name?.[0] || ''
        errors.email = backendErrors.email?.[0] || ''
        errors.phone = backendErrors.phone?.[0] || ''
        errors.password = backendErrors.password?.[0] || ''
      }
      globalErrorMessage.value = data?.message || 'Đăng ký thất bại'
    } else if (error instanceof Error) {
      globalErrorMessage.value = error.message
    } else {
      globalErrorMessage.value = 'Không thể kết nối đến máy chủ'
    }
    showError.value = true
  } finally {
    isLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
#cardLogin {
  border-radius: 15px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
  max-width: 450px;
  margin: 0 auto;

  #formLogin {
    display: flex;
    flex-direction: column;
    justify-content: center;

    h1 {
      color: #00823d;
      font-weight: 700;
    }

    h2 {
      font-size: 1.1rem;
      color: #555;
      font-weight: 600;
    }

    .input {
      border-radius: 10px;
      padding: 12px 15px;
      font-size: 14px;

      &:focus {
        border-color: #00823d;
        box-shadow: 0 0 0 0.25rem rgba(0, 130, 61, 0.25);
      }
    }
  }

  .arrow-btn {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 90px;
    height: 50px;
    border-radius: 15px;
    background: #00823d;
    color: #fff;
    font-size: 22px;
    box-shadow: -4px 4px 4px rgba(0, 0, 0, 0.15);
    cursor: pointer;

    &:hover:not(:disabled) {
      background: #005a2a;
      transition: 0.3s ease-in-out;
      box-shadow: none;
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }

  .register {
    span {
      color: #333;
    }

    .loginAccount {
      color: #00823d;
      text-decoration: none;
      font-weight: 600;
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}
</style>
