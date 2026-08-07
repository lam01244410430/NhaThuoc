import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * D1 uses SQLite semantics. Dates are stored as UTC text in
 * YYYY-MM-DD HH:MM:SS format, which is sortable and compatible with
 * CURRENT_TIMESTAMP / datetime('now').
 */
const currentTimestamp = sql`(CURRENT_TIMESTAMP)`;

export const users = sqliteTable(
  "users",
  {
    userId: integer("user_id").primaryKey({ autoIncrement: true }),
    username: text("username"),
    name: text("name").notNull(),
    email: text("email").notNull(),
    password: text("password"),
    role: text("role", { enum: ["customer", "shop", "admin"] })
      .notNull()
      .default("customer"),
    status: text("status", {
      enum: ["pending", "active", "blocked", "deleted"],
    })
      .notNull()
      .default("active"),
    avatar: text("avatar"),
    emailVerifiedAt: text("email_verified_at"),
    lastLoginAt: text("last_login_at"),
    createdAt: text("created_at").notNull().default(currentTimestamp),
    updatedAt: text("updated_at").notNull().default(currentTimestamp),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("uq_users_username_ci").on(sql`lower(${table.username})`),
    uniqueIndex("uq_users_email_ci").on(sql`lower(${table.email})`),
    check("ck_users_name", sql`length(trim(${table.name})) > 0`),
    check(
      "ck_users_email_normalized",
      sql`${table.email} = lower(trim(${table.email})) AND length(${table.email}) > 3`,
    ),
    check("ck_users_role", sql`${table.role} IN ('customer', 'shop', 'admin')`),
    check(
      "ck_users_status",
      sql`${table.status} IN ('pending', 'active', 'blocked', 'deleted')`,
    ),
    check(
      "ck_users_auth_method",
      sql`${table.password} IS NOT NULL OR ${table.emailVerifiedAt} IS NOT NULL`,
    ),
    check(
      "ck_users_deleted_state",
      sql`(
        ${table.status} = 'deleted'
        AND ${table.deletedAt} IS NOT NULL
      ) OR (
        ${table.status} <> 'deleted'
        AND ${table.deletedAt} IS NULL
      )`,
    ),
    index("idx_users_role_status").on(table.role, table.status),
    index("idx_users_deleted_at").on(table.deletedAt),
  ],
);

export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    oauthAccountId: integer("oauth_account_id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }),
    provider: text("provider", { enum: ["google", "facebook"] }).notNull(),
    providerUserId: text("provider_user_id").notNull(),
    providerEmail: text("provider_email"),
    createdAt: text("created_at").notNull().default(currentTimestamp),
    updatedAt: text("updated_at").notNull().default(currentTimestamp),
  },
  (table) => [
    unique("uq_oauth_provider_identity").on(table.provider, table.providerUserId),
    unique("uq_oauth_user_provider").on(table.userId, table.provider),
    check("ck_oauth_provider", sql`${table.provider} IN ('google', 'facebook')`),
    check("ck_oauth_provider_user_id", sql`length(trim(${table.providerUserId})) > 0`),
    check(
      "ck_oauth_provider_email",
      sql`${table.providerEmail} IS NULL OR ${table.providerEmail} = lower(trim(${table.providerEmail}))`,
    ),
    index("idx_oauth_user").on(table.userId),
    index("idx_oauth_provider_email").on(table.provider, table.providerEmail),
  ],
);

export const customerProfiles = sqliteTable(
  "customer_profiles",
  {
    customerId: integer("customer_id")
      .primaryKey()
      .references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }),
    phone: text("phone"),
    dateOfBirth: text("date_of_birth"),
    gender: text("gender", { enum: ["male", "female", "other"] }),
    createdAt: text("created_at").notNull().default(currentTimestamp),
    updatedAt: text("updated_at").notNull().default(currentTimestamp),
  },
  (table) => [
    unique("uq_customer_phone").on(table.phone),
    check(
      "ck_customer_gender",
      sql`${table.gender} IS NULL OR ${table.gender} IN ('male', 'female', 'other')`,
    ),
  ],
);

