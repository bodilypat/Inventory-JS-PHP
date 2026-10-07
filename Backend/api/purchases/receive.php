<?php

declare(strict_types=1);

/**
 * Inventory Management System
 *
 * POST /api/purchases/receive.php?id=1
 *
 * Receives a pending purchase and adds its items to inventory.
 *
 * Expected JSON:
 *
 * {
 *     "received_date": "2026-10-07",
 *     "notes": "Received in good condition",
 *     "items": [
 *         {
 *             "purchase_item_id": 1,
 *             "quantity": 10
 *         },
 *         {
 *             "purchase_item_id": 2,
 *             "quantity": 5
 *         }
 *     ]
 * }
 *
 * If "items" is omitted, the service may receive the complete
 * purchase quantities. Partial receiving should be supported
 * only if PurchaseService is implemented for it.
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

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
| Authenticated User ID
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
|
| Primary:
| POST /receive.php?id=1
|
| Also accepts:
| {
|     "purchase_id": 1
| }
|
*/

$purchaseId = filter_input(
    INPUT_GET,
    'id',
    FILTER_VALIDATE_INT
);


/*
|--------------------------------------------------------------------------
| Request Body
|--------------------------------------------------------------------------
*/

$rawInput = file_get_contents('php://input');

$data = [];

if (
    $rawInput !== false &&
    trim($rawInput) !== ''
) {

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
}


/*
|--------------------------------------------------------------------------
| Purchase ID From Body
|--------------------------------------------------------------------------
*/

if (
    $purchaseId === false ||
    $purchaseId === null
) {

    $bodyPurchaseId =
        $data['purchase_id']
        ?? $data['id']
        ?? null;


    if (
        is_numeric($bodyPurchaseId) &&
        (int) $bodyPurchaseId > 0
    ) {

        $purchaseId = (int) $bodyPurchaseId;
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
| Received Date
|--------------------------------------------------------------------------
*/

$receivedDate =
    isset($data['received_date'])
        ? trim((string) $data['received_date'])
        : date('Y-m-d');


if (!isValidDate($receivedDate)) {

    respondError(
        'Invalid received_date. Expected YYYY-MM-DD.',
        422
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Notes
|--------------------------------------------------------------------------
*/

$notes =
    isset($data['notes'])
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
| Received Items
|--------------------------------------------------------------------------
|
| Optional:
|
| {
|     "items": [
|         {
|             "purchase_item_id": 10,
|             "quantity": 5
|         }
|     ]
| }
|
| If omitted, the service receives all outstanding quantities.
|
*/

$items = null;

if (array_key_exists('items', $data)) {

    if (!is_array($data['items'])) {

        respondError(
            'items must be an array.',
            422
        );

        exit;
    }


    if (count($data['items']) === 0) {

        respondError(
            'At least one receiving item is required.',
            422
        );

        exit;
    }


    if (count($data['items']) > 500) {

        respondError(
            'A purchase cannot contain more than 500 receiving items.',
            422
        );

        exit;
    }


    $items = [];

    $purchaseItemIds = [];


    foreach ($data['items'] as $index => $item) {

        if (!is_array($item)) {

            respondError(
                'Invalid receiving item at index ' .
                $index . '.',
                422
            );

            exit;
        }


        /*
         * Purchase item ID
         */
        $purchaseItemId =
            $item['purchase_item_id']
            ?? $item['item_id']
            ?? null;


        if (
            !is_numeric($purchaseItemId) ||
            (int) $purchaseItemId < 1
        ) {

            respondError(
                'A valid purchase_item_id is required for item ' .
                ($index + 1) . '.',
                422
            );

            exit;
        }


        $purchaseItemId =
            (int) $purchaseItemId;


        /*
         * Prevent duplicate item IDs.
         */
        if (
            in_array(
                $purchaseItemId,
                $purchaseItemIds,
                true
            )
        ) {

            respondError(
                'A purchase item cannot appear more than once.',
                422
            );

            exit;
        }


        $purchaseItemIds[] =
            $purchaseItemId;


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
                'Receiving quantity must be greater than zero for item ' .
                ($index + 1) . '.',
                422
            );

            exit;
        }


        $quantity = (int) $quantity;


        if ($quantity > 1000000000) {

            respondError(
                'Receiving quantity is too large.',
                422
            );

            exit;
        }


        $items[] = [
            'purchase_item_id' => $purchaseItemId,
            'quantity' => $quantity
        ];
    }
}


/*
|--------------------------------------------------------------------------
| Database
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


    $database->setAttribute(
        PDO::ATTR_ERRMODE,
        PDO::ERRMODE_EXCEPTION
    );

} catch (Throwable $e) {

    error_log(
        'Purchase receive database error: ' .
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
| Receive Purchase
|--------------------------------------------------------------------------
*/

try {

    $purchaseService =
        new PurchaseService($database);


    /*
     * PurchaseService::receive() is responsible for:
     *
     * 1. Starting a database transaction.
     * 2. Locking the purchase row.
     * 3. Verifying that the purchase exists.
     * 4. Verifying that it can be received.
     * 5. Locking the purchase items.
     * 6. Validating received quantities.
     * 7. Adding stock through InventoryService.
     * 8. Creating inventory movement records.
     * 9. Updating purchase receiving quantities.
     * 10. Updating purchase status.
     * 11. Committing the transaction.
     *
     * If any step fails, the entire transaction must roll back.
     */

    $result = $purchaseService->receive(
        $purchaseId,
        [
            'received_date' => $receivedDate,

            'notes' => $notes,

            'items' => $items,

            'received_by' => $userId
        ]
    );


    if (
        $result === null ||
        $result === false
    ) {

        respondError(
            'Purchase not found.',
            404
        );

        exit;
    }


    /*
     * Normalize service response.
     */
    $response = [
        'purchase' => $result
    ];


    /*
     * If the service returns additional information,
     * preserve it.
     */
    if (is_array($result)) {

        if (isset($result['purchase'])) {

            $response['purchase'] =
                $result['purchase'];
        }

        if (isset($result['status'])) {

            $response['status'] =
                $result['status'];
        }

        if (isset($result['received_items'])) {

            $response['received_items'] =
                $result['received_items'];
        }

        if (isset($result['inventory_movements'])) {

            $response['inventory_movements'] =
                $result['inventory_movements'];
        }

        if (isset($result['total_received'])) {

            $response['total_received'] =
                $result['total_received'];
        }
    }


    respondSuccess(
        'Purchase received successfully.',
        $response
    );

} catch (InvalidArgumentException $e) {

    respondError(
        $e->getMessage(),
        422
    );

} catch (RuntimeException $e) {

    error_log(
        'Purchase receive runtime error: ' .
        $e->getMessage()
    );

    respondError(
        $e->getMessage(),
        422
    );

} catch (Throwable $e) {

    error_log(
        'Purchase receive error: ' .
        $e->getMessage()
    );

    respondError(
        'Unable to receive purchase.',
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
