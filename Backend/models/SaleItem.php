<?php

declare(strict_types=1);

class SaleItem
{
    private PDO $db;

    private string $table = 'sale_items';

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Create a sale item.
     */
    public function create(array $data): int|false
    {
        $required = [
            'sale_id',
            'product_id',
            'quantity',
            'unit_price',
        ];

        foreach ($required as $field) {
            if (
                !array_key_exists($field, $data) ||
                $data[$field] === null
            ) {
                throw new InvalidArgumentException(
                    "{$field} is required."
                );
            }
        }

        $quantity = (int) $data['quantity'];
        $unitPrice = (float) $data['unit_price'];

        if ($quantity <= 0) {
            throw new InvalidArgumentException(
                'Sale item quantity must be greater than zero.'
            );
        }

        if ($unitPrice < 0) {
            throw new InvalidArgumentException(
                'Sale item unit price cannot be negative.'
            );
        }

        $sql = "
            INSERT INTO {$this->table} (
                sale_id,
                product_id,
                quantity,
                returned_quantity,
                unit_price,
                discount_amount,
                tax_amount,
                total_amount
            ) VALUES (
                :sale_id,
                :product_id,
                :quantity,
                :returned_quantity,
                :unit_price,
                :discount_amount,
                :tax_amount,
                :total_amount
            )
        ";

        $statement = $this->db->prepare($sql);

        $success = $statement->execute([
            ':sale_id' => (int) $data['sale_id'],

            ':product_id' => (int) $data['product_id'],

            ':quantity' => $quantity,

            ':returned_quantity' =>
                (int) ($data['returned_quantity'] ?? 0),

            ':unit_price' => $unitPrice,

            ':discount_amount' =>
                (float) ($data['discount_amount'] ?? 0),

            ':tax_amount' =>
                (float) ($data['tax_amount'] ?? 0),

            ':total_amount' =>
                (float) ($data['total_amount'] ?? (
                    $quantity * $unitPrice
                )),
        ]);

        if (!$success) {
            return false;
        }

        return (int) $this->db->lastInsertId();
    }

    /**
     * Find a sale item by ID.
     */
    public function find(int $id): ?array
    {
        if ($id <= 0) {
            return null;
        }

        $sql = "
            SELECT
                si.*,
                p.name AS product_name,
                p.sku,
                p.barcode,
                p.selling_price,
                p.cost_price
            FROM {$this->table} si
            INNER JOIN products p
                ON p.id = si.product_id
            WHERE si.id = :id
            LIMIT 1
        ";

        $statement = $this->db->prepare($sql);

        $statement->execute([
            ':id' => $id,
        ]);

        $item = $statement->fetch(
            PDO::FETCH_ASSOC
        );

        return $item ?: null;
    }

    /**
     * Get all items belonging to a sale.
     */
    public function getBySaleId(
        int $saleId
    ): array {
        if ($saleId <= 0) {
            return [];
        }

        $sql = "
            SELECT
                si.*,
                p.name AS product_name,
                p.sku,
                p.barcode,
                p.selling_price,
                p.cost_price,
                c.name AS category_name
            FROM {$this->table} si
            INNER JOIN products p
                ON p.id = si.product_id
            LEFT JOIN categories c
                ON c.id = p.category_id
            WHERE si.sale_id = :sale_id
            ORDER BY si.id ASC
        ";

        $statement = $this->db->prepare($sql);

        $statement->execute([
            ':sale_id' => $saleId,
        ]);

        return $statement->fetchAll(
            PDO::FETCH_ASSOC
        );
    }

    /**
     * Update a sale item.
     */
    public function update(
        int $id,
        array $data
    ): bool {
        if ($id <= 0 || empty($data)) {
            return false;
        }

        $allowedFields = [
            'product_id',
            'quantity',
            'returned_quantity',
            'unit_price',
            'discount_amount',
            'tax_amount',
            'total_amount',
        ];

        $fields = [];
        $params = [
            ':id' => $id,
        ];

        foreach ($allowedFields as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }

            $fields[] = "{$field} = :{$field}";
            $params[":{$field}"] = $data[$field];
        }

        if (empty($fields)) {
            return false;
        }

        $sql = "
            UPDATE {$this->table}
            SET " . implode(', ', $fields) . ",
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        ";

        $statement = $this->db->prepare($sql);

