<?php

declare(strict_types=1);

require_once __DIR__ . '/../models/Sale.php';
require_once __DIR__ . '/../models/SaleItem.php';
require_once __DIR__ . '/InventoryService.php';

class SalesService
{
    private PDO $db;
    private Sale $saleModel;
    private SaleItem $saleItemModel;
    private InventoryService $inventoryService;

    public function __construct(PDO $db)
    {
        $this->db = $db;

        $this->saleModel = new Sale($db);
        $this->saleItemModel = new SaleItem($db);
        $this->inventoryService = new InventoryService($db);
    }

    /**
     * Create a completed sale and remove sold quantities from inventory.
     */
    public function createSale(
        array $data,
        array $items
    ): int {
        $this->validateItems($items);

        $this->db->beginTransaction();

        try {
            $preparedItems = $this->prepareItems($items);

            $subtotal = 0.0;

            foreach ($preparedItems as $item) {
                $subtotal += $item['quantity'] * $item['unit_price'];
            }

            $discount = max(
                0,
                (float) ($data['discount_amount'] ?? 0)
            );

            $tax = max(
                0,
                (float) ($data['tax_amount'] ?? 0)
            );

            $total = max(
                0,
                $subtotal + $tax - $discount
            );

            $saleData = [
                'customer_id' => $data['customer_id'] ?? null,
                'sale_date' => $data['sale_date'] ?? date('Y-m-d'),
                'subtotal' => $subtotal,
                'tax_amount' => $tax,
                'discount_amount' => $discount,
                'total_amount' => $total,
                'payment_method' => $data['payment_method'] ?? null,
                'payment_status' => $data['payment_status'] ?? 'paid',
                'status' => $data['status'] ?? 'completed',
                'notes' => $data['notes'] ?? null,
                'created_by' => $data['created_by'] ?? null,
            ];

            $saleId = $this->saleModel->create($saleData);

            if (!$saleId) {
                throw new RuntimeException(
                    'Unable to create sale.'
                );
            }

            foreach ($preparedItems as $item) {
                $itemData = [
                    'sale_id' => $saleId,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'discount_amount' => $item['discount_amount'],
                    'tax_amount' => $item['tax_amount'],
                    'total_amount' => $item['total_amount'],
                ];

                $this->saleItemModel->create($itemData);

                $this->inventoryService->stockOut(
                    $item['product_id'],
                    $item['quantity'],
                    'Sale #' . $saleId,
                    $data['created_by'] ?? null,
                    $saleId
                );
            }

            $this->db->commit();

            return (int) $saleId;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $e;
        }
    }

    /**
     * Update a sale.
     *
     * If items are supplied, the old sale quantities are restored
     * and the new quantities are removed from inventory.
     */
    public function updateSale(
        int $saleId,
        array $data,
        ?array $items = null
    ): bool {
        if ($saleId <= 0) {
            throw new InvalidArgumentException(
                'Invalid sale ID.'
            );
        }

        $existingSale = $this->saleModel->find($saleId);

        if (!$existingSale) {
            throw new RuntimeException(
                'Sale not found.'
            );
        }

        if (
            isset($existingSale['status']) &&
            strtolower((string) $existingSale['status']) === 'cancelled'
        ) {
            throw new RuntimeException(
                'Cancelled sales cannot be updated.'
            );
        }

        if ($items !== null) {
            $this->validateItems($items);
        }

        $this->db->beginTransaction();

        try {
            if ($items !== null) {
                $oldItems = $this->saleItemModel->getBySaleId(
                    $saleId
                );

                /*
                 * Return the original quantities to inventory.
                 */
                foreach ($oldItems as $oldItem) {
                    $this->inventoryService->stockIn(
                        (int) $oldItem['product_id'],
                        (int) $oldItem['quantity'],
                        'Sale #' . $saleId . ' update',
                        $data['updated_by'] ?? null,
                        $saleId
                    );
                }

                $this->saleItemModel->deleteBySaleId(
                    $saleId
                );

                $preparedItems = $this->prepareItems($items);

                $subtotal = 0.0;

                foreach ($preparedItems as $item) {
                    $subtotal +=
                        $item['quantity'] *
                        $item['unit_price'];
                }

                $discount = max(
                    0,
                    (float) ($data['discount_amount'] ?? 0)
                );

                $tax = max(
                    0,
                    (float) ($data['tax_amount'] ?? 0)
                );

                $total = max(
                    0,
                    $subtotal + $tax - $discount
                );

                $saleUpdate = [
                    'subtotal' => $subtotal,
                    'tax_amount' => $tax,
                    'discount_amount' => $discount,
                    'total_amount' => $total,
                ];

                $this->updateSaleFields(
                    $saleId,
                    $data,
                    $saleUpdate
                );

                foreach ($preparedItems as $item) {
                    $this->saleItemModel->create([
                        'sale_id' => $saleId,
                        'product_id' => $item['product_id'],
                        'quantity' => $item['quantity'],
                        'unit_price' => $item['unit_price'],
                        'discount_amount' =>
                            $item['discount_amount'],
                        'tax_amount' =>
                            $item['tax_amount'],
                        'total_amount' =>
                            $item['total_amount'],
                    ]);

                    $this->inventoryService->stockOut(
                        $item['product_id'],
                        $item['quantity'],
                        'Sale #' . $saleId . ' update',
                        $data['updated_by'] ?? null,
                        $saleId
                    );
                }
            } else {
                $this->updateSaleFields(
                    $saleId,
                    $data
                );
            }

            $this->db->commit();

            return true;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $e;
        }
    }

