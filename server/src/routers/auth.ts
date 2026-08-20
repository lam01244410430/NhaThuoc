import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { sign, verify } from 'hono/jwt'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { zValidator } from '@hono/zod-validator'
import type { D1Database } from '@cloudflare/workers-types'
import { drizzle } from 'drizzle-orm/d1'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { users, customerProfiles, oauthAccounts } from '../db/schema'
import { loginSchema, oauthCallbackSchema, registerSchema } from '../validators/auth.validator'

type UserRole = 'customer' | 'admin' | 'shop'
type UserStatus = 'pending' | 'active' | 'blocked' | 'deleted'
type OAuthProvider = 'google' | 'facebook'

type Env = {
  Bindings: {
    DB: D1Database
    JWT_SECRET: string

    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string

    FACEBOOK_APP_ID: string
    FACEBOOK_APP_SECRET: string
    FACEBOOK_GRAPH_VERSION?: string

    API_BASE_URL: string
    FRONTEND_URL: string
  }
}

interface DatabaseUser {
  id: number
  username: string | null
  name: string
  email: string
  password: string | null
  role: UserRole
  status: UserStatus
}

interface OAuthTokenResponse {
  access_token?: string
  error_description?: string
  error?: {
    message?: string
  }
}

interface OAuthUserResponse {
  id?: string
  email?: string
  name?: string
}

interface OAuthProfile {
  provider: OAuthProvider
  providerUserID: string
  email: string
  name: string
}

interface JwtPayLoad {
  sub?: string
  role?: UserRole
  email?: string
  name?: string
  exp?: number
}

const auth = new Hono<Env>()

const getJwtSecret = (env: Env['Bindings']): string => {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET chưa được cấu hình')
  }
  return env.JWT_SECRET
}

const getGoogleCallbackUrl = (env: Env['Bindings']): string => {
  return `${env.API_BASE_URL}/api/auth/google/callback`
}

const getFacebookCallbackUrl = (env: Env['Bindings']): string => {
  return `${env.API_BASE_URL}/api/auth/facebook/callback`
}

const createJwt = async (
  env: Env['Bindings'],
  user: DatabaseUser
): Promise<string> => {
  const now = Math.floor(Date.now() / 1000)

  return sign(
    {
      sub: String(user.id),
      role: user.role,
      email: user.email,
      name: user.name,
      iat: now,
      exp: now + 60 * 60 * 24 * 7
    },
    getJwtSecret(env),
    'HS256'
  )
}

const publicUser = (user: DatabaseUser) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  email: user.email,
  role: user.role
})

const getBearerToken = (authorization?: string): string | null => {
  if (!authorization?.startsWith('Bearer ')) {
    return null
  }
  return authorization.slice(7).trim() || null
}

const getUserById = async (
  DB: D1Database,
  userId: number
): Promise<DatabaseUser | null> => {
  const db = drizzle(DB)

  const [user] = await db
    .select({
      id: users.userId,
      username: users.username,
      name: users.name,
      email: users.email,
      password: users.password,
      role: users.role,
      status: users.status
    })
    .from(users)
    .where(
      and(
        eq(users.userId, userId),
        isNull(users.deletedAt)
      )
    )
    .limit(1)

  return user ?? null
}

const getUserByIdentity = async (
  DB: D1Database,
  identity: string
): Promise<DatabaseUser | null> => {
  const db = drizzle(DB)

  const [user] = await db
    .select({
      id: users.userId,
      username: users.username,
      name: users.name,
      email: users.email,
      password: users.password,
      role: users.role,
      status: users.status
    })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        or(
          sql`lower(${users.email}) = ${identity}`,
          sql`lower(${users.username}) = ${identity}`
        )
      )
    )
    .limit(1)

  return user ?? null
}

const getOAthUser = async (
  DB: D1Database,
  provider: OAuthProvider,
  providerUserId: string
): Promise<DatabaseUser | null> => {
  const db = drizzle(DB)

  const [user] = await db
    .select({
      id: users.userId,
      username: users.username,
      name: users.name,
      email: users.email,
      password: users.password,
      role: users.role,
      status: users.status
    })
    .from(oauthAccounts)
    .innerJoin(users, eq(users.userId, oauthAccounts.userId))
    .where(
      and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerUserId, providerUserId),
        isNull(users.deletedAt)
      )
    )
    .limit(1)

  return user ?? null
}

