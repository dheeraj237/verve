# PostgreSQL - Answers

## Question 1: JSONB in PostgreSQL

📋 **[Back to Question](../sse-topics.md#postgresql)** | **Topic:** PostgreSQL advanced features

**Detailed Answer:**

#### What is JSONB?

JSONB is PostgreSQL's binary JSON storage format - more efficient than regular JSON text storage.

```sql
-- Create table with JSONB column
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    attributes JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert data
INSERT INTO products (name, attributes) VALUES
    ('Laptop', '{"brand": "Dell", "ram": "16GB", "storage": "512GB SSD", "color": "silver"}'),
    ('Phone', '{"brand": "Apple", "storage": "256GB", "color": "black", "5g": true}'),
    ('Monitor', '{"brand": "LG", "size": "27 inch", "resolution": "4K", "refresh_rate": 144}');
```

#### Querying JSONB

```sql
-- Access specific field (returns JSON)
SELECT name, attributes->'brand' as brand
FROM products;

-- Access as text (returns text)
SELECT name, attributes->>'brand' as brand
FROM products
WHERE attributes->>'brand' = 'Apple';

-- Nested access
SELECT name, attributes->'specs'->>'cpu' as cpu
FROM products;

-- Check if key exists
SELECT name FROM products
WHERE attributes ? 'ram';

-- Check multiple keys exist (ALL)
SELECT name FROM products
WHERE attributes ?& array['brand', 'storage'];

-- Check any key exists (OR)
SELECT name FROM products
WHERE attributes ?| array['5g', 'wifi'];

-- Contains operator
SELECT name FROM products
WHERE attributes @> '{"brand": "Dell"}';

-- Contained by
SELECT name FROM products
WHERE '{"brand": "Dell"}' <@ attributes;
```

#### JSONB Indexing

```sql
-- GIN Index (Generalized Inverted Index) for fast lookups
CREATE INDEX idx_products_attributes ON products USING GIN (attributes);

-- Index specific path (more efficient)
CREATE INDEX idx_products_brand ON products ((attributes->>'brand'));

-- Query using index
EXPLAIN ANALYZE
SELECT * FROM products 
WHERE attributes @> '{"brand": "Apple"}';
-- Uses: Index Scan using idx_products_attributes

-- Index for existence checks
CREATE INDEX idx_products_keys ON products USING GIN (attributes jsonb_path_ops);
```

#### Updating JSONB

```sql
-- Add/update field
UPDATE products
SET attributes = attributes || '{"warranty": "2 years"}'
WHERE id = 1;

-- Update nested field
UPDATE products
SET attributes = jsonb_set(attributes, '{specs,cpu}', '"Intel i7"')
WHERE id = 1;

-- Remove field
UPDATE products
SET attributes = attributes - 'color'
WHERE id = 1;

-- Remove multiple fields
UPDATE products
SET attributes = attributes - array['color', 'size'];

-- Remove nested field
UPDATE products
SET attributes = attributes #- '{specs,old_field}'
WHERE id = 1;
```

#### Advanced JSONB Operations

```sql
-- Aggregate JSONB
SELECT jsonb_agg(attributes) FROM products;

-- Build JSONB object
SELECT jsonb_build_object(
    'product_name', name,
    'brand', attributes->>'brand',
    'price', 999.99
) FROM products;

-- Array elements
CREATE TABLE orders (
    id SERIAL,
    items JSONB
);

INSERT INTO orders (items) VALUES
    ('[{"product": "laptop", "qty": 1}, {"product": "mouse", "qty": 2}]');

-- Expand array elements
SELECT jsonb_array_elements(items) as item
FROM orders;

-- Filter array elements
SELECT id, 
       jsonb_path_query_array(items, '$[*] ? (@.qty > 1)') as high_qty_items
FROM orders;
```

#### When to Use JSONB vs Traditional Schema

**Use JSONB When:**

1. **Flexible/Variable Schema**
```sql
-- Product attributes vary by category
-- Electronics: brand, ram, storage
-- Clothing: size, color, material
-- Books: author, isbn, publisher

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50),
    name VARCHAR(255),
    attributes JSONB  -- Flexible per category
);
```

2. **Audit Logs / Event Tracking**
```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(50),
    entity_type VARCHAR(50),
    entity_id BIGINT,
    changes JSONB,  -- Before/after values
    metadata JSONB,  -- IP, user agent, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
VALUES (123, 'UPDATE', 'user', 456, 
    '{"before": {"email": "old@example.com"}, "after": {"email": "new@example.com"}}');
```

3. **API Response Caching**
```sql
CREATE TABLE api_cache (
    key VARCHAR(255) PRIMARY KEY,
    response JSONB,
    expires_at TIMESTAMP
);

-- Cache third-party API response
INSERT INTO api_cache VALUES
    ('weather:NYC', '{"temp": 72, "humidity": 65, "conditions": "sunny"}', NOW() + INTERVAL '1 hour');
```

4. **User Preferences/Settings**
```sql
CREATE TABLE user_preferences (
    user_id BIGINT PRIMARY KEY,
    preferences JSONB DEFAULT '{}'
);

-- Different users have different preferences
INSERT INTO user_preferences VALUES
    (1, '{"theme": "dark", "notifications": true, "language": "en"}'),
    (2, '{"theme": "light", "email_digest": "weekly", "timezone": "PST"}');
```

**Use Traditional Schema When:**

1. **Fixed schema with strong relationships**
2. **Need foreign key constraints**
3. **Frequent complex JOINs**
4. **Data integrity is critical**
5. **Queries primarily on specific columns**

#### Performance Considerations

```sql
-- ✅ GOOD: Index on extracted field for frequent queries
CREATE INDEX idx_user_prefs_theme ON user_preferences ((preferences->>'theme'));

SELECT * FROM user_preferences 
WHERE preferences->>'theme' = 'dark';
-- Fast: Uses index

-- ❌ BAD: No index on JSONB query
SELECT * FROM products
WHERE attributes->>'brand' = 'Apple' 
  AND attributes->>'storage' > '128GB';
-- Slow: Sequential scan

-- ✅ BETTER: Containment query with GIN index
CREATE INDEX idx_products_attrs_gin ON products USING GIN (attributes);

SELECT * FROM products
WHERE attributes @> '{"brand": "Apple"}';
-- Fast: Uses GIN index
```

#### Hybrid Approach (Best Practice)

```sql
-- Combine traditional columns for frequent queries
-- with JSONB for flexible data
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    brand VARCHAR(100),  -- Extracted for frequent queries
    attributes JSONB,    -- Additional flexible data
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index both
CREATE INDEX idx_products_brand ON products (brand);
CREATE INDEX idx_products_attributes ON products USING GIN (attributes);

-- Query efficiently
SELECT * FROM products
WHERE brand = 'Apple'  -- Uses B-tree index
  AND price < 1000
  AND attributes @> '{"storage": "256GB"}';  -- Uses GIN index
```

---

## Question 2: PostgreSQL Query Optimization (5 Table Join)

📋 **[Back to Question](../sse-topics.md#postgresql)** | **Topic:** PostgreSQL query optimization

**Detailed Answer:**

See detailed answer in [Database Knowledge Q3: Query Optimization for Large Tables](#question-3-query-optimization-for-large-tables) which covers comprehensive optimization techniques including multi-table joins.

**Additional PostgreSQL-Specific Tips:**

```sql
-- Update statistics
ANALYZE users, orders, products, order_items, categories;

-- Check table bloat
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- VACUUM to reclaim space
VACUUM ANALYZE users;

-- Increase work_mem for complex queries (session-level)
SET work_mem = '256MB';

-- Check query plan with buffers
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT ...;
```

---

