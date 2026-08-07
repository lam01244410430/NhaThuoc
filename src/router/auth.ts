import { defineStore } from 'pinia'
import apiClient from '../services/api'

interface User {
    id: number
    username: string
    name: string
    email: string
    role: 'customer' | 'admin' | 'shop'
}

interface AuthState {
    user: User | null
    token: string | null  
}

export const useAuthStore = defineStore('auth', {
    state: (): AuthState => ({
        user: JSON.parse(localStorage.getItem('user_info') || 'null'),
        token: localStorage.getItem('auth_token') || null
    }),

    getters: {
        isAuthenticated: (state) => !!state.token
    },

    actions: {
        async login(credentials: {identity: string, password: string}) {
            const response = await apiClient.post('/auth/login', { credentials })
            if (response.data.success) {
                const { user, token } = response.data.data
                this.user = user
                this.token = token

                localStorage.setItem('user_info', JSON.stringify(user))
                localStorage.setItem('auth_token', token)
            }
            return response.data
        },

        async register(userData: {
            role: 'customer' | 'admin' | 'shop',
            username: string,
            name: string, 
            email: string, 
            password: string,
            phone?: string,
        }) {
            const response = await apiClient.post('/auth/register', { userData })
            return response.data
        },

        async recoverPassword(email: string) {
            const response = await apiClient.post('/auth/forgot-password', { email })
            return response.data
        },

        logout(){
            this.token = null
            this.user = null
            localStorage.removeItem('auth_token')
            localStorage.removeItem('user_info')
        }
    }
})