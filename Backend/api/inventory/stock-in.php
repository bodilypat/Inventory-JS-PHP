<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/helpers/response.php';
require_once dirname(__DIR__, 2) . '/helpers/auth.php';
require_once dirname(__DIR__, 2) . '/services/InventoryService.php';
require_once dirname(__DIR__, 2) . '/middleware/cors.php';

try {
    $userId = requireAuthentication();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed.', 405);
    }

    $input = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($input)) {
        errorResponse('Invalid JSON request body.', 400);
    }

    $productId = (int) ($input['product_id'] ?? 0);
    $quantity = (int) ($input['quantity'] ?? 0);
    $reason = trim((string) ($input['reason'] ?? ''));

    if ($productId <= 0) {
        errorResponse('Invalid product ID.', 422);
    }

    if ($quantity <= 0) {
        errorResponse('Quantity must be greater than zero.', 422);
    }

    $service = new InventoryService(
        Database::connection()
    );

    $result = $service->transaction(
        $productId,
        'stock_in',
        $quantity,
        $reason,
        $userId
    );

    successResponse(
        $result,
        'Stock added successfully.'
    );

} catch (Throwable $e) {
    $status = $e instanceof DomainException ? 422 : 500;

    errorResponse(
        $e instanceof DomainException
            ? $e->getMessage()
            : 'Unable to add stock.',
        $status
    );
}
