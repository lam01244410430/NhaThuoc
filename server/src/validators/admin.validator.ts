import { z } from 'zod'
import {
  paginationQuerySchema,
  positiveIdSchema,
} from './common'

export const userRoleSchema = z.enum([
  'customer',
  'shop',
  'admin',
])

export const userStatusSchema = z.enum([
  'pending',
  'active',
  'blocked',
  'deleted',
])

export const adminUserListQuerySchema =
  paginationQuerySchema.extend({
    role:
      userRoleSchema.optional(),

    status:
      userStatusSchema.optional(),
  })

export const updateUserStatusSchema = z.object({
  status: z.enum([
    'active',
    'blocked',
  ]),
})

export const updateUserRoleSchema = z.object({
  role:
    userRoleSchema,
})

export const adminTargetUserParamSchema = z.object({
  id:
    positiveIdSchema,
})
