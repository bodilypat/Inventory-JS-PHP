<?php

declare(strict_types=1);

final class Inventory
{
    public function __construct(
        private PDO $db
    ) {
    }

    /**
     * Get inventory record by product ID.
     */
    public function findByProductId(int $productId): ?array
    {
        $sql = "
            SELECT
                i.id,
                i.product_id,
                i.quantity,
                i.updated_at,

                p.name AS product_name,
                p.sku,
                p.barcode,
                p.minimum_stock,
                p.maximum_stock,
                p.unit,
                p.is_active,

                c.id AS category_id,
                c.name AS category_name

            FROM inventory i

            INNER JOIN products p
                ON p.id = i.product_id

            LEFT JOIN categories c
                ON c.id = p.category_id

            WHERE i.product_id = :product_id

            LIMIT 1
        ";

        $stmt = $this->db->prepare($sql);

        $stmt->execute([
            'product_id' => $productId
        ]);

        $inventory = $stmt->fetch();

        return $inventory ?: null;
    }

    /**
     * Get inventory record by inventory ID.
     */
    public function find(int $id): ?array
    {
        $sql = "
            SELECT
                i.id,
                i.product_id,
                i.quantity,
                i.updated_at,

                p.name AS product_name,
                p.sku,
                p.barcode,
                p.minimum_stock,
                p.maximum_stock,
                p.unit,
                p.is_active,

                c.id AS category_id,
                c.name AS category_name

            FROM inventory i

            INNER JOIN products p
                ON p.id = i.product_id

            LEFT JOIN categories c
                ON c.id = p.category_id

            WHERE i.id = :id

            LIMIT 1
        ";

        $stmt = $this->db->prepare($sql);

        $stmt->execute([
            'id' => $id
        ]);

        $inventory = $stmt->fetch();

        return $inventory ?: null;
    }

