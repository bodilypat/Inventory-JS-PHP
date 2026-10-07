<?php

declare(strict_types=1);

/**
 * Users - List API
 *
 * GET /api/users/list.php
 *
 * Query parameters:
 *   page       int     Page number, default: 1
 *   per_page   int     Items per page, default: 10, max: 100
 *   search     string  Search name/email/phone
 *   role       string  Filter by role
 *   status     string  active|inactive
 *   sort       string  name_asc|name_desc|email_asc|email_desc|newest|oldest
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/constants.php';

require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../middleware/role.php';

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/pagination.php';
require_once __DIR__ . '/../../helpers/logger.php';

require_once __DIR__ . '/../../models/User.php';


/*
|--------------------------------------------------------------------------
| Request
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    responseError(
        'Method not allowed.',
        405
    );
}


/*
|--------------------------------------------------------------------------
| Authentication / Authorization
|--------------------------------------------------------------------------
|
| Only authenticated administrators should be able to manage users.
|
*/

$user = requireAuth();

requireRole(['admin']);


/*
|--------------------------------------------------------------------------
| Database
|--------------------------------------------------------------------------
*/

try {
    $db = Database::getConnection();
} catch (Throwable $e) {
    loggerError('Users list database connection failed.', [
        'error' => $e->getMessage()
    ]);

    responseError(
        'Unable to connect to the database.',
        500
    );
}


/*
|--------------------------------------------------------------------------
| Parameters
|--------------------------------------------------------------------------
*/

$page = isset($_GET['page'])
    ? max(1, (int) $_GET['page'])
    : 1;

$perPage = isset($_GET['per_page'])
    ? (int) $_GET['per_page']
    : 10;

$perPage = max(1, min($perPage, 100));

$search = isset($_GET['search'])
    ? trim((string) $_GET['search'])
    : '';

$role = isset($_GET['role'])
    ? trim((string) $_GET['role'])
    : '';

$status = isset($_GET['status'])
    ? trim((string) $_GET['status'])
    : '';

$sort = isset($_GET['sort'])
    ? trim((string) $_GET['sort'])
    : 'name_asc';


/*
|--------------------------------------------------------------------------
| Validate status
|--------------------------------------------------------------------------
*/

$allowedStatuses = [
    'active',
    'inactive'
];

if ($status !== '' && !in_array($status, $allowedStatuses, true)) {
    responseError(
        'Invalid status filter.',
        422
    );
}


/*
|--------------------------------------------------------------------------
| Validate role
|--------------------------------------------------------------------------
|
| Adjust these values if your application has additional roles.
|
*/

$allowedRoles = [
    'admin',
    'manager',
    'staff'
];

if ($role !== '' && !in_array($role, $allowedRoles, true)) {
    responseError(
        'Invalid role filter.',
        422
    );
}


/*
|--------------------------------------------------------------------------
| Sorting
|--------------------------------------------------------------------------
|
| Never put raw user input directly into ORDER BY.
|
*/

$sortMap = [
    'name_asc'   => 'u.name ASC',
    'name_desc'  => 'u.name DESC',
    'email_asc'  => 'u.email ASC',
    'email_desc' => 'u.email DESC',
    'newest'     => 'u.created_at DESC',
    'oldest'     => 'u.created_at ASC'
];

if (!isset($sortMap[$sort])) {
    $sort = 'name_asc';
}

$orderBy = $sortMap[$sort];


/*
|--------------------------------------------------------------------------
| Build WHERE clause
|--------------------------------------------------------------------------
*/

$where = [];
$params = [];


/*
|--------------------------------------------------------------------------
| Search
|--------------------------------------------------------------------------
*/

if ($search !== '') {
    $where[] = '(
        u.name LIKE :search_name
        OR u.email LIKE :search_email
        OR u.phone LIKE :search_phone
    )';

    $searchValue = '%' . $search . '%';

    $params[':search_name'] = $searchValue;
    $params[':search_email'] = $searchValue;
    $params[':search_phone'] = $searchValue;
}


/*
|--------------------------------------------------------------------------
| Role filter
|--------------------------------------------------------------------------
*/

