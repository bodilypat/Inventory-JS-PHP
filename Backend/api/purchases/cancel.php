<?php

declare(strict_types=1);

/**
 * Inventory Management System
 *
 * POST /api/purchases/cancel.php?id=1
 *
 * Cancels a purchase.
 *
 * Rules:
 * - Purchase must exist.
 * - Purchase must not already be cancelled.
 * - Received purchases cannot be cancelled.
 * - Pending purchases can be cancelled.
 * - Partially received purchases should not be cancelled because
 *   inventory has already been affected.
 *
 * Expected JSON:
 *
 * {
 *     "reason": "Supplier cancelled the order"
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
| Supports:
|
| POST /cancel.php?id=10
|
| or:
|
| {
|     "purchase_id": 10
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
| Cancellation Reason
|--------------------------------------------------------------------------
*/

$reason =
    isset($data['reason'])
        ? trim((string) $data['reason'])
        : '';


if ($reason === '') {

    respondError(
        'A cancellation reason is required.',
        422
    );

    exit;
}


if (strlen($reason) > 1000) {

    respondError(
        'Cancellation reason cannot exceed 1000 characters.',
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
        'Purchase cancellation database error: ' .
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
| Cancel Purchase
|--------------------------------------------------------------------------
*/

try {

    $purchaseService =
        new PurchaseService($database);


    /*
     * PurchaseService::cancel() should:
     *
     * 1. Begin a database transaction.
     * 2. Lock the purchase row.
     * 3. Verify the purchase exists.
     * 4. Verify the current status.
     * 5. Reject received purchases.
     * 6. Reject already cancelled purchases.
     * 7. Set status = cancelled.
     * 8. Store cancellation reason.
     * 9. Store cancelled_by.
     * 10. Store cancelled_at.
     * 11. Commit the transaction.
     *
     * No inventory transaction should be created here
     * because a cancellable purchase has not been received.
     */

    $result = $purchaseService->cancel(
        $purchaseId,
        [
            'reason' => $reason,

            'cancelled_by' => $userId
        ]
    );


    /*
     * Service can return null when purchase
     * does not exist.
     */
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


    respondSuccess(
        'Purchase cancelled successfully.',
        [
            'purchase' => $result
        ]
    );

} catch (InvalidArgumentException $e) {

    respondError(
        $e->getMessage(),
        422
    );

} catch (RuntimeException $e) {

    error_log(
        'Purchase cancellation runtime error: ' .
        $e->getMessage()
    );

    respondError(
        $e->getMessage(),
        422
    );

} catch (Throwable $e) {

    error_log(
        'Purchase cancellation error: ' .
        $e->getMessage()
    );

    respondError(
        'Unable to cancel purchase.',
        500
    );
}
