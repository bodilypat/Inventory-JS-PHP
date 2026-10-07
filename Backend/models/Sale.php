<?php

declare(strict_types=1);

class Sale
{
    private PDO $db;
    private string $table = 'sales';

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Get paginated sales.
     */
    public function getAll(
        int $page = 1,
        int $perPage = 10,
        ?string $search = null,
        ?string $status = null,
        ?int $customerId = null,
        ?string $dateFrom = null,
        ?string $dateTo = null
    ): array {
        $page = max(1, $page);
        $perPage = min(100, max(1, $perPage));
        $offset = ($page - 1) * $perPage;

        $where = [];
        $params = [];

        if ($search !== null && $search !== '') {
            $where[] = '(
                s.sale_number LIKE :search
                OR c.name LIKE :search
                OR c.email LIKE :search
            )';

            $params[':search'] = '%' . $search . '%';
        }

        if ($status !== null && $status !== '') {
            $where[] = 's.status = :status';
            $params[':status'] = $status;
        }

        if ($customerId !== null && $customerId > 0) {
            $where[] = 's.customer_id = :customer_id';
            $params[':customer_id'] = $customerId;
        }

        if ($dateFrom !== null && $dateFrom !== '') {
            $where[] = 'DATE(s.sale_date) >= :date_from';
            $params[':date_from'] = $dateFrom;
        }

        if ($dateTo !== null && $dateTo !== '') {
            $where[] = 'DATE(s.sale_date) <= :date_to';
            $params[':date_to'] = $dateTo;
        }

        $whereSql = '';

        if (!empty($where)) {
            $whereSql = 'WHERE ' . implode(
                ' AND ',
                $where
            );
        }

        $countSql = "
            SELECT COUNT(*)
            FROM {$this->table} s
            LEFT JOIN customers c
                ON c.id = s.customer_id
            {$whereSql}
        ";

        $countStatement = $this->db->prepare($countSql);

        foreach ($params as $key => $value) {
            $countStatement->bindValue(
                $key,
                $value
            );
        }

        $countStatement->execute();

        $total = (int) $countStatement->fetchColumn();

        $sql = "
            SELECT
                s.*,
                c.name AS customer_name,
                c.email AS customer_email,
                u.name AS created_by_name
            FROM {$this->table} s
            LEFT JOIN customers c
                ON c.id = s.customer_id
            LEFT JOIN users u
                ON u.id = s.created_by
            {$whereSql}
            ORDER BY s.id DESC
            LIMIT :limit OFFSET :offset
        ";

        $statement = $this->db->prepare($sql);

        foreach ($params as $key => $value) {
            $statement->bindValue(
                $key,
                $value
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

        $sales = $statement->fetchAll(
            PDO::FETCH_ASSOC
        );

        return [
            'data' => $sales,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => $total > 0
                    ? (int) ceil($total / $perPage)
                    : 1,
            ],
        ];
    }

    /**
     * Find a sale by ID, including its items.
     */
    public function find(int $id): ?array
    {
        if ($id <= 0) {
            return null;
        }

        $sql = "
            SELECT
                s.*,
                c.name AS customer_name,
                c.email AS customer_email,
                c.phone AS customer_phone,
                u.name AS created_by_name
            FROM {$this->table} s
            LEFT JOIN customers c
                ON c.id = s.customer_id
            LEFT JOIN users u
                ON u.id = s.created_by
            WHERE s.id = :id
            LIMIT 1
        ";

        $statement = $this->db->prepare($sql);

        $statement->execute([
            ':id' => $id,
        ]);

        $sale = $statement->fetch(
            PDO::FETCH_ASSOC
        );

        if (!$sale) {
            return null;
        }

        $itemsSql = "
            SELECT
                si.*,
                p.name AS product_name,
                p.sku,
                p.barcode
            FROM sale_items si
            INNER JOIN products p
                ON p.id = si.product_id
            WHERE si.sale_id = :sale_id
            ORDER BY si.id ASC
        ";

        $itemsStatement = $this->db->prepare(
            $itemsSql
        );

        $itemsStatement->execute([
            ':sale_id' => $id,
        ]);

        $sale['items'] = $itemsStatement->fetchAll(
            PDO::FETCH_ASSOC
        );

        return $sale;
    }

