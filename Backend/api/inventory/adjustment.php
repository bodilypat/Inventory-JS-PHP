<?php

declare(strict_types=1);

/**
 * Inventory Management System
 *
 * POST /api/inventory/adjustment.php
 *
 * Request body:
 * {
 *     "product_id": 12,
 *     "quantity": 25,
 *     "reason": "Physical stock count"
 * }
 *
 * The quantity represents the NEW / ABSOLUTE stock quantity.
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
| Product ID
|--------------------------------------------------------------------------
*/

$productId = filter_var(
    $data['product_id'] ?? null,
    FILTER_VALIDATE_INT
);

if ($productId === false || $productId < 1) {
    respondError(
        'A valid product_id is required.',
        422
    );
}


/*
|--------------------------------------------------------------------------
| New Stock Quantity
|--------------------------------------------------------------------------
|
| Unlike stock-in and stock-out, adjustment accepts an
| absolute quantity.
|
| Example:
|
| Current stock = 20
| Adjustment    = 15
| Difference    = -5
|
*/

$quantity = filter_var(
    $data['quantity'] ?? null,
    FILTER_VALIDATE_INT
);

if ($quantity === false || $quantity < 0) {
    respondError(
        'Quantity must be a non-negative integer.',
        422
    );
}


/*
|--------------------------------------------------------------------------
| Reason
|--------------------------------------------------------------------------
*/

$reason = isset($data['reason'])
    ? trim((string) $data['reason'])
    : 'Inventory adjustment';


if ($reason === '') {
    $reason = 'Inventory adjustment';
}


if (strlen($reason) > 500) {
    respondError(
        'Reason cannot exceed 500 characters.',
        422
    );
}


/*
|--------------------------------------------------------------------------
| Database Transaction
|--------------------------------------------------------------------------
*/

try {

    $database = new Database();

    $db = $database->getConnection();

    /*
     * Lock the inventory row while performing the adjustment.
     */
    $db->beginTransaction();

    $inventoryModel = new Inventory($db);

    $inventory = $inventoryModel->findForUpdate(
        $productId
    );


    /*
    |--------------------------------------------------------------------------
    | Inventory Exists
    |--------------------------------------------------------------------------
    */

    if ($inventory === null) {

        $db->rollBack();

        respondError(
            'Inventory record not found for this product.',
            404
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Product Status
    |--------------------------------------------------------------------------
    */

    if (
        isset($inventory['is_active']) &&
        !(bool) $inventory['is_active']
    ) {

        $db->rollBack();

        respondError(
            'Cannot adjust stock for an inactive product.',
            422
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Current Quantity
    |--------------------------------------------------------------------------
    */

    $currentQuantity = (int) (
        $inventory['quantity'] ?? 0
    );


    /*
    |--------------------------------------------------------------------------
    | Calculate Difference
    |--------------------------------------------------------------------------
    */

    $difference =
        $quantity - $currentQuantity;


    /*
    |--------------------------------------------------------------------------
    | No Change
    |--------------------------------------------------------------------------
    */

    if ($difference === 0) {

        $db->rollBack();

        respondError(
            'The adjusted quantity is the same as the current stock.',
            422,
            [
                'product_id' => $productId,
                'current_quantity' => $currentQuantity,
                'requested_quantity' => $quantity
            ]
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Update Inventory
    |--------------------------------------------------------------------------
    */

    $updated = $inventoryModel->setQuantity(
        $productId,
        $quantity
    );

    if (!$updated) {

        $db->rollBack();

        respondError(
            'Unable to update inventory quantity.',
            500
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Create Movement Record
    |--------------------------------------------------------------------------
    */

    $movementModel = new InventoryMovement($db);

    $movementId = $movementModel->create([
        'product_id' => $productId,

        'type' => 'adjustment',

        /*
         * Store the absolute adjustment quantity
         * in the movement record.
         */
        'quantity' => abs($difference),

        'quantity_before' =>
            $currentQuantity,

        'quantity_after' =>
            $quantity,

        'reason' =>
            $reason,

        'reference_type' =>
            'adjustment',

        'reference_id' =>
            null,

        'user_id' =>
            (int) ($user['id'] ?? 0)
    ]);


    /*
    |--------------------------------------------------------------------------
    | Commit
    |--------------------------------------------------------------------------
    */

    $db->commit();


    /*
    |--------------------------------------------------------------------------
    | Determine New Stock Status
    |--------------------------------------------------------------------------
    */

    $minimumStock = (int) (
        $inventory['minimum_stock'] ?? 0
    );

    $maximumStock = isset(
        $inventory['maximum_stock']
    ) && $inventory['maximum_stock'] !== null
        ? (int) $inventory['maximum_stock']
        : null;


    if ($quantity === 0) {

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


    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    respondSuccess(
        'Inventory adjusted successfully.',
        [
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
                $quantity,

            'difference' =>
                $difference,

            'adjustment_type' =>
                $difference > 0
                    ? 'increase'
                    : 'decrease',

            'reason' =>
                $reason,

            'stock_status' =>
                $stockStatus
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
        'Inventory adjustment database error: ' .
        $e->getMessage()
    );

    respondError(
        'Unable to process inventory adjustment.',
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
        'Inventory adjustment error: ' .
        $e->getMessage()
    );

    respondError(
        'An unexpected error occurred.',
        500
    );
}
