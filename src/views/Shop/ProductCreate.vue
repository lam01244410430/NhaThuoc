<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faBoxOpen,
  faCheck,
  faChevronDown,
  faChevronUp,
  faCircleInfo,
  faCloudArrowUp,
  faExpand,
  faGripVertical,
  faImage,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faTrash,
  faVideo,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import {
  shopDashboardService,
  type CategoryOption,
  type CreateProductMediaPayload,
  type CreateProductVariantPayload,
  type CreateProductPayload,
  type ManagedProductDetail,
  type ProductStatus,
  type ShopProfile,
} from '@/services/shop-dashboard.service'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar.vue'
import DashboardHeader from '@/components/dashboard/DashboardHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { useDashboardUiStore } from '@/stores/dashboard-ui'
import { storeToRefs } from 'pinia'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const dashboardUiStore = useDashboardUiStore()
const { sidebarCollapsed } = storeToRefs(dashboardUiStore)

const productId = computed(() => {
  const value = Number(route.params.productId)
  return Number.isInteger(value) && value > 0 ? value : null
})
const isEditMode = computed(() => route.name === 'shop-product-edit')

const categories = ref<CategoryOption[]>([])
const shop = ref<ShopProfile | null>(null)
const loading = ref(true)
const saving = ref(false)
const uploadingMedia = ref(false)
const errorMessage = ref('')
const slugTouched = ref(false)
const categoryModalOpen = ref(false)
const categorySearch = ref('')
const productVideoUrl = ref('')
const productVideoStorageKey = ref('')
const productImageInput = ref<HTMLInputElement | null>(null)
const descriptionImageInput = ref<HTMLInputElement | null>(null)
const productVideoInput = ref<HTMLInputElement | null>(null)
const draggedProductImageIndex = ref<number | null>(null)
const selectedProductImageKey = ref<number | null>(null)
const selectedDescriptionImageKey = ref<number | null>(null)
const videoSelected = ref(false)
const mediaPreview = ref<{ type: 'image' | 'video'; url: string; title: string } | null>(null)
interface MediaUrlDraft {
  key: number
  url: string
  name?: string
  storageKey?: string
  uploading?: boolean
}

let nextMediaKey = 1
const productImages = ref<MediaUrlDraft[]>([])
const descriptionImages = ref<MediaUrlDraft[]>([])

const fieldErrors = reactive<Record<string, string>>({})
const variantErrors = reactive<Record<string, Record<string, string>>>({})
const batchEdit = reactive({
  price: null as number | null,
  sale_price: null as number | null,
})

interface VariantSelectionDraft {
  group_name: string
  value_name: string
}

interface ClassificationValueDraft {
  key: number
  name: string
}

interface ClassificationGroupDraft {
  key: number
  name: string
  values: ClassificationValueDraft[]
}

interface VariantDraft extends Omit<CreateProductVariantPayload, 'options'> {
  key: string
  selections: VariantSelectionDraft[]
  expanded: boolean
}

const classificationGroups = ref<ClassificationGroupDraft[]>([])
const variants = ref<VariantDraft[]>([])
let nextClassificationGroupKey = 1
let nextClassificationValueKey = 1

const form = reactive<CreateProductPayload>({
  category_id: 0,
  name: '',
  slug: '',
  price: 0,
  sale_price: null,
  description: null,
  usage_guide: null,
  status: 'active',
  thumbnail_url: null,
})

const hydrateProduct = (product: ManagedProductDetail) => {
  Object.assign(form, {
    category_id: product.category_id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    sale_price: product.sale_price,
    description: product.description,
    usage_guide: product.usage_guide,
    status: product.status,
    thumbnail_url: product.thumbnail,
  })
  slugTouched.value = true

  productImages.value = product.media
    .filter((item) => item.type === 'image' && item.purpose === 'gallery')
    .map((item) => ({ key: nextMediaKey++, url: item.url }))
  descriptionImages.value = product.media
    .filter((item) => item.type === 'image' && item.purpose === 'description')
    .map((item) => ({ key: nextMediaKey++, url: item.url }))
  productVideoUrl.value = product.media.find((item) => item.type === 'video')?.url ?? ''

  const groups = new Map<string, ClassificationGroupDraft>()
  for (const variant of product.variants) {
    for (const option of variant.options) {
      const groupKey = option.group_name.trim().toLowerCase()
      const group: ClassificationGroupDraft = groups.get(groupKey) ?? {
        key: nextClassificationGroupKey++,
        name: option.group_name,
        values: [],
      }
      if (!group.values.some((value) => value.name === option.value_name)) {
        group.values.push({ key: nextClassificationValueKey++, name: option.value_name })
      }
      groups.set(groupKey, group)
    }
  }

  classificationGroups.value = [...groups.values()]
  variants.value = product.variants.map((variant) => ({
    id: variant.id,
    key: variant.options.map((option) => {
      const group = groups.get(option.group_name.trim().toLowerCase())!
      const value = group.values.find((item) => item.name === option.value_name)!
      return `${group.key}:${value.key}`
    }).join('|'),
    selections: variant.options.map((option) => ({ ...option })),
    expanded: false,
    sku: variant.sku,
    price: variant.price,
    sale_price: variant.sale_price,
    status: variant.status,
  }))
}


const selectedCategory = computed(() =>
  categories.value.find((category) => category.id === form.category_id),
)

const filteredCategories = computed(() => {
  const keyword = categorySearch.value.trim().toLowerCase()
  if (!keyword) return categories.value

  return categories.value.filter((category) =>
    `${category.name} ${category.slug ?? ''}`.toLowerCase().includes(keyword),
  )
})

const removeProductImage = (index: number) => {
  const [image] = productImages.value.splice(index, 1)
  if (image?.storageKey) void shopDashboardService.deleteUploadedProductMedia(image.storageKey)
}

const removeDescriptionImage = (index: number) => {
  const [image] = descriptionImages.value.splice(index, 1)
  if (image?.storageKey) void shopDashboardService.deleteUploadedProductMedia(image.storageKey)
}

const uploadImageFiles = async (
  files: FileList | File[],
  purpose: 'gallery' | 'description',
) => {
  const target = purpose === 'gallery' ? productImages : descriptionImages
  const limit = purpose === 'gallery' ? 9 : 12
  const selectedFiles = Array.from(files).slice(0, limit - target.value.length)
  if (!selectedFiles.length) return

  const invalidFile = selectedFiles.find(
    (file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024,
  )
  if (invalidFile) {
    errorMessage.value = 'Ảnh phải là JPG, PNG hoặc WebP và không vượt quá 8MB'
    return
  }

  uploadingMedia.value = true
  errorMessage.value = ''
  try {
    for (const file of selectedFiles) {
      const previewUrl = URL.createObjectURL(file)
      const draft: MediaUrlDraft = {
        key: nextMediaKey++,
        url: previewUrl,
        name: file.name,
        uploading: true,
      }
      target.value.push(draft)

      try {
        const uploaded = await shopDashboardService.uploadProductMedia(file)
        draft.url = uploaded.url
        draft.storageKey = uploaded.key
        draft.uploading = false
      } catch (error) {
        target.value = target.value.filter((item) => item.key !== draft.key)
        throw error
      } finally {
        URL.revokeObjectURL(previewUrl)
      }
    }
    fieldErrors.gallery = ''
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message ?? 'Không thể tải ảnh sản phẩm'
  } finally {
    uploadingMedia.value = false
  }
}

const uploadVideoFile = async (file?: File) => {
  if (!file) return
  if (!['video/mp4', 'video/webm'].includes(file.type) || file.size > 30 * 1024 * 1024) {
    errorMessage.value = 'Video phải là MP4 hoặc WebM và không vượt quá 30MB'
    return
  }

  uploadingMedia.value = true
  errorMessage.value = ''
  const previewUrl = URL.createObjectURL(file)
  productVideoUrl.value = previewUrl
  try {
    const uploaded = await shopDashboardService.uploadProductMedia(file)
    productVideoUrl.value = uploaded.url
    productVideoStorageKey.value = uploaded.key
  } catch (error: any) {
    productVideoUrl.value = ''
    errorMessage.value = error.response?.data?.message ?? 'Không thể tải video sản phẩm'
  } finally {
    URL.revokeObjectURL(previewUrl)
    uploadingMedia.value = false
  }
}

const onProductImageInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files) void uploadImageFiles(input.files, 'gallery')
  input.value = ''
}

const onDescriptionImageInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files) void uploadImageFiles(input.files, 'description')
  input.value = ''
}

const onVideoInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  void uploadVideoFile(input.files?.[0])
  input.value = ''
}

