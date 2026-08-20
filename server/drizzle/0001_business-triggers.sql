-- =========================================================
-- NhaThuoc - Business Triggers (CLEAN REBUILD)
-- Cloudflare D1 / SQLite
-- Source of truth: server/src/db/schema.ts
-- Total triggers: 31
-- =========================================================

PRAGMA foreign_keys = ON;

-- =========================================================
-- 1. CUSTOMER PROFILE / USER ROLE CONSISTENCY (2)
-- =========================================================

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
  SELECT RAISE(
    ABORT,
    'customer_profiles chỉ được liên kết với user customer chưa bị xóa'
  );
END;

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
  SELECT RAISE(
    ABORT,
    'customer_profiles chỉ được liên kết với user customer chưa bị xóa'
  );
END;

-- =========================================================
-- 2. SHOP PROFILE / USER ROLE / ADMIN APPROVAL CONSISTENCY (2)
-- =========================================================

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
        AND deleted_at IS NULL
    )
  )
BEGIN
  SELECT RAISE(
    ABORT,
    'shop_profiles hoặc approved_by không hợp lệ'
  );
END;

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
        AND deleted_at IS NULL
    )
  )
BEGIN
  SELECT RAISE(
    ABORT,
    'shop_profiles hoặc approved_by không hợp lệ'
  );
END;

-- =========================================================
-- 3. PREVENT INVALID ROLE CHANGES (1)
-- =========================================================

CREATE TRIGGER trg_users_prevent_invalid_role_change
BEFORE UPDATE OF role ON users
FOR EACH ROW
WHEN
  OLD.role <> NEW.role
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
  SELECT RAISE(
    ABORT,
    'Không được đổi role khi user vẫn còn profile liên kết'
  );
END;

-- =========================================================
-- 4. PRODUCT REQUIRES APPROVED SHOP WHEN ACTIVE (2)
-- =========================================================

CREATE TRIGGER trg_products_require_approved_shop_insert
BEFORE INSERT ON products
FOR EACH ROW
WHEN
  NEW.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM shop_profiles AS sp
    INNER JOIN users AS u
      ON u.user_id = sp.shop_id
    WHERE sp.shop_id = NEW.shop_id
      AND sp.approval_status = 'approved'
      AND u.role = 'shop'
      AND u.status = 'active'
      AND u.deleted_at IS NULL
  )
BEGIN
  SELECT RAISE(
    ABORT,
    'Chỉ shop đã được duyệt và đang hoạt động mới được kích hoạt sản phẩm'
  );
END;

CREATE TRIGGER trg_products_require_approved_shop_update
BEFORE UPDATE OF shop_id, status ON products
FOR EACH ROW
WHEN
  NEW.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM shop_profiles AS sp
    INNER JOIN users AS u
      ON u.user_id = sp.shop_id
    WHERE sp.shop_id = NEW.shop_id
      AND sp.approval_status = 'approved'
      AND u.role = 'shop'
      AND u.status = 'active'
      AND u.deleted_at IS NULL
  )
BEGIN
  SELECT RAISE(
    ABORT,
    'Chỉ shop đã được duyệt và đang hoạt động mới được kích hoạt sản phẩm'
  );
END;

-- =========================================================
-- 5. VARIANT VALUE MUST BELONG TO PRODUCT OPTION GROUP (2)
-- =========================================================

CREATE TRIGGER trg_variant_values_validate_insert
BEFORE INSERT ON variant_values
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM product_variants AS pv
  INNER JOIN option_values AS ov
    ON ov.value_id = NEW.value_id
  INNER JOIN product_options AS po
    ON po.product_id = pv.product_id
   AND po.group_id = ov.group_id
  WHERE pv.variant_id = NEW.variant_id
)
BEGIN
  SELECT RAISE(
    ABORT,
    'Giá trị biến thể không thuộc nhóm tùy chọn của sản phẩm'
  );
END;

