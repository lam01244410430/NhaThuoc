<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, reactive, ref } from "vue";

import CustomerContentCard from "@/components/Customer/CustomerContentCard.vue";
import {
  customerAccountService,
  type AddressPayload,
  type AddressType,
  type CustomerAddress,
} from "@/services/customer-account.service";

type AddressField = "recipient_name" | "phone" | "address_detail";

interface ProvinceOption {
  code: number;
  name: string;
}

interface DistrictOption {
  code: number;
  name: string;
  province_code: number;
}

interface WardOption {
  code: number;
  name: string;
  district_code: number;
}

interface ProvinceDetail extends ProvinceOption {
  districts: DistrictOption[];
}

interface DistrictDetail extends DistrictOption {
  wards: WardOption[];
}

const PROVINCE_API_BASE = "https://provinces.open-api.vn/api/v1";
const addressTypeOptions: { value: AddressType; label: string }[] = [
  { value: "home", label: "Nhà riêng" },
  { value: "work", label: "Cơ quan" },
  { value: "school", label: "Trường học" },
  { value: "other", label: "Khác" },
];

const addresses = ref<CustomerAddress[]>([]);
const loading = ref(true);
const submitting = ref(false);
const actionId = ref<number | null>(null);
const editingId = ref<number | null>(null);
const showingForm = ref(false);
const globalError = ref("");
const successMessage = ref("");
const locationError = ref("");
const provinces = ref<ProvinceOption[]>([]);
const districts = ref<DistrictOption[]>([]);
const wards = ref<WardOption[]>([]);
const selectedProvinceCode = ref<number | null>(null);
const selectedDistrictCode = ref<number | null>(null);
const selectedWardCode = ref<number | null>(null);
const loadingProvinces = ref(false);
const loadingDistricts = ref(false);
const loadingWards = ref(false);
const locationPickerOpen = ref(false);
const activeLocationLevel = ref<"province" | "district">("province");

const form = reactive<AddressPayload>({
  recipient_name: "",
  phone: "",
  province: null,
  district: null,
  ward: null,
  address_detail: "",
  type: "home",
  is_default: false,
});

const errors = reactive<Record<AddressField, string>>({
  recipient_name: "",
  phone: "",
  address_detail: "",
});

const editingAddress = computed(() => {
  if (editingId.value === null) return null;

  return (
    addresses.value.find((address) => address.address_id === editingId.value) ??
    null
  );
});

const isEditingDefault = computed(() => {
  return Boolean(editingAddress.value?.is_default);
});

const locationSummary = computed(() => {
  return (
    [form.province, form.district].filter(Boolean).join(", ") ||
    "Chọn Tỉnh/Thành phố, Quận/Huyện"
  );
});

function getApiMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

function applyApiErrors(error: unknown) {
  if (!axios.isAxiosError(error)) return;

  const fieldErrors = error.response?.data?.errors as
    Record<string, string[] | undefined> | undefined;

  errors.recipient_name = fieldErrors?.recipient_name?.[0] ?? "";
  errors.phone = fieldErrors?.phone?.[0] ?? "";
  errors.address_detail = fieldErrors?.address_detail?.[0] ?? "";
}