const findOrCreateOAuthUser = async (
  DB: D1Database,
  profile: OAuthProfile
): Promise<DatabaseUser> => {
  const db = drizzle(DB)
  const normalizedEmail = profile.email.trim().toLowerCase()

  const linkedUser = await getOAthUser(
    DB,
    profile.provider,
    profile.providerUserID
  )

  if (linkedUser) {
    return linkedUser
  }

  const [existingUser] = await db
    .select({
      id: users.userId,
      username: users.username,
      name: users.name,
      email: users.email,
      password: users.password,
      role: users.role,
      status: users.status
    })
    .from(users)
    .where(
      and(
        sql`lower(${users.email}) = ${normalizedEmail}`,
        isNull(users.deletedAt)
      )
    )
    .limit(1)

  if (existingUser) {
    if (existingUser.role !== 'customer') {
      throw new Error(
        'Email này thuộc tài khoản admin hoặc shop và không thể tự động liên kết OAuth'
      )
    }

    await db.insert(oauthAccounts).values({
      userId: existingUser.id,
      provider: profile.provider,
      providerUserId: profile.providerUserID,
      providerEmail: normalizedEmail
    })

    return existingUser
  }

  const [insertedUser] = await db
    .insert(users)
    .values({
      username: null,
      name: profile.name.trim(),
      email: normalizedEmail,
      password: null,
      role: 'customer',
      status: 'active',
      emailVerifiedAt: sql`CURRENT_TIMESTAMP`
    })
    .returning({ userId: users.userId })

  if (!insertedUser) {
    throw new Error('Không thể tạo tài khoản OAuth')
  }

  try {
    await db.insert(customerProfiles).values({
      customerId: insertedUser.userId,
      phone: null
    })

    await db.insert(oauthAccounts).values({
      userId: insertedUser.userId,
      provider: profile.provider,
      providerUserId: profile.providerUserID,
      providerEmail: normalizedEmail
    })
  } catch (error) {
    await db
      .delete(users)
      .where(eq(users.userId, insertedUser.userId))

    throw error
  }

  const createdUser = await getUserById(DB, insertedUser.userId)
  if (!createdUser) {
    throw new Error('Không thể đọc tài khoản OAuth vừa tạo')
  }

  return createdUser
}

// REGISTER

auth.post(
  '/register',
  zValidator('json', registerSchema),
  async (c) => {
    try {
      const { username, name, email, phone, password } = c.req.valid('json')
      const db = drizzle(c.env.DB)

      const [existingUser] = await db
        .select({ userId: users.userId })
        .from(users)
        .where(
          or(
            sql`lower(${users.email}) = ${email}`,
            sql`lower(${users.username}) = ${username}`
          )
        )
        .limit(1)

      if (existingUser) {
        return c.json(
          {
            success: false,
            message: 'Email hoặc username đã được sử dụng'
          },
          409
        )
      }

      if (phone) {
        const [existingPhone] = await db
          .select({ customerId: customerProfiles.customerId })
          .from(customerProfiles)
          .where(eq(customerProfiles.phone, phone))
          .limit(1)

        if (existingPhone) {
          return c.json(
            {
              success: false,
              message: 'Số điện thoại đã được sử dụng'
            },
            409
          )
        }
      }

      // Bắt buộc lưu hashedPassword, không lưu password gốc.
      const hashedPassword = await bcrypt.hash(password, 10)

      const [insertedUser] = await db
        .insert(users)
        .values({
          username,
          name,
          email,
          password: hashedPassword,
          role: 'customer',
          status: 'active'
        })
        .returning({ userId: users.userId })

      if (!insertedUser) {
        throw new Error('Không thể tạo tài khoản')
      }

      try {
        await db.insert(customerProfiles).values({
          customerId: insertedUser.userId,
          phone: phone ?? null
        })
      } catch (error) {
        await db
          .delete(users)
          .where(eq(users.userId, insertedUser.userId))

        throw error
      }

      return c.json(
        {
          success: true,
          message: 'Đăng ký tài khoản thành công'
        },
        201
      )
    } catch (error: unknown) {
      console.error('Register error: ', error)
      return c.json(
        {
          success: false,
          message: 'Không thể đăng ký tài khoản'
        },
        500
      )
    }
  }
)

// LOGIN

