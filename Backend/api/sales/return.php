<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../models/Sale.php';
require_once __DIR__ . '/../../services/SalesService.php';

try {
    $db = Database::getConnection();

    $user = requireAuth();

    $saleId = isset($_GET['id'])
        ? (int) $_GET['id']
        : 0;

    if ($saleId <= 0) {
        sendError(
            'A valid sale ID is required.',
            400
        );
    }

    $input = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($input)) {
        sendError(
            'Invalid JSON request body.',
            400
        );
    }

    $items = $input['items'] ?? [];

    if (!is_array($items) || count($items) === 0) {
        sendError(
            'At least one return item is required.',
            422
        );
    }

    $reason = isset($input['reason'])
        ? trim((string) $input['reason'])
        : null;

    $service = new SalesService($db);

    $result = $service->returnSale(
        $saleId,
        $items,
        $reason,
        (int) $user['id']
    );

    sendSuccess(
        $result,
        'Sale return processed successfully.'
    );
} catch (InvalidArgumentException $e) {
    sendError(
        $e->getMessage(),
        422
    );
} catch (RuntimeException $e) {
    sendError(
        $e->getMessage(),
        400
    );
} catch (Throwable $e) {
    sendError(
        $e->getMessage(),
        500
    );
}
