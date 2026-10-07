<?php

declare(strict_types=1);

/**
 * Inventory Management System
 *
 * GET /api/purchases/get.php?id=1
 *
 * Returns a single purchase with:
 * - Purchase information
 * - Supplier information
 * - Purchase items
 * - Product information for each item
 * - Purchase totals
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../services/PurchaseService.php';


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

if (function_exists('handleCors')) {
    handleCors();
}


/*
|--------------------------------------------------------------------------
| HTTP Method
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {

    respondError(
        'Method not allowed.',
        405
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

try {

    $user = requireAuth();

} catch (Throwable $e) {

    respondError(
        'Authentication required.',
        401
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Purchase ID
|--------------------------------------------------------------------------
*/

$purchaseId = filter_input(
    INPUT_GET,
    'id',
    FILTER_VALIDATE_INT
);


if (
    $purchaseId === false ||
    $purchaseId === null ||
    $purchaseId < 1
) {

    respondError(
        'A valid purchase ID is required.',
        422
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Database Connection
|--------------------------------------------------------------------------
*/

try {

    /*
     * Supports the common connection variable names
     * used by the project's database.php.
     */
    if (
        isset($pdo) &&
        $pdo instanceof PDO
    ) {
        $database = $pdo;

    } elseif (
        isset($db) &&
        $db instanceof PDO
    ) {
        $database = $db;

    } elseif (
        function_exists('getDatabase')
    ) {
        $database = getDatabase();

    } elseif (
        function_exists('getPDO')
    ) {
        $database = getPDO();

    } else {
        throw new RuntimeException(
            'Database connection is not available.'
        );
    }

} catch (Throwable $e) {

    error_log(
        'Purchase get database error: ' .
        $e->getMessage()
    );

    respondError(
        'Unable to connect to the database.',
        500
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Get Purchase
|--------------------------------------------------------------------------
*/

try {

    $purchaseService = new PurchaseService(
        $database
    );


    /*
     * PurchaseService should return the complete purchase,
     * including supplier and items.
     */
    $purchase = $purchaseService->get(
        $purchaseId
    );


    /*
     * Purchase does not exist.
     */
    if (
        $purchase === null ||
        $purchase === false
    ) {

        respondError(
            'Purchase not found.',
            404
        );

        exit;
    }


    /*
     |--------------------------------------------------------------------------
     | Normalize Purchase Items
     |--------------------------------------------------------------------------
     *
     * The service should normally provide items.
     * This fallback prevents malformed data from reaching
     * the frontend.
     */

    if (
        !isset($purchase['items']) ||
        !is_array($purchase['items'])
    ) {
        $purchase['items'] = [];
    }


    /*
     |--------------------------------------------------------------------------
     | Normalize Numeric Values
     |--------------------------------------------------------------------------
     */

    $numericFields = [
        'subtotal',
        'tax',
        'tax_amount',
        'discount',
        'discount_amount',
        'shipping',
        'shipping_cost',
        'total'
    ];


    foreach ($numericFields as $field) {

        if (array_key_exists(
            $field,
            $purchase
        )) {

            $purchase[$field] = (float) (
                $purchase[$field] ?? 0
            );
        }
    }


    /*
     |--------------------------------------------------------------------------
     | Normalize Item Values
     |--------------------------------------------------------------------------
     */

    foreach (
        $purchase['items']
        as &$item
    ) {

        if (isset($item['quantity'])) {
            $item['quantity'] = (int) $item['quantity'];
        }

        if (isset($item['received_quantity'])) {
            $item['received_quantity'] =
                (int) $item['received_quantity'];
        }

        if (isset($item['unit_cost'])) {
            $item['unit_cost'] =
                (float) $item['unit_cost'];
        }

        if (isset($item['cost_price'])) {
            $item['cost_price'] =
                (float) $item['cost_price'];
        }

        if (isset($item['tax_rate'])) {
            $item['tax_rate'] =
                (float) $item['tax_rate'];
        }

        if (isset($item['discount'])) {
            $item['discount'] =
                (float) $item['discount'];
        }

        if (isset($item['total'])) {
            $item['total'] =
                (float) $item['total'];
        }
    }

    unset($item);


    /*
     |--------------------------------------------------------------------------
     | Success Response
     |--------------------------------------------------------------------------
     */

    respondSuccess(
        'Purchase retrieved successfully.',
        $purchase
    );

} catch (InvalidArgumentException $e) {

    respondError(
        $e->getMessage(),
        422
    );

} catch (Throwable $e) {

    error_log(
        'Purchase get error: ' .
        $e->getMessage()
    );


    respondError(
        'Unable to retrieve purchase.',
        500
    );
}
