<?php

declare(strict_types=1);

class ReportService
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Generate sales report.
     *
     * Returns:
     * - summary
     * - daily sales
     * - top products
     * - payment methods
     * - sales rows
     */
    public function getSalesReport(
        string $dateFrom,
        string $dateTo
    ): array {
        $this->validateDateRange($dateFrom, $dateTo);

        /*
         * Summary
         */
        $summarySql = "
            SELECT
                COUNT(*) AS total_transactions,

                COALESCE(
                    SUM(subtotal),
                    0
                ) AS subtotal,

                COALESCE(
                    SUM(discount_amount),
                    0
                ) AS discount_amount,

                COALESCE(
                    SUM(tax_amount),
                    0
                ) AS tax_amount,

                COALESCE(
                    SUM(total_amount),
                    0
                ) AS total_sales

            FROM sales

            WHERE DATE(sale_date)
                BETWEEN :date_from AND :date_to

              AND status NOT IN ('cancelled')
        ";

        $statement = $this->db->prepare($summarySql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        $summary = $statement->fetch(
            PDO::FETCH_ASSOC
        ) ?: [];

        /*
         * Quantity sold.
         */
        $quantitySql = "
            SELECT
                COALESCE(
                    SUM(si.quantity),
                    0
                ) AS quantity_sold,

                COALESCE(
                    SUM(si.returned_quantity),
                    0
                ) AS quantity_returned,

                COALESCE(
                    SUM(
                        si.quantity -
                        si.returned_quantity
                    ),
                    0
                ) AS net_quantity

            FROM sale_items si

            INNER JOIN sales s
                ON s.id = si.sale_id

            WHERE DATE(s.sale_date)
                BETWEEN :date_from AND :date_to

              AND s.status NOT IN ('cancelled')
        ";

        $statement = $this->db->prepare($quantitySql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        $quantity = $statement->fetch(
            PDO::FETCH_ASSOC
        ) ?: [];

        /*
         * Daily sales.
         */
        $dailySql = "
            SELECT
                DATE(sale_date) AS sale_date,

                COUNT(*) AS transactions,

                COALESCE(
                    SUM(total_amount),
                    0
                ) AS total_sales

            FROM sales

            WHERE DATE(sale_date)
                BETWEEN :date_from AND :date_to

              AND status NOT IN ('cancelled')

            GROUP BY DATE(sale_date)

            ORDER BY sale_date ASC
        ";

        $statement = $this->db->prepare($dailySql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        $dailySales = $statement->fetchAll(
            PDO::FETCH_ASSOC
        );

        /*
         * Top-selling products.
         */
        $productsSql = "
            SELECT
                si.product_id,

                p.name AS product_name,

                p.sku,

                SUM(si.quantity)
                    AS quantity_sold,

                SUM(si.returned_quantity)
                    AS quantity_returned,

                SUM(
                    si.quantity -
                    si.returned_quantity
                ) AS net_quantity,

                COALESCE(
                    SUM(
                        (
                            si.quantity -
                            si.returned_quantity
                        ) * si.unit_price
                    ),
                    0
                ) AS sales_amount

            FROM sale_items si

            INNER JOIN sales s
                ON s.id = si.sale_id

            INNER JOIN products p
                ON p.id = si.product_id

            WHERE DATE(s.sale_date)
                BETWEEN :date_from AND :date_to

              AND s.status NOT IN ('cancelled')

            GROUP BY
                si.product_id,
                p.name,
                p.sku

            ORDER BY
                net_quantity DESC

            LIMIT 20
        ";

        $statement = $this->db->prepare($productsSql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        $topProducts = $statement->fetchAll(
            PDO::FETCH_ASSOC
        );

        /*
         * Payment methods.
         */
        $paymentSql = "
            SELECT
                payment_method,

                COUNT(*) AS transactions,

                COALESCE(
                    SUM(total_amount),
                    0
                ) AS total_amount

            FROM sales

            WHERE DATE(sale_date)
                BETWEEN :date_from AND :date_to

              AND status NOT IN ('cancelled')

            GROUP BY payment_method

            ORDER BY total_amount DESC
        ";

        $statement = $this->db->prepare($paymentSql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        $paymentMethods = $statement->fetchAll(
            PDO::FETCH_ASSOC
        );

        /*
         * Detailed sales rows.
         */
        $rowsSql = "
            SELECT
                s.id,

                s.invoice_number,

                s.sale_date,

                s.customer_id,

                COALESCE(
                    c.name,
                    'Walk-in Customer'
                ) AS customer_name,

                s.payment_method,

                s.status,

                s.subtotal,

                s.discount_amount,

                s.tax_amount,

                s.total_amount,

                s.created_at

            FROM sales s

            LEFT JOIN customers c
                ON c.id = s.customer_id

            WHERE DATE(s.sale_date)
                BETWEEN :date_from AND :date_to

            ORDER BY
                s.sale_date DESC,
                s.id DESC
        ";

        $statement = $this->db->prepare($rowsSql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        $rows = $statement->fetchAll(
            PDO::FETCH_ASSOC
        );

        return [
            'period' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],

            'summary' => [
                'total_transactions' =>
                    (int) ($summary['total_transactions'] ?? 0),

                'quantity_sold' =>
                    (int) ($quantity['quantity_sold'] ?? 0),

                'quantity_returned' =>
                    (int) ($quantity['quantity_returned'] ?? 0),

                'net_quantity' =>
                    (int) ($quantity['net_quantity'] ?? 0),

                'subtotal' =>
                    (float) ($summary['subtotal'] ?? 0),

                'discount_amount' =>
                    (float) ($summary['discount_amount'] ?? 0),

                'tax_amount' =>
                    (float) ($summary['tax_amount'] ?? 0),

                'total_sales' =>
                    (float) ($summary['total_sales'] ?? 0),
            ],

            'daily_sales' => $dailySales,

            'top_products' => $topProducts,

            'payment_methods' => $paymentMethods,

            'rows' => $rows,
        ];
    }

    /**
     * Generate purchase report.
     */
    public function getPurchaseReport(
        string $dateFrom,
        string $dateTo
    ): array {
        $this->validateDateRange($dateFrom, $dateTo);

        $summarySql = "
            SELECT
                COUNT(*) AS total_transactions,

                COALESCE(
                    SUM(subtotal),
                    0
                ) AS subtotal,

                COALESCE(
                    SUM(tax_amount),
                    0
                ) AS tax_amount,

                COALESCE(
                    SUM(total_amount),
                    0
                ) AS total_purchases

            FROM purchases

            WHERE DATE(purchase_date)
                BETWEEN :date_from AND :date_to

              AND status NOT IN ('cancelled')
        ";

        $statement = $this->db->prepare($summarySql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        $summary = $statement->fetch(
            PDO::FETCH_ASSOC
        ) ?: [];

        /*
         * Purchase quantity.
         */
        $quantitySql = "
            SELECT
                COALESCE(
                    SUM(pi.quantity),
                    0
                ) AS quantity_purchased

            FROM purchase_items pi

            INNER JOIN purchases p
                ON p.id = pi.purchase_id

            WHERE DATE(p.purchase_date)
                BETWEEN :date_from AND :date_to

              AND p.status NOT IN ('cancelled')
        ";

        $statement = $this->db->prepare($quantitySql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        $quantity = $statement->fetch(
            PDO::FETCH_ASSOC
        ) ?: [];

        /*
         * Supplier totals.
         */
        $supplierSql = "
            SELECT
                p.supplier_id,

                COALESCE(
                    s.name,
                    'Unknown Supplier'
                ) AS supplier_name,

                COUNT(p.id) AS transactions,

                COALESCE(
                    SUM(p.total_amount),
                    0
                ) AS total_amount

            FROM purchases p

            LEFT JOIN suppliers s
                ON s.id = p.supplier_id

            WHERE DATE(p.purchase_date)
                BETWEEN :date_from AND :date_to

              AND p.status NOT IN ('cancelled')

            GROUP BY
                p.supplier_id,
                s.name

            ORDER BY
                total_amount DESC
        ";

        $statement = $this->db->prepare($supplierSql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        $supplierTotals = $statement->fetchAll(
            PDO::FETCH_ASSOC
        );

        /*
         * Purchase rows.
         */
        $rowsSql = "
            SELECT
                p.id,

                p.purchase_number,

                p.purchase_date,

                p.supplier_id,

                COALESCE(
                    s.name,
                    'Unknown Supplier'
                ) AS supplier_name,

                p.status,

                p.subtotal,

                p.tax_amount,

                p.total_amount,

                p.created_at

            FROM purchases p

            LEFT JOIN suppliers s
                ON s.id = p.supplier_id

            WHERE DATE(p.purchase_date)
                BETWEEN :date_from AND :date_to

            ORDER BY
                p.purchase_date DESC,
                p.id DESC
        ";

        $statement = $this->db->prepare($rowsSql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        $rows = $statement->fetchAll(
            PDO::FETCH_ASSOC
        );

        return [
            'period' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],

            'summary' => [
                'total_transactions' =>
                    (int) ($summary['total_transactions'] ?? 0),

                'quantity_purchased' =>
                    (int) ($quantity['quantity_purchased'] ?? 0),

                'subtotal' =>
                    (float) ($summary['subtotal'] ?? 0),

                'tax_amount' =>
                    (float) ($summary['tax_amount'] ?? 0),

                'total_purchases' =>
                    (float) ($summary['total_purchases'] ?? 0),
            ],

            'supplier_totals' => $supplierTotals,

            'rows' => $rows,
        ];
    }

    /**
     * Generate inventory report.
     */
    public function getInventoryReport(
        ?int $categoryId = null,
        ?string $status = null
    ): array {
        $conditions = [];
        $params = [];

        if ($categoryId !== null && $categoryId > 0) {
            $conditions[] = 'p.category_id = :category_id';
            $params[':category_id'] = $categoryId;
        }

        /*
         * Status is calculated from stock levels.
         */
        switch ($status) {
            case 'active':
                $conditions[] = 'p.is_active = 1';
                break;

            case 'inactive':
                $conditions[] = 'p.is_active = 0';
                break;

            case 'in_stock':
                $conditions[] = 'i.quantity > 0';
                break;

            case 'low_stock':
                $conditions[] = '
                    i.quantity > 0
                    AND i.quantity <= p.minimum_stock
                ';
                break;

            case 'out_of_stock':
                $conditions[] = 'i.quantity <= 0';
                break;

            case null:
            case '':
                break;

            default:
                throw new InvalidArgumentException(
                    'Invalid inventory status.'
                );
        }

        $where = '';

        if (!empty($conditions)) {
            $where = 'WHERE ' .
                implode(' AND ', $conditions);
        }

        $sql = "
            SELECT
                p.id AS product_id,

                p.name AS product_name,

                p.sku,

                p.barcode,

                p.category_id,

                c.name AS category_name,

                p.cost_price,

                p.selling_price,

                p.minimum_stock,

                p.maximum_stock,

                p.unit,

                p.is_active,

                COALESCE(
                    i.quantity,
                    0
                ) AS current_stock,

                CASE
                    WHEN COALESCE(i.quantity, 0) <= 0
                        THEN 'out_of_stock'

                    WHEN COALESCE(i.quantity, 0)
                         <= p.minimum_stock
                        THEN 'low_stock'

                    ELSE 'in_stock'
                END AS stock_status,

                (
                    COALESCE(i.quantity, 0)
                    * p.cost_price
                ) AS stock_cost_value,

                (
                    COALESCE(i.quantity, 0)
                    * p.selling_price
                ) AS stock_retail_value

            FROM products p

            LEFT JOIN categories c
                ON c.id = p.category_id

            LEFT JOIN inventory i
                ON i.product_id = p.id

            {$where}

            ORDER BY
                p.name ASC
        ";

        $statement = $this->db->prepare($sql);

        $statement->execute($params);

        $rows = $statement->fetchAll(
            PDO::FETCH_ASSOC
        );

        /*
         * Calculate totals in PHP so the same filtered
         * rows can be returned to the frontend.
         */
        $summary = [
            'total_products' => 0,
            'active_products' => 0,
            'inactive_products' => 0,
            'in_stock' => 0,
            'low_stock' => 0,
            'out_of_stock' => 0,
            'total_quantity' => 0,
            'stock_cost_value' => 0.0,
            'stock_retail_value' => 0.0,
        ];

        foreach ($rows as $row) {
            $summary['total_products']++;

            if ((int) $row['is_active'] === 1) {
                $summary['active_products']++;
            } else {
                $summary['inactive_products']++;
            }

            $stockStatus = $row['stock_status'];

            if ($stockStatus === 'in_stock') {
                $summary['in_stock']++;
            } elseif ($stockStatus === 'low_stock') {
                $summary['low_stock']++;
            } elseif ($stockStatus === 'out_of_stock') {
                $summary['out_of_stock']++;
            }

            $summary['total_quantity'] +=
                (int) $row['current_stock'];

            $summary['stock_cost_value'] +=
                (float) $row['stock_cost_value'];

            $summary['stock_retail_value'] +=
                (float) $row['stock_retail_value'];
        }

        return [
            'filters' => [
                'category_id' => $categoryId,
                'status' => $status,
            ],

            'summary' => $summary,

            'rows' => $rows,
        ];
    }

    /**
     * Generate profit report.
     *
     * Gross profit:
     *
     * Net quantity sold × selling price
     * minus
     * Net quantity sold × cost price
     *
     * Sales-level discount and tax are kept separately.
     */
    public function getProfitReport(
        string $dateFrom,
        string $dateTo
    ): array {
        $this->validateDateRange($dateFrom, $dateTo);

        $summarySql = "
            SELECT
                COALESCE(
                    SUM(
                        (
                            si.quantity -
                            si.returned_quantity
                        ) * si.unit_price
                    ),
                    0
                ) AS gross_revenue,

                COALESCE(
                    SUM(
                        (
                            si.quantity -
                            si.returned_quantity
                        ) * p.cost_price
                    ),
                    0
                ) AS cost_of_goods,

                COALESCE(
                    SUM(
                        si.discount_amount
                    ),
                    0
                ) AS item_discounts

            FROM sale_items si

            INNER JOIN sales s
                ON s.id = si.sale_id

            INNER JOIN products p
                ON p.id = si.product_id

            WHERE DATE(s.sale_date)
                BETWEEN :date_from AND :date_to

              AND s.status NOT IN ('cancelled')
        ";

        $statement = $this->db->prepare($summarySql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        $summary = $statement->fetch(
            PDO::FETCH_ASSOC
        ) ?: [];

        /*
         * Sales-level totals.
         */
        $salesSql = "
            SELECT
                COALESCE(
                    SUM(discount_amount),
                    0
                ) AS sales_discounts,

                COALESCE(
                    SUM(tax_amount),
                    0
                ) AS sales_tax,

                COALESCE(
                    SUM(total_amount),
                    0
                ) AS total_sales

            FROM sales

            WHERE DATE(sale_date)
                BETWEEN :date_from AND :date_to

              AND status NOT IN ('cancelled')
        ";

        $statement = $this->db->prepare($salesSql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        $salesTotals = $statement->fetch(
            PDO::FETCH_ASSOC
        ) ?: [];

        $grossRevenue =
            (float) ($summary['gross_revenue'] ?? 0);

        $costOfGoods =
            (float) ($summary['cost_of_goods'] ?? 0);

        $itemDiscounts =
            (float) ($summary['item_discounts'] ?? 0);

        $salesDiscounts =
            (float) ($salesTotals['sales_discounts'] ?? 0);

        $totalDiscounts =
            $itemDiscounts + $salesDiscounts;

        $grossProfit =
            $grossRevenue - $costOfGoods;

        $netProfit =
            $grossProfit - $totalDiscounts;

        /*
         * Profit by product.
         */
        $productsSql = "
            SELECT
                si.product_id,

                p.name AS product_name,

                p.sku,

                SUM(
                    si.quantity -
                    si.returned_quantity
                ) AS net_quantity,

                COALESCE(
                    SUM(
                        (
                            si.quantity -
                            si.returned_quantity
                        ) * si.unit_price
                    ),
                    0
                ) AS revenue,

                COALESCE(
                    SUM(
                        (
                            si.quantity -
                            si.returned_quantity
                        ) * p.cost_price
                    ),
                    0
                ) AS cost,

                COALESCE(
                    SUM(
                        (
                            si.quantity -
                            si.returned_quantity
                        ) *
                        (
                            si.unit_price -
                            p.cost_price
                        )
                    ),
                    0
                ) AS profit

            FROM sale_items si

            INNER JOIN sales s
                ON s.id = si.sale_id

            INNER JOIN products p
                ON p.id = si.product_id

            WHERE DATE(s.sale_date)
                BETWEEN :date_from AND :date_to

              AND s.status NOT IN ('cancelled')

            GROUP BY
                si.product_id,
                p.name,
                p.sku

            ORDER BY
                profit DESC
        ";

        $statement = $this->db->prepare($productsSql);

        $statement->execute([
            ':date_from' => $dateFrom,
            ':date_to' => $dateTo,
        ]);

        $productProfit = $statement->fetchAll(
            PDO::FETCH_ASSOC
        );

        return [
            'period' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],

            'summary' => [
                'gross_revenue' => $grossRevenue,

                'cost_of_goods' => $costOfGoods,

                'gross_profit' => $grossProfit,

                'item_discounts' => $itemDiscounts,

                'sales_discounts' => $salesDiscounts,

                'total_discounts' => $totalDiscounts,

                'net_profit' => $netProfit,

                'profit_margin' =>
                    $grossRevenue > 0
                        ? round(
                            ($netProfit / $grossRevenue) * 100,
                            2
                        )
                        : 0,

                'tax_collected' =>
                    (float) (
                        $salesTotals['sales_tax'] ?? 0
                    ),

                'total_sales' =>
                    (float) (
                        $salesTotals['total_sales'] ?? 0
                    ),
            ],

            'product_profit' => $productProfit,

            /*
             * Export endpoint expects rows.
             */
            'rows' => $productProfit,
        ];
    }

    /**
     * Generate low-stock report.
     */
    public function getLowStockReport(): array
    {
        $sql = "
            SELECT
                p.id AS product_id,

                p.name AS product_name,

                p.sku,

                p.barcode,

                p.category_id,

                c.name AS category_name,

                p.minimum_stock,

                p.maximum_stock,

                p.unit,

                COALESCE(
                    i.quantity,
                    0
                ) AS current_stock,

                GREATEST(
                    p.minimum_stock -
                    COALESCE(i.quantity, 0),
                    0
                ) AS shortage_quantity,

                p.cost_price,

                p.selling_price,

                CASE
                    WHEN COALESCE(i.quantity, 0) <= 0
                        THEN 'out_of_stock'

                    ELSE 'low_stock'
                END AS stock_status

            FROM products p

            LEFT JOIN categories c
                ON c.id = p.category_id

            LEFT JOIN inventory i
                ON i.product_id = p.id

            WHERE p.is_active = 1

              AND COALESCE(i.quantity, 0)
                  <= p.minimum_stock

            ORDER BY
                shortage_quantity DESC,
                p.name ASC
        ";

        $statement = $this->db->prepare($sql);

        $statement->execute();

        $rows = $statement->fetchAll(
            PDO::FETCH_ASSOC
        );

        $outOfStock = 0;
        $lowStock = 0;

        foreach ($rows as $row) {
            if (
                (int) $row['current_stock'] <= 0
            ) {
                $outOfStock++;
            } else {
                $lowStock++;
            }
        }

        return [
            'summary' => [
                'total_alerts' => count($rows),

                'low_stock' => $lowStock,

                'out_of_stock' => $outOfStock,
            ],

            'rows' => $rows,
        ];
    }

    /**
     * Validate report dates.
     */
    private function validateDateRange(
        string $dateFrom,
        string $dateTo
    ): void {
        $from = DateTime::createFromFormat(
            'Y-m-d',
            $dateFrom
        );

        $to = DateTime::createFromFormat(
            'Y-m-d',
            $dateTo
        );

        $fromValid =
            $from !== false &&
            $from->format('Y-m-d') === $dateFrom;

        $toValid =
            $to !== false &&
            $to->format('Y-m-d') === $dateTo;

        if (!$fromValid || !$toValid) {
            throw new InvalidArgumentException(
                'Dates must use YYYY-MM-DD format.'
            );
        }

        if ($dateFrom > $dateTo) {
            throw new InvalidArgumentException(
                'Start date cannot be later than end date.'
            );
        }
    }
}
