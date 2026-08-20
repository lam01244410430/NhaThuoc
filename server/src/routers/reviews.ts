import { Hono } from 'hono'
import { asc, eq } from 'drizzle-orm'

import { createDb } from '../db/client'
import { categories } from '../db/schema'
import type { Bindings } from '../types'

type Env = {
    Bindings: Bindings
}

const reviewsRouter = new Hono<Env>()

export default reviewsRouter