export const shopProfiles = sqliteTable(
  "shop_profiles",
  {
    shopId: integer("shop_id")
      .primaryKey()
      .references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }),
    shopName: text("shop_name").notNull(),
    phone: text("phone").notNull(),
    description: text("description"),
    rating: real("rating").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    followers: integer("followers").notNull().default(0),
    totalProducts: integer("total_products").notNull().default(0),
    level: text("level", { enum: ["basic", "verified", "premium"] })
      .notNull()
      .default("basic"),
    approvalStatus: text("approval_status", {
      enum: ["pending", "approved", "rejected", "suspended"],
    })
      .notNull()
      .default("pending"),
    approvedBy: integer("approved_by").references(() => users.userId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    approvedAt: text("approved_at"),
    createdAt: text("created_at").notNull().default(currentTimestamp),
    updatedAt: text("updated_at").notNull().default(currentTimestamp),
  },
  (table) => [
    uniqueIndex("uq_shop_name_ci").on(sql`lower(trim(${table.shopName}))`),
    unique("uq_shop_phone").on(table.phone),
    check("ck_shop_name", sql`length(trim(${table.shopName})) > 0`),
    check("ck_shop_rating", sql`${table.rating} BETWEEN 0 AND 5`),
    check("ck_shop_rating_count", sql`${table.ratingCount} >= 0`),
    check("ck_shop_followers", sql`${table.followers} >= 0`),
    check("ck_shop_total_products", sql`${table.totalProducts} >= 0`),
    check("ck_shop_level", sql`${table.level} IN ('basic', 'verified', 'premium')`),
    check(
      "ck_shop_approval_status",
      sql`${table.approvalStatus} IN ('pending', 'approved', 'rejected', 'suspended')`,
    ),
    check(
      "ck_shop_approval_state",
      sql`(
        ${table.approvalStatus} = 'pending'
        AND ${table.approvedBy} IS NULL
        AND ${table.approvedAt} IS NULL
      ) OR (
        ${table.approvalStatus} = 'approved'
        AND ${table.approvedBy} IS NOT NULL
        AND ${table.approvedAt} IS NOT NULL
      ) OR (
        ${table.approvalStatus} IN ('rejected', 'suspended')
        AND ${table.approvedBy} IS NOT NULL
        AND ${table.approvedAt} IS NULL
      )`,
    ),
    index("idx_shop_approval_created").on(table.approvalStatus, table.createdAt),
    index("idx_shop_level").on(table.level),
    index("idx_shop_approved_by").on(table.approvedBy),
  ],
);