function normalizeOptionalText(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeLocationName(value: string | null): string {
  return value?.trim().toLocaleLowerCase("vi-VN") ?? "";
}

async function loadProvinces() {
  loadingProvinces.value = true;
  locationError.value = "";

  try {
    const response = await axios.get<ProvinceOption[]>(
      `${PROVINCE_API_BASE}/p/`,
    );
    provinces.value = response.data;
  } catch (error: unknown) {
    locationError.value = getApiMessage(
      error,
      "Không thể tải danh sách Tỉnh/Thành phố",
    );
  } finally {
    loadingProvinces.value = false;
  }
}

async function loadDistricts(provinceCode: number) {
  loadingDistricts.value = true;
  locationError.value = "";
  districts.value = [];
  wards.value = [];

  try {
    const response = await axios.get<ProvinceDetail>(
      `${PROVINCE_API_BASE}/p/${provinceCode}?depth=2`,
    );
    districts.value = response.data.districts ?? [];
  } catch (error: unknown) {
    locationError.value = getApiMessage(
      error,
      "Không thể tải danh sách Quận/Huyện",
    );
  } finally {
    loadingDistricts.value = false;
  }
}

async function loadWards(districtCode: number) {
  loadingWards.value = true;
  locationError.value = "";
  wards.value = [];

  try {
    const response = await axios.get<DistrictDetail>(
      `${PROVINCE_API_BASE}/d/${districtCode}?depth=2`,
    );
    wards.value = response.data.wards ?? [];
  } catch (error: unknown) {
    locationError.value = getApiMessage(
      error,
      "Không thể tải danh sách Phường/Xã",
    );
  } finally {
    loadingWards.value = false;
  }
}

async function handleProvinceChange() {
  const province = provinces.value.find(
    (item) => item.code === selectedProvinceCode.value,
  );

  form.province = province?.name ?? null;
  form.district = null;
  form.ward = null;
  selectedDistrictCode.value = null;
  selectedWardCode.value = null;
  districts.value = [];
  wards.value = [];

  if (province) await loadDistricts(province.code);
}

async function selectProvince(province: ProvinceOption) {
  selectedProvinceCode.value = province.code;
  await handleProvinceChange();
  activeLocationLevel.value = "district";
}

async function handleDistrictChange() {
  const district = districts.value.find(
    (item) => item.code === selectedDistrictCode.value,
  );

  form.district = district?.name ?? null;
  form.ward = null;
  selectedWardCode.value = null;
  wards.value = [];

  if (district) await loadWards(district.code);
}

async function selectDistrict(district: DistrictOption) {
  selectedDistrictCode.value = district.code;
  await handleDistrictChange();
  locationPickerOpen.value = false;
}

function toggleLocationPicker() {
  const willOpen = !locationPickerOpen.value;
  locationPickerOpen.value = willOpen;

  if (willOpen) {
    activeLocationLevel.value = "province";
  }
}

function handleWardChange() {
  const ward = wards.value.find((item) => item.code === selectedWardCode.value);

  form.ward = ward?.name ?? null;
}

function resetForm() {
  form.recipient_name = "";
  form.phone = "";
  form.province = null;
  form.district = null;
  form.ward = null;
  form.address_detail = "";
  form.type = "home";
  form.is_default = false;

  selectedProvinceCode.value = null;
  selectedDistrictCode.value = null;
  selectedWardCode.value = null;
  districts.value = [];
  wards.value = [];
  locationError.value = "";
  locationPickerOpen.value = false;
  activeLocationLevel.value = "province";

  errors.recipient_name = "";
  errors.phone = "";
  errors.address_detail = "";
}

function closeForm() {
  showingForm.value = false;
  editingId.value = null;
  resetForm();
}

function openCreateForm() {
  resetForm();
  editingId.value = null;
  showingForm.value = true;
  globalError.value = "";
  successMessage.value = "";
}

async function openEditForm(address: CustomerAddress) {
  resetForm();
  editingId.value = address.address_id;
  form.recipient_name = address.recipient_name;
  form.phone = address.phone;
  form.province = address.province;
  form.district = address.district;
  form.ward = address.ward;
  form.address_detail = address.address_detail;
  form.type = address.type;
  form.is_default = address.is_default;
  showingForm.value = true;
  globalError.value = "";
  successMessage.value = "";

  if (provinces.value.length === 0) {
    await loadProvinces();
  }

  const province = provinces.value.find(
    (item) =>
      normalizeLocationName(item.name) ===
      normalizeLocationName(address.province),
  );

  if (!province) return;

  selectedProvinceCode.value = province.code;
  await loadDistricts(province.code);

  const district = districts.value.find(
    (item) =>
      normalizeLocationName(item.name) ===
      normalizeLocationName(address.district),
  );

  if (!district) return;

  selectedDistrictCode.value = district.code;
  await loadWards(district.code);

  const ward = wards.value.find(
    (item) =>
      normalizeLocationName(item.name) === normalizeLocationName(address.ward),
  );

  selectedWardCode.value = ward?.code ?? null;
}

function clearFieldError(field: AddressField) {
  errors[field] = "";
  globalError.value = "";
  successMessage.value = "";
}

function validate(): boolean {
  errors.recipient_name = "";
  errors.phone = "";
  errors.address_detail = "";

  const recipientName = form.recipient_name.trim();
  const addressDetail = form.address_detail.trim();

  if (recipientName.length < 2) {
    errors.recipient_name = "Tên người nhận phải có ít nhất 2 ký tự";
  }

  if (!/^0\d{9}$/.test(form.phone.trim())) {
    errors.phone = "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0";
  }

  if (addressDetail.length < 5) {
    errors.address_detail = "Địa chỉ chi tiết phải có ít nhất 5 ký tự";
  }

  return !Object.values(errors).some(Boolean);
}

function toPayload(): AddressPayload {
  return {
    recipient_name: form.recipient_name.trim(),
    phone: form.phone.trim(),
    province: normalizeOptionalText(form.province),
    district: normalizeOptionalText(form.district),
    ward: normalizeOptionalText(form.ward),
    address_detail: form.address_detail.trim(),
    type: form.type,
    is_default: isEditingDefault.value || form.is_default,
  };
}

async function loadAddresses() {
  loading.value = true;
  globalError.value = "";

  try {
    addresses.value = await customerAccountService.getAddresses();
  } catch (error: unknown) {
    globalError.value = getApiMessage(error, "Không thể tải danh sách địa chỉ");
  } finally {
    loading.value = false;
  }
}

async function saveAddress() {
  if (submitting.value || !validate()) return;

  submitting.value = true;
  globalError.value = "";
  successMessage.value = "";

  try {
    const payload = toPayload();
    const response =
      editingId.value === null
        ? await customerAccountService.createAddress(payload)
        : await customerAccountService.updateAddress(editingId.value, payload);

    closeForm();
    await loadAddresses();
    successMessage.value = response.message;
  } catch (error: unknown) {
    applyApiErrors(error);

    globalError.value = getApiMessage(
      error,
      editingId.value === null
        ? "Không thể thêm địa chỉ"
        : "Không thể cập nhật địa chỉ",
    );
  } finally {
    submitting.value = false;
  }
}

async function setDefault(address: CustomerAddress) {
  if (address.is_default || actionId.value !== null) {
    return;
  }

  actionId.value = address.address_id;
  globalError.value = "";
  successMessage.value = "";

  try {
    const response = await customerAccountService.setDefaultAddress(
      address.address_id,
    );

    await loadAddresses();
    successMessage.value = response.message;
  } catch (error: unknown) {
    globalError.value = getApiMessage(error, "Không thể đặt địa chỉ mặc định");
  } finally {
    actionId.value = null;
  }
}

async function deleteAddress(address: CustomerAddress) {
  const confirmed = window.confirm(
    `Bạn có chắc muốn xóa địa chỉ của ${address.recipient_name}?`,
  );

  if (!confirmed || actionId.value !== null) return;

  actionId.value = address.address_id;
  globalError.value = "";
  successMessage.value = "";

  try {
    const response = await customerAccountService.deleteAddress(
      address.address_id,
    );

    if (editingId.value === address.address_id) {
      closeForm();
    }

    await loadAddresses();
    successMessage.value = response.message;
  } catch (error: unknown) {
    globalError.value = getApiMessage(error, "Không thể xóa địa chỉ");
  } finally {
    actionId.value = null;
  }
}

function formatLocation(address: CustomerAddress): string {
  return [
    address.address_detail,
    address.ward,
    address.district,
    address.province,
  ]
    .filter(Boolean)
    .join(", ");
}

function typeLabel(type: AddressType): string {
  const labels: Record<AddressType, string> = {
    home: "Nhà riêng",
    work: "Cơ quan",
    school: "Trường học",
    other: "Khác",
  };

  return labels[type];
}

onMounted(() => {
  void Promise.all([loadAddresses(), loadProvinces()]);
});
</script>

<template>
  <CustomerContentCard
    title="Địa chỉ của tôi"
    description="Quản lý địa chỉ nhận hàng của bạn"
  >
    <template #action>
      <button type="button" class="primary-button" @click="openCreateForm">
        + Thêm địa chỉ
      </button>
    </template>

    <div v-if="globalError" class="notice notice--error" role="alert">
      {{ globalError }}
    </div>

    <div v-if="successMessage" class="notice notice--success" role="status">
      {{ successMessage }}
    </div>

    <Teleport to="body">
      <div
        v-if="showingForm"
        class="address-modal"
        role="presentation"
        @click.self="closeForm"
      >
        <form class="address-form" @submit.prevent="saveAddress">
          <div class="form-heading">
            <h2>
              {{ editingId === null ? "Thêm địa chỉ" : "Cập nhật địa chỉ" }}
            </h2>

            <button type="button" class="text-button" @click="closeForm">
              Đóng
            </button>
          </div>

          <div class="form-grid">
            <div class="field">
              <label for="recipient-name"> Tên người nhận </label>

              <input
                id="recipient-name"
                v-model="form.recipient_name"
                type="text"
                maxlength="50"
                class="form-input"
                :class="{
                  'is-invalid': errors.recipient_name,
                }"
                @input="clearFieldError('recipient_name')"
              />

              <p v-if="errors.recipient_name" class="field-error">
                {{ errors.recipient_name }}
              </p>
            </div>

            <div class="field">
              <label for="address-phone"> Số điện thoại </label>

              <input
                id="address-phone"
                v-model="form.phone"
                type="tel"
                inputmode="numeric"
                maxlength="10"
                class="form-input"
                :class="{ 'is-invalid': errors.phone }"
                @input="clearFieldError('phone')"
              />

              <p v-if="errors.phone" class="field-error">
                {{ errors.phone }}
              </p>
            </div>

            <div class="field field--full location-picker">
              <label id="location-picker-label"
                >Tỉnh/Thành phố, Quận/Huyện</label
              >

              <button
                type="button"
                class="location-picker__trigger"
                :disabled="loadingProvinces"
                aria-labelledby="location-picker-label"
                :aria-expanded="locationPickerOpen"
                @click="toggleLocationPicker"
              >
                <span>{{
                  loadingProvinces ? "Đang tải địa giới..." : locationSummary
                }}</span>
                <span class="location-picker__arrow" aria-hidden="true">▾</span>
              </button>

              <div v-if="locationPickerOpen" class="location-picker__panel">
                <div class="location-picker__tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    :aria-selected="activeLocationLevel === 'province'"
                    :class="{ 'is-active': activeLocationLevel === 'province' }"
                    @click="activeLocationLevel = 'province'"
                  >
                    Tỉnh/Thành phố
                  </button>

                  <button
                    type="button"
                    role="tab"
                    :aria-selected="activeLocationLevel === 'district'"
                    :class="{ 'is-active': activeLocationLevel === 'district' }"
                    :disabled="selectedProvinceCode === null"
                    @click="activeLocationLevel = 'district'"
                  >
                    Quận/Huyện
                  </button>
                </div>

                <div class="location-picker__list" role="listbox">
                  <template v-if="activeLocationLevel === 'province'">
                    <button
                      v-for="province in provinces"
                      :key="province.code"
                      type="button"
                      class="location-picker__option"
                      :class="{
                        'is-selected': selectedProvinceCode === province.code,
                      }"
                      @click="selectProvince(province)"
                    >
                      {{ province.name }}
                    </button>
                  </template>

                  <template v-else>
                    <p v-if="loadingDistricts" class="location-picker__status">
                      Đang tải Quận/Huyện...
                    </p>

                    <template v-else>
                      <button
                        v-for="district in districts"
                        :key="district.code"
                        type="button"
                        class="location-picker__option"
                        :class="{
                          'is-selected': selectedDistrictCode === district.code,
                        }"
                        @click="selectDistrict(district)"
                      >
                        {{ district.name }}
                      </button>
                    </template>
                  </template>
                </div>
              </div>
            </div>

            <div class="field">
              <label for="ward">Phường/Xã</label>

              <select
                id="ward"
                v-model="selectedWardCode"
                class="form-input"
                :disabled="selectedDistrictCode === null || loadingWards"
                @change="handleWardChange"
              >
                <option :value="null">
                  {{
                    loadingWards ? "Đang tải Phường/Xã..." : "Chọn Phường/Xã"
                  }}
                </option>

                <option
                  v-for="ward in wards"
                  :key="ward.code"
                  :value="ward.code"
                >
                  {{ ward.name }}
                </option>
              </select>
            </div>

            <p
              v-if="locationError"
              class="location-error field--full"
              role="alert"
            >
              {{ locationError }}
            </p>

            <div class="field field--full">
              <span class="field-label">Loại địa chỉ</span>

              <div class="address-type-options">
                <button
                  v-for="option in addressTypeOptions"
                  :key="option.value"
                  type="button"
                  class="address-type-button"
                  :class="{ 'is-active': form.type === option.value }"
                  @click="form.type = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <div class="field field--full">
              <label for="address-detail"> Địa chỉ chi tiết </label>

              <input
                id="address-detail"
                v-model="form.address_detail"
                type="text"
                maxlength="255"
                class="form-input"
                :class="{
                  'is-invalid': errors.address_detail,
                }"
                placeholder="Số nhà, tên đường..."
                @input="clearFieldError('address_detail')"
              />

              <p v-if="errors.address_detail" class="field-error">
                {{ errors.address_detail }}
              </p>
            </div>
          </div>

          <label class="checkbox-field">
            <input
              v-model="form.is_default"
              type="checkbox"
              :disabled="isEditingDefault"
            />
            Đặt làm địa chỉ mặc định
          </label>

          <div class="form-actions">
            <button type="submit" class="primary-button" :disabled="submitting">
              {{ submitting ? "Đang lưu..." : "Lưu địa chỉ" }}
            </button>

            <button
              type="button"
              class="secondary-button"
              :disabled="submitting"
              @click="closeForm"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </Teleport>

    <div v-if="loading" class="empty-state" role="status">
      Đang tải địa chỉ...
    </div>

    <div v-else-if="addresses.length === 0" class="empty-state">
      Bạn chưa có địa chỉ nhận hàng.
    </div>

    <div v-else class="address-list">
      <article
        v-for="address in addresses"
        :key="address.address_id"
        class="address-card"
      >
        <div class="address-main">
          <div class="address-title">
            <strong>{{ address.recipient_name }}</strong>
            <span class="separator" />
            <span>{{ address.phone }}</span>

            <span class="type-badge">
              {{ typeLabel(address.type) }}
            </span>

            <span v-if="address.is_default" class="default-badge">
              Mặc định
            </span>
          </div>

          <p>{{ formatLocation(address) }}</p>
        </div>

        <div class="address-actions">
          <div class="address-actions__links">
            <button
              type="button"
              class="text-button"
              @click="openEditForm(address)"
            >
              Sửa
            </button>

            <button
              type="button"
              class="text-button text-button--danger"
              :disabled="actionId === address.address_id"
              @click="deleteAddress(address)"
            >
              Xóa
            </button>
          </div>

          <div class="address-actions__default-slot">
            <button
              v-if="!address.is_default"
              type="button"
              class="secondary-button secondary-button--small"
              :disabled="actionId === address.address_id"
              @click="setDefault(address)"
            >
              Thiết lập mặc định
            </button>
          </div>
        </div>
      </article>
    </div>
  </CustomerContentCard>
