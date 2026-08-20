import apiClient from './api'

export type OtpPurpose = 'change_password' | 'change_email' | 'change_phone'
export type AddressType = 'home' | 'work' | 'school' | 'other'

export interface ApiResponse<T = undefined>{
    success: boolean
    message: string
    data?: T
    errors?: Record<string, string[] | undefined>
}

export interface CustomerProfile {
    id: number
    username: string | null
    name: string
    email: string
    phone: string | null
    date_of_birth: string | null
    avatar: string | null
    email_verified_at: string | null
}

export interface UpdateProfilePayload {
    name: string
}

export type RequestOtpPayload =
    | { type: 'change_password' }
    | {
        type: 'change_email' | 'change_phone'
        target_value: string
      }

export interface ChangePasswordPayload {
    current_password: string
    new_password: string
    confirm_password: string
    otp: string
}

export interface ChangeEmailPayload {
    new_email: string
    current_password?: string
    otp: string
}

export interface ChangePhonePayload {
    new_phone: string
    otp: string
}

export interface CustomerAddress {
    address_id: number
    customer_id: number
    recipient_name: string
    phone: string
    province: string | null
    district: string | null
    ward: string | null
    address_detail: string
    type: AddressType
    is_default: boolean
    created_at: string
    updated_at: string
}

export interface AddressPayload {
    recipient_name: string
    phone: string
    province: string | null
    district: string | null
    ward: string | null
    address_detail: string
    type: AddressType
    is_default: boolean
}

function requireData<T> (response: ApiResponse<T>, fallbackMessage: string): T {
    if (!response.data) throw new Error(fallbackMessage)
    return response.data
}

async function getProfile(): Promise<CustomerProfile>{
    const response = await apiClient.get<ApiResponse<CustomerProfile>>
        ('/user/me/profile')
    return requireData(response.data, 'Backend không trả về dữ liệu hồ sơ')
}

async function updateProfile(
    payload: UpdateProfilePayload
): Promise<ApiResponse<CustomerProfile>> {
    const response = await apiClient.patch<ApiResponse<CustomerProfile>>(
        '/user/me/profile',
        {
            name: payload.name.trim()
        }
    )
    return response.data
}

async function requestOtp(
    payload: RequestOtpPayload
): Promise<ApiResponse> {
    const body: RequestOtpPayload =
        payload.type === 'change_password'
            ? payload
            : {
                type: payload.type,
                target_value: payload.target_value.trim()
              }

    const response = await apiClient.post<ApiResponse>(
        '/user/me/otp',
        body
    )
    return response.data
}

async function changePassword(
    payload: ChangePasswordPayload
): Promise<ApiResponse> {
    const response = await apiClient.put<ApiResponse>(
        '/user/me/password',
        payload
    )
    return response.data
}

async function changePhone(
    payload: ChangePhonePayload
): Promise<ApiResponse> {
    const response = await apiClient.put<ApiResponse>(
        '/user/me/phone',
        {
            new_phone: payload.new_phone.trim(),
            otp: payload.otp.trim()
        }
    )
    return response.data
}

async function changeEmail(
    payload: ChangeEmailPayload
): Promise<ApiResponse> {
    const response = await apiClient.put<ApiResponse>(
        '/user/me/email',
        {
            new_email: payload.new_email.trim().toLowerCase(),
            current_password: payload.current_password,
            otp: payload.otp.trim()
        },
    )
    return response.data
}

async function getAddresses(): Promise<CustomerAddress[]> {
    const response = await apiClient.get<ApiResponse<CustomerAddress[]>>(
        '/address/me'
    )
    return response.data.data ?? []
}

async function createAddress(
    payload: AddressPayload
): Promise<ApiResponse<CustomerAddress>> {
    const response = await apiClient.post<ApiResponse<CustomerAddress>>(
        '/address/me', 
        payload
    )
    return response.data
}


async function updateAddress(
    addressId: number,
    payload: Partial<AddressPayload>
): Promise<ApiResponse<CustomerAddress>> {
    const response = await apiClient.put<ApiResponse<CustomerAddress>>(
        `/address/me/${addressId}`,
        payload
    )
    return response.data
}

async function setDefaultAddress(
    addressId: number
): Promise<ApiResponse> {
    const response = await apiClient.patch<ApiResponse>(
        `/address/me/${addressId}/default`
    )
    return response.data
}

async function deleteAddress(
    addressId: number
): Promise<ApiResponse> {
    const response = await apiClient.delete<ApiResponse>(
        `/address/me/${addressId}`
    )
    return response.data
}

export const customerAccountService = {
  getProfile,
  updateProfile,
  requestOtp,
  changePassword,
  changePhone,
  changeEmail,
  getAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
}