CREATE TRIGGER trg_variant_values_validate_update
BEFORE UPDATE OF variant_id, value_id ON variant_values
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM product_variants AS pv
  INNER JOIN option_values AS ov
    ON ov.value_id = NEW.value_id
  INNER JOIN product_options AS po
    ON po.product_id = pv.product_id
   AND po.group_id = ov.group_id
  WHERE pv.variant_id = NEW.variant_id
)
BEGIN
  SELECT RAISE(
    ABORT,
    'Giá trị biến thể không thuộc nhóm tùy chọn của sản phẩm'
  );
END;

-- =========================================================
-- 6. SHOP PRODUCT COUNTER (3)
-- Counts non-soft-deleted products only.
-- =========================================================

CREATE TRIGGER trg_products_sync_shop_total_insert
AFTER INSERT ON products
FOR EACH ROW
BEGIN
  UPDATE shop_profiles
  SET
    total_products = (
      SELECT COUNT(*)
      FROM products
      WHERE shop_id = NEW.shop_id
        AND deleted_at IS NULL
    ),
    updated_at = CURRENT_TIMESTAMP
  WHERE shop_id = NEW.shop_id;
END;

CREATE TRIGGER trg_products_sync_shop_total_update
AFTER UPDATE OF shop_id, deleted_at ON products
FOR EACH ROW
BEGIN
  UPDATE shop_profiles
  SET
    total_products = (
      SELECT COUNT(*)
      FROM products
      WHERE shop_id = OLD.shop_id
        AND deleted_at IS NULL
    ),
    updated_at = CURRENT_TIMESTAMP
  WHERE shop_id = OLD.shop_id;

  UPDATE shop_profiles
  SET
    total_products = (
      SELECT COUNT(*)
      FROM products
      WHERE shop_id = NEW.shop_id
        AND deleted_at IS NULL
    ),
    updated_at = CURRENT_TIMESTAMP
  WHERE shop_id = NEW.shop_id
    AND NEW.shop_id <> OLD.shop_id;
END;

CREATE TRIGGER trg_products_sync_shop_total_delete
AFTER DELETE ON products
FOR EACH ROW
BEGIN
  UPDATE shop_profiles
  SET
    total_products = (
      SELECT COUNT(*)
      FROM products
      WHERE shop_id = OLD.shop_id
        AND deleted_at IS NULL
    ),
    updated_at = CURRENT_TIMESTAMP
  WHERE shop_id = OLD.shop_id;
END;

-- =========================================================
-- 7. ORDER TOTALS (3)
-- subtotal = SUM(order_items.line_total)
-- total = subtotal + shipping_fee - discount_amount
-- =========================================================