    /**
     * Cancel a sale and return all sold quantities to inventory.
     */
    public function cancelSale(
        int $saleId,
        int $userId
    ): bool {
        if ($saleId <= 0) {
            throw new InvalidArgumentException(
                'Invalid sale ID.'
            );
        }

        $sale = $this->saleModel->find($saleId);

        if (!$sale) {
            throw new RuntimeException(
                'Sale not found.'
            );
        }

        $status = strtolower(
            (string) ($sale['status'] ?? '')
        );

        if ($status === 'cancelled') {
            throw new RuntimeException(
                'Sale is already cancelled.'
            );
        }

        $this->db->beginTransaction();

        try {
            $items = $this->saleItemModel->getBySaleId(
                $saleId
            );

            foreach ($items as $item) {
                $quantity = (int) $item['quantity'];

                if ($quantity <= 0) {
                    continue;
                }

                $this->inventoryService->stockIn(
                    (int) $item['product_id'],
                    $quantity,
                    'Cancelled Sale #' . $saleId,
                    $userId,
                    $saleId
                );
            }

            $updated = $this->saleModel->update(
                $saleId,
                [
                    'status' => 'cancelled',
                    'updated_by' => $userId,
                ]
            );

            if (!$updated) {
                throw new RuntimeException(
                    'Unable to cancel sale.'
                );
            }

            $this->db->commit();

            return true;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $e;
        }
    }

    /**
     * Process a partial or complete return.
     */
    public function returnSale(
        int $saleId,
        array $items,
        ?string $reason,
        int $userId
    ): array {
        if ($saleId <= 0) {
            throw new InvalidArgumentException(
                'Invalid sale ID.'
            );
        }

        if (empty($items)) {
            throw new InvalidArgumentException(
                'At least one return item is required.'
            );
        }

        $sale = $this->saleModel->find($saleId);

        if (!$sale) {
            throw new RuntimeException(
                'Sale not found.'
            );
        }

        $status = strtolower(
            (string) ($sale['status'] ?? '')
        );

        if ($status === 'cancelled') {
            throw new RuntimeException(
                'Cancelled sales cannot be returned.'
            );
        }

        $this->db->beginTransaction();

        try {
            $saleItems = $this->saleItemModel->getBySaleId(
                $saleId
            );

            $saleItemsById = [];

            foreach ($saleItems as $saleItem) {
                $saleItemsById[
                    (int) $saleItem['id']
                ] = $saleItem;
            }

            $processed = [];

            foreach ($items as $returnItem) {
                $saleItemId = (int) (
                    $returnItem['sale_item_id']
                    ?? 0
                );

                $quantity = (int) (
                    $returnItem['quantity']
                    ?? 0
                );

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

                if (!isset($saleItemsById[$saleItemId])) {
                    throw new InvalidArgumentException(
                        'Sale item does not belong to this sale.'
                    );
                }

                $saleItem = $saleItemsById[$saleItemId];

                $soldQuantity = (int) $saleItem['quantity'];

                /*
                 * If your database has a returned_quantity
                 * column, use it here to calculate the remaining
                 * returnable quantity.
                 */
                $returnedQuantity = (int) (
                    $saleItem['returned_quantity']
                    ?? 0
                );

                $remainingQuantity =
                    $soldQuantity - $returnedQuantity;

                if ($quantity > $remainingQuantity) {
                    throw new InvalidArgumentException(
                        'Return quantity exceeds the remaining quantity.'
                    );
                }

                $this->inventoryService->stockIn(
                    (int) $saleItem['product_id'],
                    $quantity,
                    'Return for Sale #' . $saleId .
                    ($reason ? ': ' . $reason : ''),
                    $userId,
                    $saleId
                );

                if (
                    method_exists(
                        $this->saleItemModel,
                        'addReturnedQuantity'
                    )
                ) {
                    $this->saleItemModel
                        ->addReturnedQuantity(
                            $saleItemId,
                            $quantity
                        );
                }

                $processed[] = [
                    'sale_item_id' => $saleItemId,
                    'product_id' => (int) $saleItem['product_id'],
                    'quantity' => $quantity,
                ];
            }

            /*
             * Mark the sale as returned only when every sold
             * quantity has been returned.
             */
            $allReturned = true;

            foreach ($saleItems as $saleItem) {
                $sold = (int) $saleItem['quantity'];

                $returned = (int) (
                    $saleItem['returned_quantity']
                    ?? 0
                );

                foreach ($processed as $processedItem) {
                    if (
                        $processedItem['sale_item_id'] ===
                        (int) $saleItem['id']
                    ) {
                        $returned +=
                            $processedItem['quantity'];
                    }
                }

                if ($returned < $sold) {
                    $allReturned = false;
                    break;
                }
            }

            $newStatus = $allReturned
                ? 'returned'
                : 'partially_returned';

            $this->saleModel->update(
                $saleId,
                [
                    'status' => $newStatus,
                    'updated_by' => $userId,
                ]
            );

            $this->db->commit();

            return [
                'sale_id' => $saleId,
                'status' => $newStatus,
                'items' => $processed,
                'reason' => $reason,
            ];
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $e;
        }
    }

