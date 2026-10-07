<?php
declare(strict_types=1);
final class Product
{
    public function __construct(
        private PDO $db
    ) {
    }
    public function find(int $id): ?array
    {
        $sql = "
            SELECT
                p.*,
                c.name AS category_name,
                COALESCE(i.quantity, 0) AS quantity
            FROM products p
            LEFT JOIN categories c
                ON c.id = p.category_id
            LEFT JOIN inventory i
                ON i.product_id = p.id
            WHERE p.id = :id
            LIMIT 1
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['id' => $id]);
        $product = $stmt->fetch();
        if (!$product) {
            return null;
        }
        return $this->format($product);
    }
    public function findBySku(string $sku): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id FROM products WHERE sku = :sku LIMIT 1'
        );
        $stmt->execute(['sku' => $sku]);
        $product = $stmt->fetch();
        return $product ?: null;
    }
    public function create(array $data): int
    {
        $sql = "
            INSERT INTO products (
                name,
                sku,
                barcode,
                category_id,
                description,
                cost_price,
                selling_price,
                tax_rate,
                minimum_stock,
                maximum_stock,
                unit,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                :name,
                :sku,
                :barcode,
                :category_id,
                :description,
                :cost_price,
                :selling_price,
                :tax_rate,
                :minimum_stock,
                :maximum_stock,
                :unit,
                :is_active,
                NOW(),
                NOW()
            )
        ";

        $stmt = $this->db->prepare($sql);

        $stmt->execute([
            'name' => $data['name'],
            'sku' => $data['sku'],
            'barcode' => $data['barcode'],
            'category_id' => $data['category_id'],
            'description' => $data['description'],
            'cost_price' => $data['cost_price'],
            'selling_price' => $data['selling_price'],
            'tax_rate' => $data['tax_rate'],
            'minimum_stock' => $data['minimum_stock'],
            'maximum_stock' => $data['maximum_stock'],
            'unit' => $data['unit'],
            'is_active' => $data['is_active'],
        ]);

        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool
    {
        $sql = "
            UPDATE products
            SET
                name = :name,
                sku = :sku,
                barcode = :barcode,
                category_id = :category_id,
                description = :description,
                cost_price = :cost_price,
                selling_price = :selling_price,
                tax_rate = :tax_rate,
                minimum_stock = :minimum_stock,
                maximum_stock = :maximum_stock,
                unit = :unit,
                is_active = :is_active,
                updated_at = NOW()
            WHERE id = :id
        ";

        $stmt = $this->db->prepare($sql);

        return $stmt->execute([
            'id' => $id,
            'name' => $data['name'],
            'sku' => $data['sku'],
            'barcode' => $data['barcode'],
            'category_id' => $data['category_id'],
            'description' => $data['description'],
            'cost_price' => $data['cost_price'],
            'selling_price' => $data['selling_price'],
            'tax_rate' => $data['tax_rate'],
            'minimum_stock' => $data['minimum_stock'],
            'maximum_stock' => $data['maximum_stock'],
            'unit' => $data['unit'],
            'is_active' => $data['is_active'],
        ]);
    }
    public function delete(int $id): bool
    {
        /*
         * Soft delete is safer for inventory systems because
         * historical sales/purchases should remain intact.
         */
        $stmt = $this->db->prepare(
            'UPDATE products SET is_active = 0, updated_at = NOW()
             WHERE id = :id'
        );
        return $stmt->execute(['id' => $id]);
    }
    public function list(array $filters): array
    {
        $where = [];
        $params = [];

        if (!empty($filters['search'])) {
            $where[] = "
                (
                    p.name LIKE :search
                    OR p.sku LIKE :search
                    OR p.barcode LIKE :search
                )
            ";

            $params['search'] = '%' . $filters['search'] . '%';
        }

        if ($filters['category_id'] !== null) {
            $where[] = 'p.category_id = :category_id';
            $params['category_id'] = $filters['category_id'];
        }

        if ($filters['status'] === 'active') {
            $where[] = 'p.is_active = 1';
        }

        if ($filters['status'] === 'inactive') {
            $where[] = 'p.is_active = 0';
        }

        if ($filters['status'] === 'in_stock') {
            $where[] = 'COALESCE(i.quantity, 0) > 0';
        }

        if ($filters['status'] === 'out_of_stock') {
            $where[] = 'COALESCE(i.quantity, 0) = 0';
        }

        if ($filters['status'] === 'low_stock') {
            $where[] = '
                COALESCE(i.quantity, 0) > 0
                AND COALESCE(i.quantity, 0) <= p.minimum_stock
            ';
        }

        $whereSql = $where
            ? 'WHERE ' . implode(' AND ', $where)
            : '';

        $sortMap = [
            'name_asc' => 'p.name ASC',
            'name_desc' => 'p.name DESC',
            'stock_asc' => 'quantity ASC',
            'stock_desc' => 'quantity DESC',
            'price_asc' => 'p.selling_price ASC',
            'price_desc' => 'p.selling_price DESC',
        ];

        $sort = $sortMap[$filters['sort']] ?? 'p.name ASC';

        $countSql = "
            SELECT COUNT(*)
            FROM products p
            LEFT JOIN inventory i
                ON i.product_id = p.id
            $whereSql
        ";
        $countStmt = $this->db->prepare($countSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();
        $sql = "
            SELECT
                p.*,
                c.name AS category_name,
                COALESCE(i.quantity, 0) AS quantity
            FROM products p
            LEFT JOIN categories c
                ON c.id = p.category_id
            LEFT JOIN inventory i
                ON i.product_id = p.id
            $whereSql
            ORDER BY $sort
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $this->db->prepare($sql);

        foreach ($params as $key => $value) {
            $stmt->bindValue(
                ':' . $key,
                $value,
                is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR
            );
        }
        $stmt->bindValue(
            ':limit',
            $filters['per_page'],
            PDO::PARAM_INT
        );

        $stmt->bindValue(
            ':offset',
            $filters['offset'],
            PDO::PARAM_INT
        );
        $stmt->execute();

        $products = $stmt->fetchAll();

        return [
            'items' => array_map(
                fn(array $product): array => $this->format($product),
                $products
            ),
            'total' => $total,
        ];
    }
    public function statistics(): array
    {
        $sql = "
            SELECT
                COUNT(*) AS total_products,
                SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END)
                    AS active_products,
                SUM(
                    CASE
                        WHEN COALESCE(i.quantity, 0) > 0
                         AND COALESCE(i.quantity, 0) <= p.minimum_stock
                        THEN 1
                        ELSE 0
                    END
                ) AS low_stock_products,
                SUM(
                    CASE
                        WHEN COALESCE(i.quantity, 0) = 0
                        THEN 1
                        ELSE 0
                    END
                ) AS out_of_stock_products
            FROM products p
            LEFT JOIN inventory i
                ON i.product_id = p.id
        ";

        $stmt = $this->db->query($sql);

        $result = $stmt->fetch();

        return [
            'total_products' => (int) ($result['total_products'] ?? 0),
            'active_products' => (int) ($result['active_products'] ?? 0),
            'low_stock_products' => (int) ($result['low_stock_products'] ?? 0),
            'out_of_stock_products' =>
                (int) ($result['out_of_stock_products'] ?? 0),
        ];
    }

    private function format(array $product): array
    {
        $quantity = (int) ($product['quantity'] ?? 0);
        $minimumStock = (int) ($product['minimum_stock'] ?? 0);

        if ($quantity <= 0) {
            $stockStatus = 'out_of_stock';
        } elseif ($quantity <= $minimumStock) {
            $stockStatus = 'low_stock';
        } else {
            $stockStatus = 'in_stock';
        }

        return [
            'id' => (int) $product['id'],
            'name' => $product['name'],
            'sku' => $product['sku'],
            'barcode' => $product['barcode'],
            'description' => $product['description'],
            'category_id' => $product['category_id']
                ? (int) $product['category_id']
                : null,
            'category_name' => $product['category_name'],
            'cost_price' => (float) $product['cost_price'],
            'selling_price' => (float) $product['selling_price'],
            'tax_rate' => (float) $product['tax_rate'],
            'minimum_stock' => $minimumStock,
            'maximum_stock' => $product['maximum_stock'] !== null
                ? (int) $product['maximum_stock']
                : null,
            'unit' => $product['unit'],
            'quantity' => $quantity,
            'is_active' => (bool) $product['is_active'],
            'stock_status' => $stockStatus,
            'created_at' => $product['created_at'],
            'updated_at' => $product['updated_at'],
        ];
    }
}
