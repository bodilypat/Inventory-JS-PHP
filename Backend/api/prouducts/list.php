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

    $page = max(
        1,
        (int) ($_GET['page'] ?? 1)
    );

    $perPage = (int) ($_GET['per_page'] ?? 10);

    $perPage = max(1, min($perPage, 100));

    $filters = [
        'search' => trim((string) ($_GET['search'] ?? '')),
        'category_id' => $_GET['category_id'] !== ''
            ? (int) ($_GET['category_id'] ?? 0)
            : null,
        'status' => trim((string) ($_GET['status'] ?? '')),
        'sort' => trim((string) ($_GET['sort'] ?? 'name_asc')),
        'per_page' => $perPage,
        'offset' => ($page - 1) * $perPage,
    ];

    $db = Database::connection();

    $service = new ProductService(
        new Product($db)
    );

    $result = $service->list($filters);

    $totalPages = $result['total'] > 0
        ? (int) ceil($result['total'] / $perPage)
        : 1;

    successResponse([
        'items' => $result['items'],
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => $totalPages,
        ],
    ], 'Products loaded successfully.');

} catch (Throwable $e) {
    errorResponse(
        $e instanceof RuntimeException
            ? $e->getMessage()
            : 'Unable to load products.',
        500
    );
}