</template>

<style scoped lang="scss">
.notice {
  margin-bottom: 20px;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 13px;
}

.notice--success {
  border-color: #b7e4bf;
  background: #edf9ef;
  color: #237a32;
}

.notice--error {
  border-color: #ffc9c4;
  background: #fff1f0;
  color: #b42318;
}

.primary-button,
.secondary-button {
  min-height: 40px;
  padding: 0 16px;
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

.secondary-button {
  border: 1px solid #d0d5dd;
  background: #ffffff;
  color: #344054;
}

.secondary-button:hover:not(:disabled) {
  border-color: #39b54a;
  color: #278c36;
}

.primary-button:disabled,
.secondary-button:disabled,
.text-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.address-modal {
  position: fixed;
  z-index: 1050;
  display: grid;
  overflow-y: auto;
  padding: 24px;
  background: rgb(15 23 42 / 48%);
  inset: 0;
  place-items: center;
}

.address-form {
  width: min(100%, 680px);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  padding: 24px;
  border: 1px solid #dfe5e1;
  border-radius: 4px;
  background: #ffffff;
  box-shadow: 0 12px 32px rgb(15 23 42 / 18%);
}

.form-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.form-heading h2 {
  margin: 0;
  color: #1f2937;
  font-size: 17px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 430px));
  gap: 16px 20px;
}

