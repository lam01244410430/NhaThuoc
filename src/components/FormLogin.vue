<template>
  <div>
    <div id="cardLogin" class="card border-0 scale-in-bl p-4">
      <form id="formLogin" @submit.prevent="onSubmit">
        <h1 class="text-center mb-3">Login</h1>
        <h2 class="text-center mb-4">Welcome back!</h2>

        <div class="d-flex justify-content-center mb-4">
          <button
            type="button"
            class="social-button"
            aria-label="Đăng nhập bằng Google"
            :disabled="isLoading"
            @click="loginWithOAuth('google')"
          >
            <img :src="googleIcon" class="icons" alt="Google" />
          </button>

          <button
            type="button"
            class="social-button mx-4"
            aria-label="Đăng nhập bằng Facebook"
            :disabled="isLoading"
            @click="loginWithOAuth('facebook')"
          >
            <img :src="facebookIcon" class="icons" alt="Facebook" />
          </button>
        </div>

        <p class="text-center mb-4 other-account">
          Or login with your account
        </p>

        <div
          v-if="successMessage"
          class="alert alert-success alert-dismissible fade show mb-3"
          role="alert"
        >
          {{ successMessage }}
          <button
            type="button"
            class="btn-close"
            aria-label="Đóng"
            @click="successMessage = ''"
          />
        </div>

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
            id="identity"
            v-model.trim="form.identity"
            type="text"
            autocomplete="username"
            class="form-control input"
            :class="{ 'is-invalid': errors.identity }"
            placeholder="Username or Email"
            @input="clearError('identity')"
          />
          <div v-if="errors.identity" class="invalid-feedback">
            {{ errors.identity }}
          </div>
        </div>

        <div class="mb-3">
          <input
            id="password"
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            class="form-control input"
            :class="{ 'is-invalid': errors.password }"
            placeholder="Password"
            @input="clearError('password')"
          />
          <div v-if="errors.password" class="invalid-feedback">
            {{ errors.password }}
          </div>
        </div>

        <div
          class="d-flex justify-content-between flex-wrap align-items-center mb-3"
        >
          <div class="form-check remember">
            <input
              id="remember"
              v-model="form.remember"
              class="form-check-input"
              type="checkbox"
            />
            <label class="form-check-label" for="remember">
              Remember me
            </label>
          </div>
          <router-link to="/recover" class="forgotPassword">
            Forgot password?
          </router-link>
        </div>

        <div class="d-flex justify-content-center mt-3">
          <button
            type="submit"
            class="arrow-btn border-0"
            :disabled="isLoading"
            aria-label="Đăng nhập"
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
          <span class="me-2">Don't have an account?</span>
          <router-link to="/register" class="loginAccount">
            Create new account
          </router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import googleIcon from '@/assets/images/google.png'
import facebookIcon from '@/assets/images/facebook.png'
import {
  ApiError,
  authService,
  type LoginPayload,
} from '@/services/auth.service'
import { saveAuthSession } from '@/utils/auth-storage'

const route = useRoute()
const router = useRouter()

const queryIdentity =
  typeof route.query.identity === 'string' ? route.query.identity : ''

const form = reactive({
  identity: queryIdentity,
  password: '',
  remember: false,
})

const errors = reactive<Record<keyof LoginPayload, string>>({
  identity: '',
  password: '',
})

const isLoading = ref(false)
const showError = ref(false)
const globalErrorMessage = ref('')
const successMessage = ref(
  route.query.registered === '1' ? 'Đăng ký thành công. Vui lòng đăng nhập.' : '',
)

if (typeof route.query.oauthError === 'string') {
  globalErrorMessage.value = route.query.oauthError
  showError.value = true
}

const clearError = (field: keyof LoginPayload): void => {
  errors[field] = ''
  showError.value = false
}

const validateForm = (): boolean => {
  errors.identity = ''
  errors.password = ''

  if (!form.identity.trim()) {
    errors.identity = 'Vui lòng nhập username hoặc email'
  }

  if (!form.password) {
    errors.password = 'Vui lòng nhập mật khẩu'
  }

  return !errors.identity && !errors.password
}

const applyBackendErrors = (error: ApiError): void => {
  const identityError = error.fieldErrors.identity?.[0]
  const passwordError = error.fieldErrors.password?.[0]

  if (identityError) errors.identity = identityError
  if (passwordError) errors.password = passwordError
}

const onSubmit = async (): Promise<void> => {
  if (!validateForm()) return

  isLoading.value = true
  showError.value = false
  successMessage.value = ''

  try {
    const data = await authService.login({
      identity: form.identity,
      password: form.password,
    })

    saveAuthSession(data, form.remember)
    await router.replace('/')
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      applyBackendErrors(error)
      globalErrorMessage.value = error.message
    } else {
      globalErrorMessage.value = 'Không thể kết nối đến máy chủ'
    }

    showError.value = true
  } finally {
    isLoading.value = false
  }
}

const loginWithOAuth = (provider: 'google' | 'facebook'): void => {
  window.location.assign(authService.oauthUrl(provider))
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
      font-size: 1.2rem;
      color: #333;
      font-weight: 600;
    }

    .other-account {
      color: #777;
    }

    .social-button {
      padding: 0;
      border: 0;
      background: transparent;

      &:disabled {
        opacity: 0.6;
      }
    }

    .icons {
      width: 30px;
      height: 30px;
      object-fit: contain;
      cursor: pointer;
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

    .remember {
      color: #333;
    }
  }

  .forgotPassword {
    color: #777;
    text-decoration: none;

    &:hover {
      color: #00823d;
      transition: 0.3s ease-in-out;
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
