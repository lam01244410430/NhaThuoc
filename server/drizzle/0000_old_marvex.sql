CREATE TABLE `addresses` (
	`address_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`recipient_name` text NOT NULL,
	`phone` text NOT NULL,
	`province` text,
	`district` text,
	`ward` text,
	`address_detail` text NOT NULL,
	`type` text DEFAULT 'home' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles`(`customer_id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "ck_address_type" CHECK("addresses"."type" IN ('home', 'work', 'school', 'other')),
	CONSTRAINT "ck_address_is_default" CHECK("addresses"."is_default" IN (0, 1)),
	CONSTRAINT "ck_address_recipient" CHECK(length(trim("addresses"."recipient_name")) > 0),
	CONSTRAINT "ck_address_detail" CHECK(length(trim("addresses"."address_detail")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_address_one_default_per_customer` ON `addresses` (`customer_id`) WHERE "addresses"."is_default" = 1;--> statement-breakpoint
CREATE INDEX `idx_address_customer` ON `addresses` (`customer_id`);--> statement-breakpoint
CREATE TABLE `cart_items` (
	`cart_item_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`variant_id` integer,
	`variant_key` integer GENERATED ALWAYS AS (coalesce(variant_id, 0)) STORED,
	`quantity` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles`(`customer_id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`product_id`,`variant_id`) REFERENCES `product_variants`(`product_id`,`variant_id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "ck_cart_quantity" CHECK("cart_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_cart_customer_product_variant` ON `cart_items` (`customer_id`,`product_id`,`variant_key`);--> statement-breakpoint
CREATE INDEX `idx_cart_customer` ON `cart_items` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_cart_product_variant` ON `cart_items` (`product_id`,`variant_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`category_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_name` text NOT NULL,
	`slug` text NOT NULL,
	`parent_category_id` integer,
	`status` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`parent_category_id`) REFERENCES `categories`(`category_id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "ck_categories_name" CHECK(length(trim("categories"."category_name")) > 0),
	CONSTRAINT "ck_categories_status" CHECK("categories"."status" IN (0, 1)),
	CONSTRAINT "ck_categories_no_self_parent" CHECK("categories"."parent_category_id" IS NULL OR "categories"."parent_category_id" <> "categories"."category_id"),
	CONSTRAINT "ck_categories_slug" CHECK("categories"."slug" = lower(trim("categories"."slug"))
        AND length("categories"."slug") > 0
        AND "categories"."slug" NOT GLOB '*[^a-z0-9-]*'
        AND "categories"."slug" NOT LIKE '-%'
        AND "categories"."slug" NOT LIKE '%-'
        AND "categories"."slug" NOT LIKE '%--%')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_categories_slug_ci` ON `categories` (lower("slug"));--> statement-breakpoint
CREATE UNIQUE INDEX `uq_categories_parent_name` ON `categories` (`parent_category_id`,`category_name`);--> statement-breakpoint
CREATE INDEX `idx_categories_parent_status` ON `categories` (`parent_category_id`,`status`);--> statement-breakpoint
CREATE TABLE `customer_profiles` (
	`customer_id` integer PRIMARY KEY NOT NULL,
	`phone` text,
	`date_of_birth` text,
	`gender` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`user_id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "ck_customer_gender" CHECK("customer_profiles"."gender" IS NULL OR "customer_profiles"."gender" IN ('male', 'female', 'other'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_customer_phone` ON `customer_profiles` (`phone`);--> statement-breakpoint
CREATE TABLE `media` (
	`media_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`url` text NOT NULL,
	`type` text DEFAULT 'image' NOT NULL,
	`is_thumbnail` integer DEFAULT false NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "ck_media_url" CHECK(length(trim("media"."url")) > 0),
	CONSTRAINT "ck_media_type" CHECK("media"."type" IN ('image', 'video')),
	CONSTRAINT "ck_media_is_thumbnail" CHECK("media"."is_thumbnail" IN (0, 1)),
	CONSTRAINT "ck_media_priority" CHECK("media"."priority" >= 0),
	CONSTRAINT "ck_media_thumbnail_type" CHECK("media"."is_thumbnail" = 0 OR "media"."type" = 'image')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_media_one_thumbnail_per_product` ON `media` (`product_id`) WHERE "media"."is_thumbnail" = 1;--> statement-breakpoint
CREATE INDEX `idx_media_product_thumbnail` ON `media` (`product_id`,`is_thumbnail`,`priority`);--> statement-breakpoint
CREATE TABLE `oauth_accounts` (
	`oauth_account_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`provider_email` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "ck_oauth_provider" CHECK("oauth_accounts"."provider" IN ('google', 'facebook')),
	CONSTRAINT "ck_oauth_provider_user_id" CHECK(length(trim("oauth_accounts"."provider_user_id")) > 0),
	CONSTRAINT "ck_oauth_provider_email" CHECK("oauth_accounts"."provider_email" IS NULL OR "oauth_accounts"."provider_email" = lower(trim("oauth_accounts"."provider_email")))
);
--> statement-breakpoint
CREATE INDEX `idx_oauth_user` ON `oauth_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_provider_email` ON `oauth_accounts` (`provider`,`provider_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_oauth_provider_identity` ON `oauth_accounts` (`provider`,`provider_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_oauth_user_provider` ON `oauth_accounts` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `option_groups` (
	`group_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_name` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT "ck_option_group_name" CHECK(length(trim("option_groups"."group_name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_option_group_name_ci` ON `option_groups` (lower(trim("group_name")));--> statement-breakpoint
CREATE TABLE `option_values` (
	`value_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`value_name` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `option_groups`(`group_id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "ck_option_value_name" CHECK(length(trim("option_values"."value_name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_option_value_ci` ON `option_values` (`group_id`,lower(trim("value_name")));--> statement-breakpoint
CREATE INDEX `idx_option_values_group` ON `option_values` (`group_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`order_item_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`shop_id` integer NOT NULL,
	`variant_id` integer,
	`variant_key` integer GENERATED ALWAYS AS (coalesce(variant_id, 0)) STORED,
	`product_name` text NOT NULL,
	`variant_name` text,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`line_total` integer GENERATED ALWAYS AS (quantity * unit_price) STORED,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`product_id`,`shop_id`) REFERENCES `products`(`product_id`,`shop_id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`product_id`,`variant_id`) REFERENCES `product_variants`(`product_id`,`variant_id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "ck_order_items_product_name" CHECK(length(trim("order_items"."product_name")) > 0),
	CONSTRAINT "ck_order_items_quantity" CHECK("order_items"."quantity" > 0),
	CONSTRAINT "ck_order_items_unit_price" CHECK("order_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_order_product_variant` ON `order_items` (`order_id`,`product_id`,`variant_key`);--> statement-breakpoint
CREATE INDEX `idx_order_items_order` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_order_items_shop` ON `order_items` (`shop_id`);--> statement-breakpoint
CREATE INDEX `idx_order_items_product_shop` ON `order_items` (`product_id`,`shop_id`);--> statement-breakpoint
CREATE INDEX `idx_order_items_product_variant` ON `order_items` (`product_id`,`variant_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`order_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_code` text NOT NULL,
	`customer_id` integer NOT NULL,
	`order_date` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`subtotal_amount` integer DEFAULT 0 NOT NULL,
	`shipping_fee` integer DEFAULT 0 NOT NULL,
	`discount_amount` integer DEFAULT 0 NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`recipient_name` text NOT NULL,
	`recipient_phone` text NOT NULL,
	`shipping_address` text NOT NULL,
	`note` text,
	`payment_method` text NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`order_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles`(`customer_id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "ck_orders_amounts" CHECK("orders"."subtotal_amount" >= 0
        AND "orders"."shipping_fee" >= 0
        AND "orders"."discount_amount" >= 0
        AND "orders"."total_amount" >= 0),
	CONSTRAINT "ck_orders_total" CHECK("orders"."total_amount" = "orders"."subtotal_amount" + "orders"."shipping_fee" - "orders"."discount_amount"),
	CONSTRAINT "ck_orders_payment_method" CHECK("orders"."payment_method" IN ('COD', 'VNPay', 'Momo', 'BankTransfer')),
	CONSTRAINT "ck_orders_payment_status" CHECK("orders"."payment_status" IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
	CONSTRAINT "ck_orders_order_status" CHECK("orders"."order_status" IN ('pending', 'confirmed', 'processing', 'delivering', 'delivered', 'cancelled', 'completed'))
);
--> statement-breakpoint
CREATE INDEX `idx_orders_customer_date` ON `orders` (`customer_id`,`order_date`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`order_status`,`payment_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_orders_code` ON `orders` (`order_code`);--> statement-breakpoint
CREATE TABLE `product_options` (
	`product_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	PRIMARY KEY(`product_id`, `group_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `option_groups`(`group_id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_product_options_group` ON `product_options` (`group_id`);--> statement-breakpoint
CREATE TABLE `product_variants` (
	`variant_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`price` integer NOT NULL,
	`sale_price` integer,
	`stock_quantity` integer DEFAULT 0 NOT NULL,
	`sku` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "ck_variants_sku" CHECK(length(trim("product_variants"."sku")) > 0),
	CONSTRAINT "ck_variants_price" CHECK("product_variants"."price" >= 0),
	CONSTRAINT "ck_variants_sale_price" CHECK("product_variants"."sale_price" IS NULL OR ("product_variants"."sale_price" >= 0 AND "product_variants"."sale_price" <= "product_variants"."price")),
	CONSTRAINT "ck_variants_stock" CHECK("product_variants"."stock_quantity" >= 0),
	CONSTRAINT "ck_variants_status" CHECK("product_variants"."status" IN ('active', 'inactive', 'out_of_stock'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_variant_sku_ci` ON `product_variants` (lower(trim("sku")));--> statement-breakpoint
CREATE INDEX `idx_variants_product_status` ON `product_variants` (`product_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_variant_product_pair` ON `product_variants` (`product_id`,`variant_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`product_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`price` integer NOT NULL,
	`sale_price` integer,
	`description` text,
	`usage_guide` text,
	`stock_quantity` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`shop_id`) REFERENCES `shop_profiles`(`shop_id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`category_id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "ck_products_name" CHECK(length(trim("products"."name")) > 0),
	CONSTRAINT "ck_products_slug" CHECK("products"."slug" = lower(trim("products"."slug"))
        AND length("products"."slug") > 0
        AND "products"."slug" NOT GLOB '*[^a-z0-9-]*'
        AND "products"."slug" NOT LIKE '-%'
        AND "products"."slug" NOT LIKE '%-'
        AND "products"."slug" NOT LIKE '%--%'),
	CONSTRAINT "ck_products_price" CHECK("products"."price" >= 0),
	CONSTRAINT "ck_products_sale_price" CHECK("products"."sale_price" IS NULL OR ("products"."sale_price" >= 0 AND "products"."sale_price" <= "products"."price")),
	CONSTRAINT "ck_products_stock" CHECK("products"."stock_quantity" >= 0),
	CONSTRAINT "ck_products_status" CHECK("products"."status" IN ('draft', 'active', 'inactive', 'out_of_stock')),
	CONSTRAINT "ck_products_deleted_state" CHECK("products"."deleted_at" IS NULL OR "products"."status" = 'inactive')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_products_slug_ci` ON `products` (lower("slug"));--> statement-breakpoint
CREATE INDEX `idx_products_shop_status_deleted` ON `products` (`shop_id`,`status`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_products_category_status_deleted` ON `products` (`category_id`,`status`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_products_deleted_at` ON `products` (`deleted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_products_product_shop` ON `products` (`product_id`,`shop_id`);--> statement-breakpoint
CREATE TABLE `returns` (
	`return_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_item_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`reason` text NOT NULL,
	`seller_approved` integer DEFAULT false NOT NULL,
	`platform_approved` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`refund_amount` integer DEFAULT 0 NOT NULL,
	`requested_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`processed_at` text,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`order_item_id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "ck_returns_reason" CHECK(length(trim("returns"."reason")) > 0),
	CONSTRAINT "ck_returns_quantity" CHECK("returns"."quantity" > 0),
	CONSTRAINT "ck_returns_refund_amount" CHECK("returns"."refund_amount" >= 0),
	CONSTRAINT "ck_returns_seller_approved" CHECK("returns"."seller_approved" IN (0, 1)),
	CONSTRAINT "ck_returns_platform_approved" CHECK("returns"."platform_approved" IN (0, 1)),
	CONSTRAINT "ck_returns_approval_order" CHECK("returns"."platform_approved" = 0 OR "returns"."seller_approved" = 1),
	CONSTRAINT "ck_returns_status" CHECK("returns"."status" IN ('pending', 'seller_approved', 'platform_approved', 'rejected', 'refunding', 'refunded')),
	CONSTRAINT "ck_returns_processed_at" CHECK("returns"."status" NOT IN ('rejected', 'refunded') OR "returns"."processed_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_return_order_item` ON `returns` (`order_item_id`);--> statement-breakpoint
CREATE INDEX `idx_returns_status_date` ON `returns` (`status`,`requested_at`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`review_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`order_item_id` integer,
	`title` text NOT NULL,
	`comment` text NOT NULL,
	`rating` integer NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles`(`customer_id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`order_item_id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "ck_reviews_title" CHECK(length(trim("reviews"."title")) > 0),
	CONSTRAINT "ck_reviews_comment" CHECK(length(trim("reviews"."comment")) > 0),
	CONSTRAINT "ck_reviews_rating" CHECK("reviews"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "ck_reviews_status" CHECK("reviews"."status" IN ('pending', 'published', 'hidden'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_review_order_item` ON `reviews` (`order_item_id`) WHERE "reviews"."order_item_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_reviews_product_status` ON `reviews` (`product_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_review_customer_product` ON `reviews` (`customer_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `shop_profiles` (
	`shop_id` integer PRIMARY KEY NOT NULL,
	`shop_name` text NOT NULL,
	`phone` text NOT NULL,
	`description` text,
	`rating` real DEFAULT 0 NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`followers` integer DEFAULT 0 NOT NULL,
	`total_products` integer DEFAULT 0 NOT NULL,
	`level` text DEFAULT 'basic' NOT NULL,
	`approval_status` text DEFAULT 'pending' NOT NULL,
	`approved_by` integer,
	`approved_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `users`(`user_id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`user_id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "ck_shop_name" CHECK(length(trim("shop_profiles"."shop_name")) > 0),
	CONSTRAINT "ck_shop_rating" CHECK("shop_profiles"."rating" BETWEEN 0 AND 5),
	CONSTRAINT "ck_shop_rating_count" CHECK("shop_profiles"."rating_count" >= 0),
	CONSTRAINT "ck_shop_followers" CHECK("shop_profiles"."followers" >= 0),
	CONSTRAINT "ck_shop_total_products" CHECK("shop_profiles"."total_products" >= 0),
	CONSTRAINT "ck_shop_level" CHECK("shop_profiles"."level" IN ('basic', 'verified', 'premium')),
	CONSTRAINT "ck_shop_approval_status" CHECK("shop_profiles"."approval_status" IN ('pending', 'approved', 'rejected', 'suspended')),
	CONSTRAINT "ck_shop_approval_state" CHECK((
        "shop_profiles"."approval_status" = 'pending'
        AND "shop_profiles"."approved_by" IS NULL
        AND "shop_profiles"."approved_at" IS NULL
      ) OR (
        "shop_profiles"."approval_status" = 'approved'
        AND "shop_profiles"."approved_by" IS NOT NULL
        AND "shop_profiles"."approved_at" IS NOT NULL
      ) OR (
        "shop_profiles"."approval_status" IN ('rejected', 'suspended')
        AND "shop_profiles"."approved_by" IS NOT NULL
        AND "shop_profiles"."approved_at" IS NULL
      ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_shop_name_ci` ON `shop_profiles` (lower(trim("shop_name")));--> statement-breakpoint
CREATE INDEX `idx_shop_approval_created` ON `shop_profiles` (`approval_status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_shop_level` ON `shop_profiles` (`level`);--> statement-breakpoint
CREATE INDEX `idx_shop_approved_by` ON `shop_profiles` (`approved_by`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_shop_phone` ON `shop_profiles` (`phone`);--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`role` text DEFAULT 'customer' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`avatar` text,
	`email_verified_at` text,
	`last_login_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	CONSTRAINT "ck_users_name" CHECK(length(trim("users"."name")) > 0),
	CONSTRAINT "ck_users_email_normalized" CHECK("users"."email" = lower(trim("users"."email")) AND length("users"."email") > 3),
	CONSTRAINT "ck_users_role" CHECK("users"."role" IN ('customer', 'shop', 'admin')),
	CONSTRAINT "ck_users_status" CHECK("users"."status" IN ('pending', 'active', 'blocked', 'deleted')),
	CONSTRAINT "ck_users_auth_method" CHECK("users"."password" IS NOT NULL OR "users"."email_verified_at" IS NOT NULL),
	CONSTRAINT "ck_users_deleted_state" CHECK((
        "users"."status" = 'deleted'
        AND "users"."deleted_at" IS NOT NULL
      ) OR (
        "users"."status" <> 'deleted'
        AND "users"."deleted_at" IS NULL
      ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_username_ci` ON `users` (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_email_ci` ON `users` (lower("email"));--> statement-breakpoint
CREATE INDEX `idx_users_role_status` ON `users` (`role`,`status`);--> statement-breakpoint
CREATE INDEX `idx_users_deleted_at` ON `users` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `variant_values` (
	`variant_id` integer NOT NULL,
	`value_id` integer NOT NULL,
	PRIMARY KEY(`variant_id`, `value_id`),
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`variant_id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`value_id`) REFERENCES `option_values`(`value_id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_variant_values_value` ON `variant_values` (`value_id`);