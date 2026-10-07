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

    $id = isset($_GET['id'])
        ? (int) $_GET['id']
        : 0;

    if ($id <= 0) {
        sendError(
            'A valid sale ID is required.',
            400
        );
    }

    $service = new SalesService($db);

    $service->cancelSale(
        $id,
        (int) $user['id']
    );

    $sale = (new Sale($db))->find($id);

    sendSuccess(
        $sale,
        'Sale cancelled successfully.'
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