const onImageDrop = (event: DragEvent, purpose: 'gallery' | 'description') => {
  if (event.dataTransfer?.files.length) {
    void uploadImageFiles(event.dataTransfer.files, purpose)
  }
}

const startProductImageDrag = (index: number) => {
  draggedProductImageIndex.value = index
}

const dropProductImage = (targetIndex: number) => {
  const sourceIndex = draggedProductImageIndex.value
  draggedProductImageIndex.value = null
  if (sourceIndex === null || sourceIndex === targetIndex) return
  const [image] = productImages.value.splice(sourceIndex, 1)
  if (image) productImages.value.splice(targetIndex, 0, image)
}

const setCoverImage = (index: number) => {
  const [image] = productImages.value.splice(index, 1)
  if (image) productImages.value.unshift(image)
}

const openMediaPreview = (type: 'image' | 'video', url: string, title: string) => {
  if (!url) return
  mediaPreview.value = { type, url, title }
}

const closeMediaPreview = () => {
  mediaPreview.value = null
}

const removeProductVideo = () => {
  if (productVideoStorageKey.value) {
    void shopDashboardService.deleteUploadedProductMedia(productVideoStorageKey.value)
  }
  productVideoUrl.value = ''
  productVideoStorageKey.value = ''
}

const chooseCategory = (category: CategoryOption) => {
  form.category_id = category.id
  fieldErrors.category = ''
  categoryModalOpen.value = false
  categorySearch.value = ''
}

const getMediaPayload = (): CreateProductMediaPayload[] => [
  ...productImages.value
    .map((item) => item.url.trim())
    .filter(Boolean)
    .map((url) => ({
      url,
      type: 'image' as const,
      purpose: 'gallery' as const,
    })),
  ...(productVideoUrl.value.trim()
    ? [{
        url: productVideoUrl.value.trim(),
        type: 'video' as const,
        purpose: 'gallery' as const,
      }]
    : []),
  ...descriptionImages.value
    .map((item) => item.url.trim())
    .filter(Boolean)
    .map((url) => ({
      url,
      type: 'image' as const,
      purpose: 'description' as const,
    })),
]

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const validateField = (field: string) => {
  let message = ''
  if (field === 'name' && form.name.trim().length < 2) message = 'Tên sản phẩm phải có ít nhất 2 ký tự'
  if (field === 'category' && !form.category_id) message = 'Vui lòng chọn danh mục'
  if (field === 'description' && !form.description?.trim()) message = 'Vui lòng nhập mô tả sản phẩm'
  if (field === 'gallery' && !productImages.value.length) message = 'Vui lòng tải ít nhất một ảnh sản phẩm'
  if (field === 'price' && Number(form.price) < 0) message = 'Giá gốc không hợp lệ'
  if (
    field === 'sale_price' &&
    normalizeOptionalNumber(form.sale_price) !== null &&
    Number(form.sale_price) > Number(form.price)
  ) message = 'Giá khuyến mãi không được lớn hơn giá gốc'

  fieldErrors[field] = message
  return !message
}

const validateVariantField = (
  variant: VariantDraft,
  field: 'sku' | 'price' | 'sale_price',
) => {
  const errors = variantErrors[variant.key] ?? {}
  let message = ''

  if (field === 'sku') {
    const sku = variant.sku.trim().toLowerCase()
    if (!sku) message = 'Vui lòng nhập SKU'
    else if (variants.value.some((item) => item.key !== variant.key && item.sku.trim().toLowerCase() === sku)) {
      message = 'SKU đã bị trùng'
    }
  }
  if (field === 'price' && Number(variant.price) < 0) message = 'Giá không hợp lệ'
  if (
    field === 'sale_price' &&
    normalizeOptionalNumber(variant.sale_price) !== null &&
    Number(variant.sale_price) > Number(variant.price)
  ) message = 'Giá khuyến mãi vượt giá gốc'

  errors[field] = message
  variantErrors[variant.key] = errors
  return !message
}

const applyBatchEdit = () => {
  const price = normalizeOptionalNumber(batchEdit.price)
  const salePrice = normalizeOptionalNumber(batchEdit.sale_price)

  for (const variant of variants.value) {
    if (price !== null) variant.price = price
    if (salePrice !== null) variant.sale_price = salePrice
  }
}

const toggleVariantAvailability = (variant: VariantDraft) => {
  variant.status = variant.status === 'inactive' ? 'active' : 'inactive'
}

const variantCombinationCount = computed(() =>
  classificationGroups.value.length
    ? classificationGroups.value.reduce(
        (total, group) => total * group.values.length,
        1,
      )
    : 0,
)

const syncVariantsFromClassifications = () => {
  if (!classificationGroups.value.length) {
    variants.value = []
    return
  }

  const previousVariants = new Map(
    variants.value.map((variant) => [variant.key, variant]),
  )

  let combinations: Array<
    Array<{ group: ClassificationGroupDraft; value: ClassificationValueDraft }>
  > = [[]]

  for (const group of classificationGroups.value) {
    combinations = combinations.flatMap((combination) =>
      group.values.map((value) => [...combination, { group, value }]),
    )
  }

  variants.value = combinations.map((combination) => {
    const key = combination
      .map(({ group, value }) => `${group.key}:${value.key}`)
      .join('|')
    const selections = combination.map(({ group, value }) => ({
      group_name: group.name,
      value_name: value.name,
    }))
    const existing = previousVariants.get(key)

    if (existing) {
      return { ...existing, key, selections }
    }

    return {
      key,
      selections,
      expanded: false,
      sku: '',
      price: Number(form.price) || 0,
      sale_price: normalizeOptionalNumber(form.sale_price),
      status: 'active',
        }
  })
}

const addClassificationGroup = () => {
  if (classificationGroups.value.length >= 2) return

  classificationGroups.value.push({
    key: nextClassificationGroupKey++,
    name: '',
    values: [{ key: nextClassificationValueKey++, name: '' }],
  })
}

const removeClassificationGroup = (groupIndex: number) => {
  classificationGroups.value.splice(groupIndex, 1)
}

const addClassificationValue = (group: ClassificationGroupDraft) => {
  if (group.values.length >= 20) return

  const projectedCount = classificationGroups.value.reduce(
    (total, currentGroup) =>
      total * (
        currentGroup.key === group.key
          ? currentGroup.values.length + 1
          : currentGroup.values.length
      ),
    1,
  )

  if (projectedCount > 100) {
    errorMessage.value = 'Tổng số tổ hợp variant không được vượt quá 100'
    return
  }

  errorMessage.value = ''
  group.values.push({ key: nextClassificationValueKey++, name: '' })
}

const removeClassificationValue = (
  group: ClassificationGroupDraft,
  valueIndex: number,
) => {
  if (group.values.length === 1) return
  group.values.splice(valueIndex, 1)
}

watch(classificationGroups, syncVariantsFromClassifications, { deep: true })

const toggleVariant = (variant: VariantDraft) => {
  variant.expanded = !variant.expanded
}

const variantName = (variant: VariantDraft) => {
  const values = variant.selections
    .map((selection) => selection.value_name.trim())
    .filter(Boolean)

  return values.length ? values.join(' / ') : 'Chưa nhập giá trị phân loại'
}


const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(value) || 0)

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const syncSlug = () => {
  if (!slugTouched.value) {
    form.slug = slugify(form.name)
  }
}

const normalizedSalePrice = () => {
  const value = form.sale_price as number | null | ''
  return value === null || value === '' ? null : Number(value)
}

const normalizeOptionalNumber = (value: unknown) =>
  value === null || value === '' || value === undefined
    ? null
    : Number(value)

const backToProducts = async () => {
  const uploadedKeys = [
    ...productImages.value.map((item) => item.storageKey),
    ...descriptionImages.value.map((item) => item.storageKey),
    productVideoStorageKey.value,
  ].filter((key): key is string => Boolean(key))

  await Promise.allSettled(
    uploadedKeys.map((key) => shopDashboardService.deleteUploadedProductMedia(key)),
  )

  await router.push({
    name: 'shop-dashboard',
    query: { section: 'products' },
  })
}

const selectMenu = (item: { key: string }) =>
  router.push({
    name: 'shop-dashboard',
    query: {
      section: item.key,
    },
  })

const logout = async () => {
  authStore.logout()
  await router.replace({ name: 'login' })
}

