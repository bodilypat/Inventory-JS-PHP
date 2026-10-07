<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/helpers/response.php';
require_once dirname(__DIR__, 2) . '/helpers/auth.php';
require_once dirname(__DIR__, 2) . '/models/Product.php';
require_once dirname(__DIR__, 2) . '/services/ProductService.php';
require_once dirname(__DIR__, 2) . '/middleware/cors.php';

try {
    requireAuthentication();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed.', 405);
    }

    $input = json_decode(
        file_get_contents('php://input'),
        true
    );

    $id = (int) ($input['id'] ?? 0);

    if ($id <= 0) {
        errorResponse('Invalid product ID.', 422);
    }

    $service = new ProductService(
        new Product(Database::connection())
    );

    $service->delete($id);

    successResponse(
        null,
        'Product deactivated successfully.'
    );

} catch (RuntimeException $e) {
    errorResponse($e->getMessage(), 404);

} catch (Throwable $e) {
    errorResponse(
        'Unable to deactivate product.',
        500
    );
}