if ($role !== '') {
    $where[] = 'u.role = :role';
    $params[':role'] = $role;
}


/*
|--------------------------------------------------------------------------
| Status filter
|--------------------------------------------------------------------------
*/

if ($status !== '') {
    $where[] = 'u.is_active = :is_active';

    $params[':is_active'] = $status === 'active'
        ? 1
        : 0;
}


/*
|--------------------------------------------------------------------------
| WHERE SQL
|--------------------------------------------------------------------------
*/

$whereSql = '';

if (!empty($where)) {
    $whereSql = 'WHERE ' . implode(' AND ', $where);
}


/*
|--------------------------------------------------------------------------
| Count records
|--------------------------------------------------------------------------
*/

try {
    $countSql = "
        SELECT COUNT(*)
        FROM users u
        $whereSql
    ";

    $countStatement = $db->prepare($countSql);

    foreach ($params as $key => $value) {
        $countStatement->bindValue(
            $key,
            $value,
            is_int($value)
                ? PDO::PARAM_INT
                : PDO::PARAM_STR
        );
    }

    $countStatement->execute();

    $total = (int) $countStatement->fetchColumn();

} catch (Throwable $e) {

    loggerError('Failed to count users.', [
        'error' => $e->getMessage(),
        'admin_id' => $user['id'] ?? null
    ]);

    responseError(
        'Unable to retrieve users.',
        500
    );
}


/*
|--------------------------------------------------------------------------
| Pagination
|--------------------------------------------------------------------------
*/

$totalPages = $total > 0
    ? (int) ceil($total / $perPage)
    : 1;

if ($page > $totalPages) {
    $page = $totalPages;
}

$offset = ($page - 1) * $perPage;


/*
|--------------------------------------------------------------------------
| Fetch users
|--------------------------------------------------------------------------
*/

try {

    $sql = "
        SELECT
            u.id,
            u.name,
            u.email,
            u.phone,
            u.role,
            u.is_active,
            u.created_at,
            u.updated_at
        FROM users u
        $whereSql
        ORDER BY $orderBy
        LIMIT :limit
        OFFSET :offset
    ";

    $statement = $db->prepare($sql);

    foreach ($params as $key => $value) {
        $statement->bindValue(
            $key,
            $value,
            is_int($value)
                ? PDO::PARAM_INT
                : PDO::PARAM_STR
        );
    }

    $statement->bindValue(
        ':limit',
        $perPage,
        PDO::PARAM_INT
    );

    $statement->bindValue(
        ':offset',
        $offset,
        PDO::PARAM_INT
    );

    $statement->execute();

    $users = $statement->fetchAll(PDO::FETCH_ASSOC);

} catch (Throwable $e) {

    loggerError('Failed to retrieve users.', [
        'error' => $e->getMessage(),
        'admin_id' => $user['id'] ?? null
    ]);

    responseError(
        'Unable to retrieve users.',
        500
    );
}


/*
|--------------------------------------------------------------------------
| Normalize response
|--------------------------------------------------------------------------
*/

$users = array_map(
    static function (array $item): array {

        return [
            'id' => (int) $item['id'],
            'name' => $item['name'],
            'email' => $item['email'],
            'phone' => $item['phone'],
            'role' => $item['role'],
            'is_active' => (bool) $item['is_active'],
            'created_at' => $item['created_at'],
            'updated_at' => $item['updated_at']
        ];

    },
    $users
);


/*
|--------------------------------------------------------------------------
| Response
|--------------------------------------------------------------------------
*/

responseSuccess(
    [
        'users' => $users,
        'pagination' => [
            'current_page' => $page,
            'per_page' => $perPage,
            'total_items' => $total,
            'total_pages' => $totalPages,
            'from' => $total > 0
                ? $offset + 1
                : 0,
            'to' => min(
                $offset + count($users),
                $total
            )
        ],
        'filters' => [
            'search' => $search,
            'role' => $role,
            'status' => $status,
            'sort' => $sort
        ]
    ],
    'Users retrieved successfully.'
);
