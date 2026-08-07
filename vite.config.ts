import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { cloudflare } from "@cloudflare/vite-plugin"

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		vueDevTools(),
		cloudflare()
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		},
	},
	css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
        	@use "@/assets/scss/variables" as *;
        	@use "@/assets/scss/fonts" as *;
			@use "@/assets/scss/variables" as *;
         	@use "@/assets/scss/fonts" as *;
        	@use "@/assets/scss/animations" as *;
        `,
      },
    },
  },
})