    /**
     * Create inventory record for a product.
     */
    public function create(
        int $productId,
        int $quantity = 0
    ): int {
        $sql = "
            INSERT INTO inventory (
                product_id,
                quantity,
                updated_at
            )
            VALUES (
                :product_id,
                :quantity,
                NOW()
            )
        ";

        $stmt = $this->db->prepare($sql);

        $stmt->execute([
            'product_id' => $productId,
            'quantity' => $quantity
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Check whether an inventory record exists.
     */
    public function exists(int $productId): bool
    {
        $stmt = $this->db->prepare("
            SELECT 1
            FROM inventory
            WHERE product_id = :product_id
            LIMIT 1
        ");

        $stmt->execute([
            'product_id' => $productId
        ]);

        return (bool) $stmt->fetchColumn();
    }

    /**
     * Get current stock quantity.
     */
    public function getQuantity(int $productId): int
    {
        $stmt = $this->db->prepare("
            SELECT quantity
            FROM inventory
            WHERE product_id = :product_id
            LIMIT 1
        ");

        $stmt->execute([
            'product_id' => $productId
        ]);

        $quantity = $stmt->fetchColumn();

        return $quantity === false
            ? 0
            : (int) $quantity;
    }

    /**
     * Set the absolute inventory quantity.
     *
     * Business validation should be handled by InventoryService.
     */
    public function setQuantity(
        int $productId,
        int $quantity
    ): bool {
        $stmt = $this->db->prepare("
            UPDATE inventory
            SET
                quantity = :quantity,
                updated_at = NOW()
            WHERE product_id = :product_id
        ");

        return $stmt->execute([
            'product_id' => $productId,
            'quantity' => $quantity
        ]);
    }

    /**
     * Increase stock.
     *
     * This method is useful inside a transaction.
     */
    public function increase(
        int $productId,
        int $quantity
    ): bool {
        if ($quantity <= 0) {
            throw new InvalidArgumentException(
                'Quantity must be greater than zero.'
            );
        }

        $stmt = $this->db->prepare("
            UPDATE inventory
            SET
                quantity = quantity + :quantity,
                updated_at = NOW()
            WHERE product_id = :product_id
        ");

        return $stmt->execute([
            'product_id' => $productId,
            'quantity' => $quantity
        ]);
    }

    /**
     * Decrease stock.
     *
     * The SQL condition prevents the quantity from going below zero.
     */
    public function decrease(
        int $productId,
        int $quantity
    ): bool {
        if ($quantity <= 0) {
            throw new InvalidArgumentException(
                'Quantity must be greater than zero.'
            );
        }

        $stmt = $this->db->prepare("
            UPDATE inventory
            SET
                quantity = quantity - :quantity,
                updated_at = NOW()
            WHERE
                product_id = :product_id
                AND quantity >= :quantity
        ");

        $stmt->execute([
            'product_id' => $productId,
            'quantity' => $quantity
        ]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Get all inventory records with filtering and pagination.
     */
    public function list(array $filters = []): array
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

            $params['search'] =
                '%' . $filters['search'] . '%';
        }

        if (
            isset($filters['category_id']) &&
            $filters['category_id'] !== null &&
            $filters['category_id'] !== ''
        ) {
            $where[] = 'p.category_id = :category_id';

            $params['category_id'] =
                (int) $filters['category_id'];
        }

        if (($filters['status'] ?? '') === 'in_stock') {
            $where[] = 'i.quantity > 0';
        }

        if (($filters['status'] ?? '') === 'out_of_stock') {
            $where[] = 'i.quantity = 0';
        }

        if (($filters['status'] ?? '') === 'low_stock') {
            $where[] = '
                i.quantity > 0
                AND i.quantity <= p.minimum_stock
            ';
        }

        if (($filters['status'] ?? '') === 'over_stock') {
            $where[] = '
                p.maximum_stock IS NOT NULL
                AND i.quantity > p.maximum_stock
            ';
        }

        if (($filters['active'] ?? '') !== '') {
            $where[] = 'p.is_active = :is_active';

            $params['is_active'] =
                (int) $filters['active'];
        }

        $whereSql = '';

        if ($where) {
            $whereSql = 'WHERE ' . implode(' AND ', $where);
        }

        $sortMap = [
            'name_asc' => 'p.name ASC',
            'name_desc' => 'p.name DESC',
            'stock_asc' => 'i.quantity ASC',
            'stock_desc' => 'i.quantity DESC',
            'category_asc' => 'c.name ASC',
            'category_desc' => 'c.name DESC',
            'updated_desc' => 'i.updated_at DESC',
            'updated_asc' => 'i.updated_at ASC'
        ];

        $sort = $sortMap[
            $filters['sort'] ?? 'name_asc'
        ] ?? 'p.name ASC';

        /*
         * Count total records.
         */
        $countSql = "
            SELECT COUNT(*)

            FROM inventory i

            INNER JOIN products p
                ON p.id = i.product_id

            LEFT JOIN categories c
                ON c.id = p.category_id

            $whereSql
        ";

        $countStmt = $this->db->prepare($countSql);

        $this->bindParameters(
            $countStmt,
            $params
        );

        $countStmt->execute();

        $total = (int) $countStmt->fetchColumn();

        /*
         * Pagination.
         */
        $perPage = (int) (
            $filters['per_page'] ?? 10
        );

        $perPage = max(
            1,
            min($perPage, 100)
        );

        $page = max(
            1,
            (int) ($filters['page'] ?? 1)
        );

        $offset = ($page - 1) * $perPage;

        /*
         * Get records.
         */
        $sql = "
            SELECT
                i.id,
                i.product_id,
                i.quantity,
                i.updated_at,

                p.name AS product_name,
                p.sku,
                p.barcode,
                p.cost_price,
                p.selling_price,
                p.minimum_stock,
                p.maximum_stock,
                p.unit,
                p.is_active,

                c.id AS category_id,
                c.name AS category_name

            FROM inventory i

            INNER JOIN products p
                ON p.id = i.product_id

            LEFT JOIN categories c
                ON c.id = p.category_id

            $whereSql

            ORDER BY $sort

            LIMIT :limit
            OFFSET :offset
        ";

        $stmt = $this->db->prepare($sql);

        $this->bindParameters(
            $stmt,
            $params
        );

        $stmt->bindValue(
            ':limit',
            $perPage,
            PDO::PARAM_INT
        );

        $stmt->bindValue(
            ':offset',
            $offset,
            PDO::PARAM_INT
        );

        $stmt->execute();

        $items = $stmt->fetchAll();

        return [
            'items' => array_map(
                fn(array $item): array =>
                    $this->format($item),
                $items
            ),

            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => $total > 0
                    ? (int) ceil($total / $perPage)
                    : 1
            ]
        ];
    }

    /**
     * Get low-stock products.
     */
    public function lowStock(
        int $limit = 100
    ): array {
        $limit = max(
            1,
            min($limit, 1000)
        );

        $sql = "
            SELECT
                i.id,
                i.product_id,
                i.quantity,

                p.name AS product_name,
                p.sku,
                p.minimum_stock,
                p.maximum_stock,
                p.unit,

                c.name AS category_name

            FROM inventory i

            INNER JOIN products p
                ON p.id = i.product_id

            LEFT JOIN categories c
                ON c.id = p.category_id

            WHERE
                p.is_active = 1
                AND i.quantity <= p.minimum_stock

            ORDER BY
                i.quantity ASC,
                p.name ASC

            LIMIT :limit
        ";

        $stmt = $this->db->prepare($sql);

        $stmt->bindValue(
            ':limit',
            $limit,
            PDO::PARAM_INT
        );

        $stmt->execute();

        return array_map(
            fn(array $item): array =>
                $this->format($item),
            $stmt->fetchAll()
        );
    }

    /**
     * Lock an inventory row for update.
     *
     * Must be called while a database transaction is active.
     */
    public function findForUpdate(
        int $productId
    ): ?array {
        $sql = "
            SELECT
                i.id,
                i.product_id,
                i.quantity,
                p.name AS product_name,
                p.sku,
                p.minimum_stock,
                p.maximum_stock,
                p.unit

            FROM inventory i

            INNER JOIN products p
                ON p.id = i.product_id

            WHERE i.product_id = :product_id

            LIMIT 1

            FOR UPDATE
        ";

        $stmt = $this->db->prepare($sql);

        $stmt->execute([
            'product_id' => $productId
        ]);

        $inventory = $stmt->fetch();

        return $inventory ?: null;
    }

    /**
     * Get inventory summary.
     */
    public function statistics(): array
    {
        $sql = "
            SELECT
                COUNT(*) AS total_items,

                COALESCE(
                    SUM(i.quantity),
                    0
                ) AS total_quantity,

                SUM(
                    CASE
                        WHEN i.quantity = 0
                        THEN 1
                        ELSE 0
                    END
                ) AS out_of_stock,

                SUM(
                    CASE
                        WHEN i.quantity > 0
                         AND i.quantity <= p.minimum_stock
                        THEN 1
                        ELSE 0
                    END
                ) AS low_stock,

                SUM(
                    CASE
                        WHEN p.maximum_stock IS NOT NULL
                         AND i.quantity > p.maximum_stock
                        THEN 1
                        ELSE 0
                    END
                ) AS over_stock

            FROM inventory i

            INNER JOIN products p
                ON p.id = i.product_id

            WHERE p.is_active = 1
        ";

        $stmt = $this->db->query($sql);

        $result = $stmt->fetch();

        return [
            'total_items' =>
                (int) ($result['total_items'] ?? 0),

            'total_quantity' =>
                (int) ($result['total_quantity'] ?? 0),

            'out_of_stock' =>
                (int) ($result['out_of_stock'] ?? 0),

            'low_stock' =>
                (int) ($result['low_stock'] ?? 0),

            'over_stock' =>
                (int) ($result['over_stock'] ?? 0)
        ];
    }

    /**
     * Bind parameters safely.
     */
    private function bindParameters(
        PDOStatement $stmt,
        array $params
    ): void {
        foreach ($params as $key => $value) {
            $type = is_int($value)
                ? PDO::PARAM_INT
                : PDO::PARAM_STR;

            $stmt->bindValue(
                ':' . $key,
                $value,
                $type
            );
        }
    }

    /**
     * Format inventory response.
     */
    private function format(
        array $inventory
    ): array {
        $quantity = (int) (
            $inventory['quantity'] ?? 0
        );

        $minimumStock = (int) (
            $inventory['minimum_stock'] ?? 0
        );

        $maximumStock = isset(
            $inventory['maximum_stock']
        ) && $inventory['maximum_stock'] !== null
            ? (int) $inventory['maximum_stock']
            : null;

        if ($quantity <= 0) {
            $stockStatus = 'out_of_stock';
        } elseif ($quantity <= $minimumStock) {
            $stockStatus = 'low_stock';
        } elseif (
            $maximumStock !== null &&
            $quantity > $maximumStock
        ) {
            $stockStatus = 'over_stock';
        } else {
            $stockStatus = 'in_stock';
        }

        return [
            'id' => (int) $inventory['id'],

            'product_id' =>
                (int) $inventory['product_id'],

            'product_name' =>
                $inventory['product_name'] ?? null,

            'sku' =>
                $inventory['sku'] ?? null,

            'barcode' =>
                $inventory['barcode'] ?? null,

            'category_id' =>
                isset($inventory['category_id'])
                    ? (int) $inventory['category_id']
                    : null,

            'category_name' =>
                $inventory['category_name'] ?? null,

            'quantity' => $quantity,

            'minimum_stock' => $minimumStock,

            'maximum_stock' => $maximumStock,

            'unit' =>
                $inventory['unit'] ?? 'pcs',

            'cost_price' =>
                isset($inventory['cost_price'])
                    ? (float) $inventory['cost_price']
                    : null,

            'selling_price' =>
                isset($inventory['selling_price'])
                    ? (float) $inventory['selling_price']
                    : null,

            'is_active' =>
                isset($inventory['is_active'])
                    ? (bool) $inventory['is_active']
                    : true,

            'stock_status' => $stockStatus,

            'updated_at' =>
                $inventory['updated_at'] ?? null
        ];
    }
}
