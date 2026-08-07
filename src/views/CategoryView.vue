<template>
  <div class="container my-4">
    <h3>
      Category: {{ route.params.parentCategory }} 
      <span v-if="route.params.childCategory"> > {{ route.params.childCategory }}</span>
    </h3>

    <div class="row g-3">
      <div v-for="item in product" :key="item.product_id" class="col-md-3">

        {{ item.name }}
      </div> 
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import apiClient from '@/services/api'

const route = useRoute()
const product = ref<any[]>([])

const fetchCategoryProducts = async () => {
  try {
    const parent = route.params.parentCategory as string
    const child = route.params.childCategory as string | undefined

    const response = await apiClient.get('/products', {
      params: { parentCategory: parent, childCategory: child }
    })

    product.value = response.data.data
  } catch (error) {
    console.error('Error fetching products:', error)
    product.value = []
  }
}

onMounted(() => {
  fetchCategoryProducts()
})

watch(() => route.params, () => {
  fetchCategoryProducts()
})
</script>