<?php

declare(strict_types=1);

/**
 * Inventory Management System
 *
 * PUT /api/purchases/update.php?id=1
 *
 * Updates an existing purchase.
 *
 * Important:
 * - Only pending purchases should be editable.
 * - Updating a purchase does NOT change inventory.
 * - Inventory changes happen when the purchase is received.
 *
 * Expected JSON:
 *
 * {
 *   "supplier_id": 1,
 *   "purchase_date": "2026-10-07",
 *   "expected_date": "2026-10-10",
 *   "tax": 50,
 *   "discount": 0,
 *   "shipping": 0,
 *   "notes": "Updated order",
 *   "items": [
 *     {
 *       "product_id": 5,
 *       "quantity": 10,
 *       "unit_cost": 25.50,
 *       "tax_rate": 10,
 *       "discount": 0
 *     }
 *   ]
 * }
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

if (
    $_SERVER['REQUEST_METHOD'] !== 'PUT' &&
    $_SERVER['REQUEST_METHOD'] !== 'PATCH'
) {

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
| Resolve User ID
|--------------------------------------------------------------------------
*/

$userId = null;

if (is_array($user)) {

    $userId =
        $user['id']
        ?? $user['user_id']
        ?? null;

} elseif (is_object($user)) {

    $userId =
        $user->id
        ?? $user->user_id
        ?? null;
}


if (
    $userId === null ||
    !is_numeric($userId) ||
    (int) $userId < 1
) {

    respondError(
        'Unable to determine authenticated user.',
        401
    );

    exit;
}

$userId = (int) $userId;


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


/*
 * Also support:
 *
 * PUT /update.php
 *
 * {
 *     "id": 1,
 *     ...
 * }
 *
 * The JSON ID is read later if query ID is absent.
 */

$rawInput = file_get_contents('php://input');

if (
    $rawInput === false ||
    trim($rawInput) === ''
) {

    respondError(
        'Request body is required.',
        422
    );

    exit;
}


$data = json_decode(
    $rawInput,
    true
);


if (
    !is_array($data) ||
    json_last_error() !== JSON_ERROR_NONE
) {

    respondError(
        'Invalid JSON request body.',
        400
    );

    exit;
}


if (
    $purchaseId === false ||
    $purchaseId === null
) {

    if (
        isset($data['id']) &&
        is_numeric($data['id'])
    ) {

        $purchaseId = (int) $data['id'];
    }
}


