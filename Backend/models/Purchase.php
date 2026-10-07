<?php

declare(strict_types=1);

class Purchase
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Get paginated purchases.
     */
    public function getAll(
        int $page = 1,
        int $perPage = 10,
        ?string $search = null,
        ?string $status = null,
        ?int $supplierId = null
    ): array {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $offset = ($page - 1) * $perPage;

        $where = [];
        $params = [];

        if ($search !== null && trim($search) !== '') {
            $where[] = '(
                p.purchase_number LIKE :search
                OR s.name LIKE :search
            )';

            $params[':search'] = '%' . trim($search) . '%';
        }

        if ($status !== null && $status !== '') {
            $where[] = 'p.status = :status';
            $params[':status'] = $status;
        }

        if ($supplierId !== null) {
            $where[] = 'p.supplier_id = :supplier_id';
            $params[':supplier_id'] = $supplierId;
        }

        $whereSql = $where
            ? 'WHERE ' . implode(' AND ', $where)
            : '';

        $countSql = "
            SELECT COUNT(*)
            FROM purchases p
            LEFT JOIN suppliers s
                ON s.id = p.supplier_id
            {$whereSql}
        ";

        $countStmt = $this->db->prepare($countSql);

        foreach ($params as $key => $value) {
            $countStmt->bindValue($key, $value);
        }

        $countStmt->execute();

        $total = (int) $countStmt->fetchColumn();

        $sql = "
            SELECT
                p.id,
                p.purchase_number,
                p.supplier_id,
                s.name AS supplier_name,
                p.purchase_date,
                p.expected_date,
                p.status,
                p.subtotal,
                p.tax_amount,
                p.discount_amount,
                p.total_amount,
                p.notes,
                p.created_by,
                p.created_at,
                p.updated_at
            FROM purchases p
            LEFT JOIN suppliers s
                ON s.id = p.supplier_id
            {$whereSql}
            ORDER BY p.id DESC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $this->db->prepare($sql);

        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }

        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

        $stmt->execute();

        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'items' => $items,
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
     * Find a purchase by ID.
     */
    public function find(int $id): ?array
    {
        $sql = "
            SELECT
                p.id,
                p.purchase_number,
                p.supplier_id,
                s.name AS supplier_name,
                p.purchase_date,
                p.expected_date,
                p.status,
                p.subtotal,
                p.tax_amount,
                p.discount_amount,
                p.total_amount,
                p.notes,
                p.created_by,
                p.created_at,
                p.updated_at
            FROM purchases p
            LEFT JOIN suppliers s
                ON s.id = p.supplier_id
            WHERE p.id = :id
            LIMIT 1
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':id' => $id
        ]);

        $purchase = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$purchase) {
            return null;
        }

        $purchase['items'] = $this->getItems($id);

        return $purchase;
    }

    /**
     * Get purchase items.
     */
    public function getItems(int $purchaseId): array
    {
        $sql = "
            SELECT
                pi.id,
                pi.purchase_id,
                pi.product_id,
                pr.name AS product_name,
                pr.sku,
                pi.quantity,
                pi.received_quantity,
                pi.unit_cost,
                pi.tax_rate,
                pi.discount_amount,
                pi.total_amount
            FROM purchase_items pi
            INNER JOIN products pr
                ON pr.id = pi.product_id
            WHERE pi.purchase_id = :purchase_id
            ORDER BY pi.id ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':purchase_id' => $purchaseId
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Create a purchase.
     *
     * Expected item:
     * [
     *     'product_id' => 1,
     *     'quantity' => 10,
     *     'unit_cost' => 25.00,
     *     'tax_rate' => 0,
     *     'discount_amount' => 0
     * ]
     */
    public function create(array $data, array $items): int
    {
        $this->db->beginTransaction();

        try {
            $purchaseNumber = $data['purchase_number']
                ?? $this->generatePurchaseNumber();

            $subtotal = 0.0;
            $taxAmount = 0.0;
            $discountAmount = 0.0;

            foreach ($items as $item) {
                $quantity = (float) ($item['quantity'] ?? 0);
                $unitCost = (float) ($item['unit_cost'] ?? 0);
                $taxRate = (float) ($item['tax_rate'] ?? 0);
                $discount = (float) ($item['discount_amount'] ?? 0);

                $lineSubtotal = $quantity * $unitCost;
                $lineTax = max(
                    0,
                    ($lineSubtotal - $discount) * ($taxRate / 100)
                );

                $subtotal += $lineSubtotal;
                $taxAmount += $lineTax;
                $discountAmount += $discount;
            }

            $totalAmount = $subtotal + $taxAmount - $discountAmount;

            $sql = "
                INSERT INTO purchases (
                    purchase_number,
                    supplier_id,
                    purchase_date,
                    expected_date,
                    status,
                    subtotal,
                    tax_amount,
                    discount_amount,
                    total_amount,
                    notes,
                    created_by,
                    created_at,
                    updated_at
                ) VALUES (
                    :purchase_number,
                    :supplier_id,
                    :purchase_date,
                    :expected_date,
                    :status,
                    :subtotal,
                    :tax_amount,
                    :discount_amount,
                    :total_amount,
                    :notes,
                    :created_by,
                    NOW(),
                    NOW()
                )
            ";

            $stmt = $this->db->prepare($sql);

            $stmt->execute([
                ':purchase_number' => $purchaseNumber,
                ':supplier_id' => $data['supplier_id'] ?? null,
                ':purchase_date' => $data['purchase_date']
                    ?? date('Y-m-d'),
                ':expected_date' => $data['expected_date'] ?? null,
                ':status' => $data['status'] ?? 'pending',
                ':subtotal' => $subtotal,
                ':tax_amount' => $taxAmount,
                ':discount_amount' => $discountAmount,
                ':total_amount' => $totalAmount,
                ':notes' => $data['notes'] ?? null,
                ':created_by' => $data['created_by'] ?? null
            ]);

            $purchaseId = (int) $this->db->lastInsertId();

            $this->insertItems($purchaseId, $items);

            $this->db->commit();

            return $purchaseId;
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Insert purchase items.
     */
    private function insertItems(int $purchaseId, array $items): void
    {
        $sql = "
            INSERT INTO purchase_items (
                purchase_id,
                product_id,
                quantity,
                received_quantity,
                unit_cost,
                tax_rate,
                discount_amount,
                total_amount
            ) VALUES (
                :purchase_id,
                :product_id,
                :quantity,
                :received_quantity,
                :unit_cost,
                :tax_rate,
                :discount_amount,
                :total_amount
            )
        ";

        $stmt = $this->db->prepare($sql);

        foreach ($items as $item) {
            $quantity = (float) ($item['quantity'] ?? 0);
            $unitCost = (float) ($item['unit_cost'] ?? 0);
            $taxRate = (float) ($item['tax_rate'] ?? 0);
            $discount = (float) ($item['discount_amount'] ?? 0);

            $lineSubtotal = $quantity * $unitCost;
            $lineTax = max(
                0,
                ($lineSubtotal - $discount) * ($taxRate / 100)
            );

            $lineTotal = $lineSubtotal + $lineTax - $discount;

            $stmt->execute([
                ':purchase_id' => $purchaseId,
                ':product_id' => $item['product_id'],
                ':quantity' => $quantity,
                ':received_quantity' => 0,
                ':unit_cost' => $unitCost,
                ':tax_rate' => $taxRate,
                ':discount_amount' => $discount,
                ':total_amount' => $lineTotal
            ]);
        }
    }

    /**
     * Update a purchase.
     *
     * Only pending purchases should normally be editable.
     */
    public function update(
        int $id,
        array $data,
        ?array $items = null
    ): bool {
        $this->db->beginTransaction();

        try {
            $purchase = $this->findBasic($id);

            if (!$purchase) {
                throw new RuntimeException('Purchase not found.');
            }

            if (
                isset($purchase['status']) &&
                !in_array(
                    $purchase['status'],
                    ['pending', 'draft'],
                    true
                )
            ) {
                throw new RuntimeException(
                    'Only pending or draft purchases can be updated.'
                );
            }

            if ($items !== null) {
                $totals = $this->calculateTotals($items);

                $data['subtotal'] = $totals['subtotal'];
                $data['tax_amount'] = $totals['tax_amount'];
                $data['discount_amount'] = $totals['discount_amount'];
                $data['total_amount'] = $totals['total_amount'];
            }

            $fields = [];
            $params = [
                ':id' => $id
            ];

            $allowedFields = [
                'supplier_id',
                'purchase_date',
                'expected_date',
                'status',
                'subtotal',
                'tax_amount',
                'discount_amount',
                'total_amount',
                'notes'
            ];

            foreach ($allowedFields as $field) {
                if (array_key_exists($field, $data)) {
                    $fields[] = "{$field} = :{$field}";
                    $params[":{$field}"] = $data[$field];
                }
            }

            if ($fields) {
                $fields[] = 'updated_at = NOW()';

                $sql = "
                    UPDATE purchases
                    SET " . implode(', ', $fields) . "
                    WHERE id = :id
                ";

                $stmt = $this->db->prepare($sql);
                $stmt->execute($params);
            }

            if ($items !== null) {
                $deleteStmt = $this->db->prepare("
                    DELETE FROM purchase_items
                    WHERE purchase_id = :purchase_id
                ");

                $deleteStmt->execute([
                    ':purchase_id' => $id
                ]);

                $this->insertItems($id, $items);
            }

            $this->db->commit();

            return true;
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Mark a purchase as received.
     *
     * Inventory changes should be performed by PurchaseService /
     * InventoryService so that stock movements are recorded correctly.
     */
    public function markReceived(int $id): bool
    {
        $sql = "
            UPDATE purchases
            SET
                status = 'received',
                updated_at = NOW()
            WHERE id = :id
              AND status IN ('pending', 'partial', 'ordered')
        ";

        $stmt = $this->db->prepare($sql);

        return $stmt->execute([
            ':id' => $id
        ]);
    }

    /**
     * Cancel a purchase.
     */
    public function cancel(int $id): bool
    {
        $sql = "
            UPDATE purchases
            SET
                status = 'cancelled',
                updated_at = NOW()
            WHERE id = :id
              AND status NOT IN ('received', 'cancelled')
        ";

        $stmt = $this->db->prepare($sql);

        return $stmt->execute([
            ':id' => $id
        ]);
    }

    /**
     * Find basic purchase information.
     */
    private function findBasic(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT *
            FROM purchases
            WHERE id = :id
            LIMIT 1
        ");

        $stmt->execute([
            ':id' => $id
        ]);

        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    /**
     * Calculate purchase totals.
     */
    public function calculateTotals(array $items): array
    {
        $subtotal = 0.0;
        $taxAmount = 0.0;
        $discountAmount = 0.0;

        foreach ($items as $item) {
            $quantity = (float) ($item['quantity'] ?? 0);
            $unitCost = (float) ($item['unit_cost'] ?? 0);
            $taxRate = (float) ($item['tax_rate'] ?? 0);
            $discount = (float) ($item['discount_amount'] ?? 0);

            $lineSubtotal = $quantity * $unitCost;

            $lineTax = max(
                0,
                ($lineSubtotal - $discount) * ($taxRate / 100)
            );

            $subtotal += $lineSubtotal;
            $taxAmount += $lineTax;
            $discountAmount += $discount;
        }

        return [
            'subtotal' => round($subtotal, 2),
            'tax_amount' => round($taxAmount, 2),
            'discount_amount' => round($discountAmount, 2),
            'total_amount' => round(
                $subtotal + $taxAmount - $discountAmount,
                2
            )
        ];
    }

    /**
     * Generate a unique purchase number.
     */
    public function generatePurchaseNumber(): string
    {
        $prefix = 'PO-' . date('Ymd') . '-';

        $stmt = $this->db->prepare("
            SELECT purchase_number
            FROM purchases
            WHERE purchase_number LIKE :prefix
            ORDER BY id DESC
            LIMIT 1
        ");

        $stmt->execute([
            ':prefix' => $prefix . '%'
        ]);

        $lastNumber = $stmt->fetchColumn();

        if (!$lastNumber) {
            return $prefix . '0001';
        }

        $lastSequence = (int) substr(
            (string) $lastNumber,
            strlen($prefix)
        );

        return $prefix . str_pad(
            (string) ($lastSequence + 1),
            4,
            '0',
            STR_PAD_LEFT
        );
    }

    /**
     * Get purchase statistics.
     */
    public function getStats(): array
    {
        $sql = "
            SELECT
                COUNT(*) AS total_purchases,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'pending'
                            THEN 1 ELSE 0
                        END
                    ),
                    0
                ) AS pending_purchases,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'received'
                            THEN 1 ELSE 0
                        END
                    ),
                    0
                ) AS received_purchases,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'cancelled'
                            THEN 1 ELSE 0
                        END
                    ),
                    0
                ) AS cancelled_purchases,

                COALESCE(
                    SUM(total_amount),
                    0
                ) AS total_amount

            FROM purchases
        ";

        $stmt = $this->db->query($sql);

        $stats = $stmt->fetch(PDO::FETCH_ASSOC);

        return [
            'total_purchases' => (int) ($stats['total_purchases'] ?? 0),
            'pending_purchases' => (int) ($stats['pending_purchases'] ?? 0),
            'received_purchases' => (int) ($stats['received_purchases'] ?? 0),
            'cancelled_purchases' => (int) ($stats['cancelled_purchases'] ?? 0),
            'total_amount' => (float) ($stats['total_amount'] ?? 0)
        ];
    }
}