CREATE TRIGGER trg_order_items_sync_total_insert
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
  UPDATE orders
  SET
    subtotal_amount = (
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

CREATE TRIGGER trg_order_items_sync_total_update
AFTER UPDATE OF order_id, quantity, unit_price ON order_items
FOR EACH ROW
BEGIN
  UPDATE orders
  SET
    subtotal_amount = (
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
  SET
    subtotal_amount = (
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

CREATE TRIGGER trg_order_items_sync_total_delete
AFTER DELETE ON order_items
FOR EACH ROW
BEGIN
  UPDATE orders
  SET
    subtotal_amount = (
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
-- 8. REVIEW AUTHENTICITY (2)
-- If order_item_id is supplied, customer/product must match
-- a delivered/completed order item.
-- =========================================================

CREATE TRIGGER trg_reviews_validate_order_item_insert
BEFORE INSERT ON reviews
FOR EACH ROW
WHEN
  NEW.order_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM order_items AS oi
    INNER JOIN orders AS o
      ON o.order_id = oi.order_id
    WHERE oi.order_item_id = NEW.order_item_id
      AND oi.product_id = NEW.product_id
      AND o.customer_id = NEW.customer_id
      AND o.order_status IN ('delivered', 'completed')
  )
BEGIN
  SELECT RAISE(
    ABORT,
    'Review không khớp sản phẩm, khách hàng hoặc đơn đã giao'
  );
END;

CREATE TRIGGER trg_reviews_validate_order_item_update
BEFORE UPDATE OF order_item_id, product_id, customer_id ON reviews
FOR EACH ROW
WHEN
  NEW.order_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM order_items AS oi
    INNER JOIN orders AS o
      ON o.order_id = oi.order_id
    WHERE oi.order_item_id = NEW.order_item_id
      AND oi.product_id = NEW.product_id
      AND o.customer_id = NEW.customer_id
      AND o.order_status IN ('delivered', 'completed')
  )
BEGIN
  SELECT RAISE(
    ABORT,
    'Review không khớp sản phẩm, khách hàng hoặc đơn đã giao'
  );
END;

-- =========================================================
-- 9. RETURN VALIDATION (2)
-- Return only delivered/completed items and never exceed
-- purchased quantity / line total.
-- =========================================================

CREATE TRIGGER trg_returns_validate_insert
BEFORE INSERT ON returns
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM order_items AS oi
  INNER JOIN orders AS o
    ON o.order_id = oi.order_id
  WHERE oi.order_item_id = NEW.order_item_id
    AND NEW.quantity <= oi.quantity
    AND NEW.refund_amount <= oi.line_total
    AND o.order_status IN ('delivered', 'completed')
)
BEGIN
  SELECT RAISE(
    ABORT,
    'Yêu cầu hoàn trả vượt số lượng/giá trị hoặc đơn chưa hoàn tất'
  );
END;

CREATE TRIGGER trg_returns_validate_update
BEFORE UPDATE OF order_item_id, quantity, refund_amount ON returns
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM order_items AS oi
  INNER JOIN orders AS o
    ON o.order_id = oi.order_id
  WHERE oi.order_item_id = NEW.order_item_id
    AND NEW.quantity <= oi.quantity
    AND NEW.refund_amount <= oi.line_total
    AND o.order_status IN ('delivered', 'completed')
)
BEGIN
  SELECT RAISE(
    ABORT,
    'Yêu cầu hoàn trả vượt số lượng/giá trị hoặc đơn chưa hoàn tất'
  );
END;

-- =========================================================
-- 10. PRODUCT STOCK STATUS FROM WAREHOUSE INVENTORY (3)
-- Only automatic transition active <-> out_of_stock.
-- draft/inactive are never overridden.
-- For a product with variants, aggregate all inventory rows.
-- =========================================================

CREATE TRIGGER trg_inventory_sync_product_status_insert
AFTER INSERT ON warehouse_inventory
FOR EACH ROW
BEGIN
  UPDATE products
  SET
    status = CASE
      WHEN status = 'active'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = NEW.product_id
        ) <= 0
        THEN 'out_of_stock'
      WHEN status = 'out_of_stock'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = NEW.product_id
        ) > 0
        THEN 'active'
      ELSE status
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE product_id = NEW.product_id
    AND deleted_at IS NULL;
END;

CREATE TRIGGER trg_inventory_sync_product_status_update
AFTER UPDATE OF product_id, quantity, reserved_quantity ON warehouse_inventory
FOR EACH ROW
BEGIN
  UPDATE products
  SET
    status = CASE
      WHEN status = 'active'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = OLD.product_id
        ) <= 0
        THEN 'out_of_stock'
      WHEN status = 'out_of_stock'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = OLD.product_id
        ) > 0
        THEN 'active'
      ELSE status
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE product_id = OLD.product_id
    AND deleted_at IS NULL;

  UPDATE products
  SET
    status = CASE
      WHEN status = 'active'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = NEW.product_id
        ) <= 0
        THEN 'out_of_stock'
      WHEN status = 'out_of_stock'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = NEW.product_id
        ) > 0
        THEN 'active'
      ELSE status
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE product_id = NEW.product_id
    AND NEW.product_id <> OLD.product_id
    AND deleted_at IS NULL;
END;

CREATE TRIGGER trg_inventory_sync_product_status_delete
AFTER DELETE ON warehouse_inventory
FOR EACH ROW
BEGIN
  UPDATE products
  SET
    status = CASE
      WHEN status = 'active'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = OLD.product_id
        ) <= 0
        THEN 'out_of_stock'
      WHEN status = 'out_of_stock'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = OLD.product_id
        ) > 0
        THEN 'active'
      ELSE status
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE product_id = OLD.product_id
    AND deleted_at IS NULL;
