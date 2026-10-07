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

    $page = max(
        1,
        (int) ($_GET['page'] ?? 1)
    );

    $perPage = min(
        100,
        max(1, (int) ($_GET['per_page'] ?? 10))
    );

    $search = isset($_GET['search'])
        ? trim((string) $_GET['search'])
        : null;

    $status = isset($_GET['status'])
        ? trim((string) $_GET['status'])
        : null;

    $customerId = isset($_GET['customer_id'])
        && $_GET['customer_id'] !== ''
        ? (int) $_GET['customer_id']
        : null;

    $dateFrom = isset($_GET['date_from'])
        ? trim((string) $_GET['date_from'])
        : null;

    $dateTo = isset($_GET['date_to'])
        ? trim((string) $_GET['date_to'])
        : null;

    $saleModel = new Sale($db);

    $result = $saleModel->getAll(
        $page,
        $perPage,
        $search,
        $status,
        $customerId,
        $dateFrom,
        $dateTo
    );

    sendSuccess(
        $result,
        'Sales retrieved successfully.'
    );
} catch (Throwable $e) {
    sendError(
        $e->getMessage(),
        500
    );
}