if (
    !is_int($purchaseId) ||
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
| Supplier
|--------------------------------------------------------------------------
*/

$supplierId = $data['supplier_id'] ?? null;


if (
    !is_numeric($supplierId) ||
    (int) $supplierId < 1
) {

    respondError(
        'A valid supplier_id is required.',
        422
    );

    exit;
}

$supplierId = (int) $supplierId;


/*
|--------------------------------------------------------------------------
| Purchase Date
|--------------------------------------------------------------------------
*/

$purchaseDate =
    isset($data['purchase_date'])
        ? trim((string) $data['purchase_date'])
        : '';


if (
    $purchaseDate === '' ||
    !isValidDate($purchaseDate)
) {

    respondError(
        'A valid purchase_date is required. Expected YYYY-MM-DD.',
        422
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Expected Date
|--------------------------------------------------------------------------
*/

$expectedDate = null;

if (
    isset($data['expected_date']) &&
    trim((string) $data['expected_date']) !== ''
) {

    $expectedDate =
        trim((string) $data['expected_date']);


    if (!isValidDate($expectedDate)) {

        respondError(
            'Invalid expected_date. Expected YYYY-MM-DD.',
            422
        );

        exit;
    }


    if ($expectedDate < $purchaseDate) {

        respondError(
            'expected_date cannot be earlier than purchase_date.',
            422
        );

        exit;
    }
}


/*
|--------------------------------------------------------------------------
| Tax
|--------------------------------------------------------------------------
*/

$tax = normalizeMoney(
    $data['tax'] ?? 0,
    'tax'
);


/*
|--------------------------------------------------------------------------
| Discount
|--------------------------------------------------------------------------
*/

$discount = normalizeMoney(
    $data['discount'] ?? 0,
    'discount'
);


/*
|--------------------------------------------------------------------------
| Shipping
|--------------------------------------------------------------------------
*/

$shipping = normalizeMoney(
    $data['shipping'] ?? 0,
    'shipping'
);


/*
|--------------------------------------------------------------------------
| Notes
|--------------------------------------------------------------------------
*/

$notes = isset($data['notes'])
    ? trim((string) $data['notes'])
    : null;


if (
    $notes !== null &&
    strlen($notes) > 2000
) {

    respondError(
        'Notes cannot exceed 2000 characters.',
        422
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Purchase Items
|--------------------------------------------------------------------------
*/

$items = $data['items'] ?? null;


if (
    !is_array($items) ||
    count($items) === 0
) {

    respondError(
        'At least one purchase item is required.',
        422
    );

    exit;
}


if (count($items) > 500) {

    respondError(
        'A purchase cannot contain more than 500 items.',
        422
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Validate Items
|--------------------------------------------------------------------------
*/

$validatedItems = [];

$productIds = [];


foreach ($items as $index => $item) {

    if (!is_array($item)) {

        respondError(
            'Invalid purchase item at index ' .
            $index . '.',
            422
        );

        exit;
    }


    /*
     * Product ID
     */
    $productId =
        $item['product_id'] ?? null;


    if (
        !is_numeric($productId) ||
        (int) $productId < 1
    ) {

        respondError(
            'A valid product_id is required for item ' .
            ($index + 1) . '.',
            422
        );

        exit;
    }

    $productId = (int) $productId;


    /*
     * Prevent duplicate products.
     */
    if (
        in_array(
            $productId,
            $productIds,
            true
        )
    ) {

        respondError(
            'The same product cannot appear more than once in a purchase.',
            422
        );

        exit;
    }

    $productIds[] = $productId;


    /*
     * Quantity
     */
    $quantity =
        $item['quantity'] ?? null;


    if (
        !is_numeric($quantity) ||
        (int) $quantity < 1
    ) {

        respondError(
            'Quantity must be greater than zero for item ' .
            ($index + 1) . '.',
            422
        );

        exit;
    }

    $quantity = (int) $quantity;


    /*
     * Unit Cost
     */
    $unitCost =
        $item['unit_cost']
        ?? $item['cost_price']
        ?? null;


    if (
        !is_numeric($unitCost) ||
        (float) $unitCost < 0
    ) {

        respondError(
            'A valid unit_cost is required for item ' .
            ($index + 1) . '.',
            422
        );

        exit;
    }

    $unitCost = round(
        (float) $unitCost,
        2
    );


    /*
     * Tax Rate
     */
    $taxRate =
        $item['tax_rate'] ?? 0;


    if (
        !is_numeric($taxRate) ||
        (float) $taxRate < 0 ||
        (float) $taxRate > 100
    ) {

        respondError(
            'tax_rate must be between 0 and 100 for item ' .
            ($index + 1) . '.',
            422
        );

        exit;
    }

    $taxRate = round(
        (float) $taxRate,
        2
    );


    /*
     * Item Discount
     */
    $itemDiscount =
        $item['discount'] ?? 0;


    if (
        !is_numeric($itemDiscount) ||
        (float) $itemDiscount < 0
    ) {

        respondError(
            'Invalid discount for item ' .
            ($index + 1) . '.',
            422
        );

        exit;
    }

    $itemDiscount = round(
        (float) $itemDiscount,
        2
    );


    /*
     * Item note
     */
    $itemNote =
        isset($item['note'])
            ? trim((string) $item['note'])
            : null;


    if (
        $itemNote !== null &&
        strlen($itemNote) > 500
    ) {

        respondError(
            'Item note cannot exceed 500 characters for item ' .
            ($index + 1) . '.',
            422
        );

        exit;
    }


    $validatedItems[] = [
        'product_id' => $productId,

        'quantity' => $quantity,

        'unit_cost' => $unitCost,

        'tax_rate' => $taxRate,

        'discount' => $itemDiscount,

        'note' => $itemNote
    ];
}


/*
|--------------------------------------------------------------------------
| Database Connection
|--------------------------------------------------------------------------
*/

try {

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
        'Purchase update database error: ' .
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
| Update Purchase
|--------------------------------------------------------------------------
*/

try {

    $purchaseService = new PurchaseService(
        $database
    );


    /*
     * PurchaseService should:
     *
     * 1. Lock the purchase.
     * 2. Verify it exists.
     * 3. Verify status is pending.
     * 4. Verify supplier exists.
     * 5. Verify products exist and are active.
     * 6. Replace/update purchase items.
     * 7. Recalculate totals.
     * 8. Keep inventory unchanged.
     */
    $purchase = $purchaseService->update(
        $purchaseId,
        [
            'supplier_id' => $supplierId,

            'purchase_date' => $purchaseDate,

            'expected_date' => $expectedDate,

            'tax' => $tax,

            'discount' => $discount,

            'shipping' => $shipping,

            'notes' => $notes,

            'items' => $validatedItems,

            'updated_by' => $userId
        ]
    );


    /*
     * Service may return null when the purchase
     * doesn't exist.
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


    respondSuccess(
        'Purchase updated successfully.',
        $purchase
    );

} catch (InvalidArgumentException $e) {

    respondError(
        $e->getMessage(),
        422
    );

} catch (RuntimeException $e) {

    error_log(
        'Purchase update runtime error: ' .
        $e->getMessage()
    );

    respondError(
        $e->getMessage(),
        422
    );

} catch (Throwable $e) {

    error_log(
        'Purchase update error: ' .
        $e->getMessage()
    );

    respondError(
        'Unable to update purchase.',
        500
    );
}


/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function isValidDate(string $date): bool
{
    $parsed = DateTime::createFromFormat(
        'Y-m-d',
        $date
    );


    return $parsed !== false &&
        $parsed->format('Y-m-d') === $date;
}


function normalizeMoney(
    mixed $value,
    string $field
): float {

    if (
        !is_numeric($value) ||
        (float) $value < 0
    ) {

        respondError(
            $field .
            ' must be a non-negative number.',
            422
        );

        exit;
    }


    $value = round(
        (float) $value,
        2
    );


    if ($value > 999999999.99) {

        respondError(
            $field . ' is too large.',
            422
        );

        exit;
    }


    return $value;
}
