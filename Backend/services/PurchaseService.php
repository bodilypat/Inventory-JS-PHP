<?php

declare(strict_types=1);

/**
 * Inventory Management System
 *
 * Backend/services/PurchaseService.php
 *
 * Purchase business logic.
 *
 * Responsibilities:
 * - Create purchases
 * - Read purchases
 * - Update pending purchases
 * - Receive purchases
 * - Cancel pending purchases
 * - Calculate totals
 * - Coordinate inventory receiving
 *
 * Important:
 * - Controllers/API files validate HTTP requests.
 * - This service validates business rules.
 * - Inventory changes happen ONLY when a purchase is received.
 */

require_once __DIR__ . '/../models/Purchase.php';
require_once __DIR__ . '/../models/PurchaseItem.php';
require_once __DIR__ . '/../models/Product.php';
require_once __DIR__ . '/InventoryService.php';


class PurchaseService
{
    private PDO $db;

    private Purchase $purchaseModel;

    private PurchaseItem $purchaseItemModel;

    private Product $productModel;

    private InventoryService $inventoryService;


    public function __construct(PDO $db)
    {
        $this->db = $db;

        $this->db->setAttribute(
            PDO::ATTR_ERRMODE,
            PDO::ERRMODE_EXCEPTION
        );

        $this->purchaseModel =
            new Purchase($db);

        $this->purchaseItemModel =
            new PurchaseItem($db);

        $this->productModel =
            new Product($db);

        $this->inventoryService =
            new InventoryService($db);
    }


    /*
    |--------------------------------------------------------------------------
    | LIST
    |--------------------------------------------------------------------------
    */