.field {
  min-width: 0;
}

.field--full {
  grid-column: 1 / -1;
  max-width: 880px;
}

.field label {
  display: block;
  margin-bottom: 7px;
  color: #344054;
  font-size: 13px;
  font-weight: 600;
}

.field-label {
  display: block;
  margin-bottom: 7px;
  color: #344054;
  font-size: 13px;
  font-weight: 600;
}

.form-input {
  width: 100%;
  height: 42px;
  box-sizing: border-box;
  padding: 0 12px;
  border: 1px solid #d0d5dd;
  border-radius: 4px;
  outline: none;
  background: #ffffff;
  color: #1d2939;
  font: inherit;
  font-size: 14px;
}

.form-input:focus {
  border-color: #39b54a;
  box-shadow: 0 0 0 3px rgb(57 181 74 / 10%);
}

.form-input:disabled {
  cursor: not-allowed;
  background: #f2f4f7;
  color: #98a2b3;
}

.form-input.is-invalid {
  border-color: #dc3545;
}

.location-picker {
  position: relative;
}

.location-picker__trigger {
  display: flex;
  width: 100%;
  height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  border: 1px solid #d0d5dd;
  border-radius: 4px;
  background: #ffffff;
  color: #1d2939;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.location-picker__trigger:focus-visible {
  border-color: #39b54a;
  outline: 3px solid rgb(57 181 74 / 10%);
}

