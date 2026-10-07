<?php

declare(strict_types=1);

/**
 * Inventory Management System
 *
 * POST /api/inventory/stock-out.php
 *
 * Request body:
 * {
 *     "product_id": 12,
 *     "quantity": 5,
 *     "reason": "Sold to customer",
 *     "reference_type": "sale",
 *     "reference_id": 25
 * }
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/constants.php';

require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../middleware/error.php';

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../models/Inventory.php';
require_once __DIR__ . '/../../models/InventoryMovement.php';


/*
|--------------------------------------------------------------------------
| HTTP Method
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respondError(
        'Method not allowed.',
        405
    );
}


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

$user = requireAuth();


/*
|--------------------------------------------------------------------------
| Read JSON Request
|--------------------------------------------------------------------------
*/

$rawInput = file_get_contents('php://input');

$data = json_decode(
    $rawInput,
    true
);

if (!is_array($data)) {
    respondError(
        'Invalid JSON request body.',
        400
    );
}


/*
|--------------------------------------------------------------------------
| Required Fields
|--------------------------------------------------------------------------
*/

$productId = filter_var(
    $data['product_id'] ?? null,
    FILTER_VALIDATE_INT
);

$quantity = filter_var(
    $data['quantity'] ?? null,
    FILTER_VALIDATE_INT
);

if ($productId === false || $productId < 1) {
    respondError(
        'A valid product_id is required.',
        422
    );
}

if ($quantity === false || $quantity < 1) {
    respondError(
        'Quantity must be a positive integer.',
        422
    );
}


/*
|--------------------------------------------------------------------------
| Optional Fields
|--------------------------------------------------------------------------
*/

$reason = isset($data['reason'])
    ? trim((string) $data['reason'])
    : null;

$referenceType = isset($data['reference_type'])
    ? trim((string) $data['reference_type'])
    : null;

$referenceId = null;

if (
    isset($data['reference_id']) &&
    $data['reference_id'] !== ''
) {
    $referenceId = filter_var(
        $data['reference_id'],
        FILTER_VALIDATE_INT
    );

    if ($referenceId === false || $referenceId < 1) {
        respondError(
            'Invalid reference_id.',
            422
        );
    }
}


/*
|--------------------------------------------------------------------------
| Validate Reason
|--------------------------------------------------------------------------
*/

if ($reason !== null && strlen($reason) > 500) {
    respondError(
        'Reason cannot exceed 500 characters.',
        422
    );
}


/*
|--------------------------------------------------------------------------
| Validate Reference Type
|--------------------------------------------------------------------------
*/

$allowedReferenceTypes = [
    null,
    'sale',
    'return',
    'adjustment',
    'manual',
    'other'
];

if (!in_array(
    $referenceType,
    $allowedReferenceTypes,
    true
)) {
    respondError(
        'Invalid reference_type.',
        422
    );
}


/*
|--------------------------------------------------------------------------
| Database
|--------------------------------------------------------------------------
*/

try {

    $database = new Database();

    $db = $database->getConnection();

    /*
     * Start transaction.
     *
     * The inventory row is locked before checking the
     * available quantity. This prevents two simultaneous
     * stock-out requests from overselling the same stock.
     */
    $db->beginTransaction();

    $inventoryModel = new Inventory($db);

    $inventory = $inventoryModel->findForUpdate(
        $productId
    );

    if ($inventory === null) {

        $db->rollBack();

        respondError(
            'Inventory record not found for this product.',
            404
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Check Product Status
    |--------------------------------------------------------------------------
    */

    $productActive = isset(
        $inventory['is_active']
    )
        ? (bool) $inventory['is_active']
        : true;

    if (!$productActive) {

        $db->rollBack();

        respondError(
            'Cannot remove stock from an inactive product.',
            422
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Check Available Stock
    |--------------------------------------------------------------------------
    */

    $currentQuantity = (int) (
        $inventory['quantity'] ?? 0
    );

    if ($quantity > $currentQuantity) {

        $db->rollBack();

        respondError(
            'Insufficient stock.',
            422,
            [
                'product_id' => $productId,
                'requested_quantity' => $quantity,
                'available_quantity' => $currentQuantity
            ]
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Update Inventory
    |--------------------------------------------------------------------------
    */

    $success = $inventoryModel->decrease(
        $productId,
        $quantity
    );

    if (!$success) {

        $db->rollBack();

        respondError(
            'Unable to update inventory.',
            500
        );
    }


    /*
    |--------------------------------------------------------------------------
    | New Stock Quantity
    |--------------------------------------------------------------------------
    */

    $newQuantity =
        $currentQuantity - $quantity;


    /*
    |--------------------------------------------------------------------------
    | Create Inventory Movement
    |--------------------------------------------------------------------------
    */

    $movementModel = new InventoryMovement($db);

    $movementId = $movementModel->create([
        'product_id' => $productId,
        'type' => 'stock_out',
        'quantity' => $quantity,
        'quantity_before' => $currentQuantity,
        'quantity_after' => $newQuantity,
        'reason' => $reason,
        'reference_type' => $referenceType,
        'reference_id' => $referenceId,
        'user_id' => (int) (
            $user['id'] ?? 0
        )
    ]);


    /*
    |--------------------------------------------------------------------------
    | Commit Transaction
    |--------------------------------------------------------------------------
    */

    $db->commit();


    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    respondSuccess(
        'Stock removed successfully.',
        [
            'movement_id' => $movementId,

            'product_id' => $productId,

            'product_name' =>
                $inventory['product_name'] ?? null,

            'sku' =>
                $inventory['sku'] ?? null,

            'quantity_removed' => $quantity,

            'quantity_before' => $currentQuantity,

            'quantity_after' => $newQuantity,

            'stock_status' =>
                $newQuantity <= 0
                    ? 'out_of_stock'
                    : (
                        $newQuantity <=
                        (int) (
                            $inventory['minimum_stock'] ?? 0
                        )
                            ? 'low_stock'
                            : 'in_stock'
                    )
        ]
    );

} catch (PDOException $e) {

    if (
        isset($db) &&
        $db instanceof PDO &&
        $db->inTransaction()
    ) {
        $db->rollBack();
    }

    error_log(
        'Stock out database error: ' .
        $e->getMessage()
    );

    respondError(
        'Unable to process stock-out transaction.',
        500
    );

} catch (Throwable $e) {

    if (
        isset($db) &&
        $db instanceof PDO &&
        $db->inTransaction()
    ) {
        $db->rollBack();
    }

    error_log(
        'Stock out error: ' .
        $e->getMessage()
    );

    respondError(
        'An unexpected error occurred.',
        500
    );
}
