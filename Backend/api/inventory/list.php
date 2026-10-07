<?php

declare(strict_types=1);

/**
 * Inventory Management System
 *
 * GET /api/inventory/list.php
 *
 * Query parameters:
 * ?page=1
 * &per_page=10
 * &search=keyboard
 * &category_id=2
 * &status=in_stock
 * &active=1
 * &sort=name_asc
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/constants.php';

require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../middleware/error.php';

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/pagination.php';

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
|
| auth.php should validate the current authentication token/session.
|
*/

$user = requireAuth();


/*
|--------------------------------------------------------------------------
| Query Parameters
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

$categoryId = filter_input(
    INPUT_GET,
    'category_id',
    FILTER_VALIDATE_INT
);

$active = filter_input(
    INPUT_GET,
    'active',
    FILTER_VALIDATE_INT
);

$search = isset($_GET['search'])
    ? trim((string) $_GET['search'])
    : '';

$status = isset($_GET['status'])
    ? trim((string) $_GET['status'])
    : '';

$sort = isset($_GET['sort'])
    ? trim((string) $_GET['sort'])
    : 'name_asc';


/*
|--------------------------------------------------------------------------
| Defaults
|--------------------------------------------------------------------------
*/

$page = $page !== false && $page !== null
    ? $page
    : 1;

$perPage = $perPage !== false && $perPage !== null
    ? $perPage
    : 10;


/*
|--------------------------------------------------------------------------
| Validate Pagination
|--------------------------------------------------------------------------
*/

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
| Validate Category
|--------------------------------------------------------------------------
*/

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
| Validate Active Filter
|--------------------------------------------------------------------------
*/

if (
    $active !== false &&
    $active !== null &&
    !in_array($active, [0, 1], true)
) {
    respondError(
        'active must be either 0 or 1.',
        422
    );
}


/*
|--------------------------------------------------------------------------
| Validate Status
|--------------------------------------------------------------------------
*/

$allowedStatuses = [
    '',
    'in_stock',
    'out_of_stock',
    'low_stock',
    'over_stock'
];

if (!in_array($status, $allowedStatuses, true)) {
    respondError(
        'Invalid inventory status.',
        422,
        [
            'allowed_statuses' => [
                'in_stock',
                'out_of_stock',
                'low_stock',
                'over_stock'
            ]
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Validate Sort
|--------------------------------------------------------------------------
*/

$allowedSorts = [
    'name_asc',
    'name_desc',
    'stock_asc',
    'stock_desc',
    'category_asc',
    'category_desc',
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
    'status' => $status,
    'active' => $active,
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

    $result = $inventoryModel->list($filters);


    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    respondSuccess(
        'Inventory retrieved successfully.',
        [
            'items' => $result['items'],
            'pagination' => $result['pagination']
        ]
    );

} catch (PDOException $e) {

    error_log(
        'Inventory list database error: ' .
        $e->getMessage()
    );

    respondError(
        'Unable to retrieve inventory.',
        500
    );

} catch (Throwable $e) {

    error_log(
        'Inventory list error: ' .
        $e->getMessage()
    );

    respondError(
        'An unexpected error occurred.',
        500
    );
}

