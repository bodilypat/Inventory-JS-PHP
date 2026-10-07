<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../services/ReportService.php';

try {
    $user = requireAuth();

    $type = $_GET['type'] ?? 'sales';

    $dateFrom = $_GET['date_from'] ?? date('Y-m-01');
    $dateTo   = $_GET['date_to'] ?? date('Y-m-d');

    $allowedTypes = [
        'sales',
        'purchases',
        'inventory',
        'profit',
        'low_stock'
    ];

    if (!in_array($type, $allowedTypes, true)) {
        http_response_code(422);
        header('Content-Type: application/json');

        echo json_encode([
            'success' => false,
            'message' => 'Invalid report type.'
        ]);

        exit;
    }

    $db = Database::getConnection();

    $service = new ReportService($db);

    switch ($type) {
        case 'sales':
            $data = $service->getSalesReport(
                $dateFrom,
                $dateTo
            );
            break;

        case 'purchases':
            $data = $service->getPurchaseReport(
                $dateFrom,
                $dateTo
            );
            break;

        case 'inventory':
            $data = $service->getInventoryReport();
            break;

        case 'profit':
            $data = $service->getProfitReport(
                $dateFrom,
                $dateTo
            );
            break;

        case 'low_stock':
            $data = $service->getLowStockReport();
            break;

        default:
            $data = [];
    }

    /*
     * ReportService may return either:
     *
     * [
     *     'summary' => [...],
     *     'rows' => [...]
     * ]
     *
     * or a simple indexed array.
     */
    $rows = $data['rows'] ?? $data;

    if (!is_array($rows)) {
        $rows = [];
    }

    $filename = 'inventory_' .
        $type . '_' .
        date('Y-m-d_H-i-s') .
        '.csv';

    header('Content-Type: text/csv; charset=utf-8');
    header(
        'Content-Disposition: attachment; filename="' .
        $filename .
        '"'
    );
    header('Pragma: no-cache');
    header('Expires: 0');

    $output = fopen('php://output', 'w');

    if (!$output) {
        throw new RuntimeException(
            'Unable to create export stream.'
        );
    }

    /*
     * Add UTF-8 BOM for Excel compatibility.
     */
    fwrite($output, "\xEF\xBB\xBF");

    if (!empty($rows)) {
        $firstRow = reset($rows);

        if (is_array($firstRow)) {
            fputcsv(
                $output,
                array_keys($firstRow)
            );

            foreach ($rows as $row) {
                if (is_array($row)) {
                    fputcsv(
                        $output,
                        $row
                    );
                }
            }
        }
    } else {
        fputcsv($output, [
            'No data available'
        ]);
    }

    fclose($output);
    exit;
} catch (Throwable $e) {
    error_log($e->getMessage());

    /*
     * If CSV headers have already been sent, don't attempt
     * to return JSON because the response is already committed.
     */
    if (!headers_sent()) {
        http_response_code(500);

        header(
            'Content-Type: application/json; charset=utf-8'
        );

        echo json_encode([
            'success' => false,
            'message' => 'Unable to export report.'
        ]);
    }
}