.location-picker__trigger:disabled {
  cursor: not-allowed;
  background: #f2f4f7;
  color: #98a2b3;
}

.location-picker__arrow {
  flex: 0 0 auto;
  color: #667085;
}

.location-picker__panel {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  overflow: hidden;
  border: 1px solid #d0d5dd;
  border-radius: 4px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgb(15 23 42 / 12%);
}

.location-picker__tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid #eaecf0;
}

.location-picker__tabs button {
  height: 44px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: #ffffff;
  color: #475467;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.location-picker__tabs button.is-active {
  border-bottom-color: #39b54a;
  color: #278c36;
  font-weight: 600;
}

.location-picker__tabs button:disabled {
  cursor: not-allowed;
  color: #b0b7c3;
}

.location-picker__list {
  display: flex;
  max-height: 240px;
  flex-direction: column;
  overflow-y: auto;
  padding: 6px 0;
}

.location-picker__option {
  flex: 0 0 auto;
  min-height: 40px;
  padding: 8px 14px;
  border: 0;
  background: #ffffff;
  color: #344054;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.location-picker__option:hover,
.location-picker__option.is-selected {
  background: #edf9ef;
  color: #278c36;
}

.location-picker__option.is-selected {
  font-weight: 600;
}

.location-picker__status {
  margin: 0;
  padding: 16px;
  color: #667085;
  font-size: 13px;
  text-align: center;
}

.address-type-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.address-type-button {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid #d0d5dd;
  border-radius: 4px;
  background: #ffffff;
  color: #344054;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.address-type-button:hover,
.address-type-button.is-active {
  border-color: #39b54a;
  color: #278c36;
}

.address-type-button.is-active {
  background: #edf9ef;
  font-weight: 600;
}

.field-error {
  margin: 6px 0 0;
  color: #dc3545;
  font-size: 12px;
}

.location-error {
  margin: 0;
  color: #dc3545;
  font-size: 12px;
}

.checkbox-field {
  display: flex;
  width: fit-content;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  color: #344054;
  font-size: 13px;
  cursor: pointer;
}

.checkbox-field input {
  width: 16px;
  height: 16px;
  accent-color: #39b54a;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.empty-state {
  padding: 56px 16px;
  color: #667085;
  text-align: center;
}

.address-list {
  display: flex;
  flex-direction: column;
}

.address-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 0;
  border-bottom: 1px solid #eaecf0;
}

.address-card:first-child {
  padding-top: 0;
}

.address-main {
  min-width: 0;
}

.address-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: #344054;
  font-size: 14px;
}

