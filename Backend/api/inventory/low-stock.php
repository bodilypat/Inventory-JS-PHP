<?php

declare(strict_types=1);

/**
 * Inventory Management System
 *
 * GET /api/inventory/low-stock.php
 *
 * Query parameters:
 *
 * ?page=1
 * &per_page=20
 * &search=keyboard
 * &category_id=2
 * &sort=stock_asc
 *
 * Returns products where:
 *
 *     current_stock <= minimum_stock
 *
 * Products with zero stock are included because they also
 * require replenishment.
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/constants.php';

require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../middleware/error.php';

require_once __DIR__ . '/../../helpers/response.php';

require_once __DIR__ . '/../../models/Inventory.php';


/*
|--------------------------------------------------------------------------
| HTTP Method
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respondError(
        'Method not allowed.',
        405
    );
}


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

$user = requireAuth();


/*
|--------------------------------------------------------------------------
| Pagination
|--------------------------------------------------------------------------
*/

$page = filter_input(
    INPUT_GET,
    'page',
    FILTER_VALIDATE_INT
);

$perPage = filter_input(
    INPUT_GET,
    'per_page',
    FILTER_VALIDATE_INT
);


$page = (
    $page !== false &&
    $page !== null
)
    ? $page
    : 1;


$perPage = (
    $perPage !== false &&
    $perPage !== null
)
    ? $perPage
    : 20;


if ($page < 1) {
    respondError(
        'Page must be greater than or equal to 1.',
        422
    );
}


if ($perPage < 1 || $perPage > 100) {
    respondError(
        'per_page must be between 1 and 100.',
        422
    );
}


/*
|--------------------------------------------------------------------------
| Search
|--------------------------------------------------------------------------
*/

$search = isset($_GET['search'])
    ? trim((string) $_GET['search'])
    : '';


if (strlen($search) > 150) {
    respondError(
        'Search term is too long.',
        422
    );
}


/*
|--------------------------------------------------------------------------
| Category Filter
|--------------------------------------------------------------------------
*/

$categoryId = filter_input(
    INPUT_GET,
    'category_id',
    FILTER_VALIDATE_INT
);


if (
    $categoryId !== false &&
    $categoryId !== null &&
    $categoryId < 1
) {
    respondError(
        'Invalid category_id.',
        422
    );
}


/*
|--------------------------------------------------------------------------
| Sorting
|--------------------------------------------------------------------------
*/

$sort = isset($_GET['sort'])
    ? trim((string) $_GET['sort'])
    : 'stock_asc';


$allowedSorts = [
    'stock_asc',
    'stock_desc',
    'name_asc',
    'name_desc',
    'shortage_desc',
    'shortage_asc',
    'updated_desc',
    'updated_asc'
];


if (!in_array($sort, $allowedSorts, true)) {
    respondError(
        'Invalid sort option.',
        422,
        [
            'allowed_sorts' => $allowedSorts
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Build Filters
|--------------------------------------------------------------------------
*/

$filters = [
    'page' => $page,
    'per_page' => $perPage,
    'search' => $search,
    'category_id' => $categoryId,
    'sort' => $sort
];


/*
|--------------------------------------------------------------------------
| Database
|--------------------------------------------------------------------------
*/

try {

    $database = new Database();

    $db = $database->getConnection();

    $inventoryModel = new Inventory($db);


    /*
    |--------------------------------------------------------------------------
    | Get Low Stock Products
    |--------------------------------------------------------------------------
    */

    $result = $inventoryModel->getLowStock(
        $filters
    );


    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    respondSuccess(
        'Low-stock products retrieved successfully.',
        [
            'items' =>
                $result['items'] ?? [],

            'pagination' =>
                $result['pagination'] ?? [
                    'page' => $page,
                    'per_page' => $perPage,
                    'total' => 0,
                    'total_pages' => 0
                ]
        ]
    );

} catch (PDOException $e) {

    error_log(
        'Low-stock database error: ' .
        $e->getMessage()
    );

    respondError(
        'Unable to retrieve low-stock products.',
        500
    );

} catch (Throwable $e) {

    error_log(
        'Low-stock error: ' .
        $e->getMessage()
    );

    respondError(
        'An unexpected error occurred.',
        500
    );
}