    /**
     * Create a new sale.
     */
    public function create(array $data): int|false
    {
        $saleNumber = $data['sale_number']
            ?? $this->generateSaleNumber();

        $sql = "
            INSERT INTO {$this->table} (
                sale_number,
                customer_id,
                sale_date,
                subtotal,
                tax_amount,
                discount_amount,
                total_amount,
                payment_method,
                payment_status,
                status,
                notes,
                created_by
            ) VALUES (
                :sale_number,
                :customer_id,
                :sale_date,
                :subtotal,
                :tax_amount,
                :discount_amount,
                :total_amount,
                :payment_method,
                :payment_status,
                :status,
                :notes,
                :created_by
            )
        ";

        $statement = $this->db->prepare($sql);

        $success = $statement->execute([
            ':sale_number' => $saleNumber,
            ':customer_id' => $data['customer_id'] ?? null,
            ':sale_date' => $data['sale_date']
                ?? date('Y-m-d'),
            ':subtotal' => $data['subtotal'] ?? 0,
            ':tax_amount' => $data['tax_amount'] ?? 0,
            ':discount_amount' =>
                $data['discount_amount'] ?? 0,
            ':total_amount' =>
                $data['total_amount'] ?? 0,
            ':payment_method' =>
                $data['payment_method'] ?? null,
            ':payment_status' =>
                $data['payment_status'] ?? 'paid',
            ':status' =>
                $data['status'] ?? 'completed',
            ':notes' =>
                $data['notes'] ?? null,
            ':created_by' =>
                $data['created_by'] ?? null,
        ]);

        if (!$success) {
            return false;
        }

        return (int) $this->db->lastInsertId();
    }

    /**
     * Update a sale.
     */
    public function update(
        int $id,
        array $data
    ): bool {
        if ($id <= 0 || empty($data)) {
            return false;
        }

        $allowedFields = [
            'customer_id',
            'sale_date',
            'subtotal',
            'tax_amount',
            'discount_amount',
            'total_amount',
            'payment_method',
            'payment_status',
            'status',
            'notes',
            'updated_by',
        ];

        $fields = [];
        $params = [
            ':id' => $id,
        ];

        foreach ($allowedFields as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }

            $fields[] = "{$field} = :{$field}";
            $params[":{$field}"] = $data[$field];
        }

        if (empty($fields)) {
            return false;
        }

        $sql = "
            UPDATE {$this->table}
            SET " . implode(', ', $fields) . ",
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        ";

        $statement = $this->db->prepare($sql);

