-- Custom SQLite/D1 triggers that cannot be expressed in Drizzle schema.ts.
-- Apply this file after the Drizzle-generated table migration.

PRAGMA foreign_keys = ON;

-- =========================================================
-- ROLE CONSISTENCY
-- =========================================================

DROP TRIGGER IF EXISTS trg_customer_profile_validate_insert;
CREATE TRIGGER trg_customer_profile_validate_insert
BEFORE INSERT ON customer_profiles
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM users
  WHERE user_id = NEW.customer_id
    AND role = 'customer'
    AND status <> 'deleted'
)
BEGIN
  SELECT RAISE(ABORT, 'customer_profiles chỉ được liên kết với user customer chưa bị xóa');
END;

DROP TRIGGER IF EXISTS trg_customer_profile_validate_update;
CREATE TRIGGER trg_customer_profile_validate_update
BEFORE UPDATE OF customer_id ON customer_profiles
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM users
  WHERE user_id = NEW.customer_id
    AND role = 'customer'
    AND status <> 'deleted'
)
BEGIN
  SELECT RAISE(ABORT, 'customer_profiles chỉ được liên kết với user customer chưa bị xóa');
END;

DROP TRIGGER IF EXISTS trg_shop_profile_validate_insert;
CREATE TRIGGER trg_shop_profile_validate_insert
BEFORE INSERT ON shop_profiles
FOR EACH ROW
WHEN
  NOT EXISTS (
    SELECT 1
    FROM users
    WHERE user_id = NEW.shop_id
      AND role = 'shop'
      AND status <> 'deleted'
  )
  OR (
    NEW.approved_by IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM users
      WHERE user_id = NEW.approved_by
        AND role = 'admin'
        AND status = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'shop_profiles hoặc approved_by không hợp lệ');
END;

DROP TRIGGER IF EXISTS trg_shop_profile_validate_update;
CREATE TRIGGER trg_shop_profile_validate_update
BEFORE UPDATE OF shop_id, approved_by ON shop_profiles
FOR EACH ROW
WHEN
  NOT EXISTS (
    SELECT 1
    FROM users
    WHERE user_id = NEW.shop_id
      AND role = 'shop'
      AND status <> 'deleted'
  )
  OR (
    NEW.approved_by IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM users
      WHERE user_id = NEW.approved_by
        AND role = 'admin'
        AND status = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'shop_profiles hoặc approved_by không hợp lệ');
END;

DROP TRIGGER IF EXISTS trg_users_prevent_invalid_role_change;
CREATE TRIGGER trg_users_prevent_invalid_role_change
BEFORE UPDATE OF role ON users
FOR EACH ROW
WHEN OLD.role <> NEW.role
  AND (
    EXISTS (
      SELECT 1
      FROM customer_profiles
      WHERE customer_id = OLD.user_id
    )
    OR EXISTS (
      SELECT 1
      FROM shop_profiles
      WHERE shop_id = OLD.user_id
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'Không được đổi role khi user vẫn còn profile liên kết');
END;

-- =========================================================
-- PRODUCT / VARIANT CONSISTENCY
-- =========================================================

DROP TRIGGER IF EXISTS trg_products_require_approved_shop_insert;
CREATE TRIGGER trg_products_require_approved_shop_insert
BEFORE INSERT ON products
FOR EACH ROW
WHEN NEW.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM shop_profiles
    WHERE shop_id = NEW.shop_id
      AND approval_status = 'approved'
  )
BEGIN
  SELECT RAISE(ABORT, 'Chỉ shop đã được duyệt mới được kích hoạt sản phẩm');
END;

DROP TRIGGER IF EXISTS trg_products_require_approved_shop_update;
CREATE TRIGGER trg_products_require_approved_shop_update
BEFORE UPDATE OF shop_id, status ON products
FOR EACH ROW
WHEN NEW.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM shop_profiles
    WHERE shop_id = NEW.shop_id
      AND approval_status = 'approved'
  )
BEGIN
  SELECT RAISE(ABORT, 'Chỉ shop đã được duyệt mới được kích hoạt sản phẩm');
END;

DROP TRIGGER IF EXISTS trg_variant_values_validate_insert;
CREATE TRIGGER trg_variant_values_validate_insert
BEFORE INSERT ON variant_values
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM product_variants AS pv
  JOIN option_values AS ov
    ON ov.value_id = NEW.value_id
  JOIN product_options AS po
    ON po.product_id = pv.product_id
   AND po.group_id = ov.group_id
  WHERE pv.variant_id = NEW.variant_id
)
BEGIN
  SELECT RAISE(ABORT, 'Giá trị biến thể không thuộc nhóm tùy chọn của sản phẩm');
END;

DROP TRIGGER IF EXISTS trg_variant_values_validate_update;
CREATE TRIGGER trg_variant_values_validate_update
BEFORE UPDATE OF variant_id, value_id ON variant_values
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM product_variants AS pv
  JOIN option_values AS ov
    ON ov.value_id = NEW.value_id
  JOIN product_options AS po
    ON po.product_id = pv.product_id
   AND po.group_id = ov.group_id
  WHERE pv.variant_id = NEW.variant_id
)
BEGIN
  SELECT RAISE(ABORT, 'Giá trị biến thể không thuộc nhóm tùy chọn của sản phẩm');
END;

-- =========================================================
-- SHOP PRODUCT COUNTER
-- =========================================================

DROP TRIGGER IF EXISTS trg_products_sync_shop_total_insert;
CREATE TRIGGER trg_products_sync_shop_total_insert
AFTER INSERT ON products
FOR EACH ROW
BEGIN
  UPDATE shop_profiles
  SET total_products = (
        SELECT COUNT(*)
        FROM products
        WHERE shop_id = NEW.shop_id
          AND deleted_at IS NULL
      ),
      updated_at = CURRENT_TIMESTAMP
  WHERE shop_id = NEW.shop_id;