const validate = () => {
  const media = getMediaPayload()
  const galleryImages = media.filter(
    (item) => item.type === 'image' && item.purpose === 'gallery',
  )

  ;['gallery', 'name', 'category', 'description', 'price', 'sale_price']
    .forEach((field) => validateField(field))

  if (!galleryImages.length) return 'Vui lòng thêm ít nhất một ảnh sản phẩm'
  if (media.some((item) => !isValidHttpUrl(item.url))) {
    return 'URL ảnh hoặc video không hợp lệ'
  }
  if (form.name.trim().length < 2) return 'Tên sản phẩm phải có ít nhất 2 ký tự'
  if (!form.slug.trim()) return 'Slug sản phẩm không được để trống'
  if (!form.category_id) return 'Vui lòng chọn danh mục'
  if (!form.description?.trim()) return 'Vui lòng nhập mô tả sản phẩm'
  if (Number(form.price) < 0) return 'Giá gốc không hợp lệ'
  const salePrice = normalizedSalePrice()
  if (salePrice !== null && salePrice > Number(form.price)) {
    return 'Giá khuyến mãi không được lớn hơn giá gốc'
  }

  if (classificationGroups.value.length) {
    const normalizedGroupNames = classificationGroups.value.map((group) =>
      group.name.trim().toLowerCase(),
    )

    if (normalizedGroupNames.some((name) => !name)) {
      return 'Vui lòng nhập tên cho tất cả nhóm phân loại'
    }
    if (new Set(normalizedGroupNames).size !== normalizedGroupNames.length) {
      return 'Tên các nhóm phân loại không được trùng nhau'
    }

    for (const [groupIndex, group] of classificationGroups.value.entries()) {
      const normalizedValues = group.values.map((value) =>
        value.name.trim().toLowerCase(),
      )

      if (normalizedValues.some((value) => !value)) {
        return `Nhóm ${groupIndex + 1} còn giá trị phân loại chưa được nhập`
      }
      if (new Set(normalizedValues).size !== normalizedValues.length) {
        return `Các giá trị trong nhóm “${group.name}” không được trùng nhau`
      }
    }

    if (variantCombinationCount.value > 100) {
      return 'Tổng số tổ hợp variant không được vượt quá 100'
    }
  }

  syncVariantsFromClassifications()

  const normalizedSkus = new Set<string>()
  const normalizedCombinations = new Set<string>()
  const expectedGroupNames = variants.value[0]?.selections
    .map((selection) => selection.group_name.trim().toLowerCase())
    .sort()

  for (const [index, variant] of variants.value.entries()) {
    const label = `Variant ${index + 1}`

    validateVariantField(variant, 'sku')
    validateVariantField(variant, 'price')
    validateVariantField(variant, 'sale_price')

    if (!variant.sku.trim()) return `${label} chưa có SKU`
    if (variant.selections.length > 2) {
      return `${label} chỉ được có tối đa 2 thuộc tính phân loại`
    }
    if (
      variant.selections.some(
        (selection) =>
          !selection.group_name.trim() || !selection.value_name.trim(),
      )
    ) {
      return `${label} chưa nhập đủ tên thuộc tính và giá trị phân loại`
    }
    const normalizedSku = variant.sku.trim().toLowerCase()
    if (normalizedSkus.has(normalizedSku)) return 'SKU của các variant không được trùng nhau'
    normalizedSkus.add(normalizedSku)

    const groupNames = variant.selections.map(
      (selection) => selection.group_name.trim().toLowerCase(),
    )
    if (new Set(groupNames).size !== groupNames.length) {
      return `${label} không được trùng nhóm phân loại`
    }
    if (
      expectedGroupNames &&
      [...groupNames].sort().join('|') !== expectedGroupNames.join('|')
    ) {
      return 'Mọi variant phải sử dụng cùng các thuộc tính phân loại'
    }

    const combinationKey = variant.selections
      .map((selection) =>
        `${selection.group_name.trim().toLowerCase()}=${selection.value_name.trim().toLowerCase()}`,
      )
      .sort()
      .join('|')
    if (normalizedCombinations.has(combinationKey)) {
      return `${label} bị trùng tổ hợp phân loại với một variant khác`
    }
    normalizedCombinations.add(combinationKey)

    if (Number(variant.price) < 0) return `Giá của ${label} không hợp lệ`
    if (
      variant.sale_price !== null &&
      Number(variant.sale_price) > Number(variant.price)
    ) {
      return `Giá khuyến mãi của ${label} không được lớn hơn giá gốc`
    }
  }

  return null
}

const submit = async (targetStatus: ProductStatus) => {
  errorMessage.value = ''
  if (uploadingMedia.value) {
    errorMessage.value = 'Vui lòng chờ media tải lên hoàn tất'
    return
  }
  const validationError = validate()

  if (validationError) {
    errorMessage.value = validationError
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }

  saving.value = true

  try {
    const payload: CreateProductPayload = {
      ...form,
      status: targetStatus,
      name: form.name.trim(),
      slug: form.slug.trim(),
      price: Number(form.price),
      sale_price: normalizedSalePrice(),
      description: form.description?.trim() || null,
      usage_guide: form.usage_guide?.trim() || null,
      thumbnail_url:
        productImages.value.find((item) => item.url.trim())?.url.trim() ?? null,
      media: getMediaPayload(),
      variants: variants.value.map((variant) => ({
        id: variant.id,
        sku: variant.sku.trim(),
        price: Number(variant.price),
        sale_price: normalizeOptionalNumber(variant.sale_price),
        status: variant.status,
            options: variant.selections.map((selection) => ({
          group_name: selection.group_name.trim(),
          value_name: selection.value_name.trim(),
        })),
      })),
    }

    if (isEditMode.value && productId.value) {
      await shopDashboardService.updateProduct(productId.value, payload)
    } else {
      await shopDashboardService.createProduct(payload)
    }

    await router.push({
      name: 'shop-dashboard',
      query: {
        section: 'products',
        [isEditMode.value ? 'updated' : 'created']: '1',
      },
    })
  } catch (error: any) {
    errorMessage.value =
      error.response?.data?.message ??
      (isEditMode.value ? 'Không thể cập nhật sản phẩm' : 'Không thể thêm sản phẩm')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } finally {
    saving.value = false
  }
}

const saveDraft = () => submit('draft')
const submitProduct = () => submit(isEditMode.value ? form.status : 'active')

