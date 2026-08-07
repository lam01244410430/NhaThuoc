DROP DATABASE IF EXISTS ecommerce_db;
CREATE DATABASE ecommerce_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE ecommerce_db;
SET NAMES utf8mb4;
SET time_zone = '+07:00';

CREATE TABLE users (
    user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(191) NOT NULL,
    password VARCHAR(255) NULL COMMENT 'NULL nếu tài khoản chỉ đăng nhập OAuth',
    role ENUM('customer', 'shop', 'admin') NOT NULL DEFAULT 'customer',
    status ENUM('pending', 'active', 'blocked', 'deleted') NOT NULL DEFAULT 'active',
    avatar VARCHAR(500) NULL,
    email_verified_at DATETIME NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email UNIQUE (email),

    INDEX idx_users_role_status (role, status),
    INDEX idx_users_deleted_at (deleted_at)
) ENGINE=InnoDB;

CREATE TABLE oauth_accounts (
    oauth_account_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    provider ENUM('google', 'facebook') NOT NULL,
    provider_user_id VARCHAR(191) NOT NULL,
    provider_email VARCHAR(191) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_oauth_provider_identity
        UNIQUE (provider, provider_user_id),
    CONSTRAINT uq_oauth_user_provider
        UNIQUE (user_id, provider),

    CONSTRAINT fk_oauth_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_oauth_user (user_id),
    INDEX idx_oauth_provider_email (provider, provider_email)
) ENGINE=InnoDB;