END;

DROP TRIGGER IF EXISTS trg_products_sync_shop_total_update;
CREATE TRIGGER trg_products_sync_shop_total_update
AFTER UPDATE OF shop_id, deleted_at ON products
FOR EACH ROW
BEGIN
  UPDATE shop_profiles
  SET total_products = (
        SELECT COUNT(*)
        FROM products
        WHERE shop_id = OLD.shop_id
          AND deleted_at IS NULL
      ),
      updated_at = CURRENT_TIMESTAMP
  WHERE shop_id = OLD.shop_id;

  UPDATE shop_profiles
  SET total_products = (
        SELECT COUNT(*)
        FROM products
        WHERE shop_id = NEW.shop_id
          AND deleted_at IS NULL
      ),
      updated_at = CURRENT_TIMESTAMP
  WHERE shop_id = NEW.shop_id
    AND NEW.shop_id <> OLD.shop_id;
END;

DROP TRIGGER IF EXISTS trg_products_sync_shop_total_delete;
CREATE TRIGGER trg_products_sync_shop_total_delete
AFTER DELETE ON products
FOR EACH ROW
BEGIN
  UPDATE shop_profiles
  SET total_products = (
        SELECT COUNT(*)
        FROM products
        WHERE shop_id = OLD.shop_id
          AND deleted_at IS NULL
      ),
      updated_at = CURRENT_TIMESTAMP
  WHERE shop_id = OLD.shop_id;
END;

-- =========================================================
-- ORDER TOTALS
-- =========================================================

DROP TRIGGER IF EXISTS trg_order_items_sync_total_insert;
CREATE TRIGGER trg_order_items_sync_total_insert
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
      ) + shipping_fee - discount_amount,
      updated_at = CURRENT_TIMESTAMP
  WHERE order_id = NEW.order_id;
END;

DROP TRIGGER IF EXISTS trg_order_items_sync_total_update;
CREATE TRIGGER trg_order_items_sync_total_update
AFTER UPDATE OF order_id, quantity, unit_price ON order_items
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
      ) + shipping_fee - discount_amount,
      updated_at = CURRENT_TIMESTAMP
  WHERE order_id = OLD.order_id;

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
      ) + shipping_fee - discount_amount,
      updated_at = CURRENT_TIMESTAMP
  WHERE order_id = NEW.order_id
    AND NEW.order_id <> OLD.order_id;
END;

DROP TRIGGER IF EXISTS trg_order_items_sync_total_delete;
CREATE TRIGGER trg_order_items_sync_total_delete
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
      ) + shipping_fee - discount_amount,
      updated_at = CURRENT_TIMESTAMP
  WHERE order_id = OLD.order_id;
END;

-- =========================================================
-- REVIEW AUTHENTICITY
-- =========================================================

DROP TRIGGER IF EXISTS trg_reviews_validate_order_item_insert;
CREATE TRIGGER trg_reviews_validate_order_item_insert
BEFORE INSERT ON reviews
FOR EACH ROW
WHEN NEW.order_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM order_items AS oi
    JOIN orders AS o ON o.order_id = oi.order_id
    WHERE oi.order_item_id = NEW.order_item_id
      AND oi.product_id = NEW.product_id
      AND o.customer_id = NEW.customer_id
      AND o.order_status IN ('delivered', 'completed')
  )
BEGIN
  SELECT RAISE(ABORT, 'Review không khớp sản phẩm, khách hàng hoặc đơn đã giao');
END;

DROP TRIGGER IF EXISTS trg_reviews_validate_order_item_update;
CREATE TRIGGER trg_reviews_validate_order_item_update
BEFORE UPDATE OF order_item_id, product_id, customer_id ON reviews
FOR EACH ROW
WHEN NEW.order_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM order_items AS oi
    JOIN orders AS o ON o.order_id = oi.order_id
    WHERE oi.order_item_id = NEW.order_item_id
      AND oi.product_id = NEW.product_id
      AND o.customer_id = NEW.customer_id
      AND o.order_status IN ('delivered', 'completed')
  )
BEGIN
  SELECT RAISE(ABORT, 'Review không khớp sản phẩm, khách hàng hoặc đơn đã giao');
END;

-- =========================================================
-- RETURN VALIDATION
-- =========================================================

DROP TRIGGER IF EXISTS trg_returns_validate_insert;
CREATE TRIGGER trg_returns_validate_insert
BEFORE INSERT ON returns
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM order_items AS oi
  JOIN orders AS o ON o.order_id = oi.order_id
  WHERE oi.order_item_id = NEW.order_item_id
    AND NEW.quantity <= oi.quantity
    AND NEW.refund_amount <= oi.line_total
    AND o.order_status IN ('delivered', 'completed')
)
BEGIN
  SELECT RAISE(ABORT, 'Yêu cầu hoàn trả vượt số lượng/giá trị hoặc đơn chưa hoàn tất');
END;

DROP TRIGGER IF EXISTS trg_returns_validate_update;
CREATE TRIGGER trg_returns_validate_update
BEFORE UPDATE OF order_item_id, quantity, refund_amount ON returns
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM order_items AS oi
  JOIN orders AS o ON o.order_id = oi.order_id
  WHERE oi.order_item_id = NEW.order_item_id
    AND NEW.quantity <= oi.quantity
    AND NEW.refund_amount <= oi.line_total
    AND o.order_status IN ('delivered', 'completed')
)
BEGIN
  SELECT RAISE(ABORT, 'Yêu cầu hoàn trả vượt số lượng/giá trị hoặc đơn chưa hoàn tất');
END;