auth.post(
  '/login',
  zValidator('json', loginSchema),
  async (c) => {
    try {
      const { identity, password } = c.req.valid('json')
      const user = await getUserByIdentity(c.env.DB, identity)

      if (!user) {
        return c.json(
          {
            success: false,
            message: 'Tài khoản hoặc mật khẩu không chính xác'
          },
          401
        )
      }

      if (user.status !== 'active') {
        const message: Record<UserStatus, string> = {
          active: '',
          pending: 'Tài khoản đang chờ kích hoạt',
          blocked: 'Tài khoản đã bị khoá',
          deleted: 'Tài khoản không còn tồn tại'
        }

        return c.json(
          {
            success: false,
            message: message[user.status]
          },
          403
        )
      }

      if (!user.password) {
        return c.json(
          {
            success: false,
            message: 'Tài khoản hoặc mật khẩu không chính xác'
          },
          400
        )
      }

      const passwordValid = await bcrypt.compare(password, user.password)
      if (!passwordValid) {
        return c.json(
          {
            success: false,
            message: 'Tài khoản hoặc mật khẩu không chính xác'
          },
          401
        )
      }

      const token = await createJwt(c.env, user)
      const db = drizzle(c.env.DB)

      await db
        .update(users)
        .set({
          lastLoginAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(users.userId, user.id))

      return c.json({
        success: true,
        message: 'Đăng nhập thành công',
        data: {
          token,
          user: publicUser(user)
        }
      })
    } catch (error: unknown) {
      console.error('Login error: ', error)
      return c.json(
        {
          success: false,
          message: 'Không thể đăng nhập'
        },
        500
      )
    }
  }
)

// GET me

auth.get('/me', async (c) => {
  try {
    const token = getBearerToken(c.req.header('Authorization'))
    if (!token) {
      return c.json(
        {
          success: false,
          message: 'Bạn chưa đăng nhập'
        },
        401
      )
    }

    const payload = await verify(
      token,
      getJwtSecret(c.env),
      'HS256'
    ) as JwtPayLoad

    const userId = Number(payload.sub)
    if (!Number.isInteger(userId) || userId <= 0) {
      return c.json(
        {
          success: false,
          message: 'Token không hợp lệ'
        },
        401
      )
    }

    const user = await getUserById(c.env.DB, userId)
    if (!user || user.status !== 'active') {
      return c.json(
        {
          success: false,
          message: 'Tài khoản không còn hoạt động'
        },
        401
      )
    }

    return c.json({
      success: true,
      data: {
        user: publicUser(user)
      }
    })
  } catch (error) {
    console.error('Get me error: ', error)
    return c.json(
      {
        success: false,
        message: 'Token không hợp lệ hoặc đã hết hạn'
      },
      401
    )
  }
})

// Google OAuth
auth.get('/google', (c) => {
  const state = crypto.randomUUID()

  setCookie(c, 'google_oauth_state', state, {
    httpOnly: true,
    secure: c.env.API_BASE_URL.startsWith('https://'),
    sameSite: 'Lax',
    maxAge: 600,
    path: '/'
  })

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: getGoogleCallbackUrl(c.env),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state
  })

  return c.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
})

