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

    $db = Database::getConnection();

    $service = new ReportService($db);

    $report = $service->getLowStockReport();

    jsonResponse([
        'success' => true,
        'data' => $report
    ]);
} catch (Throwable $e) {
    error_log($e->getMessage());

    jsonResponse([
        'success' => false,
        'message' => 'Unable to generate low-stock report.'
    ], 500);
}