END;

-- =========================================================
-- 11. VARIANT STOCK STATUS FROM WAREHOUSE INVENTORY (3)
-- Only inventory rows with variant_id affect variant status.
-- =========================================================

CREATE TRIGGER trg_inventory_sync_variant_status_insert
AFTER INSERT ON warehouse_inventory
FOR EACH ROW
WHEN NEW.variant_id IS NOT NULL
BEGIN
  UPDATE product_variants
  SET
    status = CASE
      WHEN status = 'active'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = NEW.product_id
            AND variant_id = NEW.variant_id
        ) <= 0
        THEN 'out_of_stock'
      WHEN status = 'out_of_stock'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = NEW.product_id
            AND variant_id = NEW.variant_id
        ) > 0
        THEN 'active'
      ELSE status
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE product_id = NEW.product_id
    AND variant_id = NEW.variant_id;
END;

CREATE TRIGGER trg_inventory_sync_variant_status_update
AFTER UPDATE OF product_id, variant_id, quantity, reserved_quantity ON warehouse_inventory
FOR EACH ROW
BEGIN
  UPDATE product_variants
  SET
    status = CASE
      WHEN status = 'active'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = OLD.product_id
            AND variant_id = OLD.variant_id
        ) <= 0
        THEN 'out_of_stock'
      WHEN status = 'out_of_stock'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = OLD.product_id
            AND variant_id = OLD.variant_id
        ) > 0
        THEN 'active'
      ELSE status
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE OLD.variant_id IS NOT NULL
    AND product_id = OLD.product_id
    AND variant_id = OLD.variant_id;

  UPDATE product_variants
  SET
    status = CASE
      WHEN status = 'active'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = NEW.product_id
            AND variant_id = NEW.variant_id
        ) <= 0
        THEN 'out_of_stock'
      WHEN status = 'out_of_stock'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = NEW.product_id
            AND variant_id = NEW.variant_id
        ) > 0
        THEN 'active'
      ELSE status
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE NEW.variant_id IS NOT NULL
    AND product_id = NEW.product_id
    AND variant_id = NEW.variant_id
    AND (
      NEW.product_id <> OLD.product_id
      OR NEW.variant_id IS NOT OLD.variant_id
    );
END;

CREATE TRIGGER trg_inventory_sync_variant_status_delete
AFTER DELETE ON warehouse_inventory
FOR EACH ROW
WHEN OLD.variant_id IS NOT NULL
BEGIN
  UPDATE product_variants
  SET
    status = CASE
      WHEN status = 'active'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = OLD.product_id
            AND variant_id = OLD.variant_id
        ) <= 0
        THEN 'out_of_stock'
      WHEN status = 'out_of_stock'
        AND (
          SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
          FROM warehouse_inventory
          WHERE product_id = OLD.product_id
            AND variant_id = OLD.variant_id
        ) > 0
        THEN 'active'
      ELSE status
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE product_id = OLD.product_id
    AND variant_id = OLD.variant_id;
END;

-- =========================================================
-- 12. INVENTORY MOVEMENT AUDIT IMMUTABILITY (2)
-- Corrections must be new adjustment movements.
-- =========================================================

CREATE TRIGGER trg_inventory_movement_no_update
BEFORE UPDATE ON inventory_movements
FOR EACH ROW
BEGIN
  SELECT RAISE(
    ABORT,
    'Không được sửa lịch sử biến động kho; hãy tạo movement adjustment mới'
  );
END;

CREATE TRIGGER trg_inventory_movement_no_delete
BEFORE DELETE ON inventory_movements
FOR EACH ROW
BEGIN
  SELECT RAISE(
    ABORT,
    'Không được xóa lịch sử biến động kho'
  );
END;

-- =========================================================
-- 13. ORDER FULFILLMENT CONSISTENCY (2)
-- - Total non-cancelled fulfillment quantity cannot exceed order item.
-- - Warehouse must belong to same shop and have inventory row for
--   the order item's product/variant.
-- IMPORTANT: stock reservation itself belongs in Worker service/batch.
-- =========================================================