export const addresses = sqliteTable(
  "addresses",
  {
    addressId: integer("address_id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customerProfiles.customerId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    province: text("province"),
    district: text("district"),
    ward: text("ward"),
    addressDetail: text("address_detail").notNull(),
    type: text("type", { enum: ["home", "work", "school", "other"] })
      .notNull()
      .default("home"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(currentTimestamp),
    updatedAt: text("updated_at").notNull().default(currentTimestamp),
  },
  (table) => [
    check("ck_address_type", sql`${table.type} IN ('home', 'work', 'school', 'other')`),
    check("ck_address_is_default", sql`${table.isDefault} IN (0, 1)`),
    check("ck_address_recipient", sql`length(trim(${table.recipientName})) > 0`),
    check("ck_address_detail", sql`length(trim(${table.addressDetail})) > 0`),
    uniqueIndex("uq_address_one_default_per_customer")
      .on(table.customerId)
      .where(sql`${table.isDefault} = 1`),
    index("idx_address_customer").on(table.customerId),
  ],
);

export const categories = sqliteTable(
  "categories",
  {
    categoryId: integer("category_id").primaryKey({ autoIncrement: true }),
    categoryName: text("category_name").notNull(),
    slug: text("slug").notNull(),
    parentCategoryId: integer("parent_category_id"),
    status: integer("status", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(currentTimestamp),
    updatedAt: text("updated_at").notNull().default(currentTimestamp),
  },
  (table) => [
    uniqueIndex("uq_categories_slug_ci").on(sql`lower(${table.slug})`),
    uniqueIndex("uq_categories_parent_name").on(
      table.parentCategoryId,
      table.categoryName
    ),
    foreignKey({
      name: "fk_category_parent",
      columns: [table.parentCategoryId],
      foreignColumns: [table.categoryId],
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    check("ck_categories_name", sql`length(trim(${table.categoryName})) > 0`),
    check("ck_categories_status", sql`${table.status} IN (0, 1)`),
    check(
      "ck_categories_no_self_parent",
      sql`${table.parentCategoryId} IS NULL OR ${table.parentCategoryId} <> ${table.categoryId}`,
    ),
    check(
      "ck_categories_slug",
      sql`${table.slug} = lower(trim(${table.slug}))
        AND length(${table.slug}) > 0
        AND ${table.slug} NOT GLOB '*[^a-z0-9-]*'
        AND ${table.slug} NOT LIKE '-%'
        AND ${table.slug} NOT LIKE '%-'
        AND ${table.slug} NOT LIKE '%--%'`,
    ),
    index("idx_categories_parent_status").on(table.parentCategoryId, table.status),
  ],
);

export const products = sqliteTable(
  "products",
  {
    productId: integer("product_id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id")
      .notNull()
      .references(() => shopProfiles.shopId, { onDelete: "restrict", onUpdate: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.categoryId, { onDelete: "restrict", onUpdate: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    price: integer("price").notNull(),
    salePrice: integer("sale_price"),
    description: text("description"),
    usageGuide: text("usage_guide"),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    status: text("status", { enum: ["draft", "active", "inactive", "out_of_stock"] })
      .notNull()
      .default("draft"),
    createdAt: text("created_at").notNull().default(currentTimestamp),
    updatedAt: text("updated_at").notNull().default(currentTimestamp),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("uq_products_slug_ci").on(sql`lower(${table.slug})`),
    unique("uq_products_product_shop").on(table.productId, table.shopId),
    check("ck_products_name", sql`length(trim(${table.name})) > 0`),
    check(
      "ck_products_slug",
      sql`${table.slug} = lower(trim(${table.slug}))
        AND length(${table.slug}) > 0
        AND ${table.slug} NOT GLOB '*[^a-z0-9-]*'
        AND ${table.slug} NOT LIKE '-%'
        AND ${table.slug} NOT LIKE '%-'
        AND ${table.slug} NOT LIKE '%--%'`,
    ),
    check("ck_products_price", sql`${table.price} >= 0`),
    check(
      "ck_products_sale_price",
      sql`${table.salePrice} IS NULL OR (${table.salePrice} >= 0 AND ${table.salePrice} <= ${table.price})`,
    ),
    check("ck_products_stock", sql`${table.stockQuantity} >= 0`),
    check(
      "ck_products_status",
      sql`${table.status} IN ('draft', 'active', 'inactive', 'out_of_stock')`,
    ),
    check(
      "ck_products_deleted_state",
      sql`${table.deletedAt} IS NULL OR ${table.status} = 'inactive'`,
    ),
    index("idx_products_shop_status_deleted").on(
      table.shopId,
      table.status,
      table.deletedAt,
    ),
    index("idx_products_category_status_deleted").on(
      table.categoryId,
      table.status,
      table.deletedAt,
    ),
    index("idx_products_deleted_at").on(table.deletedAt),
  ],
);

export const media = sqliteTable(
  "media",
  {
    mediaId: integer("media_id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.productId, { onDelete: "cascade", onUpdate: "cascade" }),
    url: text("url").notNull(),
    type: text("type", { enum: ["image", "video"] }).notNull().default("image"),
    isThumbnail: integer("is_thumbnail", { mode: "boolean" }).notNull().default(false),
    priority: integer("priority").notNull().default(0),
    createdAt: text("created_at").notNull().default(currentTimestamp),
  },
  (table) => [
    check("ck_media_url", sql`length(trim(${table.url})) > 0`),
    check("ck_media_type", sql`${table.type} IN ('image', 'video')`),
    check("ck_media_is_thumbnail", sql`${table.isThumbnail} IN (0, 1)`),
    check("ck_media_priority", sql`${table.priority} >= 0`),
    check(
      "ck_media_thumbnail_type",
      sql`${table.isThumbnail} = 0 OR ${table.type} = 'image'`,
    ),
    uniqueIndex("uq_media_one_thumbnail_per_product")
      .on(table.productId)
      .where(sql`${table.isThumbnail} = 1`),
    index("idx_media_product_thumbnail").on(
      table.productId,
      table.isThumbnail,
      table.priority,
    ),
  ],
);

export const optionGroups = sqliteTable(
  "option_groups",
  {
    groupId: integer("group_id").primaryKey({ autoIncrement: true }),
    groupName: text("group_name").notNull(),
    createdAt: text("created_at").notNull().default(currentTimestamp),
  },
  (table) => [
    uniqueIndex("uq_option_group_name_ci").on(sql`lower(trim(${table.groupName}))`),
    check("ck_option_group_name", sql`length(trim(${table.groupName})) > 0`),
  ],
);

export const productOptions = sqliteTable(
  "product_options",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.productId, { onDelete: "cascade", onUpdate: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => optionGroups.groupId, { onDelete: "restrict", onUpdate: "cascade" }),
  },
  (table) => [
    primaryKey({ name: "pk_product_options", columns: [table.productId, table.groupId] }),
    index("idx_product_options_group").on(table.groupId),
  ],
);

export const optionValues = sqliteTable(
  "option_values",
  {
    valueId: integer("value_id").primaryKey({ autoIncrement: true }),
    groupId: integer("group_id")
      .notNull()
      .references(() => optionGroups.groupId, { onDelete: "cascade", onUpdate: "cascade" }),
    valueName: text("value_name").notNull(),
  },
  (table) => [
    uniqueIndex("uq_option_value_ci").on(
      table.groupId,
      sql`lower(trim(${table.valueName}))`,
    ),
    check("ck_option_value_name", sql`length(trim(${table.valueName})) > 0`),
    index("idx_option_values_group").on(table.groupId),
  ],
);

export const productVariants = sqliteTable(
  "product_variants",
  {
    variantId: integer("variant_id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.productId, { onDelete: "cascade", onUpdate: "cascade" }),
    price: integer("price").notNull(),
    salePrice: integer("sale_price"),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    sku: text("sku").notNull(),
    status: text("status", { enum: ["active", "inactive", "out_of_stock"] })
      .notNull()
      .default("active"),
    createdAt: text("created_at").notNull().default(currentTimestamp),
    updatedAt: text("updated_at").notNull().default(currentTimestamp),
  },
  (table) => [
    uniqueIndex("uq_variant_sku_ci").on(sql`lower(trim(${table.sku}))`),
    unique("uq_variant_product_pair").on(table.productId, table.variantId),
    check("ck_variants_sku", sql`length(trim(${table.sku})) > 0`),
    check("ck_variants_price", sql`${table.price} >= 0`),
    check(
      "ck_variants_sale_price",
      sql`${table.salePrice} IS NULL OR (${table.salePrice} >= 0 AND ${table.salePrice} <= ${table.price})`,
    ),
    check("ck_variants_stock", sql`${table.stockQuantity} >= 0`),
    check(
      "ck_variants_status",
      sql`${table.status} IN ('active', 'inactive', 'out_of_stock')`,
    ),
    index("idx_variants_product_status").on(table.productId, table.status),
  ],
);

export const variantValues = sqliteTable(
  "variant_values",
  {
    variantId: integer("variant_id")
      .notNull()
      .references(() => productVariants.variantId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    valueId: integer("value_id")
      .notNull()
      .references(() => optionValues.valueId, { onDelete: "restrict", onUpdate: "cascade" }),
  },
  (table) => [
    primaryKey({ name: "pk_variant_values", columns: [table.variantId, table.valueId] }),
    index("idx_variant_values_value").on(table.valueId),
  ],
);

export const cartItems = sqliteTable(
  "cart_items",
  {
    cartItemId: integer("cart_item_id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customerProfiles.customerId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.productId, { onDelete: "cascade", onUpdate: "cascade" }),
    variantId: integer("variant_id"),
    variantKey: integer("variant_key").generatedAlwaysAs(
      sql`coalesce(variant_id, 0)`,
      { mode: "stored" },
    ),
    quantity: integer("quantity").notNull(),
    createdAt: text("created_at").notNull().default(currentTimestamp),
    updatedAt: text("updated_at").notNull().default(currentTimestamp),
  },
  (table) => [
    uniqueIndex("uq_cart_customer_product_variant").on(
      table.customerId,
      table.productId,
      table.variantKey,
    ),
    foreignKey({
      name: "fk_cart_product_variant",
      columns: [table.productId, table.variantId],
      foreignColumns: [productVariants.productId, productVariants.variantId],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    check("ck_cart_quantity", sql`${table.quantity} > 0`),
    index("idx_cart_customer").on(table.customerId),
    index("idx_cart_product_variant").on(table.productId, table.variantId),
  ],
);

export const orders = sqliteTable(
  "orders",
  {
    orderId: integer("order_id").primaryKey({ autoIncrement: true }),
    orderCode: text("order_code").notNull(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customerProfiles.customerId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    orderDate: text("order_date").notNull().default(currentTimestamp),
    subtotalAmount: integer("subtotal_amount").notNull().default(0),
    shippingFee: integer("shipping_fee").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    totalAmount: integer("total_amount").notNull().default(0),
    recipientName: text("recipient_name").notNull(),
    recipientPhone: text("recipient_phone").notNull(),
    shippingAddress: text("shipping_address").notNull(),
    note: text("note"),
    paymentMethod: text("payment_method", {
      enum: ["COD", "VNPay", "Momo", "BankTransfer"],
    }).notNull(),
    paymentStatus: text("payment_status", {
      enum: ["pending", "paid", "failed", "refunded", "partially_refunded"],
    })
      .notNull()
      .default("pending"),
    orderStatus: text("order_status", {
      enum: [
        "pending",
        "confirmed",
        "processing",
        "delivering",
        "delivered",
        "cancelled",
        "completed",
      ],
    })
      .notNull()
      .default("pending"),
    createdAt: text("created_at").notNull().default(currentTimestamp),
    updatedAt: text("updated_at").notNull().default(currentTimestamp),
  },
  (table) => [
    unique("uq_orders_code").on(table.orderCode),
    check(
      "ck_orders_amounts",
      sql`${table.subtotalAmount} >= 0
        AND ${table.shippingFee} >= 0
        AND ${table.discountAmount} >= 0
        AND ${table.totalAmount} >= 0`,
    ),
    check(
      "ck_orders_total",
      sql`${table.totalAmount} = ${table.subtotalAmount} + ${table.shippingFee} - ${table.discountAmount}`,
    ),
    check(
      "ck_orders_payment_method",
      sql`${table.paymentMethod} IN ('COD', 'VNPay', 'Momo', 'BankTransfer')`,
    ),
    check(
      "ck_orders_payment_status",
      sql`${table.paymentStatus} IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')`,
    ),
    check(
      "ck_orders_order_status",
      sql`${table.orderStatus} IN ('pending', 'confirmed', 'processing', 'delivering', 'delivered', 'cancelled', 'completed')`,
    ),
    index("idx_orders_customer_date").on(table.customerId, table.orderDate),
    index("idx_orders_status").on(table.orderStatus, table.paymentStatus),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    orderItemId: integer("order_item_id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.orderId, { onDelete: "cascade", onUpdate: "cascade" }),
    productId: integer("product_id").notNull(),
    shopId: integer("shop_id").notNull(),
    variantId: integer("variant_id"),
    variantKey: integer("variant_key").generatedAlwaysAs(
      sql`coalesce(variant_id, 0)`,
      { mode: "stored" },
    ),
    productName: text("product_name").notNull(),
    variantName: text("variant_name"),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    lineTotal: integer("line_total").generatedAlwaysAs(
      sql`quantity * unit_price`,
      { mode: "stored" },
    ),
    createdAt: text("created_at").notNull().default(currentTimestamp),
  },
  (table) => [
    uniqueIndex("uq_order_product_variant").on(
      table.orderId,
      table.productId,
      table.variantKey,
    ),
    foreignKey({
      name: "fk_order_item_product_shop",
      columns: [table.productId, table.shopId],
      foreignColumns: [products.productId, products.shopId],
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    foreignKey({
      name: "fk_order_item_product_variant",
      columns: [table.productId, table.variantId],
      foreignColumns: [productVariants.productId, productVariants.variantId],
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    check("ck_order_items_product_name", sql`length(trim(${table.productName})) > 0`),
    check("ck_order_items_quantity", sql`${table.quantity} > 0`),
    check("ck_order_items_unit_price", sql`${table.unitPrice} >= 0`),
    index("idx_order_items_order").on(table.orderId),
    index("idx_order_items_shop").on(table.shopId),
    index("idx_order_items_product_shop").on(table.productId, table.shopId),
    index("idx_order_items_product_variant").on(table.productId, table.variantId),
  ],
);

export const reviews = sqliteTable(
  "reviews",
  {
    reviewId: integer("review_id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customerProfiles.customerId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.productId, { onDelete: "cascade", onUpdate: "cascade" }),
    orderItemId: integer("order_item_id").references(() => orderItems.orderItemId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: text("title").notNull(),
    comment: text("comment").notNull(),
    rating: integer("rating").notNull(),
    status: text("status", { enum: ["pending", "published", "hidden"] })
      .notNull()
      .default("published"),
    createdAt: text("created_at").notNull().default(currentTimestamp),
    updatedAt: text("updated_at").notNull().default(currentTimestamp),
  },
  (table) => [
    unique("uq_review_customer_product").on(table.customerId, table.productId),
    uniqueIndex("uq_review_order_item")
      .on(table.orderItemId)
      .where(sql`${table.orderItemId} IS NOT NULL`),
    check("ck_reviews_title", sql`length(trim(${table.title})) > 0`),
    check("ck_reviews_comment", sql`length(trim(${table.comment})) > 0`),
    check("ck_reviews_rating", sql`${table.rating} BETWEEN 1 AND 5`),
    check(
      "ck_reviews_status",
      sql`${table.status} IN ('pending', 'published', 'hidden')`,
    ),
    index("idx_reviews_product_status").on(table.productId, table.status),
  ],
);

export const returns = sqliteTable(
  "returns",
  {
    returnId: integer("return_id").primaryKey({ autoIncrement: true }),
    orderItemId: integer("order_item_id")
      .notNull()
      .unique("uq_return_order_item")
      .references(() => orderItems.orderItemId, { onDelete: "restrict", onUpdate: "cascade" }),
    quantity: integer("quantity").notNull(),
    reason: text("reason").notNull(),
    sellerApproved: integer("seller_approved", { mode: "boolean" }).notNull().default(false),
    platformApproved: integer("platform_approved", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status", {
      enum: [
        "pending",
        "seller_approved",
        "platform_approved",
        "rejected",
        "refunding",
        "refunded",
      ],
    })
      .notNull()
      .default("pending"),
    refundAmount: integer("refund_amount").notNull().default(0),
    requestedAt: text("requested_at").notNull().default(currentTimestamp),
    processedAt: text("processed_at"),
  },
  (table) => [
    check("ck_returns_reason", sql`length(trim(${table.reason})) > 0`),
    check("ck_returns_quantity", sql`${table.quantity} > 0`),
    check("ck_returns_refund_amount", sql`${table.refundAmount} >= 0`),
    check("ck_returns_seller_approved", sql`${table.sellerApproved} IN (0, 1)`),
    check("ck_returns_platform_approved", sql`${table.platformApproved} IN (0, 1)`),
    check(
      "ck_returns_approval_order",
      sql`${table.platformApproved} = 0 OR ${table.sellerApproved} = 1`,
    ),
    check(
      "ck_returns_status",
      sql`${table.status} IN ('pending', 'seller_approved', 'platform_approved', 'rejected', 'refunding', 'refunded')`,
    ),
    check(
      "ck_returns_processed_at",
      sql`${table.status} NOT IN ('rejected', 'refunded') OR ${table.processedAt} IS NOT NULL`,
    ),
    index("idx_returns_status_date").on(table.status, table.requestedAt),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert;
export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type NewCustomerProfile = typeof customerProfiles.$inferInsert;
export type ShopProfile = typeof shopProfiles.$inferSelect;
export type NewShopProfile = typeof shopProfiles.$inferInsert;
export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type OptionGroup = typeof optionGroups.$inferSelect;
export type NewOptionGroup = typeof optionGroups.$inferInsert;
export type ProductOption = typeof productOptions.$inferSelect;
export type NewProductOption = typeof productOptions.$inferInsert;
export type OptionValue = typeof optionValues.$inferSelect;
export type NewOptionValue = typeof optionValues.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type VariantValue = typeof variantValues.$inferSelect;
export type NewVariantValue = typeof variantValues.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type ReturnRequest = typeof returns.$inferSelect;
export type NewReturnRequest = typeof returns.$inferInsert;