<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../services/ReportService.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $user = requireAuth();

    $categoryId = isset($_GET['category_id'])
        ? (int) $_GET['category_id']
        : null;

    $status = $_GET['status'] ?? null;

    $db = Database::getConnection();

    $service = new ReportService($db);

    $report = $service->getInventoryReport(
        $categoryId,
        $status
    );

    jsonResponse([
        'success' => true,
        'data' => $report
    ]);
} catch (Throwable $e) {
    error_log($e->getMessage());

    jsonResponse([
        'success' => false,
        'message' => 'Unable to generate inventory report.'
    ], 500);
}