        return $statement->execute($params);
    }

    /**
     * Delete a sale.
     *
     * Normally sales should be cancelled rather than deleted.
     */
    public function delete(int $id): bool
    {
        if ($id <= 0) {
            return false;
        }

        $statement = $this->db->prepare(
            "DELETE FROM {$this->table}
             WHERE id = :id"
        );

        return $statement->execute([
            ':id' => $id,
        ]);
    }

    /**
     * Check whether a sale exists.
     */
    public function exists(int $id): bool
    {
        $statement = $this->db->prepare(
            "SELECT COUNT(*)
             FROM {$this->table}
             WHERE id = :id"
        );

        $statement->execute([
            ':id' => $id,
        ]);

        return (int) $statement->fetchColumn() > 0;
    }

    /**
     * Get sales by customer.
     */
    public function getByCustomer(
        int $customerId,
        int $limit = 50
    ): array {
        $limit = min(100, max(1, $limit));

        $sql = "
            SELECT *
            FROM {$this->table}
            WHERE customer_id = :customer_id
            ORDER BY sale_date DESC, id DESC
            LIMIT :limit
        ";

        $statement = $this->db->prepare($sql);

        $statement->bindValue(
            ':customer_id',
            $customerId,
            PDO::PARAM_INT
        );

        $statement->bindValue(
            ':limit',
            $limit,
            PDO::PARAM_INT
        );

        $statement->execute();

        return $statement->fetchAll(
            PDO::FETCH_ASSOC
        );
    }

    /**
     * Get sales within a date range.
     */
    public function getByDateRange(
        string $dateFrom,
        string $dateTo
    ): array {
        $sql = "
            SELECT *
            FROM {$this->table}
            WHERE DATE(sale_date) BETWEEN
                :date_from AND :date_to
            ORDER BY sale_date DESC, id DESC
        ";

        $statement = $this->db->prepare($sql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        return $statement->fetchAll(
            PDO::FETCH_ASSOC
        );
    }

    /**
     * Get sales totals for reporting.
     */
    public function getTotals(
        ?string $dateFrom = null,
        ?string $dateTo = null
    ): array {
        $where = [];
        $params = [];

        if ($dateFrom !== null) {
            $where[] =
                'DATE(sale_date) >= :date_from';

            $params[':date_from'] = $dateFrom;
        }

        if ($dateTo !== null) {
            $where[] =
                'DATE(sale_date) <= :date_to';

            $params[':date_to'] = $dateTo;
        }

        $whereSql = empty($where)
            ? ''
            : 'WHERE ' . implode(
                ' AND ',
                $where
            );

        $sql = "
            SELECT
                COUNT(*) AS total_sales,
                COALESCE(
                    SUM(subtotal),
                    0
                ) AS subtotal,
                COALESCE(
                    SUM(tax_amount),
                    0
                ) AS tax_amount,
                COALESCE(
                    SUM(discount_amount),
                    0
                ) AS discount_amount,
                COALESCE(
                    SUM(total_amount),
                    0
                ) AS total_amount
            FROM {$this->table}
            {$whereSql}
            AND status NOT IN ('cancelled')
        ";

        /*
         * If there is no WHERE clause, the query above would
         * generate "FROM sales AND status ...". Build it safely.
         */
        if (empty($where)) {
            $sql = "
                SELECT
                    COUNT(*) AS total_sales,
                    COALESCE(
                        SUM(subtotal),
                        0
                    ) AS subtotal,
                    COALESCE(
                        SUM(tax_amount),
                        0
                    ) AS tax_amount,
                    COALESCE(
                        SUM(discount_amount),
                        0
                    ) AS discount_amount,
                    COALESCE(
                        SUM(total_amount),
                        0
                    ) AS total_amount
                FROM {$this->table}
                WHERE status NOT IN ('cancelled')
            ";
        }

        $statement = $this->db->prepare($sql);

        $statement->execute($params);

        $result = $statement->fetch(
            PDO::FETCH_ASSOC
        );

        return $result ?: [
            'total_sales' => 0,
            'subtotal' => 0,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 0,
        ];
    }

    /**
     * Generate a unique human-readable sale number.
     */
    private function generateSaleNumber(): string
    {
        $prefix = 'SAL-' . date('Ymd') . '-';

        $statement = $this->db->prepare(
            "SELECT sale_number
             FROM {$this->table}
             WHERE sale_number LIKE :prefix
             ORDER BY id DESC
             LIMIT 1"
        );

        $statement->execute([
            ':prefix' => $prefix . '%',
        ]);

        $lastNumber = $statement->fetchColumn();

        if (!$lastNumber) {
            return $prefix . '0001';
        }

        $parts = explode(
            '-',
            (string) $lastNumber
        );

        $lastSequence = (int) end($parts);

        return $prefix .
            str_pad(
                (string) ($lastSequence + 1),
                4,
                '0',
                STR_PAD_LEFT
            );
    }
}
