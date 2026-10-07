<?php

declare(strict_types=1);

/**
 * Inventory Management System
 *
 * GET /api/inventory/movements.php
 *
 * Query parameters:
 *
 * ?page=1
 * &per_page=20
 * &product_id=12
 * &type=stock_out
 * &search=keyboard
 * &date_from=2026-10-01
 * &date_to=2026-10-07
 * &sort=newest
 *
 * Allowed movement types:
 * - stock_in
 * - stock_out
 * - adjustment
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/constants.php';

require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../middleware/error.php';

require_once __DIR__ . '/../../helpers/response.php';

require_once __DIR__ . '/../../models/InventoryMovement.php';


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
| Product Filter
|--------------------------------------------------------------------------
*/

$productId = filter_input(
    INPUT_GET,
    'product_id',
    FILTER_VALIDATE_INT
);

if (
    $productId !== false &&
    $productId !== null &&
    $productId < 1
) {
    respondError(
        'Invalid product_id.',
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
| Movement Type
|--------------------------------------------------------------------------
*/

$type = isset($_GET['type'])
    ? trim((string) $_GET['type'])
    : '';


$allowedTypes = [
    '',
    'stock_in',
    'stock_out',
    'adjustment'
];


if (!in_array($type, $allowedTypes, true)) {
    respondError(
        'Invalid movement type.',
        422,
        [
            'allowed_types' => [
                'stock_in',
                'stock_out',
                'adjustment'
            ]
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Date Filters
|--------------------------------------------------------------------------
*/

$dateFrom = isset($_GET['date_from'])
    ? trim((string) $_GET['date_from'])
    : '';

$dateTo = isset($_GET['date_to'])
    ? trim((string) $_GET['date_to'])
    : '';


/*
|--------------------------------------------------------------------------
| Validate Dates
|--------------------------------------------------------------------------
*/

function validateDate(
    string $date
): bool {
    if ($date === '') {
        return true;
    }

    $parsed = DateTime::createFromFormat(
        'Y-m-d',
        $date
    );

    return $parsed !== false &&
        $parsed->format('Y-m-d') === $date;
}


if (!validateDate($dateFrom)) {
    respondError(
        'Invalid date_from. Expected format: YYYY-MM-DD.',
        422
    );
}


if (!validateDate($dateTo)) {
    respondError(
        'Invalid date_to. Expected format: YYYY-MM-DD.',
        422
    );
}


if (
    $dateFrom !== '' &&
    $dateTo !== '' &&
    $dateFrom > $dateTo
) {
    respondError(
        'date_from cannot be later than date_to.',
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
    : 'newest';


$allowedSorts = [
    'newest',
    'oldest',
    'quantity_high',
    'quantity_low',
    'product_asc',
    'product_desc'
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
    'product_id' => $productId,
    'search' => $search,
    'type' => $type,
    'date_from' => $dateFrom,
    'date_to' => $dateTo,
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

    $movementModel = new InventoryMovement($db);

    $result = $movementModel->list(
        $filters
    );


    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    respondSuccess(
        'Inventory movements retrieved successfully.',
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
        'Inventory movements database error: ' .
        $e->getMessage()
    );

    respondError(
        'Unable to retrieve inventory movements.',
        500
    );

} catch (Throwable $e) {

    error_log(
        'Inventory movements error: ' .
        $e->getMessage()
    );

    respondError(
        'An unexpected error occurred.',
        500
    );
}
