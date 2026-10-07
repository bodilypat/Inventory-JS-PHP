<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../models/Sale.php';

try {
    $db = Database::getConnection();

    requireAuth();

    $id = isset($_GET['id'])
        ? (int) $_GET['id']
        : 0;

    if ($id <= 0) {
        sendError(
            'A valid sale ID is required.',
            400
        );
    }

    $saleModel = new Sale($db);

    $sale = $saleModel->find($id);

    if (!$sale) {
        sendError(
            'Sale not found.',
            404
        );
    }

    sendSuccess(
        $sale,
        'Sale retrieved successfully.'
    );
} catch (Throwable $e) {
    sendError(
        $e->getMessage(),
        500
    );
}
