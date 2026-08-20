<script setup lang="ts">
interface Props {
  title: string
  description?: string
}

defineProps<Props>()
</script>

<template>
  <section class="customer-content-card">
    <header class="content-header">
      <div class="header-text">
        <h1>
          {{ title }}
        </h1>

        <p
          v-if="description"
        >
          {{ description }}
        </p>
      </div>

      <div
        v-if="$slots.action"
        class="header-action"
      >
        <slot name="action" />
      </div>
    </header>

    <div class="content-divider" />

    <div class="content-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.customer-content-card {
  width: 100%;
  min-height: 620px;
  padding: 28px 34px 36px;
  border: 1px solid #e8eaed;
  border-radius: 8px;
  background: #ffffff;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.02),
    0 4px 14px rgba(0, 0, 0, 0.03);
  font-family:
    Inter,
    Arial,
    sans-serif;
}

.content-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.header-text {
  min-width: 0;
}

.header-text h1 {
  margin: 0;
  color: #1f2937;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.4;
}

.header-text p {
  margin: 5px 0 0;
  color: #6b7280;
  font-size: 14px;
  line-height: 1.5;
}

.header-action {
  flex-shrink: 0;
}

.content-divider {
  height: 1px;
  margin: 22px 0 32px;
  background: #eceff1;
}

.content-body {
  width: 100%;
}

@media (max-width: 640px) {
  .customer-content-card {
    min-height: auto;
    padding: 22px 18px 28px;
  }

  .content-header {
    flex-direction: column;
  }

  .header-action {
    width: 100%;
  }
}
</style>