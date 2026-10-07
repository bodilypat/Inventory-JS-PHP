<?php

declare(strict_types=1);

/**
 * Inventory Management System
 *
 * Service responsible for:
 * - Inventory listing
 * - Stock in
 * - Stock out
 * - Inventory adjustments
 * - Inventory movement history
 * - Low-stock products
 *
 * The service contains business logic while the API files
 * are responsible for HTTP request/response handling.
 */

require_once __DIR__ . '/../models/Inventory.php';
require_once __DIR__ . '/../models/InventoryMovement.php';

class InventoryService
{
    private PDO $db;

    private Inventory $inventory;

    private InventoryMovement $movement;


    /*
    |--------------------------------------------------------------------------
    | Constructor
    |--------------------------------------------------------------------------
    */

    public function __construct(PDO $db)
    {
        $this->db = $db;

        $this->inventory = new Inventory($db);

        $this->movement = new InventoryMovement($db);
    }


    /*
    |--------------------------------------------------------------------------
    | List Inventory
    |--------------------------------------------------------------------------
    */

    public function list(array $filters = []): array
    {
        $filters = $this->normalizeListFilters(
            $filters
        );

        return $this->inventory->list(
            $filters
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Get Inventory
    |--------------------------------------------------------------------------
    */

    public function get(int $productId): ?array
    {
        if ($productId < 1) {
            throw new InvalidArgumentException(
                'Invalid product ID.'
            );
        }

        return $this->inventory->find(
            $productId
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Stock In
    |--------------------------------------------------------------------------
    |
    | Adds quantity to the current inventory.
    |
    */

    public function stockIn(
        int $productId,
        int $quantity,
        ?string $reason = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?int $userId = null
    ): array {

        $this->validateProductId(
            $productId
        );

        $this->validatePositiveQuantity(
            $quantity
        );

        $reason = $this->normalizeReason(
            $reason
        );

        $referenceType = $this->normalizeReferenceType(
            $referenceType
        );

        $this->validateReferenceId(
            $referenceId
        );


        $this->db->beginTransaction();

        try {

            /*
             * Lock inventory row to prevent concurrent
             * stock changes.
             */
            $inventory = $this->inventory->findForUpdate(
                $productId
            );

            if ($inventory === null) {
                throw new RuntimeException(
                    'Inventory record not found.'
                );
            }


            $this->ensureProductIsActive(
                $inventory
            );


            $currentQuantity = (int) (
                $inventory['quantity'] ?? 0
            );

            $newQuantity =
                $currentQuantity + $quantity;


            /*
             * Respect maximum stock when configured.
             */
            $maximumStock = $this->getMaximumStock(
                $inventory
            );

            if (
                $maximumStock !== null &&
                $newQuantity > $maximumStock
            ) {
                throw new RuntimeException(
                    'Stock quantity would exceed the maximum stock level.'
                );
            }


            $updated = $this->inventory->increase(
                $productId,
                $quantity
            );

            if (!$updated) {
                throw new RuntimeException(
                    'Unable to increase inventory.'
                );
            }


            $movementId = $this->movement->create([
                'product_id' => $productId,
                'type' => 'stock_in',
                'quantity' => $quantity,
                'quantity_before' => $currentQuantity,
                'quantity_after' => $newQuantity,
                'reason' => $reason,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'user_id' => $userId
            ]);


            $this->db->commit();


            return $this->buildTransactionResult(
                $inventory,
                $movementId,
                $currentQuantity,
                $newQuantity,
                $quantity,
                'increase',
                $reason
            );

        } catch (Throwable $e) {

            $this->rollback();

            throw $e;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Stock Out
    |--------------------------------------------------------------------------
    |
    | Removes quantity from current inventory.
    |
    */

    public function stockOut(
        int $productId,
        int $quantity,
        ?string $reason = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?int $userId = null
    ): array {

        $this->validateProductId(
            $productId
        );

        $this->validatePositiveQuantity(
            $quantity
        );

        $reason = $this->normalizeReason(
            $reason
        );

        $referenceType = $this->normalizeReferenceType(
            $referenceType
        );

        $this->validateReferenceId(
            $referenceId
        );


        $this->db->beginTransaction();

        try {

            $inventory = $this->inventory->findForUpdate(
                $productId
            );

            if ($inventory === null) {
                throw new RuntimeException(
                    'Inventory record not found.'
                );
            }


            $this->ensureProductIsActive(
                $inventory
            );


            $currentQuantity = (int) (
                $inventory['quantity'] ?? 0
            );


            /*
             * Never allow negative inventory.
             */
            if ($quantity > $currentQuantity) {

                throw new RuntimeException(
                    'Insufficient stock. Available quantity: ' .
                    $currentQuantity
                );
            }


            $newQuantity =
                $currentQuantity - $quantity;


            $updated = $this->inventory->decrease(
                $productId,
                $quantity
            );

            if (!$updated) {
                throw new RuntimeException(
                    'Unable to decrease inventory.'
                );
            }


            $movementId = $this->movement->create([
                'product_id' => $productId,
                'type' => 'stock_out',
                'quantity' => $quantity,
                'quantity_before' => $currentQuantity,
                'quantity_after' => $newQuantity,
                'reason' => $reason,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'user_id' => $userId
            ]);


            $this->db->commit();


            return $this->buildTransactionResult(
                $inventory,
                $movementId,
                $currentQuantity,
                $newQuantity,
                $quantity,
                'decrease',
                $reason
            );

        } catch (Throwable $e) {

            $this->rollback();

            throw $e;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Inventory Adjustment
    |--------------------------------------------------------------------------
    |
    | Sets inventory to an absolute quantity.
    |
    | Example:
    |
    | Current = 20
    | New     = 15
    | Difference = -5
    |
    */

    public function adjustment(
        int $productId,
        int $newQuantity,
        ?string $reason = null,
        ?int $userId = null
    ): array {

        $this->validateProductId(
            $productId
        );

        $this->validateNonNegativeQuantity(
            $newQuantity
        );

        $reason = $this->normalizeReason(
            $reason,
            'Inventory adjustment'
        );


        $this->db->beginTransaction();

        try {

            $inventory = $this->inventory->findForUpdate(
                $productId
            );

            if ($inventory === null) {
                throw new RuntimeException(
                    'Inventory record not found.'
                );
            }


            $this->ensureProductIsActive(
                $inventory
            );


            $currentQuantity = (int) (
                $inventory['quantity'] ?? 0
            );


            if ($currentQuantity === $newQuantity) {
                throw new RuntimeException(
                    'The adjusted quantity is the same as the current quantity.'
                );
            }


            $maximumStock = $this->getMaximumStock(
                $inventory
            );

            if (
                $maximumStock !== null &&
                $newQuantity > $maximumStock
            ) {
                throw new RuntimeException(
                    'Adjusted quantity would exceed the maximum stock level.'
                );
            }


            $difference =
                $newQuantity - $currentQuantity;


            $updated = $this->inventory->setQuantity(
                $productId,
                $newQuantity
            );

            if (!$updated) {
                throw new RuntimeException(
                    'Unable to adjust inventory.'
                );
            }


            $movementId = $this->movement->create([
                'product_id' => $productId,
                'type' => 'adjustment',
                'quantity' => abs($difference),
                'quantity_before' => $currentQuantity,
                'quantity_after' => $newQuantity,
                'reason' => $reason,
                'reference_type' => 'adjustment',
                'reference_id' => null,
                'user_id' => $userId
            ]);


            $this->db->commit();


            return [
                'movement_id' =>
                    $movementId,

                'product_id' =>
                    $productId,

                'product_name' =>
                    $inventory['product_name'] ?? null,

                'sku' =>
                    $inventory['sku'] ?? null,

                'quantity_before' =>
                    $currentQuantity,

                'quantity_after' =>
                    $newQuantity,

                'difference' =>
                    $difference,

                'adjustment_type' =>
                    $difference > 0
                        ? 'increase'
                        : 'decrease',

                'reason' =>
                    $reason,

                'stock_status' =>
                    $this->getStockStatus(
                        $newQuantity,
                        $inventory
                    )
            ];

        } catch (Throwable $e) {

            $this->rollback();

            throw $e;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Inventory Movements
    |--------------------------------------------------------------------------
    */

    public function movements(
        array $filters = []
    ): array {

        $filters = $this->normalizeMovementFilters(
            $filters
        );

        return $this->movement->list(
            $filters
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Low Stock
    |--------------------------------------------------------------------------
    */

    public function lowStock(
        array $filters = []
    ): array {

        $filters = $this->normalizeListFilters(
            $filters
        );

        return $this->inventory->getLowStock(
            $filters
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Stock Status
    |--------------------------------------------------------------------------
    */

    public function getStockStatus(
        int $quantity,
        array $inventory
    ): string {

        $minimumStock = (int) (
            $inventory['minimum_stock'] ?? 0
        );

        $maximumStock = $this->getMaximumStock(
            $inventory
        );


        if ($quantity <= 0) {
            return 'out_of_stock';
        }


        if ($quantity <= $minimumStock) {
            return 'low_stock';
        }


        if (
            $maximumStock !== null &&
            $quantity > $maximumStock
        ) {
            return 'over_stock';
        }


        return 'in_stock';
    }


    /*
    |--------------------------------------------------------------------------
    | Normalize List Filters
    |--------------------------------------------------------------------------
    */

    private function normalizeListFilters(
        array $filters
    ): array {

        $page = isset($filters['page'])
            ? (int) $filters['page']
            : 1;

        $perPage = isset($filters['per_page'])
            ? (int) $filters['per_page']
            : 20;


        if ($page < 1) {
            throw new InvalidArgumentException(
                'Page must be greater than or equal to 1.'
            );
        }


        if ($perPage < 1 || $perPage > 100) {
            throw new InvalidArgumentException(
                'per_page must be between 1 and 100.'
            );
        }


        $categoryId = null;

        if (
            isset($filters['category_id']) &&
            $filters['category_id'] !== '' &&
            $filters['category_id'] !== null
        ) {
            $categoryId = (int) $filters['category_id'];

            if ($categoryId < 1) {
                throw new InvalidArgumentException(
                    'Invalid category_id.'
                );
            }
        }


        return [
            'page' => $page,

            'per_page' => $perPage,

            'search' =>
                isset($filters['search'])
                    ? trim((string) $filters['search'])
                    : '',

            'category_id' =>
                $categoryId,

            'status' =>
                isset($filters['status'])
                    ? trim((string) $filters['status'])
                    : '',

            'active' =>
                isset($filters['active'])
                    ? $filters['active']
                    : null,

            'sort' =>
                isset($filters['sort'])
                    ? trim((string) $filters['sort'])
                    : 'name_asc'
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | Normalize Movement Filters
    |--------------------------------------------------------------------------
    */

    private function normalizeMovementFilters(
        array $filters
    ): array {

        $page = isset($filters['page'])
            ? (int) $filters['page']
            : 1;

        $perPage = isset($filters['per_page'])
            ? (int) $filters['per_page']
            : 20;


        if ($page < 1) {
            throw new InvalidArgumentException(
                'Page must be greater than or equal to 1.'
            );
        }


        if ($perPage < 1 || $perPage > 100) {
            throw new InvalidArgumentException(
                'per_page must be between 1 and 100.'
            );
        }


        $productId = null;

        if (
            isset($filters['product_id']) &&
            $filters['product_id'] !== '' &&
            $filters['product_id'] !== null
        ) {
            $productId = (int) $filters['product_id'];

            if ($productId < 1) {
                throw new InvalidArgumentException(
                    'Invalid product_id.'
                );
            }
        }


        return [
            'page' => $page,

            'per_page' => $perPage,

            'product_id' =>
                $productId,

            'search' =>
                isset($filters['search'])
                    ? trim((string) $filters['search'])
                    : '',

            'type' =>
                isset($filters['type'])
                    ? trim((string) $filters['type'])
                    : '',

            'date_from' =>
                isset($filters['date_from'])
                    ? trim((string) $filters['date_from'])
                    : '',

            'date_to' =>
                isset($filters['date_to'])
                    ? trim((string) $filters['date_to'])
                    : '',

            'sort' =>
                isset($filters['sort'])
                    ? trim((string) $filters['sort'])
                    : 'newest'
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | Validate Product ID
    |--------------------------------------------------------------------------
    */

    private function validateProductId(
        int $productId
    ): void {

        if ($productId < 1) {
            throw new InvalidArgumentException(
                'Invalid product ID.'
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Validate Positive Quantity
    |--------------------------------------------------------------------------
    */

    private function validatePositiveQuantity(
        int $quantity
    ): void {

        if ($quantity < 1) {
            throw new InvalidArgumentException(
                'Quantity must be greater than zero.'
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Validate Non-Negative Quantity
    |--------------------------------------------------------------------------
    */

    private function validateNonNegativeQuantity(
        int $quantity
    ): void {

        if ($quantity < 0) {
            throw new InvalidArgumentException(
                'Quantity cannot be negative.'
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Validate Reference ID
    |--------------------------------------------------------------------------
    */

    private function validateReferenceId(
        ?int $referenceId
    ): void {

        if (
            $referenceId !== null &&
            $referenceId < 1
        ) {
            throw new InvalidArgumentException(
                'Invalid reference ID.'
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Normalize Reason
    |--------------------------------------------------------------------------
    */

    private function normalizeReason(
        ?string $reason,
        string $default = 'Inventory transaction'
    ): string {

        $reason = $reason !== null
            ? trim($reason)
            : '';


        if ($reason === '') {
            $reason = $default;
        }


        if (strlen($reason) > 500) {
            throw new InvalidArgumentException(
                'Reason cannot exceed 500 characters.'
            );
        }


        return $reason;
    }


    /*
    |--------------------------------------------------------------------------
    | Normalize Reference Type
    |--------------------------------------------------------------------------
    */

    private function normalizeReferenceType(
        ?string $referenceType
    ): ?string {

        if ($referenceType === null) {
            return null;
        }


        $referenceType = trim(
            strtolower($referenceType)
        );


        if ($referenceType === '') {
            return null;
        }


        $allowed = [
            'sale',
            'purchase',
            'return',
            'adjustment',
            'manual',
            'other'
        ];


        if (!in_array(
            $referenceType,
            $allowed,
            true
        )) {
            throw new InvalidArgumentException(
                'Invalid reference type.'
            );
        }


        return $referenceType;
    }


    /*
    |--------------------------------------------------------------------------
    | Ensure Product Is Active
    |--------------------------------------------------------------------------
    */

    private function ensureProductIsActive(
        array $inventory
    ): void {

        if (
            isset($inventory['is_active']) &&
            !(bool) $inventory['is_active']
        ) {
            throw new RuntimeException(
                'Cannot modify inventory for an inactive product.'
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Maximum Stock
    |--------------------------------------------------------------------------
    */

    private function getMaximumStock(
        array $inventory
    ): ?int {

        if (
            !isset($inventory['maximum_stock']) ||
            $inventory['maximum_stock'] === '' ||
            $inventory['maximum_stock'] === null
        ) {
            return null;
        }


        $maximumStock = (int) (
            $inventory['maximum_stock']
        );


        return $maximumStock > 0
            ? $maximumStock
            : null;
    }


    /*
    |--------------------------------------------------------------------------
    | Transaction Result
    |--------------------------------------------------------------------------
    */

    private function buildTransactionResult(
        array $inventory,
        int|string|null $movementId,
        int $before,
        int $after,
        int $quantity,
        string $operation,
        string $reason
    ): array {

        return [
            'movement_id' =>
                $movementId,

            'product_id' =>
                (int) (
                    $inventory['product_id']
                    ?? $inventory['id']
                    ?? 0
                ),

            'product_name' =>
                $inventory['product_name'] ?? null,

            'sku' =>
                $inventory['sku'] ?? null,

            'quantity_before' =>
                $before,

            'quantity_after' =>
                $after,

            'quantity_changed' =>
                $quantity,

            'difference' =>
                $after - $before,

            'operation' =>
                $operation,

            'reason' =>
                $reason,

            'stock_status' =>
                $this->getStockStatus(
                    $after,
                    $inventory
                )
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | Rollback Helper
    |--------------------------------------------------------------------------
    */

    private function rollback(): void
    {
        if ($this->db->inTransaction()) {
            $this->db->rollBack();
        }
    }
}
