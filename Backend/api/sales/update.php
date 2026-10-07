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

    $items = $input['items'] ?? null;

    if ($items !== null && !is_array($items)) {
        sendError(
            'Items must be an array.',
            422
        );
    }

    $data = [
        'customer_id' => array_key_exists(
            'customer_id',
            $input
        )
            ? (
                $input['customer_id'] === ''
                    ? null
                    : (int) $input['customer_id']
            )
            : null,

        'sale_date' => $input['sale_date'] ?? null,
        'payment_method' => $input['payment_method'] ?? null,
        'payment_status' => $input['payment_status'] ?? null,
        'tax_amount' => $input['tax_amount'] ?? null,
        'discount_amount' => $input['discount_amount'] ?? null,
        'notes' => $input['notes'] ?? null,
        'updated_by' => (int) $user['id']
    ];

    $data = array_filter(
        $data,
        static fn ($value) => $value !== null
    );

    $service = new SalesService($db);

    $service->updateSale(
        $id,
        $data,
        $items
    );

    $sale = (new Sale($db))->find($id);

    sendSuccess(
        $sale,
        'Sale updated successfully.'
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
