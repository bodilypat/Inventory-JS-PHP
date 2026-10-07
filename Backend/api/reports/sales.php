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

    $dateFrom = $_GET['date_from'] ?? date('Y-m-01');
    $dateTo   = $_GET['date_to'] ?? date('Y-m-d');

    if ($dateFrom > $dateTo) {
        jsonResponse([
            'success' => false,
            'message' => 'Invalid date range.'
        ], 422);
    }

    $db = Database::getConnection();

    $service = new ReportService($db);

    $report = $service->getSalesReport(
        $dateFrom,
        $dateTo
    );

    jsonResponse([
        'success' => true,
        'data' => $report
    ]);
} catch (Throwable $e) {
    error_log($e->getMessage());

    jsonResponse([
        'success' => false,
        'message' => 'Unable to generate sales report.'
    ], 500);
}
