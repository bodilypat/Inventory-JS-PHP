<?php

declare(strict_types=1);

class PurchaseItem
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Find a purchase item by ID.
     */
    public function find(int $id): ?array
    {
        $sql = "
            SELECT
                pi.id,
                pi.purchase_id,
                pi.product_id,
                p.name AS product_name,
                p.sku,
                p.barcode,
                pi.quantity,
                pi.received_quantity,
                pi.unit_cost,
                pi.tax_rate,
                pi.discount_amount,
                pi.total_amount,
                pi.created_at
            FROM purchase_items pi
            INNER JOIN products p
                ON p.id = pi.product_id
            WHERE pi.id = :id
            LIMIT 1
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':id' => $id
        ]);

        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        return $item ?: null;
    }

    /**
     * Get all items belonging to a purchase.
     */
    public function getByPurchaseId(int $purchaseId): array
    {
        $sql = "
            SELECT
                pi.id,
                pi.purchase_id,
                pi.product_id,
                p.name AS product_name,
                p.sku,
                p.barcode,
                pi.quantity,
                pi.received_quantity,
                GREATEST(
                    pi.quantity - pi.received_quantity,
                    0
                ) AS pending_quantity,
                pi.unit_cost,
                pi.tax_rate,
                pi.discount_amount,
                pi.total_amount,
                pi.created_at
            FROM purchase_items pi
            INNER JOIN products p
                ON p.id = pi.product_id
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
     * Create a purchase item.
     */
    public function create(array $data): int
    {
        $quantity = $this->validateQuantity(
            $data['quantity'] ?? 0
        );

        $unitCost = $this->validateMoney(
            $data['unit_cost'] ?? 0
        );

        $taxRate = $this->validateTaxRate(
            $data['tax_rate'] ?? 0
        );

        $discountAmount = $this->validateMoney(
            $data['discount_amount'] ?? 0
        );

        $lineTotal = $this->calculateLineTotal(
            $quantity,
            $unitCost,
            $taxRate,
            $discountAmount
        );

        $sql = "
            INSERT INTO purchase_items (
                purchase_id,
                product_id,
                quantity,
                received_quantity,
                unit_cost,
                tax_rate,
                discount_amount,
                total_amount,
                created_at
            ) VALUES (
                :purchase_id,
                :product_id,
                :quantity,
                :received_quantity,
                :unit_cost,
                :tax_rate,
                :discount_amount,
                :total_amount,
                NOW()
            )
        ";

        $stmt = $this->db->prepare($sql);

        $stmt->execute([
            ':purchase_id' => (int) $data['purchase_id'],
            ':product_id' => (int) $data['product_id'],
            ':quantity' => $quantity,
            ':received_quantity' => (float) (
                $data['received_quantity'] ?? 0
            ),
            ':unit_cost' => $unitCost,
            ':tax_rate' => $taxRate,
            ':discount_amount' => $discountAmount,
            ':total_amount' => $lineTotal
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Update a purchase item.
     */
    public function update(int $id, array $data): bool
    {
        $existing = $this->findBasic($id);

        if (!$existing) {
            throw new RuntimeException(
                'Purchase item not found.'
            );
        }

        $quantity = array_key_exists('quantity', $data)
            ? $this->validateQuantity($data['quantity'])
            : (float) $existing['quantity'];

        $unitCost = array_key_exists('unit_cost', $data)
            ? $this->validateMoney($data['unit_cost'])
            : (float) $existing['unit_cost'];

        $taxRate = array_key_exists('tax_rate', $data)
            ? $this->validateTaxRate($data['tax_rate'])
            : (float) $existing['tax_rate'];

        $discountAmount = array_key_exists(
            'discount_amount',
            $data
        )
            ? $this->validateMoney($data['discount_amount'])
            : (float) $existing['discount_amount'];

        $receivedQuantity = array_key_exists(
            'received_quantity',
            $data
        )
            ? (float) $data['received_quantity']
            : (float) $existing['received_quantity'];

        if ($receivedQuantity < 0) {
            throw new InvalidArgumentException(
                'Received quantity cannot be negative.'
            );
        }

        if ($receivedQuantity > $quantity) {
            throw new InvalidArgumentException(
                'Received quantity cannot exceed ordered quantity.'
            );
        }

        $lineTotal = $this->calculateLineTotal(
            $quantity,
            $unitCost,
            $taxRate,
            $discountAmount
        );

        $sql = "
            UPDATE purchase_items
            SET
                product_id = :product_id,
                quantity = :quantity,
                received_quantity = :received_quantity,
                unit_cost = :unit_cost,
                tax_rate = :tax_rate,
                discount_amount = :discount_amount,
                total_amount = :total_amount
            WHERE id = :id
        ";

        $stmt = $this->db->prepare($sql);

        return $stmt->execute([
            ':id' => $id,
            ':product_id' => (int) (
                $data['product_id']
                ?? $existing['product_id']
            ),
            ':quantity' => $quantity,
            ':received_quantity' => $receivedQuantity,
            ':unit_cost' => $unitCost,
            ':tax_rate' => $taxRate,
            ':discount_amount' => $discountAmount,
            ':total_amount' => $lineTotal
        ]);
    }

    /**
     * Delete a purchase item.
     *
     * Items that have already been received should not normally
     * be deleted.
     */
    public function delete(int $id): bool
    {
        $item = $this->findBasic($id);

        if (!$item) {
            throw new RuntimeException(
                'Purchase item not found.'
            );
        }

        if ((float) $item['received_quantity'] > 0) {
            throw new RuntimeException(
                'A received purchase item cannot be deleted.'
            );
        }

        $stmt = $this->db->prepare("
            DELETE FROM purchase_items
            WHERE id = :id
        ");

        return $stmt->execute([
            ':id' => $id
        ]);
    }

    /**
     * Delete all items for a purchase.
     */
    public function deleteByPurchaseId(int $purchaseId): bool
    {
        $stmt = $this->db->prepare("
            DELETE FROM purchase_items
            WHERE purchase_id = :purchase_id
        ");

        return $stmt->execute([
            ':purchase_id' => $purchaseId
        ]);
    }

    /**
     * Update received quantity.
     *
     * This method only updates the purchase item.
     * InventoryService should handle the actual stock movement.
     */
    public function updateReceivedQuantity(
        int $id,
        float $receivedQuantity
    ): bool {
        $item = $this->findBasic($id);

        if (!$item) {
            throw new RuntimeException(
                'Purchase item not found.'
            );
        }

        $orderedQuantity = (float) $item['quantity'];

        if ($receivedQuantity < 0) {
            throw new InvalidArgumentException(
                'Received quantity cannot be negative.'
            );
        }

        if ($receivedQuantity > $orderedQuantity) {
            throw new InvalidArgumentException(
                'Received quantity cannot exceed ordered quantity.'
            );
        }

        $stmt = $this->db->prepare("
            UPDATE purchase_items
            SET received_quantity = :received_quantity
            WHERE id = :id
        ");

        return $stmt->execute([
            ':id' => $id,
            ':received_quantity' => $receivedQuantity
        ]);
    }

    /**
     * Add received quantity to an existing item.
     *
     * Returns the new received quantity.
     */
    public function addReceivedQuantity(
        int $id,
        float $quantity
    ): float {
        if ($quantity <= 0) {
            throw new InvalidArgumentException(
                'Received quantity must be greater than zero.'
            );
        }

        $item = $this->findBasic($id);

        if (!$item) {
            throw new RuntimeException(
                'Purchase item not found.'
            );
        }

        $orderedQuantity = (float) $item['quantity'];
        $currentReceived = (float) $item['received_quantity'];

        $newReceived = $currentReceived + $quantity;

        if ($newReceived > $orderedQuantity) {
            throw new InvalidArgumentException(
                'Received quantity cannot exceed ordered quantity.'
            );
        }

        $stmt = $this->db->prepare("
            UPDATE purchase_items
            SET received_quantity = :received_quantity
            WHERE id = :id
        ");

        $stmt->execute([
            ':id' => $id,
            ':received_quantity' => $newReceived
        ]);

        return $newReceived;
    }

    /**
     * Get remaining quantity for an item.
     */
    public function getPendingQuantity(int $id): float
    {
        $item = $this->findBasic($id);

        if (!$item) {
            throw new RuntimeException(
                'Purchase item not found.'
            );
        }

        return max(
            0,
            (float) $item['quantity']
            - (float) $item['received_quantity']
        );
    }

    /**
     * Get total ordered quantity for a purchase.
     */
    public function getTotalQuantity(int $purchaseId): float
    {
        $stmt = $this->db->prepare("
            SELECT COALESCE(SUM(quantity), 0)
            FROM purchase_items
            WHERE purchase_id = :purchase_id
        ");

        $stmt->execute([
            ':purchase_id' => $purchaseId
        ]);

        return (float) $stmt->fetchColumn();
    }

    /**
     * Get total received quantity for a purchase.
     */
    public function getTotalReceivedQuantity(
        int $purchaseId
    ): float {
        $stmt = $this->db->prepare("
            SELECT COALESCE(SUM(received_quantity), 0)
            FROM purchase_items
            WHERE purchase_id = :purchase_id
        ");

        $stmt->execute([
            ':purchase_id' => $purchaseId
        ]);

        return (float) $stmt->fetchColumn();
    }

    /**
     * Get remaining quantity for a purchase.
     */
    public function getTotalPendingQuantity(
        int $purchaseId
    ): float {
        $stmt = $this->db->prepare("
            SELECT COALESCE(
                SUM(
                    GREATEST(
                        quantity - received_quantity,
                        0
                    )
                ),
                0
            )
            FROM purchase_items
            WHERE purchase_id = :purchase_id
        ");

        $stmt->execute([
            ':purchase_id' => $purchaseId
        ]);

        return (float) $stmt->fetchColumn();
    }

    /**
     * Get purchase items that are not completely received.
     */
    public function getPendingItems(int $purchaseId): array
    {
        $sql = "
            SELECT
                pi.id,
                pi.purchase_id,
                pi.product_id,
                p.name AS product_name,
                p.sku,
                pi.quantity,
                pi.received_quantity,
                GREATEST(
                    pi.quantity - pi.received_quantity,
                    0
                ) AS pending_quantity,
                pi.unit_cost,
                pi.tax_rate,
                pi.discount_amount,
                pi.total_amount
            FROM purchase_items pi
            INNER JOIN products p
                ON p.id = pi.product_id
            WHERE pi.purchase_id = :purchase_id
              AND pi.received_quantity < pi.quantity
            ORDER BY pi.id ASC
        ";

        $stmt = $this->db->prepare($sql);

        $stmt->execute([
            ':purchase_id' => $purchaseId
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Check whether an item is fully received.
     */
    public function isFullyReceived(int $id): bool
    {
        $item = $this->findBasic($id);

        if (!$item) {
            throw new RuntimeException(
                'Purchase item not found.'
            );
        }

        return (float) $item['received_quantity']
            >= (float) $item['quantity'];
    }

    /**
     * Calculate line total.
     */
    public function calculateLineTotal(
        float $quantity,
        float $unitCost,
        float $taxRate = 0,
        float $discountAmount = 0
    ): float {
        $subtotal = $quantity * $unitCost;

        $discountAmount = min(
            max(0, $discountAmount),
            $subtotal
        );

        $taxableAmount = $subtotal - $discountAmount;

        $tax = $taxableAmount * ($taxRate / 100);

        return round(
            $taxableAmount + $tax,
            2
        );
    }

    /**
     * Find an item without joining other tables.
     */
    private function findBasic(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT *
            FROM purchase_items
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
     * Validate quantity.
     */
    private function validateQuantity($quantity): float
    {
        if (!is_numeric($quantity)) {
            throw new InvalidArgumentException(
                'Quantity must be numeric.'
            );
        }

        $quantity = (float) $quantity;

        if ($quantity <= 0) {
            throw new InvalidArgumentException(
                'Quantity must be greater than zero.'
            );
        }

        return $quantity;
    }

    /**
     * Validate monetary value.
     */
    private function validateMoney($amount): float
    {
        if (!is_numeric($amount)) {
            throw new InvalidArgumentException(
                'Amount must be numeric.'
            );
        }

        $amount = (float) $amount;

        if ($amount < 0) {
            throw new InvalidArgumentException(
                'Amount cannot be negative.'
            );
        }

        return round($amount, 2);
    }

    /**
     * Validate tax percentage.
     */
    private function validateTaxRate($rate): float
    {
        if (!is_numeric($rate)) {
            throw new InvalidArgumentException(
                'Tax rate must be numeric.'
            );
        }

        $rate = (float) $rate;

        if ($rate < 0 || $rate > 100) {
            throw new InvalidArgumentException(
                'Tax rate must be between 0 and 100.'
            );
        }

        return round($rate, 2);
    }
}