.separator {
  width: 1px;
  height: 16px;
  background: #d0d5dd;
}

.address-main p {
  margin: 10px 0 0;
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
}

.type-badge,
.default-badge {
  padding: 3px 7px;
  border-radius: 3px;
  font-size: 12px;
}

.type-badge {
  background: #f2f4f7;
  color: #475467;
}

.default-badge {
  border: 1px solid #39b54a;
  color: #278c36;
}

.address-actions {
  display: flex;
  width: 190px;
  flex: 0 0 190px;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.address-actions__links {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.address-actions__default-slot {
  display: flex;
  min-height: 34px;
  justify-content: flex-end;
}

.text-button {
  padding: 4px;
  border: 0;
  background: transparent;
  color: #278c36;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.text-button:hover {
  color: #0d5c31;
  text-decoration: underline;
}

.text-button--danger {
  color: #dc3545;
}

.secondary-button--small {
  min-height: 34px;
  padding: 0 12px;
  font-size: 12.5px;
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field--full {
    grid-column: auto;
  }

  .address-card {
    flex-direction: column;
  }

  .address-actions {
    width: auto;
    flex-basis: auto;
    align-items: flex-start;
    justify-content: flex-start;
  }

  .address-actions__links,
  .address-actions__default-slot {
    justify-content: flex-start;
  }

  .address-modal {
    padding: 12px;
    place-items: start center;
  }

  .address-form {
    max-height: calc(100vh - 24px);
    padding: 18px;
  }
}
</style>
