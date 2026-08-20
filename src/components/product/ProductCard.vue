<script setup lang="ts">
import { computed } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faBoxOpen, faCartPlus } from '@fortawesome/free-solid-svg-icons'

export interface ProductCardItem {
  id: number
  name: string
  price: number
  sale_price?: number | null
  thumbnail?: string | null
}

const props = withDefaults(defineProps<{
  product: ProductCardItem
  addToCartLabel?: string
  disabled?: boolean
}>(), {
  addToCartLabel: 'Thêm vào giỏ',
  disabled: false,
})

const emit = defineEmits<{
  view: [productId: number]
  addToCart: [productId: number]
}>()

const hasSale = computed(() => {
  const salePrice = props.product.sale_price
  return salePrice !== null && salePrice !== undefined && salePrice >= 0 && salePrice < props.product.price
})

const displayPrice = computed(() => hasSale.value ? Number(props.product.sale_price) : props.product.price)

const discountPercent = computed(() => {
  if (!hasSale.value || props.product.price <= 0) return 0
  return Math.round(((props.product.price - Number(props.product.sale_price)) / props.product.price) * 100)
})

const formatPrice = (value: number) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))}₫`

const openProduct = () => emit('view', props.product.id)

const addToCart = () => {
  if (props.disabled) return
  emit('addToCart', props.product.id)
}
</script>

<template>
  <article
    class="product-card"
    tabindex="0"
    role="button"
    :aria-label="`Xem ${product.name}`"
    @click="openProduct"
    @keydown.enter.prevent="openProduct"
    @keydown.space.prevent="openProduct"
  >
    <div class="product-card__media">
      <img
        v-if="product.thumbnail"
        class="product-card__image"
        :src="product.thumbnail"
        :alt="product.name"
        loading="lazy"
      />
      <div v-else class="product-card__image-empty" aria-hidden="true">
        <FontAwesomeIcon :icon="faBoxOpen" />
      </div>
    </div>

    <div class="product-card__body">
      <h3 class="product-card__name" :title="product.name">
        {{ product.name }}
      </h3>

      <div class="product-card__pricing">
        <strong class="product-card__current-price">
          {{ formatPrice(displayPrice) }}
        </strong>

        <div v-if="hasSale" class="product-card__sale-row">
          <del class="product-card__original-price">
            {{ formatPrice(product.price) }}
          </del>
          <span class="product-card__discount">-{{ discountPercent }}%</span>
        </div>
      </div>

      <button
        type="button"
        class="product-card__cart-button"
        :disabled="disabled"
        @click.stop="addToCart"
      >
        <FontAwesomeIcon :icon="faCartPlus" />
        <span>{{ addToCartLabel }}</span>
      </button>
    </div>
  </article>
</template>

<style scoped>
.product-card {
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e3e7e4;
  border-radius: 6px;
  outline: none;
  cursor: pointer;
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}

.product-card:hover,
.product-card:focus-visible {
  transform: translateY(-2px);
  border-color: #bfd6c4;
  box-shadow: 0 7px 18px rgba(34, 65, 43, .08);
}

.product-card__media {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: #fff;
}

.product-card__image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  transition: transform .2s ease;
}

.product-card:hover .product-card__image {
  transform: scale(1.018);
}

.product-card__image-empty {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #adb5af;
  background: #f6f8f6;
  font-size: 32px;
}

.product-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.product-card__name {
  margin: 0;
  min-height: 42px;
  color: #29352d;
  font-size: 15px;
  font-weight: 600;
  line-height: 21px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.product-card__pricing {
  min-height: 58px;
  margin-top: 12px;
}

.product-card__current-price {
  display: block;
  color: #e43d47;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.25;
}

.product-card__sale-row {
  min-height: 22px;
  margin-top: 5px;
  display: flex;
  align-items: center;
  gap: 7px;
}

.product-card__original-price {
  color: #929a94;
  font-size: 13px;
  line-height: 1.2;
}

.product-card__discount {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 2px 6px;
  color: #fff;
  background: #e43d47;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.product-card__cart-button {
  width: 100%;
  min-height: 42px;
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  background: #39b54a;
  border: 1px solid #39b54a;
  border-radius: 7px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease;
}

.product-card__cart-button:hover:not(:disabled) {
  background: #31a441;
  border-color: #31a441;
}

.product-card__cart-button:focus-visible {
  outline: 2px solid rgba(57, 181, 74, .24);
  outline-offset: 2px;
}

.product-card__cart-button:disabled {
  color: #8a938d;
  background: #edf0ed;
  border-color: #edf0ed;
  cursor: not-allowed;
}

@media (max-width: 520px) {
  .product-card__body { padding: 10px; }
  .product-card__name { min-height: 38px; font-size: 13px; line-height: 19px; }
  .product-card__current-price { font-size: 16px; }
  .product-card__original-price { font-size: 12px; }
  .product-card__cart-button { min-height: 38px; font-size: 13px; }
}
</style>