CREATE TRIGGER trg_fulfillment_validate_insert
BEFORE INSERT ON order_fulfillments
FOR EACH ROW
WHEN
  NOT EXISTS (
    SELECT 1
    FROM order_items AS oi
    INNER JOIN warehouse_inventory AS wi
      ON wi.shop_id = oi.shop_id
     AND wi.warehouse_id = NEW.warehouse_id
     AND wi.product_id = oi.product_id
     AND (
       wi.variant_id = oi.variant_id
       OR (
         wi.variant_id IS NULL
         AND oi.variant_id IS NULL
       )
     )
    WHERE oi.order_item_id = NEW.order_item_id
      AND oi.shop_id = NEW.shop_id
  )
  OR (
    SELECT COALESCE(SUM(ofl.quantity), 0)
    FROM order_fulfillments AS ofl
    WHERE ofl.order_item_id = NEW.order_item_id
      AND ofl.status <> 'cancelled'
  ) + CASE
        WHEN NEW.status = 'cancelled'
          THEN 0
        ELSE NEW.quantity
      END
    > (
      SELECT oi.quantity
      FROM order_items AS oi
      WHERE oi.order_item_id = NEW.order_item_id
        AND oi.shop_id = NEW.shop_id
    )
BEGIN
  SELECT RAISE(
    ABORT,
    'Fulfillment không khớp kho/sản phẩm hoặc vượt số lượng order item'
  );
END;

CREATE TRIGGER trg_fulfillment_validate_update
BEFORE UPDATE OF order_item_id, shop_id, warehouse_id, quantity, status
ON order_fulfillments
FOR EACH ROW
WHEN
  NOT EXISTS (
    SELECT 1
    FROM order_items AS oi
    INNER JOIN warehouse_inventory AS wi
      ON wi.shop_id = oi.shop_id
     AND wi.warehouse_id = NEW.warehouse_id
     AND wi.product_id = oi.product_id
     AND (
       wi.variant_id = oi.variant_id
       OR (
         wi.variant_id IS NULL
         AND oi.variant_id IS NULL
       )
     )
    WHERE oi.order_item_id = NEW.order_item_id
      AND oi.shop_id = NEW.shop_id
  )
  OR (
    SELECT COALESCE(SUM(ofl.quantity), 0)
    FROM order_fulfillments AS ofl
    WHERE ofl.order_item_id = NEW.order_item_id
      AND ofl.fulfillment_id <> OLD.fulfillment_id
      AND ofl.status <> 'cancelled'
  ) + CASE
        WHEN NEW.status = 'cancelled'
          THEN 0
        ELSE NEW.quantity
      END
    > (
      SELECT oi.quantity
      FROM order_items AS oi
      WHERE oi.order_item_id = NEW.order_item_id
        AND oi.shop_id = NEW.shop_id
    )
BEGIN
  SELECT RAISE(
    ABORT,
    'Fulfillment không khớp kho/sản phẩm hoặc vượt số lượng order item'
  );
END;

-- =========================================================
-- 14. CATEGORY BUSINESS ORDER: "Ưu đãi" ALWAYS FIRST (2)
-- UI/API should still ORDER BY sort_order, category_id.
-- =========================================================

CREATE TRIGGER trg_category_uu_dai_sort_insert
AFTER INSERT ON categories
FOR EACH ROW
WHEN NEW.slug = 'uu-dai'
  AND NEW.sort_order <> 0
BEGIN
  UPDATE categories
  SET
    sort_order = 0,
    updated_at = CURRENT_TIMESTAMP
  WHERE category_id = NEW.category_id;
END;

CREATE TRIGGER trg_category_uu_dai_sort_update
AFTER UPDATE OF slug, sort_order ON categories
FOR EACH ROW
WHEN NEW.slug = 'uu-dai'
  AND NEW.sort_order <> 0
BEGIN
  UPDATE categories
  SET
    sort_order = 0,
    updated_at = CURRENT_TIMESTAMP
  WHERE category_id = NEW.category_id;
END;