    /**
     * Prepare and normalize sale items.
     */
    private function prepareItems(array $items): array
    {
        $prepared = [];

        foreach ($items as $item) {
            $productId = (int) (
                $item['product_id']
                ?? 0
            );

            $quantity = (int) (
                $item['quantity']
                ?? 0
            );

            $unitPrice = (float) (
                $item['unit_price']
                ?? $item['price']
                ?? 0
            );

            $discount = max(
                0,
                (float) (
                    $item['discount_amount']
                    ?? 0
                )
            );

            $tax = max(
                0,
                (float) (
                    $item['tax_amount']
                    ?? 0
                )
            );

            if ($productId <= 0) {
                throw new InvalidArgumentException(
                    'Each sale item requires a valid product ID.'
                );
            }

            if ($quantity <= 0) {
                throw new InvalidArgumentException(
                    'Sale quantity must be greater than zero.'
                );
            }

            if ($unitPrice < 0) {
                throw new InvalidArgumentException(
                    'Unit price cannot be negative.'
                );
            }

            $lineSubtotal =
                ($quantity * $unitPrice) - $discount;

            $lineTotal =
                max(0, $lineSubtotal + $tax);

            $prepared[] = [
                'product_id' => $productId,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'discount_amount' => $discount,
                'tax_amount' => $tax,
                'total_amount' => $lineTotal,
            ];
        }

        return $prepared;
    }

    /**
     * Validate the basic structure of sale items.
     */
    private function validateItems(array $items): void
    {
        if (count($items) === 0) {
            throw new InvalidArgumentException(
                'At least one sale item is required.'
            );
        }

        foreach ($items as $item) {
            if (!is_array($item)) {
                throw new InvalidArgumentException(
                    'Invalid sale item.'
                );
            }

            if (
                !isset($item['product_id']) ||
                !isset($item['quantity'])
            ) {
                throw new InvalidArgumentException(
                    'Product ID and quantity are required for every sale item.'
                );
            }
        }
    }

    /**
     * Update sale header fields.
     */
    private function updateSaleFields(
        int $saleId,
        array $data,
        array $calculated = []
    ): void {
        $allowed = [
            'customer_id',
            'sale_date',
            'payment_method',
            'payment_status',
            'notes',
            'updated_by',
        ];

        $update = [];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $update[$field] = $data[$field];
            }
        }

        foreach (
            [
                'subtotal',
                'tax_amount',
                'discount_amount',
                'total_amount',
            ] as $field
        ) {
            if (array_key_exists($field, $calculated)) {
                $update[$field] = $calculated[$field];
            } elseif (array_key_exists($field, $data)) {
                $update[$field] = $data[$field];
            }
        }

        if (empty($update)) {
            return;
        }

        $updated = $this->saleModel->update(
            $saleId,
            $update
        );

        if (!$updated) {
            throw new RuntimeException(
                'Unable to update sale.'
            );
        }
    }
}
