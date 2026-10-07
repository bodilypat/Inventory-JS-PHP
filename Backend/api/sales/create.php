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

    $customerId = isset($input['customer_id'])
        && $input['customer_id'] !== ''
        ? (int) $input['customer_id']
        : null;

    $items = $input['items'] ?? [];

    if (!is_array($items) || count($items) === 0) {
        sendError(
            'At least one sale item is required.',
            422
        );
    }

    $data = [
        'customer_id' => $customerId,
        'sale_date' => $input['sale_date']
            ?? date('Y-m-d'),
        'status' => $input['status']
            ?? 'completed',
        'payment_method' => $input['payment_method']
            ?? null,
        'payment_status' => $input['payment_status']
            ?? 'paid',
        'tax_amount' => $input['tax_amount']
            ?? 0,
        'discount_amount' => $input['discount_amount']
            ?? 0,
        'notes' => $input['notes']
            ?? null,
        'created_by' => (int) $user['id']
    ];

    $service = new SalesService($db);

    $saleId = $service->createSale(
        $data,
        $items
    );

    $sale = (new Sale($db))->find($saleId);

    sendSuccess(
        $sale,
        'Sale created successfully.',
        201
    );
} catch (InvalidArgumentException $e) {
    sendError(
        $e->getMessage(),
        422
    );
} catch (Throwable $e) {
    sendError(
        $e->getMessage(),
        500
    );
}