    public function list(
        array $filters = []
    ): array {

        $page = max(
            1,
            (int) ($filters['page'] ?? 1)
        );

        $perPage = max(
            1,
            min(
                100,
                (int) ($filters['per_page'] ?? 20)
            )
        );

        $offset =
            ($page - 1) * $perPage;


        $where = [];

        $params = [];


        /*
         * Search
         */
        if (
            isset($filters['search']) &&
            trim((string) $filters['search']) !== ''
        ) {

            $search =
                trim((string) $filters['search']);

            $where[] = "
                (
                    p.purchase_number LIKE :search
                    OR s.name LIKE :search
                )
            ";

            $params[':search'] =
                '%' . $search . '%';
        }


        /*
         * Supplier
         */
        if (
            isset($filters['supplier_id']) &&
            (int) $filters['supplier_id'] > 0
        ) {

            $where[] =
                'p.supplier_id = :supplier_id';

            $params[':supplier_id'] =
                (int) $filters['supplier_id'];
        }


        /*
         * Status
         */
        if (
            isset($filters['status']) &&
            trim((string) $filters['status']) !== ''
        ) {

            $where[] =
                'p.status = :status';

            $params[':status'] =
                trim((string) $filters['status']);
        }


        /*
         * Date range
         */
        if (
            !empty($filters['date_from'])
        ) {

            $where[] =
                'p.purchase_date >= :date_from';

            $params[':date_from'] =
                $filters['date_from'];
        }


        if (
            !empty($filters['date_to'])
        ) {

            $where[] =
                'p.purchase_date <= :date_to';

            $params[':date_to'] =
                $filters['date_to'];
        }


        $whereSql =
            count($where) > 0
                ? 'WHERE ' . implode(
                    ' AND ',
                    $where
                )
                : '';


        /*
         * Total
         */
        $countSql = "
            SELECT COUNT(*)
            FROM purchases p
            LEFT JOIN suppliers s
                ON s.id = p.supplier_id
            {$whereSql}
        ";

        $countStmt =
            $this->db->prepare($countSql);

        foreach ($params as $key => $value) {

            $countStmt->bindValue(
                $key,
                $value
            );
        }

        $countStmt->execute();

        $total =
            (int) $countStmt->fetchColumn();


        /*
         * Sorting
         */
        $allowedSorts = [
            'date' => 'p.purchase_date',
            'total' => 'p.total',
            'status' => 'p.status',
            'number' => 'p.purchase_number'
        ];

        $sort =
            $filters['sort'] ?? 'date';

        $sortColumn =
            $allowedSorts[$sort]
            ?? $allowedSorts['date'];


        $direction =
            strtolower(
                (string) (
                    $filters['direction']
                    ?? 'desc'
                )
            );

        $direction =
            $direction === 'asc'
                ? 'ASC'
                : 'DESC';


        /*
         * Data
         */
        $sql = "
            SELECT
                p.*,
                s.name AS supplier_name
            FROM purchases p
            LEFT JOIN suppliers s
                ON s.id = p.supplier_id
            {$whereSql}
            ORDER BY {$sortColumn} {$direction}
            LIMIT :limit
            OFFSET :offset
        ";

        $stmt =
            $this->db->prepare($sql);


        foreach ($params as $key => $value) {

            $stmt->bindValue(
                $key,
                $value
            );
        }


        $stmt->bindValue(
            ':limit',
            $perPage,
            PDO::PARAM_INT
        );

        $stmt->bindValue(
            ':offset',
            $offset,
            PDO::PARAM_INT
        );


        $stmt->execute();

        $rows =
            $stmt->fetchAll(
                PDO::FETCH_ASSOC
            );


        return [
            'data' => $rows,

            'pagination' => [
                'page' => $page,

                'per_page' => $perPage,

                'total' => $total,

                'total_pages' =>
                    $total > 0
                        ? (int) ceil(
                            $total / $perPage
                        )
                        : 1
            ]
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | GET
    |--------------------------------------------------------------------------
    */

    public function get(
        int $purchaseId
    ): ?array {

        if ($purchaseId < 1) {

            throw new InvalidArgumentException(
                'Invalid purchase ID.'
            );
        }


        $sql = "
            SELECT
                p.*,
                s.name AS supplier_name
            FROM purchases p
            LEFT JOIN suppliers s
                ON s.id = p.supplier_id
            WHERE p.id = :id
            LIMIT 1
        ";

        $stmt =
            $this->db->prepare($sql);

        $stmt->execute([
            ':id' => $purchaseId
        ]);


        $purchase =
            $stmt->fetch(
                PDO::FETCH_ASSOC
            );


        if (!$purchase) {

            return null;
        }


        $itemsSql = "
            SELECT
                pi.*,
                pr.name AS product_name,
                pr.sku,
                pr.barcode
            FROM purchase_items pi
            INNER JOIN products pr
                ON pr.id = pi.product_id
            WHERE pi.purchase_id = :purchase_id
            ORDER BY pi.id ASC
        ";

        $itemsStmt =
            $this->db->prepare($itemsSql);

        $itemsStmt->execute([
            ':purchase_id' => $purchaseId
        ]);


        $purchase['items'] =
            $itemsStmt->fetchAll(
                PDO::FETCH_ASSOC
            );


        return $purchase;
    }


    /*
    |--------------------------------------------------------------------------
    | CREATE
    |--------------------------------------------------------------------------
    */

    public function create(
        array $data
    ): array {

        $supplierId =
            (int) (
                $data['supplier_id']
                ?? 0
            );


        if ($supplierId < 1) {

            throw new InvalidArgumentException(
                'A valid supplier is required.'
            );
        }


        $purchaseDate =
            $data['purchase_date']
            ?? date('Y-m-d');


        $expectedDate =
            $data['expected_date']
            ?? null;


        $items =
            $data['items']
            ?? [];


        $this->validateItems($items);


        /*
         * Verify supplier.
         */
        $supplierStmt =
            $this->db->prepare("
                SELECT id
                FROM suppliers
                WHERE id = :id
                LIMIT 1
            ");

        $supplierStmt->execute([
            ':id' => $supplierId
        ]);


        if (!$supplierStmt->fetchColumn()) {

            throw new InvalidArgumentException(
                'Supplier not found.'
            );
        }


        /*
         * Calculate totals.
         */
        $totals =
            $this->calculateTotals(
                $items,
                (float) ($data['tax'] ?? 0),
                (float) ($data['discount'] ?? 0),
                (float) ($data['shipping'] ?? 0)
            );


        try {

            $this->db->beginTransaction();


            /*
             * Generate purchase number.
             */
            $purchaseNumber =
                $this->generatePurchaseNumber();


            /*
             * Insert purchase.
             */
            $sql = "
                INSERT INTO purchases (
                    purchase_number,
                    supplier_id,
                    purchase_date,
                    expected_date,
                    subtotal,
                    tax,
                    discount,
                    shipping,
                    total,
                    status,
                    notes,
                    created_by,
                    created_at,
                    updated_at
                )
                VALUES (
                    :purchase_number,
                    :supplier_id,
                    :purchase_date,
                    :expected_date,
                    :subtotal,
                    :tax,
                    :discount,
                    :shipping,
                    :total,
                    'pending',
                    :notes,
                    :created_by,
                    NOW(),
                    NOW()
                )
            ";

            $stmt =
                $this->db->prepare($sql);

            $stmt->execute([
                ':purchase_number' =>
                    $purchaseNumber,

                ':supplier_id' =>
                    $supplierId,

                ':purchase_date' =>
                    $purchaseDate,

                ':expected_date' =>
                    $expectedDate,

                ':subtotal' =>
                    $totals['subtotal'],

                ':tax' =>
                    $totals['tax'],

                ':discount' =>
                    $totals['discount'],

                ':shipping' =>
                    $totals['shipping'],

                ':total' =>
                    $totals['total'],

                ':notes' =>
                    $data['notes'] ?? null,

                ':created_by' =>
                    $data['created_by'] ?? null
            ]);


            $purchaseId =
                (int) $this->db->lastInsertId();


            /*
             * Insert items.
             */
            $this->insertItems(
                $purchaseId,
                $items
            );


            $this->db->commit();


            $result =
                $this->get($purchaseId);


            if ($result === null) {

                throw new RuntimeException(
                    'Purchase was created but could not be loaded.'
                );
            }


            return $result;

        } catch (Throwable $e) {

            if ($this->db->inTransaction()) {

                $this->db->rollBack();
            }

            throw $e;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | UPDATE
    |--------------------------------------------------------------------------
    */

    public function update(
        int $purchaseId,
        array $data
    ): ?array {

        if ($purchaseId < 1) {

            throw new InvalidArgumentException(
                'Invalid purchase ID.'
            );
        }


        $items =
            $data['items']
            ?? [];


        $this->validateItems($items);


        try {

            $this->db->beginTransaction();


            /*
             * Lock purchase.
             */
            $purchase =
                $this->getForUpdate(
                    $purchaseId
                );


            if (!$purchase) {

                $this->db->rollBack();

                return null;
            }


            if (
                $purchase['status'] !== 'pending'
            ) {

                throw new RuntimeException(
                    'Only pending purchases can be updated.'
                );
            }


            /*
             * Supplier validation.
             */
            $supplierId =
                (int) (
                    $data['supplier_id']
                    ?? $purchase['supplier_id']
                );


            $this->assertSupplierExists(
                $supplierId
            );


            /*
             * Calculate totals server-side.
             */
            $totals =
                $this->calculateTotals(
                    $items,
                    (float) ($data['tax'] ?? 0),
                    (float) ($data['discount'] ?? 0),
                    (float) ($data['shipping'] ?? 0)
                );


            /*
             * Update header.
             */
            $sql = "
                UPDATE purchases
                SET
                    supplier_id = :supplier_id,
                    purchase_date = :purchase_date,
                    expected_date = :expected_date,
                    subtotal = :subtotal,
                    tax = :tax,
                    discount = :discount,
                    shipping = :shipping,
                    total = :total,
                    notes = :notes,
                    updated_by = :updated_by,
                    updated_at = NOW()
                WHERE id = :id
            ";

            $stmt =
                $this->db->prepare($sql);

            $stmt->execute([
                ':supplier_id' =>
                    $supplierId,

                ':purchase_date' =>
                    $data['purchase_date']
                    ?? $purchase['purchase_date'],

                ':expected_date' =>
                    $data['expected_date']
                    ?? $purchase['expected_date'],

                ':subtotal' =>
                    $totals['subtotal'],

                ':tax' =>
                    $totals['tax'],

                ':discount' =>
                    $totals['discount'],

                ':shipping' =>
                    $totals['shipping'],

                ':total' =>
                    $totals['total'],

                ':notes' =>
                    $data['notes']
                    ?? $purchase['notes'],

                ':updated_by' =>
                    $data['updated_by'] ?? null,

                ':id' =>
                    $purchaseId
            ]);


            /*
             * Replace existing items.
             */
            $deleteStmt =
                $this->db->prepare("
                    DELETE FROM purchase_items
                    WHERE purchase_id = :purchase_id
                ");

            $deleteStmt->execute([
                ':purchase_id' =>
                    $purchaseId
            ]);


            $this->insertItems(
                $purchaseId,
                $items
            );


            $this->db->commit();


            $result =
                $this->get($purchaseId);


            return $result;

        } catch (Throwable $e) {

            if ($this->db->inTransaction()) {

                $this->db->rollBack();
            }

            throw $e;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | RECEIVE
    |--------------------------------------------------------------------------
    */

    public function receive(
        int $purchaseId,
        array $data
    ): ?array {

        if ($purchaseId < 1) {

            throw new InvalidArgumentException(
                'Invalid purchase ID.'
            );
        }


        try {

            $this->db->beginTransaction();


            /*
             * Lock purchase.
             */
            $purchase =
                $this->getForUpdate(
                    $purchaseId
                );


            if (!$purchase) {

                $this->db->rollBack();

                return null;
            }


            $status =
                strtolower(
                    (string) $purchase['status']
                );


            if ($status === 'cancelled') {

                throw new RuntimeException(
                    'Cancelled purchases cannot be received.'
                );
            }


            if ($status === 'received') {

                throw new RuntimeException(
                    'This purchase has already been received.'
                );
            }


            if (
                !in_array(
                    $status,
                    [
                        'pending',
                        'partially_received'
                    ],
                    true
                )
            ) {

                throw new RuntimeException(
                    'Purchase cannot be received in its current status.'
                );
            }


            /*
             * Lock purchase items.
             */
            $items =
                $this->getItemsForUpdate(
                    $purchaseId
                );


            if (count($items) === 0) {

                throw new RuntimeException(
                    'Purchase contains no items.'
                );
            }


            /*
             * Determine requested receiving quantities.
             */
            $requestedItems =
                $data['items']
                ?? null;


            $receivedItems = [];


            if ($requestedItems === null) {

                /*
                 * Receive all outstanding quantities.
                 */
                foreach ($items as $item) {

                    $ordered =
                        (int) $item['quantity'];

                    $received =
                        (int) (
                            $item['received_quantity']
                            ?? 0
                        );

                    $remaining =
                        $ordered - $received;


                    if ($remaining > 0) {

                        $receivedItems[] = [
                            'purchase_item_id' =>
                                (int) $item['id'],

                            'product_id' =>
                                (int) $item['product_id'],

                            'quantity' =>
                                $remaining,

                            'unit_cost' =>
                                (float) $item['unit_cost']
                        ];
                    }
                }

            } else {

                /*
                 * Partial receiving.
                 */
                foreach (
                    $requestedItems
                    as $requested
                ) {

                    $itemId =
                        (int) (
                            $requested['purchase_item_id']
                            ?? 0
                        );

                    $quantity =
                        (int) (
                            $requested['quantity']
                            ?? 0
                        );


                    if (
                        $itemId < 1 ||
                        $quantity < 1
                    ) {

                        throw new InvalidArgumentException(
                            'Invalid receiving item.'
                        );
                    }


                    $matchedItem = null;


                    foreach ($items as $item) {

                        if (
                            (int) $item['id']
                            === $itemId
                        ) {

                            $matchedItem =
                                $item;

                            break;
                        }
                    }


                    if (!$matchedItem) {

                        throw new InvalidArgumentException(
                            'Purchase item not found.'
                        );
                    }


                    $ordered =
                        (int) $matchedItem['quantity'];

                    $alreadyReceived =
                        (int) (
                            $matchedItem['received_quantity']
                            ?? 0
                        );

                    $remaining =
                        $ordered - $alreadyReceived;


                    if ($quantity > $remaining) {

                        throw new InvalidArgumentException(
                            'Receiving quantity cannot exceed the remaining quantity for product ' .
                            $matchedItem['product_id'] .
                            '.'
                        );
                    }


                    $receivedItems[] = [
                        'purchase_item_id' =>
                            $itemId,

                        'product_id' =>
                            (int) $matchedItem['product_id'],

                        'quantity' =>
                            $quantity,

                        'unit_cost' =>
                            (float) $matchedItem['unit_cost']
                    ];
                }
            }


            if (count($receivedItems) === 0) {

                throw new RuntimeException(
                    'There are no outstanding quantities to receive.'
                );
            }


            /*
             * Add inventory.
             */
            foreach ($receivedItems as $receivedItem) {

                $this->inventoryService->stockIn(
                    $receivedItem['product_id'],
                    $receivedItem['quantity'],
                    [
                        'reference_type' =>
                            'purchase',

                        'reference_id' =>
                            $purchaseId,

                        'purchase_id' =>
                            $purchaseId,

                        'purchase_item_id' =>
                            $receivedItem['purchase_item_id'],

                        'unit_cost' =>
                            $receivedItem['unit_cost'],

                        'reason' =>
                            'Purchase received',

                        'created_by' =>
                            $data['received_by'] ?? null
                    ]
                );


                /*
                 * Update received quantity.
                 */
                $updateItem =
                    $this->db->prepare("
                        UPDATE purchase_items
                        SET
                            received_quantity =
                                COALESCE(received_quantity, 0)
                                + :quantity,
                            updated_at = NOW()
                        WHERE id = :id
                          AND purchase_id = :purchase_id
                    ");

                $updateItem->execute([
                    ':quantity' =>
                        $receivedItem['quantity'],

                    ':id' =>
                        $receivedItem['purchase_item_id'],

                    ':purchase_id' =>
                        $purchaseId
                ]);
            }


            /*
             * Determine final purchase status.
             */
            $remainingStmt =
                $this->db->prepare("
                    SELECT COUNT(*)
                    FROM purchase_items
                    WHERE purchase_id = :purchase_id
                      AND COALESCE(received_quantity, 0)
                          < quantity
                ");

            $remainingStmt->execute([
                ':purchase_id' =>
                    $purchaseId
            ]);


            $remainingCount =
                (int) $remainingStmt->fetchColumn();


            $newStatus =
                $remainingCount === 0
                    ? 'received'
                    : 'partially_received';


            /*
             * Update purchase.
             */
            $updatePurchase =
                $this->db->prepare("
                    UPDATE purchases
                    SET
                        status = :status,
                        received_date = :received_date,
                        received_by = :received_by,
                        receiving_notes = :receiving_notes,
                        updated_at = NOW()
                    WHERE id = :id
                ");

            $updatePurchase->execute([
                ':status' =>
                    $newStatus,

                ':received_date' =>
                    $data['received_date']
                    ?? date('Y-m-d'),

                ':received_by' =>
                    $data['received_by'] ?? null,

                ':receiving_notes' =>
                    $data['notes'] ?? null,

                ':id' =>
                    $purchaseId
            ]);


            $this->db->commit();


            $result =
                $this->get($purchaseId);


            if ($result === null) {

                throw new RuntimeException(
                    'Purchase was received but could not be loaded.'
                );
            }


            $result['received_items'] =
                $receivedItems;

            $result['status'] =
                $newStatus;


            return $result;

        } catch (Throwable $e) {

            if ($this->db->inTransaction()) {

                $this->db->rollBack();
            }

            throw $e;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | CANCEL
    |--------------------------------------------------------------------------
    */

    public function cancel(
        int $purchaseId,
        array $data
    ): ?array {

        if ($purchaseId < 1) {

            throw new InvalidArgumentException(
                'Invalid purchase ID.'
            );
        }


        $reason =
            trim(
                (string) (
                    $data['reason'] ?? ''
                )
            );


        if ($reason === '') {

            throw new InvalidArgumentException(
                'Cancellation reason is required.'
            );
        }


        try {

            $this->db->beginTransaction();


            /*
             * Lock purchase before changing status.
             */
            $purchase =
                $this->getForUpdate(
                    $purchaseId
                );


            if (!$purchase) {

                $this->db->rollBack();

                return null;
            }


            $status =
                strtolower(
                    (string) $purchase['status']
                );


            if ($status === 'cancelled') {

                throw new RuntimeException(
                    'Purchase is already cancelled.'
                );
            }


            if (
                in_array(
                    $status,
                    [
                        'received',
                        'partially_received'
                    ],
                    true
                )
            ) {

                throw new RuntimeException(
                    'Received purchases cannot be cancelled. Use a purchase return or inventory reversal.'
                );
            }


            if ($status !== 'pending') {

                throw new RuntimeException(
                    'Only pending purchases can be cancelled.'
                );
            }


            /*
             * Cancel purchase.
             */
            $sql = "
                UPDATE purchases
                SET
                    status = 'cancelled',
                    cancellation_reason = :reason,
                    cancelled_by = :cancelled_by,
                    cancelled_at = NOW(),
                    updated_at = NOW()
                WHERE id = :id
            ";

            $stmt =
                $this->db->prepare($sql);

            $stmt->execute([
                ':reason' =>
                    $reason,

                ':cancelled_by' =>
                    $data['cancelled_by'] ?? null,

                ':id' =>
                    $purchaseId
            ]);


            $this->db->commit();


            $result =
                $this->get($purchaseId);


            return $result;

        } catch (Throwable $e) {

            if ($this->db->inTransaction()) {

                $this->db->rollBack();
            }

            throw $e;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | VALIDATE ITEMS
    |--------------------------------------------------------------------------
    */

    private function validateItems(
        array $items
    ): void {

        if (count($items) === 0) {

            throw new InvalidArgumentException(
                'At least one purchase item is required.'
            );
        }


        $productIds = [];


        foreach ($items as $index => $item) {

            if (!is_array($item)) {

                throw new InvalidArgumentException(
                    'Invalid purchase item at index ' .
                    $index . '.'
                );
            }


            $productId =
                (int) (
                    $item['product_id']
                    ?? 0
                );


            if ($productId < 1) {

                throw new InvalidArgumentException(
                    'Invalid product_id for item ' .
                    ($index + 1) . '.'
                );
            }


            if (
                in_array(
                    $productId,
                    $productIds,
                    true
                )
            ) {

                throw new InvalidArgumentException(
                    'The same product cannot appear more than once in a purchase.'
                );
            }


            $productIds[] =
                $productId;


            $quantity =
                (int) (
                    $item['quantity']
                    ?? 0
                );


            if ($quantity < 1) {

                throw new InvalidArgumentException(
                    'Quantity must be greater than zero for item ' .
                    ($index + 1) . '.'
                );
            }


            $unitCost =
                $item['unit_cost']
                ?? $item['cost_price']
                ?? null;


            if (
                !is_numeric($unitCost) ||
                (float) $unitCost < 0
            ) {

                throw new InvalidArgumentException(
                    'Invalid unit cost for item ' .
                    ($index + 1) . '.'
                );
            }


            $taxRate =
                $item['tax_rate']
                ?? 0;


            if (
                !is_numeric($taxRate) ||
                (float) $taxRate < 0 ||
                (float) $taxRate > 100
            ) {

                throw new InvalidArgumentException(
                    'Tax rate must be between 0 and 100.'
                );
            }


            $discount =
                $item['discount']
                ?? 0;


            if (
                !is_numeric($discount) ||
                (float) $discount < 0
            ) {

                throw new InvalidArgumentException(
                    'Invalid item discount.'
                );
            }


            /*
             * Verify product exists.
             */
            $this->assertProductExists(
                $productId
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | CALCULATE TOTALS
    |--------------------------------------------------------------------------
    */

    private function calculateTotals(
        array $items,
        float $tax,
        float $discount,
        float $shipping
    ): array {

        if ($tax < 0) {
            throw new InvalidArgumentException(
                'Tax cannot be negative.'
            );
        }

        if ($discount < 0) {
            throw new InvalidArgumentException(
                'Discount cannot be negative.'
            );
        }

        if ($shipping < 0) {
            throw new InvalidArgumentException(
                'Shipping cannot be negative.'
            );
        }


        $subtotal = 0.00;


        foreach ($items as $item) {

            $quantity =
                (int) $item['quantity'];

            $unitCost =
                round(
                    (float) $item['unit_cost'],
                    2
                );

            $itemDiscount =
                round(
                    (float) (
                        $item['discount']
                        ?? 0
                    ),
                    2
                );


            $lineTotal =
                ($quantity * $unitCost)
                - $itemDiscount;


            if ($lineTotal < 0) {

                throw new InvalidArgumentException(
                    'Item discount cannot exceed the item subtotal.'
                );
            }


            $subtotal +=
                $lineTotal;
        }


        $subtotal =
            round(
                $subtotal,
                2
            );


        $tax =
            round(
                $tax,
                2
            );

        $discount =
            round(
                $discount,
                2
            );

        $shipping =
            round(
                $shipping,
                2
            );


        $total =
            $subtotal
            + $tax
            + $shipping
            - $discount;


        if ($total < 0) {

            throw new InvalidArgumentException(
                'Purchase total cannot be negative.'
            );
        }


        return [
            'subtotal' =>
                round($subtotal, 2),

            'tax' =>
                round($tax, 2),

            'discount' =>
                round($discount, 2),

            'shipping' =>
                round($shipping, 2),

            'total' =>
                round($total, 2)
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | INSERT ITEMS
    |--------------------------------------------------------------------------
    */

    private function insertItems(
        int $purchaseId,
        array $items
    ): void {

        $sql = "
            INSERT INTO purchase_items (
                purchase_id,
                product_id,
                quantity,
                received_quantity,
                unit_cost,
                tax_rate,
                discount,
                line_total,
                note,
                created_at,
                updated_at
            )
            VALUES (
                :purchase_id,
                :product_id,
                :quantity,
                0,
                :unit_cost,
                :tax_rate,
                :discount,
                :line_total,
                :note,
                NOW(),
                NOW()
            )
        ";


        $stmt =
            $this->db->prepare($sql);


        foreach ($items as $item) {

            $quantity =
                (int) $item['quantity'];

            $unitCost =
                round(
                    (float) $item['unit_cost'],
                    2
                );

            $discount =
                round(
                    (float) (
                        $item['discount']
                        ?? 0
                    ),
                    2
                );


            $lineTotal =
                round(
                    ($quantity * $unitCost)
                    - $discount,
                    2
                );


            $stmt->execute([
                ':purchase_id' =>
                    $purchaseId,

                ':product_id' =>
                    (int) $item['product_id'],

                ':quantity' =>
                    $quantity,

                ':unit_cost' =>
                    $unitCost,

                ':tax_rate' =>
                    (float) (
                        $item['tax_rate']
                        ?? 0
                    ),

                ':discount' =>
                    $discount,

                ':line_total' =>
                    $lineTotal,

                ':note' =>
                    $item['note'] ?? null
            ]);
        }
    }


    /*
    |--------------------------------------------------------------------------
    | LOCK PURCHASE
    |--------------------------------------------------------------------------
    */

    private function getForUpdate(
        int $purchaseId
    ): ?array {

        $stmt =
            $this->db->prepare("
                SELECT *
                FROM purchases
                WHERE id = :id
                LIMIT 1
                FOR UPDATE
            ");

        $stmt->execute([
            ':id' => $purchaseId
        ]);


        $purchase =
            $stmt->fetch(
                PDO::FETCH_ASSOC
            );


        return $purchase ?: null;
    }


    /*
    |--------------------------------------------------------------------------
    | LOCK PURCHASE ITEMS
    |--------------------------------------------------------------------------
    */

    private function getItemsForUpdate(
        int $purchaseId
    ): array {

        $stmt =
            $this->db->prepare("
                SELECT *
                FROM purchase_items
                WHERE purchase_id = :purchase_id
                ORDER BY id ASC
                FOR UPDATE
            ");

        $stmt->execute([
            ':purchase_id' =>
                $purchaseId
        ]);


        return $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );
    }


    /*
    |--------------------------------------------------------------------------
    | SUPPLIER EXISTS
    |--------------------------------------------------------------------------
    */

    private function assertSupplierExists(
        int $supplierId
    ): void {

        if ($supplierId < 1) {

            throw new InvalidArgumentException(
                'A valid supplier is required.'
            );
        }


        $stmt =
            $this->db->prepare("
                SELECT id
                FROM suppliers
                WHERE id = :id
                LIMIT 1
            ");

        $stmt->execute([
            ':id' => $supplierId
        ]);


        if (!$stmt->fetchColumn()) {

            throw new InvalidArgumentException(
                'Supplier not found.'
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | PRODUCT EXISTS
    |--------------------------------------------------------------------------
    */

    private function assertProductExists(
        int $productId
    ): void {

        if ($productId < 1) {

            throw new InvalidArgumentException(
                'Invalid product ID.'
            );
        }


        $stmt =
            $this->db->prepare("
                SELECT id
                FROM products
                WHERE id = :id
                LIMIT 1
            ");

        $stmt->execute([
            ':id' => $productId
        ]);


        if (!$stmt->fetchColumn()) {

            throw new InvalidArgumentException(
                'Product ' .
                $productId .
                ' not found.'
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | PURCHASE NUMBER
    |--------------------------------------------------------------------------
    */

    private function generatePurchaseNumber(): string
    {
        $prefix =
            'PO-' .
            date('Ymd') .
            '-';


        $stmt =
            $this->db->prepare("
                SELECT purchase_number
                FROM purchases
                WHERE purchase_number LIKE :prefix
                ORDER BY id DESC
                LIMIT 1
            ");

        $stmt->execute([
            ':prefix' =>
                $prefix . '%'
        ]);


        $last =
            $stmt->fetchColumn();


        if (!$last) {

            $sequence = 1;

        } else {

            $parts =
                explode(
                    '-',
                    (string) $last
                );

            $sequence =
                ((int) end($parts)) + 1;
        }


        return $prefix .
            str_pad(
                (string) $sequence,
                4,
                '0',
                STR_PAD_LEFT
            );
    }
}