        return $statement->execute($params);
    }

    /**
     * Delete a single sale item.
     */
    public function delete(int $id): bool
    {
        if ($id <= 0) {
            return false;
        }

        $statement = $this->db->prepare(
            "DELETE FROM {$this->table}
             WHERE id = :id"
        );

        return $statement->execute([
            ':id' => $id,
        ]);
    }

    /**
     * Delete all items belonging to a sale.
     */
    public function deleteBySaleId(
        int $saleId
    ): bool {
        if ($saleId <= 0) {
            return false;
        }

        $statement = $this->db->prepare(
            "DELETE FROM {$this->table}
             WHERE sale_id = :sale_id"
        );

        return $statement->execute([
            ':sale_id' => $saleId,
        ]);
    }

    /**
     * Add returned quantity to a sale item.
     *
     * This method prevents returned quantity from exceeding
     * the originally sold quantity.
     */
    public function addReturnedQuantity(
        int $saleItemId,
        int $quantity
    ): bool {
        if ($saleItemId <= 0) {
            throw new InvalidArgumentException(
                'Invalid sale item ID.'
            );
        }

        if ($quantity <= 0) {
            throw new InvalidArgumentException(
                'Return quantity must be greater than zero.'
            );
        }

        $sql = "
            UPDATE {$this->table}
            SET
                returned_quantity =
                    returned_quantity + :quantity,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
              AND returned_quantity + :quantity <= quantity
        ";

        $statement = $this->db->prepare($sql);

        $statement->execute([
            ':quantity' => $quantity,
            ':id' => $saleItemId,
        ]);

        return $statement->rowCount() > 0;
    }

    /**
     * Set the returned quantity directly.
     */
    public function setReturnedQuantity(
        int $saleItemId,
        int $quantity
    ): bool {
        if ($saleItemId <= 0) {
            return false;
        }

        if ($quantity < 0) {
            throw new InvalidArgumentException(
                'Returned quantity cannot be negative.'
            );
        }

        $sql = "
            UPDATE {$this->table}
            SET
                returned_quantity = :returned_quantity,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
              AND :returned_quantity <= quantity
        ";

        $statement = $this->db->prepare($sql);

        $statement->execute([
            ':returned_quantity' => $quantity,
            ':id' => $saleItemId,
        ]);

        return $statement->rowCount() > 0;
    }

    /**
     * Get remaining quantity that can be returned.
     */
    public function getReturnableQuantity(
        int $saleItemId
    ): int {
        $sql = "
            SELECT
                GREATEST(
                    quantity - returned_quantity,
                    0
                ) AS returnable_quantity
            FROM {$this->table}
            WHERE id = :id
            LIMIT 1
        ";

        $statement = $this->db->prepare($sql);

        $statement->execute([
            ':id' => $saleItemId,
        ]);

        $quantity = $statement->fetchColumn();

        return $quantity === false
            ? 0
            : (int) $quantity;
    }

    /**
     * Check whether an item belongs to a particular sale.
     */
    public function belongsToSale(
        int $saleItemId,
        int $saleId
    ): bool {
        $sql = "
            SELECT COUNT(*)
            FROM {$this->table}
            WHERE id = :id
              AND sale_id = :sale_id
        ";

        $statement = $this->db->prepare($sql);

        $statement->execute([
            ':id' => $saleItemId,
            ':sale_id' => $saleId,
        ]);

        return (int) $statement->fetchColumn() > 0;
    }

    /**
     * Get sale item count.
     */
    public function countBySaleId(
        int $saleId
    ): int {
        $statement = $this->db->prepare(
            "SELECT COUNT(*)
             FROM {$this->table}
             WHERE sale_id = :sale_id"
        );

        $statement->execute([
            ':sale_id' => $saleId,
        ]);

        return (int) $statement->fetchColumn();
    }

    /**
     * Calculate the total quantity sold in a sale.
     */
    public function getTotalQuantity(
        int $saleId
    ): int {
        $statement = $this->db->prepare(
            "SELECT COALESCE(SUM(quantity), 0)
             FROM {$this->table}
             WHERE sale_id = :sale_id"
        );

        $statement->execute([
            ':sale_id' => $saleId,
        ]);

        return (int) $statement->fetchColumn();
    }

    /**
     * Calculate the total quantity returned in a sale.
     */
    public function getTotalReturnedQuantity(
        int $saleId
    ): int {
        $statement = $this->db->prepare(
            "SELECT COALESCE(
                SUM(returned_quantity),
                0
             )
             FROM {$this->table}
             WHERE sale_id = :sale_id"
        );

        $statement->execute([
            ':sale_id' => $saleId,
        ]);

        return (int) $statement->fetchColumn();
    }

    /**
     * Get all products sold within a date range.
     *
     * Useful for sales reports.
     */
    public function getProductSales(
        string $dateFrom,
        string $dateTo
    ): array {
        $sql = "
            SELECT
                si.product_id,
                p.name AS product_name,
                p.sku,

                SUM(si.quantity)
                    AS quantity_sold,

                SUM(si.returned_quantity)
                    AS quantity_returned,

                SUM(
                    si.quantity -
                    si.returned_quantity
                ) AS net_quantity,

                SUM(si.total_amount)
                    AS gross_sales

            FROM {$this->table} si

            INNER JOIN sales s
                ON s.id = si.sale_id

            INNER JOIN products p
                ON p.id = si.product_id

            WHERE DATE(s.sale_date)
                BETWEEN :date_from AND :date_to

              AND s.status NOT IN (
                  'cancelled'
              )

            GROUP BY
                si.product_id,
                p.name,
                p.sku

            ORDER BY
                net_quantity DESC
        ";

        $statement = $this->db->prepare($sql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        return $statement->fetchAll(
            PDO::FETCH_ASSOC
        );
    }
}
