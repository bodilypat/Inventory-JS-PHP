<?php

declare(strict_types=1);

/**
 * Inventory Management System
 *
 * GET /api/purchases/list.php
 *
 * Returns a paginated list of purchases.
 *
 * Supported query parameters:
 *
 * ?page=1
 * ?per_page=20
 * ?search=PO-0001
 * ?supplier_id=5
 * ?status=pending
 * ?date_from=2026-01-01
 * ?date_to=2026-12-31
 * ?sort=newest
 *
 * Example:
 *
 * /api/purchases/list.php?page=1&per_page=20&status=pending
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/pagination.php';
require_once __DIR__ . '/../../services/PurchaseService.php';


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

if (function_exists('handleCors')) {
    handleCors();
}


/*
|--------------------------------------------------------------------------
| HTTP Method
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {

    if (function_exists('respondError')) {
        respondError(
            'Method not allowed.',
            405
        );
    }

    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

try {

    /*
     * Supports projects where auth middleware returns
     * the authenticated user.
     */
    $user = requireAuth();

} catch (Throwable $e) {

    if (function_exists('respondError')) {
        respondError(
            'Authentication required.',
            401
        );
    }

    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' => 'Authentication required.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Database
|--------------------------------------------------------------------------
*/

try {

    /*
     * database.php should expose the PDO connection as
     * $db or $pdo.
     */
    if (isset($pdo) && $pdo instanceof PDO) {
        $database = $pdo;
    } elseif (isset($db) && $db instanceof PDO) {
        $database = $db;
    } elseif (function_exists('getDatabase')) {
        $database = getDatabase();
    } elseif (function_exists('getPDO')) {
        $database = getPDO();
    } else {
        throw new RuntimeException(
            'Database connection is not available.'
        );
    }

} catch (Throwable $e) {

    error_log(
        'Purchase list database error: ' .
        $e->getMessage()
    );

    if (function_exists('respondError')) {
        respondError(
            'Unable to connect to the database.',
            500
        );
    }

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to connect to the database.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Read Query Parameters
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


$page = $page !== false && $page !== null
    ? $page
    : 1;

$perPage = $perPage !== false && $perPage !== null
    ? $perPage
    : 20;


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

    exit;
}


if ($perPage < 1 || $perPage > 100) {

    respondError(
        'per_page must be between 1 and 100.',
        422
    );

    exit;
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
        'Search query cannot exceed 150 characters.',
        422
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Supplier Filter
|--------------------------------------------------------------------------
*/

$supplierId = null;

if (
    isset($_GET['supplier_id']) &&
    $_GET['supplier_id'] !== ''
) {

    $supplierId = filter_var(
        $_GET['supplier_id'],
        FILTER_VALIDATE_INT
    );

    if (
        $supplierId === false ||
        $supplierId < 1
    ) {

        respondError(
            'Invalid supplier_id.',
            422
        );

        exit;
    }
}


/*
|--------------------------------------------------------------------------
| Status Filter
|--------------------------------------------------------------------------
*/

$status = isset($_GET['status'])
    ? strtolower(trim((string) $_GET['status']))
    : '';


$allowedStatuses = [
    'pending',
    'partially_received',
    'received',
    'cancelled'
];


if (
    $status !== '' &&
    !in_array($status, $allowedStatuses, true)
) {

    respondError(
        'Invalid purchase status.',
        422,
        [
            'allowed_statuses' => $allowedStatuses
        ]
    );

    exit;
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


if (
    $dateFrom !== '' &&
    !isValidDate($dateFrom)
) {

    respondError(
        'Invalid date_from. Expected YYYY-MM-DD.',
        422
    );

    exit;
}


if (
    $dateTo !== '' &&
    !isValidDate($dateTo)
) {

    respondError(
        'Invalid date_to. Expected YYYY-MM-DD.',
        422
    );

    exit;
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

    exit;
}


/*
|--------------------------------------------------------------------------
| Sorting
|--------------------------------------------------------------------------
*/

$sort = isset($_GET['sort'])
    ? strtolower(trim((string) $_GET['sort']))
    : 'newest';


$allowedSorts = [
    'newest',
    'oldest',
    'total_asc',
    'total_desc',
    'supplier_asc',
    'supplier_desc'
];


if (!in_array($sort, $allowedSorts, true)) {

    respondError(
        'Invalid sort option.',
        422,
        [
            'allowed_sorts' => $allowedSorts
        ]
    );

    exit;
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

    'supplier_id' => $supplierId,

    'status' => $status,

    'date_from' => $dateFrom,

    'date_to' => $dateTo,

    'sort' => $sort
];


/*
|--------------------------------------------------------------------------
| Get Purchases
|--------------------------------------------------------------------------
*/

try {

    $purchaseService = new PurchaseService(
        $database
    );


    $result = $purchaseService->list(
        $filters
    );


    /*
     * PurchaseService may return either:
     *
     * [
     *     'items' => [],
     *     'pagination' => []
     * ]
     *
     * or a raw array of purchases.
     */
    if (
        is_array($result) &&
        isset($result['items'])
    ) {

        $items = $result['items'];

        $pagination = $result['pagination'] ?? null;

    } else {

        $items = is_array($result)
            ? $result
            : [];

        $pagination = null;
    }


    /*
     |--------------------------------------------------------------------------
     | Build Pagination When Service Does Not
     |--------------------------------------------------------------------------
     */

    if ($pagination === null) {

        $total = count($items);

        $totalPages = $total > 0
            ? (int) ceil($total / $perPage)
            : 1;


        $pagination = [
            'current_page' => $page,

            'per_page' => $perPage,

            'total' => $total,

            'total_pages' => $totalPages,

            'has_previous' => $page > 1,

            'has_next' =>
                $page < $totalPages
        ];
    }


    /*
     |--------------------------------------------------------------------------
     | Success Response
     |--------------------------------------------------------------------------
     */

    respondSuccess(
        'Purchases retrieved successfully.',
        [
            'items' => $items,

            'pagination' => $pagination,

            'filters' => [
                'search' => $search,

                'supplier_id' => $supplierId,

                'status' => $status,

                'date_from' => $dateFrom,

                'date_to' => $dateTo,

                'sort' => $sort
            ]
        ]
    );

} catch (InvalidArgumentException $e) {

    respondError(
        $e->getMessage(),
        422
    );

} catch (Throwable $e) {

    error_log(
        'Purchase list error: ' .
        $e->getMessage()
    );


    respondError(
        'Unable to retrieve purchases.',
        500
    );
}


/*
|--------------------------------------------------------------------------
| Date Validation Helper
|--------------------------------------------------------------------------
*/

function isValidDate(string $date): bool
{
    $parsed = DateTime::createFromFormat(
        'Y-m-d',
        $date
    );


    return $parsed !== false &&
        $parsed->format('Y-m-d') === $date;
}