onMounted(async () => {
  try {
    if (isEditMode.value && !productId.value) {
      throw new Error('Mã sản phẩm không hợp lệ')
    }

    const [categoryData, shopData, productData] = await Promise.all([
      shopDashboardService.getCategories(),
      shopDashboardService.getShop(),
      productId.value
        ? shopDashboardService.getManagedProduct(productId.value)
        : Promise.resolve(null),
    ])

    categories.value = categoryData.filter((category) => category.id > 0)
    shop.value = shopData

    if (productData) {
      hydrateProduct(productData)
    }
  } catch (error: any) {
    errorMessage.value =
      error.response?.data?.message ??
      (isEditMode.value
        ? 'Không thể tải dữ liệu chỉnh sửa sản phẩm'
        : 'Không thể tải dữ liệu tạo sản phẩm')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="seller-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <DashboardSidebar
      variant="shop"
      :user-name="authStore.user?.name || shop?.owner_name || 'Chủ cửa hàng'"
      :avatar-url="authStore.user?.avatar || shop?.avatar"
      active-item="products"
      :collapsed="sidebarCollapsed"
      @select="selectMenu"
      @logout="logout"
    />

    <div class="product-create-page">
      <DashboardHeader
        :title="isEditMode ? 'Chỉnh sửa sản phẩm' : 'Thêm một sản phẩm mới'"
        eyebrow="SẢN PHẨM"
        :subtitle="shop?.shop_name || 'Seller Center'"
        :shop-name="shop?.shop_name || 'Cửa hàng'"
        :collapsed="sidebarCollapsed"
        :user-name="authStore.user?.name || shop?.owner_name || 'Chủ cửa hàng'"
        :show-back="true"
        back-label="Sản phẩm"
        :show-search="false"
        :show-notifications="false"
        @toggle-sidebar="dashboardUiStore.toggleSidebar()"
        @back="backToProducts"
        @home="router.push('/')"
        @shop="router.push({ name: 'shop' })"
      />

      <main class="page-body">
        <div v-if="errorMessage" class="message error-message">
          <FontAwesomeIcon :icon="faCircleInfo" />
          {{ errorMessage }}
        </div>

        <div v-if="loading" class="loading-state">Đang tải biểu mẫu...</div>

        <form v-else id="product-create-form" @submit.prevent="submitProduct">
          <section class="form-section">
            <div class="section-heading">
              <h2>Thông tin cơ bản</h2>
              <p>Thông tin rõ ràng giúp khách hàng dễ tìm thấy và hiểu sản phẩm.</p>
            </div>

            <div class="form-row">
              <label for="product-name" class="row-label">Tên sản phẩm <b>*</b></label>
              <div class="row-control control-with-counter">
                <input
                  id="product-name"
                  v-model="form.name"
                  required
                  maxlength="120"
                  placeholder="Nhập tên sản phẩm"
                  :class="{ 'is-invalid': fieldErrors.name }"
                  @input="syncSlug"
                  @blur="validateField('name')"
                />
                <span>{{ form.name.length }}/120</span>
                <small v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name }}</small>
              </div>
            </div>

            <div class="form-row">
              <span class="row-label">Danh mục <b>*</b></span>
              <div class="row-control">
                <button
                  type="button"
                  class="category-picker"
                  :class="{ 'is-invalid': fieldErrors.category }"
                  @click="categoryModalOpen = true"
                >
                  <span :class="{ muted: !selectedCategory }">
                    {{ selectedCategory?.name || 'Chọn danh mục phù hợp' }}
                  </span>
                  <FontAwesomeIcon :icon="faPen" />
                </button>
                <small v-if="fieldErrors.category" class="field-error">{{ fieldErrors.category }}</small>
              </div>
            </div>

            <div class="form-row form-row--top">
              <label for="product-description" class="row-label">
                Mô tả sản phẩm <b>*</b>
              </label>
              <div class="row-control">
                <div class="textarea-wrap">
                  <textarea
                    id="product-description"
                    v-model="form.description"
                    required
                    rows="10"
                    maxlength="5000"
                    placeholder="Mô tả công dụng, thành phần, quy cách và những thông tin khách hàng cần biết..."
                    :class="{ 'is-invalid': fieldErrors.description }"
                    @blur="validateField('description')"
                  />
                  <span>{{ form.description?.length ?? 0 }}/5000</span>
                </div>
                <small v-if="fieldErrors.description" class="field-error">{{ fieldErrors.description }}</small>
              </div>
            </div>

            <div class="form-row form-row--top">
              <label for="usage-guide" class="row-label">Hướng dẫn sử dụng</label>
              <div class="row-control">
                <textarea
                  id="usage-guide"
                  v-model="form.usage_guide"
                  rows="5"
                  maxlength="5000"
                  placeholder="Nhập cách dùng, bảo quản và lưu ý..."
                />
              </div>
            </div>
          </section>

          <section class="form-section">
            <div class="section-heading">
              <h2>Hình ảnh &amp; Video</h2>
              <p>Kéo thả file để tải lên. Có thể kéo thumbnail để đổi thứ tự và ảnh bìa.</p>
            </div>

            <div class="form-row form-row--top form-row--media">
              <label class="row-label row-label--media">
                <span>Hình ảnh sản phẩm <b>*</b></span>
                <small>{{ productImages.length }}/9 ảnh</small>
              </label>
              <div class="row-control">
                <input
                  ref="productImageInput"
                  class="visually-hidden-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  @change="onProductImageInput"
                />

                <div class="media-tile-grid media-tile-grid--gallery">
                  <button
                    v-if="productImages.length < 9"
                    type="button"
                    class="media-upload-tile"
                    :class="{ 'is-invalid': fieldErrors.gallery }"
                    :disabled="uploadingMedia"
                    @click="productImageInput?.click()"
                    @dragover.prevent
                    @drop.prevent="onImageDrop($event, 'gallery')"
                    @blur="validateField('gallery')"
                  >
                    <FontAwesomeIcon :icon="faCloudArrowUp" />
                    <strong>{{ uploadingMedia ? 'Đang tải...' : 'Thêm ảnh' }}</strong>
                    <span>JPG/PNG/WebP</span>
                  </button>

                  <article
                    v-for="(image, index) in productImages"
                    :key="image.key"
                    class="media-sort-item media-tile"
                    :class="{ 'is-selected': selectedProductImageKey === image.key }"
                    draggable="true"
                    @dragstart="startProductImageDrag(index)"
                    @dragover.prevent
                    @drop.stop.prevent="dropProductImage(index)"
                  >
                    <button
                      type="button"
                      class="media-tile__surface"
                      @click="selectedProductImageKey = selectedProductImageKey === image.key ? null : image.key"
                    >
                      <img :src="image.url" :alt="image.name || 'Ảnh sản phẩm'" />
                    </button>
                    <span v-if="image.uploading" class="uploading-label">Đang tải...</span>
                    <span class="drag-handle"><FontAwesomeIcon :icon="faGripVertical" /></span>
                    <span v-if="index === 0" class="cover-label">Ảnh bìa</span>
                    <div v-if="selectedProductImageKey === image.key" class="media-tile__actions">
                      <button type="button" title="Phóng to" @click.stop="openMediaPreview('image', image.url, image.name || 'Ảnh sản phẩm')">
                        <FontAwesomeIcon :icon="faExpand" />
                      </button>
                      <button type="button" title="Xóa" @click.stop="removeProductImage(index)">
                        <FontAwesomeIcon :icon="faXmark" />
                      </button>
                    </div>
                    <button v-if="index > 0" type="button" class="set-cover-button" @click.stop="setCoverImage(index)">
                      Đặt làm bìa
                    </button>
                  </article>
                </div>
                <small v-if="fieldErrors.gallery" class="field-error">{{ fieldErrors.gallery }}</small>
                <small class="field-help">Tối đa 9 ảnh · 8MB/ảnh. Bấm vào ảnh để hiện nút phóng to.</small>
              </div>
            </div>

            <div class="form-row form-row--top form-row--media">
              <label class="row-label row-label--media">
                <span>Ảnh trong mô tả</span>
                <small>{{ descriptionImages.length }}/12 ảnh</small>
              </label>
              <div class="row-control">
                <input
                  ref="descriptionImageInput"
                  class="visually-hidden-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  @change="onDescriptionImageInput"
                />

                <div class="media-tile-grid media-tile-grid--description">
                  <button
                    v-if="descriptionImages.length < 12"
                    type="button"
                    class="media-upload-tile"
                    :disabled="uploadingMedia"
                    @click="descriptionImageInput?.click()"
                    @dragover.prevent
                    @drop.prevent="onImageDrop($event, 'description')"
                  >
                    <FontAwesomeIcon :icon="faImage" />
                    <strong>Thêm ảnh</strong>
                    <span>Tối đa 8MB</span>
                  </button>

                  <article
                    v-for="(image, index) in descriptionImages"
                    :key="image.key"
                    class="media-tile"
                    :class="{ 'is-selected': selectedDescriptionImageKey === image.key }"
                  >
                    <button
                      type="button"
                      class="media-tile__surface"
                      @click="selectedDescriptionImageKey = selectedDescriptionImageKey === image.key ? null : image.key"
                    >
                      <img :src="image.url" :alt="image.name || 'Ảnh mô tả'" />
                    </button>
                    <span v-if="image.uploading" class="uploading-label">Đang tải...</span>
                    <div v-if="selectedDescriptionImageKey === image.key" class="media-tile__actions">
                      <button type="button" title="Phóng to" @click.stop="openMediaPreview('image', image.url, image.name || 'Ảnh mô tả')">
                        <FontAwesomeIcon :icon="faExpand" />
                      </button>
                      <button type="button" title="Xóa" @click.stop="removeDescriptionImage(index)">
                        <FontAwesomeIcon :icon="faTrash" />
                      </button>
                    </div>
                  </article>
                </div>
              </div>
            </div>

            <div class="form-row form-row--top form-row--media">
              <label class="row-label row-label--media"><span>Video sản phẩm</span><small>Tối đa 1 video</small></label>
              <div class="row-control">
                <input
                  ref="productVideoInput"
                  class="visually-hidden-input"
                  type="file"
                  accept="video/mp4,video/webm"
                  @change="onVideoInput"
                />
                <div class="media-tile-grid media-tile-grid--gallery">
                  <button
                    v-if="!productVideoUrl"
                    type="button"
                    class="media-upload-tile"
                    :disabled="uploadingMedia"
                    @click="productVideoInput?.click()"
                    @dragover.prevent
                    @drop.prevent="uploadVideoFile($event.dataTransfer?.files[0])"
                  >
                    <FontAwesomeIcon :icon="faVideo" />
                    <strong>Thêm video</strong>
                    <span>MP4/WebM</span>
                  </button>
                  <article v-else class="media-tile media-video-tile" :class="{ 'is-selected': videoSelected }">
                    <button type="button" class="media-tile__surface" @click="videoSelected = !videoSelected">
                      <video :src="productVideoUrl" muted preload="metadata" />
                      <span class="media-video-tile__badge"><FontAwesomeIcon :icon="faVideo" /></span>
                    </button>
                    <div v-if="videoSelected" class="media-tile__actions">
                      <button type="button" title="Phóng to" @click.stop="openMediaPreview('video', productVideoUrl, 'Video sản phẩm')">
                        <FontAwesomeIcon :icon="faExpand" />
                      </button>
                      <button type="button" title="Xóa" @click.stop="removeProductVideo">
                        <FontAwesomeIcon :icon="faTrash" />
                      </button>
                    </div>
                  </article>
                </div>
                <small class="field-help">Tối đa 30MB. Bấm vào video để hiện nút phóng to.</small>
              </div>
            </div>
          </section>

          <section class="form-section">
            <div class="section-heading">
              <h2>Thông tin bán hàng</h2>
              <p>Thiết lập giá và thêm các phân loại khách hàng có thể lựa chọn.</p>
            </div>

            <div class="form-row">
              <label for="base-price" class="row-label">Giá gốc <b>*</b></label>
              <div class="row-control compact-control">
                <div class="money-input">
                  <span>₫</span>
                  <input id="base-price" v-model.number="form.price" type="number" min="0" required :class="{ 'is-invalid': fieldErrors.price }" @blur="validateField('price')" />
                </div>
                <small v-if="fieldErrors.price" class="field-error">{{ fieldErrors.price }}</small>
              </div>
            </div>

            <div class="form-row">
              <label for="sale-price" class="row-label">Giá khuyến mãi</label>
              <div class="row-control compact-control">
                <div class="money-input">
                  <span>₫</span>
                  <input id="sale-price" v-model.number="form.sale_price" type="number" min="0" :class="{ 'is-invalid': fieldErrors.sale_price }" @blur="validateField('sale_price')" />
                </div>
                <small v-if="fieldErrors.sale_price" class="field-error">{{ fieldErrors.sale_price }}</small>
              </div>
            </div>

            <div class="form-row form-row--top">
              <span class="row-label">
                Phân loại hàng
                <small>{{ classificationGroups.length }}/2 nhóm · {{ variantCombinationCount }}/100 tổ hợp</small>
              </span>
              <div class="row-control">
                <div class="classification-toolbar">
                  <div>
                    <strong>Nhóm phân loại</strong>
                    <p>Mỗi nhóm dùng lại một tên và có thể chứa nhiều giá trị.</p>
                  </div>
                  <button
                    type="button"
                    :disabled="classificationGroups.length >= 2"
                    @click="addClassificationGroup"
                  >
                    <FontAwesomeIcon :icon="faPlus" />
                    Thêm nhóm phân loại
                  </button>
                </div>

                <div v-if="!classificationGroups.length" class="empty-variant-state">
                  Chưa có nhóm phân loại. Sản phẩm sẽ sử dụng giá và tồn kho mặc định.
                </div>

                <div v-else class="classification-editor">
                  <section
                    v-for="(group, groupIndex) in classificationGroups"
                    :key="group.key"
                    class="classification-group"
                  >
                    <header>
                      <span>Nhóm {{ groupIndex + 1 }}</span>
                      <input
                        v-model.trim="group.name"
                        maxlength="80"
                        :placeholder="groupIndex === 0 ? 'Ví dụ: Kích thước' : 'Ví dụ: Gói'"
                      />
                      <button
                        type="button"
                        class="icon-button danger-button"
                        :aria-label="'Xóa nhóm ' + (groupIndex + 1)"
                        @click="removeClassificationGroup(groupIndex)"
                      >
                        <FontAwesomeIcon :icon="faTrash" />
                      </button>
                    </header>

                    <div class="classification-values">
                      <div
                        v-for="(value, valueIndex) in group.values"
                        :key="value.key"
                        class="classification-value-row"
                      >
                        <span>{{ valueIndex + 1 }}</span>
                        <input
                          v-model.trim="value.name"
                          maxlength="120"
                          :placeholder="groupIndex === 0 ? 'Ví dụ: 20cm, 30cm, 40cm' : 'Ví dụ: 1 gói, Combo 3 gói'"
                        />
                        <button
                          type="button"
                          class="icon-button danger-button"
                          :disabled="group.values.length === 1"
                          :aria-label="'Xóa giá trị ' + (valueIndex + 1)"
                          @click="removeClassificationValue(group, valueIndex)"
                        >
                          <FontAwesomeIcon :icon="faTrash" />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      class="add-value-button"
                      :disabled="group.values.length >= 20 || variantCombinationCount >= 100"
                      @click="addClassificationValue(group)"
                    >
                      <FontAwesomeIcon :icon="faPlus" />
                      Thêm giá trị
                    </button>
                  </section>
                </div>

                <div v-if="variants.length" class="variant-matrix-heading">
                  <div>
                    <strong>Danh sách tổ hợp bán hàng</strong>
                    <p>Hệ thống tự tạo {{ variants.length }} tổ hợp từ các giá trị phía trên.</p>
                  </div>
                </div>

                <div v-if="variants.length" class="batch-edit-toolbar">
                  <label>
                    <span>Giá chung</span>
                    <input v-model.number="batchEdit.price" type="number" min="0" placeholder="Không đổi" />
                  </label>
                  <label>
                    <span>Giá khuyến mãi</span>
                    <input v-model.number="batchEdit.sale_price" type="number" min="0" placeholder="Không đổi" />
                  </label>
                  <button type="button" @click="applyBatchEdit">Áp dụng cho tất cả</button>
                </div>

                <div v-if="variants.length" class="variant-sheet">
                  <div class="variant-sheet__head">
                    <span>#</span>
                    <span>Tổ hợp phân loại</span>
                    <span>Thông tin bán hàng</span>
                    <span>Thao tác</span>
                  </div>

                  <div class="variant-sheet__body">
                    <article
                      v-for="(variant, variantIndex) in variants"
                      :key="variant.key"
                      class="variant-row"
                    >
                      <div class="variant-row__summary">
                        <strong class="variant-index">{{ variantIndex + 1 }}</strong>

                        <div class="variant-classifications">
                          <span
                            v-for="(selection, selectionIndex) in variant.selections"
                            :key="selectionIndex"
                            class="classification-chip"
                          >
                            <small>{{ selection.group_name || 'Chưa đặt tên' }}</small>
                            <strong>{{ selection.value_name || 'Chưa nhập giá trị' }}</strong>
                          </span>
                        </div>

                        <div class="variant-compact-info">
                          <strong>{{ variantName(variant) }}</strong>
                          <span>{{ formatCurrency(variant.sale_price ?? variant.price) }}</span>
                          <span>SKU {{ variant.sku || 'Chưa nhập' }}</span>
                        </div>

                        <div class="variant-actions">
                          <button
                            type="button"
                            class="availability-toggle"
                            :class="{ off: variant.status === 'inactive' }"
                            :aria-pressed="variant.status !== 'inactive'"
                            @click="toggleVariantAvailability(variant)"
                          >
                            {{ variant.status === 'inactive' ? 'Đã ẩn' : 'Đang bán' }}
                          </button>
                          <button type="button" class="details-toggle" @click="toggleVariant(variant)">
                            {{ variant.expanded ? 'Thu gọn' : 'Chi tiết' }}
                            <FontAwesomeIcon :icon="variant.expanded ? faChevronUp : faChevronDown" />
                          </button>
                        </div>
                      </div>

                      <div v-show="variant.expanded" class="variant-details">
                        <label>
                          <span>Mã SKU <b>*</b></span>
                          <input
                            v-model="variant.sku"
                            required
                            maxlength="120"
                            placeholder="Ví dụ: SP-20CM"
                            :class="{ 'is-invalid': variantErrors[variant.key]?.sku }"
                            @blur="validateVariantField(variant, 'sku')"
                          />
                          <small v-if="variantErrors[variant.key]?.sku" class="field-error">{{ variantErrors[variant.key]?.sku }}</small>
                        </label>
                        <label>
                          <span>Giá gốc <b>*</b></span>
                          <input v-model.number="variant.price" required type="number" min="0" :class="{ 'is-invalid': variantErrors[variant.key]?.price }" @blur="validateVariantField(variant, 'price')" />
                          <small v-if="variantErrors[variant.key]?.price" class="field-error">{{ variantErrors[variant.key]?.price }}</small>
                        </label>
                        <label>
                          <span>Giá khuyến mãi</span>
                          <input v-model.number="variant.sale_price" type="number" min="0" :class="{ 'is-invalid': variantErrors[variant.key]?.sale_price }" @blur="validateVariantField(variant, 'sale_price')" />
                          <small v-if="variantErrors[variant.key]?.sale_price" class="field-error">{{ variantErrors[variant.key]?.sale_price }}</small>
                        </label>
                        <label>
                          <span>Trạng thái</span>
                          <select v-model="variant.status">
                            <option value="active">Đang bán</option>
                            <option value="inactive">Ngừng bán</option>
                            <option value="out_of_stock">Hết hàng</option>
                          </select>
                        </label>
                      </div>
                    </article>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="form-section">
            <div class="section-heading section-heading--with-status">
              <div>
                <h2>Vận chuyển</h2>
                <p>Kích thước đóng gói, cân nặng và đơn vị vận chuyển.</p>
              </div>
              <span class="pending-label">Chưa bật</span>
            </div>
            <div class="section-note">
              Phần vận chuyển đang được giữ ở trạng thái tùy chọn. Khi có hợp đồng vận chuyển và trường dữ liệu tương ứng trong database, có thể bật mà không làm thay đổi các phần còn lại của form.
            </div>
          </section>

          <section class="form-section">
            <div class="section-heading">
              <h2>Thông tin bổ sung</h2>
              <p>Các thiết lập không thuộc dữ liệu sản phẩm.</p>
            </div>

            <div class="setup-row">
              <div>
                <strong>Tài khoản ngân hàng</strong>
                <span>Chức năng tài khoản nhận tiền chưa được cấu hình trong hệ thống hiện tại.</span>
              </div>
              <span class="pending-label">Chưa hỗ trợ</span>
            </div>

            <div class="section-note">
              Phương thức vận chuyển chưa cần thiết ở giai đoạn hiện tại và không ảnh hưởng đến việc lưu sản phẩm.
            </div>
          </section>
        </form>
      </main>

      <div v-if="!loading" class="sticky-actions">
        <button type="button" class="secondary-button" :disabled="saving || uploadingMedia" @click="backToProducts">Hủy</button>
        <button
          v-if="!isEditMode"
          type="button"
          class="secondary-button"
          :disabled="saving || uploadingMedia"
          @click="saveDraft"
        >
          Lưu nháp
        </button>
        <button
          type="submit"
          form="product-create-form"
          class="primary-button"
          :disabled="saving || uploadingMedia"
        >
          {{ saving ? 'Đang lưu...' : (isEditMode ? 'Lưu thay đổi' : 'Lưu & Hiển thị') }}
        </button>
      </div>

      <div v-if="categoryModalOpen" class="modal-overlay" @click.self="categoryModalOpen = false">
        <section class="category-modal" role="dialog" aria-modal="true" aria-labelledby="category-title">
          <header>
            <h2 id="category-title">Chọn danh mục</h2>
            <button type="button" aria-label="Đóng" @click="categoryModalOpen = false">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </header>

          <div class="category-search">
            <FontAwesomeIcon :icon="faMagnifyingGlass" />
            <input v-model.trim="categorySearch" autofocus placeholder="Tìm kiếm danh mục phù hợp" />
          </div>

          <div class="category-list">
            <button
              v-for="category in filteredCategories"
              :key="category.id"
              type="button"
              :class="{ selected: category.id === form.category_id }"
              @click="chooseCategory(category)"
            >
              <span>{{ category.name }}</span>
              <small v-if="category.slug">{{ category.slug }}</small>
            </button>
            <p v-if="!filteredCategories.length">Không tìm thấy danh mục phù hợp.</p>
          </div>

          <footer>
            <span>Đã chọn: {{ selectedCategory?.name || 'Chưa chọn danh mục' }}</span>
            <button type="button" @click="categoryModalOpen = false">Đóng</button>
          </footer>
        </section>
      </div>
    </div>
  </div>

    <Teleport to="body">
      <div v-if="mediaPreview" class="media-lightbox" role="dialog" aria-modal="true" @click.self="closeMediaPreview">
        <div class="media-lightbox__panel">
          <button type="button" class="media-lightbox__close" aria-label="Đóng" @click="closeMediaPreview">
            <FontAwesomeIcon :icon="faXmark" />
          </button>
          <img v-if="mediaPreview.type === 'image'" :src="mediaPreview.url" :alt="mediaPreview.title" />
          <video v-else :src="mediaPreview.url" controls autoplay />
          <p>{{ mediaPreview.title }}</p>
        </div>
      </div>
    </Teleport>
</template>

<style scoped lang="scss">
.seller-shell { --sidebar-layout-width: 276px; display: flex; box-sizing: border-box; width: 100%; max-width: 100vw; min-height: 100vh; overflow-x: hidden; background: #f5f5f5; }
.seller-shell.sidebar-collapsed { --sidebar-layout-width: 100px; }
.product-create-page {
  --primary: #39b54a; --primary-dark: #278d38; --text: #222; --muted: #727772; --line: #e1e4e2;
  width: 100%; min-width: 0; max-width: 100%; min-height: 100vh; flex: 0 0 100%; padding-bottom: 86px; color: var(--text); background: #f5f5f5; font-family: "Segoe UI", Tahoma, sans-serif;
}
.page-body { box-sizing: border-box; width: calc(100% - var(--sidebar-layout-width)); max-width: 1320px; margin: 18px auto 28px var(--sidebar-layout-width); padding: 0 18px; transition: width .18s ease, margin-left .18s ease; }
#product-create-form { display: grid; gap: 16px; }
.form-section, .loading-state, .message { border: 1px solid #e2e8e4; border-radius: 12px; background: #fff; box-shadow: 0 4px 16px rgba(43,75,56,.035); overflow: hidden; }
.section-heading { padding: 16px 20px 14px; border-bottom: 1px solid #eceeec; }
.section-heading h2 { margin: 0 0 4px; font-size: 18px; }
.section-heading p { margin: 0; color: var(--muted); font-size: 13px; }
.form-row { display: grid; grid-template-columns: minmax(140px,176px) minmax(0,1fr); gap: 18px; padding: 10px 20px; align-items: center; }
.form-row--top { align-items: start; }
.row-label { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: flex-end; gap: 3px 4px; color: #414641; font-size: 12px; font-weight: 500; text-align: right; }
.row-label b, label b { display: inline; flex: 0 0 auto; color: #d93a2f; }
.row-label small { flex: 0 0 100%; color: #8a908b; font-size: 11px; font-weight: 400; text-align: right; }
.form-row--media { grid-template-columns: 176px minmax(0,1fr); align-items: start; }
.row-label--media { min-height: 32px; padding-top: 4px; white-space: nowrap; }
.row-label--media > span { display: inline-flex; align-items: baseline; gap: 4px; white-space: nowrap; }
.row-control { width: 100%; min-width: 0; max-width: none; }
.compact-control { max-width: 400px; }
input, select, textarea, button { box-sizing: border-box; border-radius: 8px; font: inherit; }
input, select, textarea { width: 100%; border: 1px solid #d9ddda; background: #fff; color: var(--text); outline: none; }
input, select { min-height: 36px; padding: 6px 10px; font-size: 13px; }
textarea { padding: 8px 10px; resize: vertical; line-height: 1.45; font-size: 13px; }
input:focus, select:focus, textarea:focus { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
.is-invalid { border-color: #d93025 !important; box-shadow: inset 0 0 0 1px #d93025 !important; }

.visually-hidden-input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.control-with-counter, .textarea-wrap { position: relative; }
.control-with-counter input { padding-right: 72px; }
.control-with-counter > span, .textarea-wrap > span { position: absolute; right: 10px; bottom: 8px; color: #979c98; font-size: 12px; }
.textarea-wrap textarea { padding-bottom: 34px; }
.field-help { margin: 5px 0 0; color: #858b86; font-size: 12px; }
.media-tile-grid { display: grid; gap: 8px; align-items: start; }
.media-tile-grid--gallery { grid-template-columns: repeat(9,minmax(64px,1fr)); }
.media-tile-grid--description { grid-template-columns: repeat(9,minmax(64px,1fr)); gap: 8px; }
.media-upload-tile, .media-tile { position: relative; min-width: 0; aspect-ratio: 1; overflow: hidden; border: 1px solid #d9ddda; border-radius: 8px; background: #fff; }
.media-upload-tile { display: grid; place-items: center; align-content: center; gap: 2px; padding: 6px; border-style: dashed; border-color: #aeb7b0; background: #fafbfa; color: #4f5851; cursor: pointer; }
.media-upload-tile:hover:not(:disabled) { border-color: var(--primary); background: #f4fbf5; color: var(--primary-dark); }
.media-upload-tile:disabled { cursor: not-allowed; opacity: .6; }
.media-upload-tile svg { color: var(--primary-dark); font-size: 17px; }
.media-upload-tile strong { font-size: 11px; font-weight: 600; line-height: 1.2; }
.media-upload-tile span { color: #858c87; font-size: 9px; line-height: 1.2; }
.media-tile { cursor: pointer; }
.media-tile.is-selected { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
.media-tile__surface { display: block; width: 100%; height: 100%; padding: 0; border: 0; border-radius: 0; background: #f5f6f5; cursor: pointer; }
.media-tile__surface img, .media-tile__surface video { display: block; width: 100%; height: 100%; object-fit: cover; }
.media-sort-item { cursor: grab; }
.media-sort-item:active { cursor: grabbing; }
.drag-handle { position: absolute; top: 4px; left: 4px; z-index: 2; display: grid; width: 21px; height: 21px; place-items: center; border: 1px solid #d7dbd8; border-radius: 6px; background: rgba(255,255,255,.94); color: #59615b; pointer-events: none; }
.uploading-label { position: absolute; inset: auto 0 0; z-index: 3; padding: 5px; background: rgba(33,38,34,.78); color: #fff; font-size: 10px; text-align: center; }
.cover-label { position: absolute; left: 0; bottom: 0; z-index: 2; padding: 3px 6px; color: #fff; background: rgba(34,34,34,.78); font-size: 9px; pointer-events: none; }
.media-tile__actions { position: absolute; top: 4px; right: 4px; z-index: 4; display: flex; gap: 4px; }
.media-tile__actions button { display: grid; width: 25px; height: 25px; place-items: center; padding: 0; border: 1px solid rgba(211,217,213,.95); border-radius: 6px; background: rgba(255,255,255,.96); color: #475149; cursor: pointer; box-shadow: 0 2px 7px rgba(26,42,31,.08); }
.media-tile__actions button:last-child { color: #b42318; }
.set-cover-button { position: absolute; right: 4px; bottom: 4px; z-index: 3; min-height: 24px; width: auto; padding: 0 6px; border: 1px solid rgba(215,219,216,.95); border-radius: 6px; background: rgba(255,255,255,.95); color: var(--primary-dark); font-size: 9px; cursor: pointer; }
.media-video-tile__badge { position: absolute; left: 5px; bottom: 5px; display: grid; width: 22px; height: 22px; place-items: center; border-radius: 50%; background: rgba(24,28,25,.72); color: #fff; font-size: 10px; pointer-events: none; }
.media-lightbox { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center; padding: 24px; background: rgba(13,17,14,.78); backdrop-filter: blur(3px); }
.media-lightbox__panel { position: relative; display: grid; max-width: min(1100px,94vw); max-height: 92vh; gap: 8px; place-items: center; padding: 14px; border-radius: 12px; background: #fff; box-shadow: 0 20px 70px rgba(0,0,0,.28); }
.media-lightbox__panel img, .media-lightbox__panel video { display: block; max-width: min(1040px,90vw); max-height: 78vh; object-fit: contain; background: #111; }
.media-lightbox__panel p { margin: 0; max-width: 760px; color: #59615b; font-size: 12px; text-align: center; }
.media-lightbox__close { position: absolute; top: -12px; right: -12px; z-index: 2; display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid #d9ddda; border-radius: 50%; background: #fff; color: #39423b; cursor: pointer; box-shadow: 0 5px 15px rgba(0,0,0,.12); }
.media-list { display: flex; flex-wrap: wrap; gap: 10px; }
.media-url-card { width: 184px; }
.media-preview, .media-add {
  position: relative; display: grid; width: 100%; height: 118px; place-items: center; overflow: hidden;
  border: 1px dashed #cbd1cd; background: #fafafa; color: #7b837d;
}
.media-preview img { width: 100%; height: 100%; object-fit: cover; }
.media-preview > svg { font-size: 25px; }
.media-url-card input { min-height: 36px; margin-top: 5px; padding: 7px 8px; font-size: 12px; }
.media-add { width: 118px; gap: 3px; align-content: center; color: var(--primary-dark); cursor: pointer; }
.media-add span { font-size: 12px; }
.media-add small { color: #8a908b; font-size: 10px; }
.cover-label { position: absolute; left: 0; bottom: 0; padding: 4px 7px; color: #fff; background: rgba(34,34,34,.78); font-size: 10px; }
.media-remove { position: absolute; top: 4px; right: 4px; display: grid; width: 25px; height: 25px; place-items: center; border: 1px solid #d7dbd8; background: rgba(255,255,255,.92); color: #a52b24; cursor: pointer; }
.video-url-control { display: grid; grid-template-columns: 44px minmax(0,1fr) 38px; max-width: 720px; border: 1px solid #d9ddda; }
.video-url-control > span, .video-url-control > button { display: grid; place-items: center; border: 0; background: #fafafa; color: #6b736d; }
.video-url-control input { min-height: 42px; border-width: 0 1px; }
.video-url-control > button { cursor: pointer; }
.category-picker { display: flex; width: 100%; min-height: 44px; align-items: center; justify-content: space-between; padding: 0 13px; border: 1px solid #d9ddda; background: #fff; color: #333; cursor: pointer; }
.category-picker .muted { color: #9a9f9b; }
.category-picker svg { color: #737a75; }
.description-media { margin-top: 10px; border: 1px solid #e1e4e2; }
.description-media__head, .description-image-row { display: grid; align-items: center; gap: 9px; padding: 9px 11px; }
.description-media__head { grid-template-columns: 1fr auto; background: #f7f8f7; }
.description-media__head div { display: grid; gap: 2px; }
.description-media__head small { color: #858b86; font-size: 11px; }
.description-media__head button, .description-image-row button { min-height: 32px; border: 1px solid #cfd4d0; background: #fff; color: #4e5650; cursor: pointer; }
.description-image-row { grid-template-columns: 28px minmax(0,1fr) 34px; border-top: 1px solid #e8eae8; }
.description-image-row span { color: #808681; font-size: 12px; text-align: center; }
.description-image-row input { min-height: 36px; }
.description-image-row button { color: #b42318; }
.money-input { display: grid; grid-template-columns: 42px minmax(0,1fr); border: 1px solid #d9ddda; }
.money-input span { display: grid; place-items: center; border-right: 1px solid #e1e4e2; background: #fafafa; color: #686f69; }
.money-input input { border: 0; }
.classification-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 10px; }
.classification-toolbar > div { display: grid; gap: 3px; }
.classification-toolbar p, .variant-matrix-heading p { margin: 0; color: #7d837e; font-size: 12px; }
.classification-toolbar button { display: inline-flex; min-height: 38px; flex: 0 0 auto; align-items: center; gap: 7px; padding: 0 13px; border: 1px solid #bfc6c1; background: #fff; color: var(--primary-dark); cursor: pointer; }
.empty-variant-state { padding: 18px; border: 1px dashed #cfd4d1; background: #fafafa; color: #777e79; font-size: 13px; text-align: center; }
.classification-editor { display: grid; gap: 10px; }
.classification-group { border: 1px solid #d9ddda; background: #fff; }
.classification-group header { display: grid; grid-template-columns: 78px minmax(0,1fr) 34px; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid #e4e7e5; background: #f7f8f7; }
.classification-group header > span { color: #565d58; font-size: 12px; font-weight: 700; }
.classification-group header input { min-height: 36px; }
.classification-values { display: grid; }
.classification-value-row { display: grid; grid-template-columns: 38px minmax(0,1fr) 34px; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid #eceeec; }
.classification-value-row > span { color: #858b86; font-size: 12px; text-align: center; }
.classification-value-row input { min-height: 36px; }
.add-value-button { display: inline-flex; min-height: 36px; align-items: center; gap: 7px; margin: 9px 10px; padding: 0 11px; border: 1px solid #cfd4d0; background: #fff; color: var(--primary-dark); cursor: pointer; }
.variant-matrix-heading { display: flex; align-items: center; justify-content: space-between; margin: 18px 0 8px; }
.variant-matrix-heading > div { display: grid; gap: 3px; }
.batch-edit-toolbar { display: grid; grid-template-columns: repeat(4,minmax(120px,1fr)) auto; gap: 8px; align-items: end; margin-bottom: 10px; padding: 10px; border: 1px solid #d9ddda; background: #f7f8f7; }
.batch-edit-toolbar label { display: grid; min-width: 0; gap: 4px; color: #59615b; font-size: 11px; font-weight: 600; }
.batch-edit-toolbar input, .batch-edit-toolbar select { min-height: 35px; padding: 6px 8px; font-size: 12px; }
.batch-edit-toolbar > button { min-height: 35px; padding: 0 12px; border: 1px solid var(--primary-dark); background: #fff; color: var(--primary-dark); font-weight: 600; cursor: pointer; }
.variant-sheet { overflow-x: auto; border: 1px solid #d9ddda; background: #fff; }
.variant-sheet__head, .variant-row__summary { display: grid; grid-template-columns: 42px minmax(250px,1.25fr) minmax(180px,.6fr) 180px; min-width: 760px; }
.variant-sheet__head { min-height: 40px; align-items: center; border-bottom: 1px solid #d9ddda; background: #f5f6f5; color: #565d58; font-size: 12px; font-weight: 700; }
.variant-sheet__head span { padding: 0 10px; }
.variant-sheet__body { min-width: 760px; }
.variant-row { border-bottom: 1px solid #e3e6e4; }
.variant-row:last-child { border-bottom: 0; }
.variant-row__summary > * { min-height: 58px; padding: 9px 10px; border-right: 1px solid #eceeec; }
.variant-row__summary > *:last-child { border-right: 0; }
.variant-index { display: grid; place-items: center; color: #666d68; font-size: 12px; }
.variant-classifications { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); align-content: center; gap: 6px; }
.classification-chip { display: grid; min-width: 0; gap: 2px; padding: 6px 8px; border: 1px solid #e0e3e1; background: #fafafa; }
.classification-chip small, .classification-chip strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.classification-chip small { color: #858b86; font-size: 10px; font-weight: 400; }
.classification-chip strong { color: #3f4540; font-size: 12px; }
.icon-button, .details-toggle { min-height: 32px; border: 1px solid #d4d8d5; background: #fff; color: #5c645e; cursor: pointer; }
.icon-button { width: 32px; padding: 0; }
.danger-button { color: #b42318; }
.variant-compact-info { display: grid; align-content: center; gap: 3px; font-size: 12px; }
.variant-compact-info strong, .variant-compact-info span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.variant-compact-info span { color: #727873; }
.variant-actions { display: flex; justify-content: flex-end; gap: 6px; }
.availability-toggle { min-width: 68px; min-height: 32px; padding: 0 8px; border: 1px solid #8bbf92; background: #f1f8f2; color: #1e7430; font-size: 11px; cursor: pointer; }
.availability-toggle.off { border-color: #cfd4d0; background: #f5f5f5; color: #737a75; }
.details-toggle { padding: 0 8px; }
.variant-details { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 11px; padding: 15px 18px 17px 52px; border-top: 1px solid #e5e7e5; background: #fafafa; }
.variant-details label { display: grid; gap: 5px; font-size: 12px; font-weight: 600; }
.variant-details input, .variant-details select { min-height: 37px; padding: 7px 9px; font-size: 12px; }
.section-alert, .section-note { margin: 16px 28px; padding: 12px 14px; border-left: 3px solid #b5bab6; background: #f7f8f7; color: #676e69; font-size: 13px; }
.setup-row { display: flex; min-height: 66px; align-items: center; justify-content: space-between; gap: 20px; padding: 0 28px; border-bottom: 1px solid #eceeec; }
.setup-row div { display: grid; gap: 4px; }
.setup-row span { color: #737a75; font-size: 12px; }
.setup-row button { min-height: 34px; padding: 0 12px; border: 1px solid #cfd4d0; background: #fff; color: #414842; cursor: pointer; }
.pending-label { padding: 5px 8px; border: 1px solid #ddd; background: #f7f7f7; }
.section-heading--with-status { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.sticky-actions { position: fixed; right: 0; bottom: 0; left: var(--sidebar-layout-width); z-index: 40; display: flex; min-height: 70px; align-items: center; justify-content: flex-end; gap: 10px; padding: 0 28px; border-top: 1px solid #dfe7e1; background: rgba(255,255,255,.97); box-shadow: 0 -6px 20px rgba(40,75,52,.07); backdrop-filter: blur(8px); }
.sticky-actions button { min-width: 130px; min-height: 40px; padding: 0 18px; cursor: pointer; }
.secondary-button { border: 1px solid #cfd4d0; background: #fff; color: #444b46; }
.primary-button { border: 1px solid var(--primary-dark); background: var(--primary); color: #fff; font-weight: 700; }
.sticky-actions button:disabled, .classification-toolbar button:disabled, .add-value-button:disabled, .icon-button:disabled, .description-media__head button:disabled { cursor: not-allowed; opacity: .5; }
.message, .loading-state { margin-bottom: 16px; padding: 15px 18px; }
.error-message { display: flex; align-items: center; gap: 9px; border-color: #ecc2bf; color: #a52e27; background: #fff8f7; }
.modal-overlay { position: fixed; inset: 0; z-index: 60; display: grid; padding: 34px; place-items: center; background: rgba(26,30,27,.48); }
.category-modal { display: grid; width: min(900px,100%); max-height: min(720px,calc(100vh - 68px)); grid-template-rows: auto auto minmax(0,1fr) auto; border: 1px solid #d6dad7; background: #fff; box-shadow: 0 16px 45px rgba(0,0,0,.18); }
.category-modal header, .category-modal footer { display: flex; min-height: 64px; align-items: center; justify-content: space-between; gap: 20px; padding: 0 22px; }
.category-modal header { border-bottom: 1px solid #e3e6e4; }
.category-modal h2 { margin: 0; font-size: 20px; font-weight: 500; }
.category-modal header button { border: 0; background: transparent; color: #747b76; cursor: pointer; }
.category-search { position: relative; margin: 18px 22px 10px; }
.category-search svg { position: absolute; top: 50%; left: 13px; color: #8b918d; transform: translateY(-50%); }
.category-search input { padding-left: 38px; }
.category-list { display: grid; align-content: start; margin: 0 22px 16px; overflow-y: auto; border: 1px solid #e0e3e1; }
.category-list button { display: grid; gap: 2px; padding: 12px 14px; border: 0; border-bottom: 1px solid #eceeec; background: #fff; color: #333; text-align: left; cursor: pointer; }
.category-list button:hover, .category-list button.selected { background: #f1f8f2; }
.category-list small { color: #858b86; }
.category-list p { padding: 30px; color: #858b86; text-align: center; }
.category-modal footer { border-top: 1px solid #e3e6e4; color: #6d746f; font-size: 13px; }
.category-modal footer button { min-height: 36px; padding: 0 16px; border: 1px solid #cfd4d0; background: #fff; cursor: pointer; }
@media (max-width: 1400px) {
  .media-tile-grid--gallery { grid-template-columns: repeat(6,minmax(64px,1fr)); }
  .media-tile-grid--description { grid-template-columns: repeat(6,minmax(64px,1fr)); }
}
@media (max-width: 900px) {
  .media-tile-grid--gallery { grid-template-columns: repeat(4,minmax(64px,1fr)); }
  .media-tile-grid--description { grid-template-columns: repeat(4,minmax(64px,1fr)); }
}
@media (max-width: 560px) {
  .media-tile-grid--gallery { grid-template-columns: repeat(3,minmax(64px,1fr)); }
  .media-tile-grid--description { grid-template-columns: repeat(3,minmax(64px,1fr)); }
}
@media (max-width: 1200px) { .variant-details { grid-template-columns: repeat(2,minmax(0,1fr)); } .batch-edit-toolbar { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 991.98px) {
  .seller-shell { flex-direction: column; }
  .product-create-page { width: 100%; }
  .page-body { width: 100%; max-width: none; margin-left: 0; }
  .sticky-actions { left: 0; }
}
@media (max-width: 760px) {
  .shop-identity { display: none; }
  .page-body { width: auto; margin-top: 10px; padding: 0 10px; }
  .section-heading { padding: 18px; }
  .form-row { grid-template-columns: 1fr; gap: 7px; padding: 12px 18px; }
  .row-label { justify-content: flex-start; text-align: left; }
  .row-label small { text-align: left; }
  .form-row--media { grid-template-columns: 1fr; }
  .row-label--media { min-height: 0; padding-top: 0; }
  .classification-toolbar, .setup-row { align-items: stretch; flex-direction: column; }
  .classification-toolbar button { justify-content: center; }
  .batch-edit-toolbar { grid-template-columns: 1fr; }
  .classification-group header { grid-template-columns: 1fr 34px; }
  .classification-group header > span { grid-column: 1 / -1; }
  .variant-details { grid-template-columns: 1fr; padding: 14px; }
  .setup-row { padding: 14px 18px; }
  .sticky-actions { left: 0; padding: 0 10px; }
  .sticky-actions button { min-width: 0; flex: 1; padding: 0 8px; }
  .modal-overlay { padding: 12px; }
}
</style>