auth.get(
  '/google/callback',
  zValidator('query', oauthCallbackSchema),
  async (c) => {
    try {
      const { code, state } = c.req.valid('query')
      const cookieState = getCookie(c, 'google_oauth_state')

      deleteCookie(c, 'google_oauth_state', { path: '/' })

      if (!cookieState || cookieState !== state) {
        throw new Error('OAuth state không hợp lệ')
      }

      const tokenResponse = await fetch(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            code,
            client_id: c.env.GOOGLE_CLIENT_ID,
            client_secret: c.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: getGoogleCallbackUrl(c.env),
            grant_type: 'authorization_code'
          })
        }
      )

      const tokenData = await tokenResponse.json() as OAuthTokenResponse
      if (!tokenResponse.ok || !tokenData.access_token) {
        throw new Error(
          tokenData.error_description ||
          'Không thể lấy Google access token'
        )
      }

      const userResponse = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`
          }
        }
      )

      const googleUser = await userResponse.json() as OAuthUserResponse
      if (
        !userResponse.ok ||
        !googleUser.id ||
        !googleUser.name ||
        !googleUser.email
      ) {
        throw new Error(
          'Google không trả về đầy đủ thông tin tài khoản'
        )
      }

      const user = await findOrCreateOAuthUser(
        c.env.DB,
        {
          provider: 'google',
          providerUserID: googleUser.id,
          email: googleUser.email.toLowerCase(),
          name: googleUser.name
        }
      )

      if (user.status !== 'active') {
        throw new Error('Tài khoản không đăng nhập được')
      }

      const token = await createJwt(c.env, user)
      const db = drizzle(c.env.DB)

      await db
        .update(users)
        .set({
          lastLoginAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(users.userId, user.id))

      return c.redirect(
        `${c.env.FRONTEND_URL}/oauth/callback?token=${encodeURIComponent(token)}`
      )
    } catch (error: unknown) {
      console.error('Google OAuth error: ', error)
      const message = error instanceof Error
        ? error.message
        : 'Đăng nhập Google thất bại'

      return c.redirect(
        `${c.env.FRONTEND_URL}/login?oauthError=${encodeURIComponent(message)}`
      )
    }
  }
)

// Facebook OAuth
auth.get('/facebook', (c) => {
  const state = crypto.randomUUID()

  setCookie(c, 'facebook_oauth_state', state, {
    httpOnly: true,
    secure: c.env.API_BASE_URL.startsWith('https://'),
    sameSite: 'Lax',
    maxAge: 600,
    path: '/'
  })

  const graphVersion = c.env.FACEBOOK_GRAPH_VERSION || 'v23.0'

  const params = new URLSearchParams({
    client_id: c.env.FACEBOOK_APP_ID,
    redirect_uri: getFacebookCallbackUrl(c.env),
    response_type: 'code',
    scope: 'email,public_profile',
    state
  })

  return c.redirect(
    `https://www.facebook.com/${graphVersion}/dialog/oauth?${params.toString()}`
  )
})

auth.get(
  '/facebook/callback',
  zValidator('query', oauthCallbackSchema),
  async (c) => {
    try {
      const { code, state } = c.req.valid('query')

      const cookieState = getCookie(c, 'facebook_oauth_state')

      deleteCookie(c, 'facebook_oauth_state', {
        path: '/'
      })

      if (!cookieState || cookieState !== state) {
        throw new Error('OAuth state không hợp lệ')
      }

      const graphVersion = c.env.FACEBOOK_GRAPH_VERSION || 'v23.0'

      const tokenParams = new URLSearchParams({
        client_id: c.env.FACEBOOK_APP_ID,
        client_secret: c.env.FACEBOOK_APP_SECRET,
        redirect_uri: getFacebookCallbackUrl(c.env),
        code
      })

      const tokenResponse = await fetch(
        `https://graph.facebook.com/${graphVersion}/oauth/access_token?${tokenParams.toString()}`
      )

      const tokenData = await tokenResponse.json() as OAuthTokenResponse

      if (!tokenResponse.ok || !tokenData.access_token) {
        throw new Error(
          tokenData.error?.message ||
          'Không thể lấy Facebook access token'
        )
      }

      const userParams = new URLSearchParams({
        fields: 'id,name,email',
        access_token: tokenData.access_token
      })

      const userResponse = await fetch(
        `https://graph.facebook.com/${graphVersion}/me?${userParams.toString()}`
      )

      const facebookUser = await userResponse.json() as OAuthUserResponse

      if (
        !userResponse.ok ||
        !facebookUser.id ||
        !facebookUser.name
      ) {
        throw new Error(
          'Facebook không trả về đầy đủ thông tin tài khoản'
        )
      }

      if (!facebookUser.email) {
        throw new Error(
          'Tài khoản Facebook không cung cấp email'
        )
      }

      const user = await findOrCreateOAuthUser(
        c.env.DB,
        {
          provider: 'facebook',
          providerUserID: facebookUser.id,
          email: facebookUser.email.toLowerCase(),
          name: facebookUser.name
        }
      )

      if (user.status !== 'active') {
        throw new Error(
          'Tài khoản không được phép đăng nhập'
        )
      }

      const token = await createJwt(c.env, user)
      const db = drizzle(c.env.DB)

      await db
        .update(users)
        .set({
          lastLoginAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(users.userId, user.id))

      return c.redirect(
        `${c.env.FRONTEND_URL}/oauth/callback?token=${encodeURIComponent(token)}`
      )
    } catch (error: unknown) {
      console.error('Facebook OAuth error:', error)

      const message = error instanceof Error
        ? error.message
        : 'Đăng nhập Facebook thất bại'

      return c.redirect(`${c.env.FRONTEND_URL}/login?oauthError=${encodeURIComponent(message)}`)
    }
  }
)

export default auth