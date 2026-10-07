<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/helpers/response.php';
require_once dirname(__DIR__, 2) . '/helpers/auth.php';
require_once dirname(__DIR__, 2) . '/models/Product.php';
require_once dirname(__DIR__, 2) . '/services/ProductService.php';
require_once dirname(__DIR__, 2) . '/validations/ProductValidator.php';
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

    if (!is_array($input)) {
        errorResponse('Invalid JSON request body.', 400);
    }

    $data = ProductValidator::validate($input);

    $service = new ProductService(
        new Product(Database::connection())
    );

    $product = $service->create($data);

    successResponse(
        $product,
        'Product created successfully.',
        201
    );

} catch (DomainException $e) {
    errorResponse($e->getMessage(), 409);

} catch (InvalidArgumentException $e) {
    $errors = json_decode($e->getMessage(), true);

    errorResponse(
        'Validation failed.',
        422,
        is_array($errors) ? $errors : []
    );

} catch (Throwable $e) {
    errorResponse(
        'Unable to create product.',
        500
    );
}
