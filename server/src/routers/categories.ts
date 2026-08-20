import { Hono } from 'hono'

import type {
  Bindings,
} from '../types'

type Env = {
  Bindings: Bindings
}

interface CategoryRecord {
  id: number
  name: string
  slug: string
  parent_category_id: number | null
  status: number
}

interface CategoryTreeItem {
  id: number
  name: string
  slug: string
  parent_category_id: number | null
  link: string
  subCategories: CategoryTreeItem[]
}

const categories =
  new Hono<Env>()

categories.get(
  '/',
  async (c) => {
    try {
      const result = await c.env.DB
          .prepare(`
            SELECT
              category_id AS id,
              category_name AS name,
              slug,
              parent_category_id,
              status
            FROM categories
            WHERE status = 1
            ORDER BY
              parent_category_id IS NOT NULL,
              parent_category_id,
              category_id
          `)
          .all<CategoryRecord>()

      return c.json({
        success: true,
        data:
          result.results ?? [],
      })
    } catch (error) {
      console.error(
        'Get categories error:',
        error,
      )

      return c.json(
        {
          success: false,
          message:
            'Không thể tải danh mục',
        },
        500,
      )
    }
  },
)

categories.get(
  '/tree',
  async (c) => {
    try {
      const result =
        await c.env.DB
          .prepare(`
            SELECT
              category_id AS id,
              category_name AS name,
              slug,
              parent_category_id,
              status
            FROM categories
            WHERE status = 1
            ORDER BY category_id
          `)
          .all<CategoryRecord>()

      const rows =
        result.results ?? []

      const map =
        new Map<
          number,
          CategoryTreeItem
        >()

      for (const row of rows) {
        map.set(
          row.id,
          {
            id: row.id,
            name: row.name,
            slug: row.slug,
            parent_category_id:
              row.parent_category_id,
            link:
              `/Category/${row.slug}`,
            subCategories: [],
          },
        )
      }

      const tree:
        CategoryTreeItem[] = []

      for (const row of rows) {
        const current =
          map.get(row.id)

        if (!current) {
          continue
        }

        if (
          row.parent_category_id ===
          null
        ) {
          tree.push(current)
          continue
        }

        const parent =
          map.get(
            row.parent_category_id,
          )

        if (parent) {
          parent.subCategories.push(
            current,
          )
        }
      }

      return c.json({
        success: true,
        data: tree,
      })
    } catch (error) {
      console.error(
        'Get category tree error:',
        error,
      )

      return c.json(
        {
          success: false,
          message:
            'Không thể tải cây danh mục',
        },
        500,
      )
    }
  },
)

export default categories