CREATE TABLE customer_profiles (
    customer_id INT UNSIGNED PRIMARY KEY,
    phone VARCHAR(20) NULL,
    date_of_birth DATE NULL,
    gender ENUM('male', 'female', 'other') NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_customer_phone UNIQUE (phone),

    CONSTRAINT fk_customer_user
        FOREIGN KEY (customer_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE shop_profiles (
    shop_id INT UNSIGNED PRIMARY KEY,
    shop_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    description TEXT NULL,
    rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    rating_count INT UNSIGNED NOT NULL DEFAULT 0,
    followers BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_products BIGINT UNSIGNED NOT NULL DEFAULT 0,
    level ENUM('basic', 'verified', 'premium') NOT NULL DEFAULT 'basic',
    approval_status ENUM('pending', 'approved', 'rejected', 'suspended')
        NOT NULL DEFAULT 'pending',
    approved_by INT UNSIGNED NULL,
    approved_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_shop_name UNIQUE (shop_name),
    CONSTRAINT uq_shop_phone UNIQUE (phone),

    CONSTRAINT fk_shop_user
        FOREIGN KEY (shop_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_shop_approved_by
        FOREIGN KEY (approved_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    INDEX idx_shop_approval_status (approval_status),
    INDEX idx_shop_level (level)
) ENGINE=InnoDB;

CREATE TABLE addresses (
    address_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id INT UNSIGNED NOT NULL,
    recipient_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    province VARCHAR(100) NULL,
    district VARCHAR(100) NULL,
    ward VARCHAR(100) NULL,
    address_detail VARCHAR(500) NOT NULL,
    type ENUM('home', 'work', 'school', 'other') NOT NULL DEFAULT 'home',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_address_customer
        FOREIGN KEY (customer_id)
        REFERENCES customer_profiles(customer_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_address_customer (customer_id),
    INDEX idx_address_customer_default (customer_id, is_default)
) ENGINE=InnoDB;

CREATE TABLE categories (
    category_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    parent_category_id INT UNSIGNED NULL,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_categories_slug UNIQUE (slug),
    CONSTRAINT uq_categories_parent_name
        UNIQUE (parent_category_id, category_name),

    CONSTRAINT fk_category_parent
        FOREIGN KEY (parent_category_id)
        REFERENCES categories(category_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_categories_parent_status (parent_category_id, status)
) ENGINE=InnoDB;

CREATE TABLE products (
    product_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    shop_id INT UNSIGNED NOT NULL,
    category_id INT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL,
    price DECIMAL(12,0) NOT NULL,
    sale_price DECIMAL(12,0) NULL,
    description TEXT NULL,
    usage_guide TEXT NULL,
    stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('draft', 'active', 'inactive', 'out_of_stock') NOT NULL DEFAULT 'draft',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    CONSTRAINT uq_products_slug
    UNIQUE (slug),
  
    CONSTRAINT uq_products_product_shop
    UNIQUE (product_id, shop_id),

    CONSTRAINT fk_product_shop
    FOREIGN KEY (shop_id)
    REFERENCES shop_profiles(shop_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

    CONSTRAINT fk_product_category
    FOREIGN KEY (category_id)
    REFERENCES categories(category_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

INDEX idx_products_shop_status (
    shop_id,
    status
),

INDEX idx_products_category_status (
    category_id,
    status
)
) ENGINE=InnoDB;

CREATE TABLE media (
    media_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    url VARCHAR(500) NOT NULL,
    type ENUM('image', 'video') NOT NULL DEFAULT 'image',
    is_thumbnail BOOLEAN NOT NULL DEFAULT FALSE,
    priority INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_media_product
        FOREIGN KEY (product_id)
        REFERENCES products(product_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_media_product_thumbnail
        (product_id, is_thumbnail, priority)
) ENGINE=InnoDB;

CREATE TABLE option_groups (
    group_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    group_name VARCHAR(50) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_option_group_name UNIQUE (group_name)
) ENGINE=InnoDB;

CREATE TABLE product_options (
    product_id INT UNSIGNED NOT NULL,
    group_id INT UNSIGNED NOT NULL,

    PRIMARY KEY (product_id, group_id),

    CONSTRAINT fk_product_option_product
        FOREIGN KEY (product_id)
        REFERENCES products(product_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_product_option_group
        FOREIGN KEY (group_id)
        REFERENCES option_groups(group_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE option_values (
    value_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    group_id INT UNSIGNED NOT NULL,
    value_name VARCHAR(50) NOT NULL,

    CONSTRAINT uq_option_value UNIQUE (group_id, value_name),

    CONSTRAINT fk_option_value_group
        FOREIGN KEY (group_id)
        REFERENCES option_groups(group_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_option_values_group (group_id)
) ENGINE=InnoDB;

CREATE TABLE product_variants (
    variant_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    price DECIMAL(12,0) NOT NULL,
    sale_price DECIMAL(12,0) NULL,
    stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
    sku VARCHAR(80) NOT NULL,
    status ENUM(
        'active',
        'inactive',
        'out_of_stock'
    ) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_variant_sku UNIQUE (sku),

    CONSTRAINT fk_variant_product
        FOREIGN KEY (product_id)
        REFERENCES products(product_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_variant_product_pair (
        product_id,
        variant_id
    ),

    INDEX idx_variants_product_status (
        product_id,
        status
    )
) ENGINE=InnoDB;

CREATE TABLE variant_values (
    variant_id INT UNSIGNED NOT NULL,
    value_id INT UNSIGNED NOT NULL,

    PRIMARY KEY (variant_id, value_id),

    CONSTRAINT fk_variant_value_variant
        FOREIGN KEY (variant_id)
        REFERENCES product_variants(variant_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_variant_value_option
        FOREIGN KEY (value_id)
        REFERENCES option_values(value_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE cart_items (
    cart_item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    variant_id INT UNSIGNED NULL,

    -- Không dùng GENERATED COLUMN trong MySQL 5.7.
    -- 0 đại diện cho sản phẩm không có biến thể.
    variant_key INT UNSIGNED NOT NULL DEFAULT 0,

    quantity INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_cart_customer_product_variant
        UNIQUE (
            customer_id,
            product_id,
            variant_key
        ),

    CONSTRAINT fk_cart_customer
        FOREIGN KEY (customer_id)
        REFERENCES customer_profiles(customer_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_cart_product
        FOREIGN KEY (product_id)
        REFERENCES products(product_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_cart_product_variant
        FOREIGN KEY (product_id, variant_id)
        REFERENCES product_variants(
            product_id,
            variant_id
        )
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    INDEX idx_cart_customer (customer_id),

    INDEX idx_cart_product_variant (
        product_id,
        variant_id
    )
) ENGINE=InnoDB;

CREATE TABLE orders (
    order_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_code VARCHAR(30) NOT NULL,
    customer_id INT UNSIGNED NOT NULL,
    order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal_amount DECIMAL(12,0) NOT NULL DEFAULT 0,
    shipping_fee DECIMAL(12,0) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,0) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,0) NOT NULL DEFAULT 0,
    recipient_name VARCHAR(100) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    shipping_address VARCHAR(500) NOT NULL,
    note TEXT NULL,
    payment_method ENUM('COD', 'VNPay', 'Momo', 'BankTransfer') NOT NULL,
    payment_status ENUM('pending', 'paid', 'failed', 'refunded', 'partially_refunded')
        NOT NULL DEFAULT 'pending',
    order_status ENUM(
        'pending',
        'confirmed',
        'processing',
        'delivering',
        'delivered',
        'cancelled',
        'completed'
    ) NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_orders_code UNIQUE (order_code),

    CONSTRAINT fk_order_customer
        FOREIGN KEY (customer_id)
        REFERENCES customer_profiles(customer_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_orders_customer_date (customer_id, order_date),
    INDEX idx_orders_status (order_status, payment_status)
) ENGINE=InnoDB;

CREATE TABLE order_items (
    order_item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    shop_id INT UNSIGNED NOT NULL,
    variant_id INT UNSIGNED NULL,

    variant_key INT UNSIGNED NOT NULL DEFAULT 0,

    product_name VARCHAR(200) NOT NULL,
    variant_name VARCHAR(200) NULL,
    quantity INT UNSIGNED NOT NULL,
    unit_price DECIMAL(12,0) NOT NULL,

    line_total DECIMAL(12,0)
        GENERATED ALWAYS AS (
            quantity * unit_price
        ) STORED,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_order_product_variant
        UNIQUE (
            order_id,
            product_id,
            variant_key
        ),

    CONSTRAINT fk_order_item_order
        FOREIGN KEY (order_id)
        REFERENCES orders(order_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_order_item_product_shop
        FOREIGN KEY (
            product_id,
            shop_id
        )
        REFERENCES products (
            product_id,
            shop_id
        )
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_order_item_product_variant
        FOREIGN KEY (
            product_id,
            variant_id
        )
        REFERENCES product_variants (
            product_id,
            variant_id
        )
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_order_items_order (
        order_id
    ),

    INDEX idx_order_items_shop (
        shop_id
    ),

    INDEX idx_order_items_product_shop (
        product_id,
        shop_id
    ),

    INDEX idx_order_items_product_variant (
        product_id,
        variant_id
    )
) ENGINE=InnoDB;

CREATE TABLE reviews (
    review_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    order_item_id INT UNSIGNED NULL,
    title VARCHAR(100) NOT NULL,
    comment VARCHAR(1000) NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    status ENUM('pending', 'published', 'hidden') NOT NULL DEFAULT 'published',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_review_customer_product
        UNIQUE (customer_id, product_id),

    CONSTRAINT fk_review_customer
        FOREIGN KEY (customer_id)
        REFERENCES customer_profiles(customer_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_review_product
        FOREIGN KEY (product_id)
        REFERENCES products(product_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_review_order_item
        FOREIGN KEY (order_item_id)
        REFERENCES order_items(order_item_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    INDEX idx_reviews_product_status (product_id, status)
) ENGINE=InnoDB;

CREATE TABLE returns (
    return_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_item_id INT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    seller_approved BOOLEAN NOT NULL DEFAULT FALSE,
    platform_approved BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM(
        'pending',
        'seller_approved',
        'platform_approved',
        'rejected',
        'refunding',
        'refunded'
    ) NOT NULL DEFAULT 'pending',
    refund_amount DECIMAL(12,0) NOT NULL DEFAULT 0,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME NULL,

    CONSTRAINT uq_return_order_item UNIQUE (order_item_id),

    CONSTRAINT fk_return_order_item
        FOREIGN KEY (order_item_id)
        REFERENCES order_items(order_item_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_returns_status_date (status, requested_at)
) ENGINE=InnoDB;

DELIMITER $$

CREATE TRIGGER trg_users_validate_before_insert
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
    IF NEW.password IS NULL AND NEW.email_verified_at IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User phải có password hoặc email OAuth đã xác minh';
    END IF;

    IF NEW.status = 'deleted' AND NEW.deleted_at IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User có status deleted phải có deleted_at';
    END IF;

    IF NEW.status <> 'deleted' AND NEW.deleted_at IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User chưa deleted không được có deleted_at';
    END IF;
END$$

CREATE TRIGGER trg_users_validate_before_update
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    IF NEW.password IS NULL AND NEW.email_verified_at IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User phải có password hoặc email OAuth đã xác minh';
    END IF;

    IF NEW.status = 'deleted' AND NEW.deleted_at IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User có status deleted phải có deleted_at';
    END IF;

    IF NEW.status <> 'deleted' AND NEW.deleted_at IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User chưa deleted không được có deleted_at';
    END IF;
END$$

CREATE TRIGGER trg_shop_profile_validate_before_insert
BEFORE INSERT ON shop_profiles
FOR EACH ROW
BEGIN
    IF NEW.rating < 0.00 OR NEW.rating > 5.00 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'rating phải nằm trong khoảng 0 đến 5';
    END IF;

    IF NEW.approval_status = 'approved' AND NEW.approved_at IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Shop approved phải có approved_at';
    END IF;
END$$

CREATE TRIGGER trg_shop_profile_validate_before_update
BEFORE UPDATE ON shop_profiles
FOR EACH ROW
BEGIN
    IF NEW.rating < 0.00 OR NEW.rating > 5.00 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'rating phải nằm trong khoảng 0 đến 5';
    END IF;

    IF NEW.approval_status = 'approved' AND NEW.approved_at IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Shop approved phải có approved_at';
    END IF;
END$$

CREATE TRIGGER trg_products_validate_before_insert
BEFORE INSERT ON products
FOR EACH ROW
BEGIN
    IF NEW.price < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Giá sản phẩm không được âm';
    END IF;

    IF NEW.sale_price IS NOT NULL
       AND (NEW.sale_price < 0 OR NEW.sale_price > NEW.price) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'sale_price phải từ 0 đến price';
    END IF;
END$$

CREATE TRIGGER trg_products_validate_before_update
BEFORE UPDATE ON products
FOR EACH ROW
BEGIN
    IF NEW.price < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Giá sản phẩm không được âm';
    END IF;

    IF NEW.sale_price IS NOT NULL
       AND (NEW.sale_price < 0 OR NEW.sale_price > NEW.price) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'sale_price phải từ 0 đến price';
    END IF;
END$$

CREATE TRIGGER trg_variants_validate_before_insert
BEFORE INSERT ON product_variants
FOR EACH ROW
BEGIN
    IF NEW.price < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Giá biến thể không được âm';
    END IF;

    IF NEW.sale_price IS NOT NULL
       AND (NEW.sale_price < 0 OR NEW.sale_price > NEW.price) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'sale_price biến thể phải từ 0 đến price';
    END IF;
END$$

CREATE TRIGGER trg_variants_validate_before_update
BEFORE UPDATE ON product_variants
FOR EACH ROW
BEGIN
    IF NEW.price < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Giá biến thể không được âm';
    END IF;

    IF NEW.sale_price IS NOT NULL
       AND (NEW.sale_price < 0 OR NEW.sale_price > NEW.price) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'sale_price biến thể phải từ 0 đến price';
    END IF;
END$$

CREATE TRIGGER trg_cart_items_validate_before_insert
BEFORE INSERT ON cart_items
FOR EACH ROW
BEGIN
    IF NEW.quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Số lượng giỏ hàng phải lớn hơn 0';
    END IF;
END$$

CREATE TRIGGER trg_cart_items_validate_before_update
BEFORE UPDATE ON cart_items
FOR EACH ROW
BEGIN
    IF NEW.quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Số lượng giỏ hàng phải lớn hơn 0';
    END IF;
END$$

CREATE TRIGGER trg_orders_validate_before_insert
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
    IF NEW.subtotal_amount < 0
       OR NEW.shipping_fee < 0
       OR NEW.discount_amount < 0
       OR NEW.total_amount < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Các giá trị tiền của đơn hàng không được âm';
    END IF;

    IF NEW.total_amount <> NEW.subtotal_amount + NEW.shipping_fee - NEW.discount_amount THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'total_amount không khớp công thức đơn hàng';
    END IF;
END$$

CREATE TRIGGER trg_orders_validate_before_update
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
    IF NEW.subtotal_amount < 0
       OR NEW.shipping_fee < 0
       OR NEW.discount_amount < 0
       OR NEW.total_amount < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Các giá trị tiền của đơn hàng không được âm';
    END IF;

    IF NEW.total_amount <> NEW.subtotal_amount + NEW.shipping_fee - NEW.discount_amount THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'total_amount không khớp công thức đơn hàng';
    END IF;
END$$

CREATE TRIGGER trg_order_items_validate_before_insert
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
    IF NEW.quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Số lượng order item phải lớn hơn 0';
    END IF;

    IF NEW.unit_price < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Đơn giá order item không được âm';
    END IF;
END$$

CREATE TRIGGER trg_order_items_validate_before_update
BEFORE UPDATE ON order_items
FOR EACH ROW
BEGIN
    IF NEW.quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Số lượng order item phải lớn hơn 0';
    END IF;

    IF NEW.unit_price < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Đơn giá order item không được âm';
    END IF;
END$$

CREATE TRIGGER trg_reviews_validate_before_insert
BEFORE INSERT ON reviews
FOR EACH ROW
BEGIN
    IF NEW.rating < 1 OR NEW.rating > 5 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'rating review phải nằm trong khoảng 1 đến 5';
    END IF;
END$$

CREATE TRIGGER trg_reviews_validate_before_update
BEFORE UPDATE ON reviews
FOR EACH ROW
BEGIN
    IF NEW.rating < 1 OR NEW.rating > 5 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'rating review phải nằm trong khoảng 1 đến 5';
    END IF;
END$$

CREATE TRIGGER trg_returns_validate_before_insert
BEFORE INSERT ON returns
FOR EACH ROW
BEGIN
    IF NEW.quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Số lượng hoàn trả phải lớn hơn 0';
    END IF;

    IF NEW.refund_amount < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Số tiền hoàn trả không được âm';
    END IF;

    IF NEW.status IN ('rejected', 'refunded') AND NEW.processed_at IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Return đã xử lý phải có processed_at';
    END IF;
END$$

CREATE TRIGGER trg_returns_validate_before_update
BEFORE UPDATE ON returns
FOR EACH ROW
BEGIN
    IF NEW.quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Số lượng hoàn trả phải lớn hơn 0';
    END IF;

    IF NEW.refund_amount < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Số tiền hoàn trả không được âm';
    END IF;

    IF NEW.status IN ('rejected', 'refunded') AND NEW.processed_at IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Return đã xử lý phải có processed_at';
    END IF;
END$$

CREATE TRIGGER trg_customer_profile_before_insert
BEFORE INSERT ON customer_profiles
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE user_id = NEW.customer_id
          AND role = 'customer'
          AND status <> 'deleted'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'customer_profiles chỉ được liên kết với users.role = customer';
    END IF;
END$$

CREATE TRIGGER trg_shop_profile_before_insert
BEFORE INSERT ON shop_profiles
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE user_id = NEW.shop_id
          AND role = 'shop'
          AND status <> 'deleted'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'shop_profiles chỉ được liên kết với users.role = shop';
    END IF;

    IF NEW.approved_by IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM users
        WHERE user_id = NEW.approved_by
          AND role = 'admin'
          AND status = 'active'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'approved_by phải là admin đang hoạt động';
    END IF;
END$$

CREATE TRIGGER trg_shop_profile_before_update
BEFORE UPDATE ON shop_profiles
FOR EACH ROW
BEGIN
    IF NEW.approved_by IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM users
        WHERE user_id = NEW.approved_by
          AND role = 'admin'
          AND status = 'active'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'approved_by phải là admin đang hoạt động';
    END IF;
END$$

CREATE TRIGGER trg_users_before_role_update
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    IF OLD.role <> NEW.role THEN
        IF EXISTS (
            SELECT 1 FROM customer_profiles
            WHERE customer_id = OLD.user_id
        ) OR EXISTS (
            SELECT 1 FROM shop_profiles
            WHERE shop_id = OLD.user_id
        ) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Không được đổi role khi user vẫn còn profile liên kết';
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_products_after_insert
AFTER INSERT ON products
FOR EACH ROW
BEGIN
    UPDATE shop_profiles
    SET total_products = (
        SELECT COUNT(*)
        FROM products
        WHERE shop_id = NEW.shop_id
          AND deleted_at IS NULL
    )
    WHERE shop_id = NEW.shop_id;
END$$

CREATE TRIGGER trg_products_after_update
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
    UPDATE shop_profiles
    SET total_products = (
        SELECT COUNT(*)
        FROM products
        WHERE shop_id = OLD.shop_id
          AND deleted_at IS NULL
    )
    WHERE shop_id = OLD.shop_id;

    IF NEW.shop_id <> OLD.shop_id THEN
        UPDATE shop_profiles
        SET total_products = (
            SELECT COUNT(*)
            FROM products
            WHERE shop_id = NEW.shop_id
              AND deleted_at IS NULL
        )
        WHERE shop_id = NEW.shop_id;
    END IF;
END$$

CREATE TRIGGER trg_products_after_delete
AFTER DELETE ON products
FOR EACH ROW
BEGIN
    UPDATE shop_profiles
    SET total_products = (
        SELECT COUNT(*)
        FROM products
        WHERE shop_id = OLD.shop_id
          AND deleted_at IS NULL
    )
    WHERE shop_id = OLD.shop_id;
END$$

CREATE TRIGGER trg_order_items_after_insert
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET subtotal_amount = (
            SELECT COALESCE(SUM(line_total), 0)
            FROM order_items
            WHERE order_id = NEW.order_id
        ),
        total_amount = (
            SELECT COALESCE(SUM(line_total), 0)
            FROM order_items
            WHERE order_id = NEW.order_id
        ) + shipping_fee - discount_amount
    WHERE order_id = NEW.order_id;
END$$

CREATE TRIGGER trg_order_items_after_update
AFTER UPDATE ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET subtotal_amount = (
            SELECT COALESCE(SUM(line_total), 0)
            FROM order_items
            WHERE order_id = OLD.order_id
        ),
        total_amount = (
            SELECT COALESCE(SUM(line_total), 0)
            FROM order_items
            WHERE order_id = OLD.order_id
        ) + shipping_fee - discount_amount
    WHERE order_id = OLD.order_id;

    IF NEW.order_id <> OLD.order_id THEN
        UPDATE orders
        SET subtotal_amount = (
                SELECT COALESCE(SUM(line_total), 0)
                FROM order_items
                WHERE order_id = NEW.order_id
            ),
            total_amount = (
                SELECT COALESCE(SUM(line_total), 0)
                FROM order_items
                WHERE order_id = NEW.order_id
            ) + shipping_fee - discount_amount
        WHERE order_id = NEW.order_id;
    END IF;
END$$

CREATE TRIGGER trg_order_items_after_delete
AFTER DELETE ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET subtotal_amount = (
            SELECT COALESCE(SUM(line_total), 0)
            FROM order_items
            WHERE order_id = OLD.order_id
        ),
        total_amount = (
            SELECT COALESCE(SUM(line_total), 0)
            FROM order_items
            WHERE order_id = OLD.order_id
        ) + shipping_fee - discount_amount
    WHERE order_id = OLD.order_id;
END$$

DELIMITER ;

START TRANSACTION;

INSERT INTO users (
    user_id, username, name, email, password,
    role, status, avatar, email_verified_at
) VALUES
(
    1, 'nguyenvana', 'Nguyễn Văn A', 'vana@gmail.com',
    '$2b$10$e4Vv0tS7m64iQBlhsMQG/O7noCqc7YhMWI0t067boFVP1k4gvSNra',
    'customer', 'active', NULL, NOW()
),
(
    2, 'tranthib', 'Trần Thị B', 'thib@gmail.com',
    '$2b$10$e4Vv0tS7m64iQBlhsMQG/O7noCqc7YhMWI0t067boFVP1k4gvSNra',
    'customer', 'active', NULL, NOW()
),
(
    3, 'admin', 'Administrator', 'admin@pharmacy.vn',
    '$2b$10$mn4YlMl7ZQmzcXr454tjDu/pLj6osZhOanQI6Sbc4pxXc.kgQlYrC',
    'admin', 'active', NULL, NOW()
),
(
    4, 'longchau', 'Nhà thuốc Long Châu', 'shop@longchau.vn',
    '$2b$10$2X.4py6RJhecEnI9w0ZeLe2NxOr.S63ujvB0sXyezv4S2c0tXT77m',
    'shop', 'active', NULL, NOW()
),
(
    5, NULL, 'Khách hàng Google', 'google.customer@example.com',
    NULL,
    'customer', 'active', NULL, NOW()
);

INSERT INTO customer_profiles (
    customer_id, phone, date_of_birth, gender
) VALUES
(1, '0901234567', '1999-05-20', 'male'),
(2, '0912345678', '2000-09-15', 'female'),
(5, NULL, NULL, NULL);

INSERT INTO shop_profiles (
    shop_id, shop_name, phone, description,
    rating, rating_count, followers, total_products,
    level, approval_status, approved_by, approved_at
) VALUES
(
    4,
    'Nhà thuốc Long Châu',
    '19006928',
    'Nhà thuốc cung cấp dược phẩm và sản phẩm chăm sóc sức khỏe.',
    4.90,
    1200,
    50000,
    0,
    'premium',
    'approved',
    3,
    NOW()
);

INSERT INTO oauth_accounts (
    oauth_account_id, user_id, provider,
    provider_user_id, provider_email
) VALUES
(
    1,
    5,
    'google',
    'google-demo-user-001',
    'google.customer@example.com'
);

INSERT INTO addresses (
    address_id, customer_id, recipient_name, phone,
    province, district, ward, address_detail, type, is_default
) VALUES
(
    1, 1, 'Nguyễn Văn A', '0901234567',
    'Hà Nội', 'Thanh Xuân', 'Thượng Đình',
    '12 Nguyễn Trãi', 'home', TRUE
),
(
    2, 2, 'Trần Thị B', '0912345678',
    'TP.HCM', 'Quận 1', 'Bến Nghé',
    '25 Lê Lợi', 'home', TRUE
),
(
    3, 1, 'Nguyễn Văn A', '0901234567',
    'Hà Nội', 'Cầu Giấy', 'Dịch Vọng',
    'Tòa nhà văn phòng số 8', 'work', FALSE
);

INSERT INTO categories (
    category_id, category_name, slug,
    parent_category_id, status
) VALUES
(1, 'Chăm sóc sức khỏe', 'cham-soc-suc-khoe', NULL, TRUE),
(2, 'Chăm sóc cá nhân', 'cham-soc-ca-nhan', NULL, TRUE),
(3, 'Thực phẩm bảo vệ sức khỏe', 'thuc-pham-bao-ve-suc-khoe', 1, TRUE),
(4, 'Chăm sóc da mặt', 'cham-soc-da-mat', 2, TRUE);

INSERT INTO products (
    product_id, shop_id, category_id, name, slug,
    price, sale_price, description, usage_guide,
    stock_quantity, status
) VALUES
(
    107, 4, 4,
    'Sữa rửa mặt dịu nhẹ Cetaphil 500ml',
    'sua-rua-mat-cetaphil-500ml',
    200000, 190000,
    'Sản phẩm làm sạch dịu nhẹ dành cho da nhạy cảm.',
    'Làm ướt da, thoa sản phẩm, massage nhẹ và rửa sạch.',
    100, 'active'
),
(
    109, 4, 3,
    'Mật ong hoa rừng tự nhiên 500ml',
    'mat-ong-hoa-rung-500ml',
    150000, 135000,
    'Mật ong nguyên chất, phù hợp pha nước ấm.',
    'Dùng trực tiếp hoặc pha với nước ấm.',
    200, 'active'
),
(
    110, 4, 3,
    'Mật ong Manuka 250ml',
    'mat-ong-manuka-250ml',
    450000, NULL,
    'Mật ong nhập khẩu cao cấp.',
    'Dùng trực tiếp hoặc pha trà.',
    80, 'active'
),
(
    111, 4, 3,
    'Vitamin C 1000mg',
    'vitamin-c-1000mg',
    180000, 165000,
    'Thực phẩm bổ sung vitamin C.',
    'Sử dụng theo hướng dẫn trên bao bì.',
    150, 'active'
);

INSERT INTO media (
    media_id, product_id, url, type,
    is_thumbnail, priority
) VALUES
(1, 107, '/images/products/cetaphil-500ml-1.jpg', 'image', TRUE, 1),
(2, 107, '/images/products/cetaphil-500ml-2.jpg', 'image', FALSE, 2),
(3, 109, '/images/products/mat-ong-hoa-rung.jpg', 'image', TRUE, 1),
(4, 110, '/images/products/manuka-250ml.jpg', 'image', TRUE, 1),
(5, 111, '/images/products/vitamin-c-1000mg.jpg', 'image', TRUE, 1);

INSERT INTO option_groups (group_id, group_name) VALUES
(1, 'Quy cách'),
(2, 'Dung tích');

INSERT INTO option_values (
    value_id, group_id, value_name
) VALUES
(1, 1, 'Hộp 10 viên'),
(2, 1, 'Hộp 20 viên'),
(3, 2, '250ml'),
(4, 2, '500ml');

INSERT INTO product_options (
    product_id, group_id
) VALUES
(109, 2),
(110, 2),
(111, 1);

INSERT INTO product_variants (
    variant_id, product_id, price, sale_price,
    stock_quantity, sku, status
) VALUES
(1, 109, 150000, 135000, 200, 'HONEY-500', 'active'),
(2, 110, 450000, NULL, 80, 'MANUKA-250', 'active'),
(3, 111, 95000, 89000, 80, 'VITC-10', 'active'),
(4, 111, 180000, 165000, 70, 'VITC-20', 'active');

INSERT INTO variant_values (
    variant_id, value_id
) VALUES
(1, 4),
(2, 3),
(3, 1),
(4, 2);

INSERT INTO cart_items (
    cart_item_id, customer_id, product_id,
    variant_id, quantity
) VALUES
(1, 1, 109, 1, 2),
(2, 2, 107, NULL, 1),
(3, 1, 111, 4, 1);

INSERT INTO orders (
    order_id, order_code, customer_id,
    subtotal_amount, shipping_fee, discount_amount, total_amount,
    recipient_name, recipient_phone, shipping_address,
    note, payment_method, payment_status, order_status
) VALUES
(
    1, 'ORD-20260804-0001', 1,
    0, 30000, 10000, 20000,
    'Nguyễn Văn A', '0901234567',
    '12 Nguyễn Trãi, Thượng Đình, Thanh Xuân, Hà Nội',
    'Giao giờ hành chính',
    'COD', 'pending', 'confirmed'
),
(
    2, 'ORD-20260804-0002', 2,
    0, 0, 0, 0,
    'Trần Thị B', '0912345678',
    '25 Lê Lợi, Bến Nghé, Quận 1, TP.HCM',
    NULL,
    'VNPay', 'paid', 'delivered'
);

INSERT INTO order_items (
    order_item_id, order_id, product_id, shop_id,
    variant_id, product_name, variant_name,
    quantity, unit_price
) VALUES
(
    1, 1, 109, 4, 1,
    'Mật ong hoa rừng tự nhiên 500ml',
    'Dung tích: 500ml',
    2, 135000
),
(
    2, 1, 111, 4, 4,
    'Vitamin C 1000mg',
    'Quy cách: Hộp 20 viên',
    1, 165000
),
(
    3, 2, 107, 4, NULL,
    'Sữa rửa mặt dịu nhẹ Cetaphil 500ml',
    NULL,
    1, 190000
);

COMMIT;

SELECT
    u.user_id,
    u.username,
    u.name,
    u.email,
    u.role,
    u.status
FROM users AS u
ORDER BY u.user_id;

SELECT
    p.product_id,
    p.name,
    sp.shop_name,
    c.category_name,
    p.stock_quantity,
    p.status
FROM products AS p
JOIN shop_profiles AS sp ON sp.shop_id = p.shop_id
JOIN categories AS c ON c.category_id = p.category_id
ORDER BY p.product_id;

SELECT
    o.order_code,
    o.subtotal_amount,
    o.shipping_fee,
    o.discount_amount,
    o.total_amount,
    o.payment_status,
    o.order_status
FROM orders AS o
ORDER BY o.order_id;
