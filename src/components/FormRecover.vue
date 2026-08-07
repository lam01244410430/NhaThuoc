<template>
  <div>
    <div id="cardLogin" class="card border-0 scale-in-bl p-4">
      <form @submit.prevent="onSubmit" id="formLogin">
        <h1 class="text-center mb-3">Recover Account</h1>
        <h2 class="text-center mb-4">Enter the email address you used to register</h2>

        <!-- Alert Success -->
        <div v-if="showSuccess" class="alert alert-success alert-dismissible fade show mb-3" role="alert">
          Request has been sent! Please check your email.
          <button type="button" class="btn-close" @click="showSuccess = false"></button>
        </div>

        <!-- Alert Error -->
        <div v-if="showError" class="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          {{ globalErrorMessage }}
          <button type="button" class="btn-close" @click="showError = false"></button>
        </div>

        <!-- Email Input -->
        <div class="mb-3">
          <input
            id="email"
            v-model="form.email"
            type="email"
            class="form-control input"
            :class="{ 'is-invalid': errors.email }"
            placeholder="Enter your registered email"
            @input="errors.email = ''"
          />
          <div v-if="errors.email" class="invalid-feedback">
            {{ errors.email }}
          </div>
        </div>

        <!-- Submit Button -->
        <div class="d-flex justify-content-center mt-3">
          <button type="submit" class="arrow-btn border-0" :disabled="isLoading">
            <span v-if="isLoading" class="spinner-border spinner-border-sm" role="status"></span>
            <font-awesome-icon icon="fa-solid fa-arrow-right" />
          </button>
        </div>

        <!-- Back to Login -->
        <div class="d-flex justify-content-center flex-wrap mt-4 register">
          <span class="me-2">Remember your password?</span>
          <router-link to="/login" class="loginAccount">Login</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'

const form = reactive({
  email: ''
})

const errors = reactive({
  email: ''
})

const isLoading = ref(false)
const showError = ref(false)
const showSuccess = ref(false)
const globalErrorMessage = ref('')

const validateForm = (): boolean => {
  errors.email = ''
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!form.email.trim()) {
    errors.email = 'Please enter your email address'
    return false
  }
  if (!emailRegex.test(form.email)) {
    errors.email = 'Invalid email address'
    return false
  }
  return true
}

const onSubmit = async () => {
  if (!validateForm()) return

  isLoading.value = true
  showError.value = false
  showSuccess.value = false

  try {
    console.log('Sending reset request for:', form.email)
    await new Promise((resolve) => setTimeout(resolve, 1200))

    showSuccess.value = true
  } catch (error: any) {
    globalErrorMessage.value = 'Failed to send recovery email. Please try again.'
    showError.value = true
  } finally {
    isLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
#cardLogin {
  border-radius: 15px;
  box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.15);
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