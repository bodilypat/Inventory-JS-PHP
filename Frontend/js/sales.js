/* =========================================================
   INVENTORY MANAGEMENT SYSTEM
   SALES OPERATIONS
   File: frontend/js/sales.js

   Expected API examples:
   GET    ../backend/api/sales.php
   GET    ../backend/api/sales.php?id=1
   POST   ../backend/api/sales.php
   PUT    ../backend/api/sales.php?id=1
   DELETE ../backend/api/sales.php?id=1

   Optional endpoints:
   GET  ../backend/api/products.php
   GET  ../backend/api/customers.php
   POST ../backend/api/sales-payment.php
========================================================= */

"use strict";


/* =========================================================
   CONFIGURATION
========================================================= */

const SALES_CONFIG = {

    api: {
        sales: "../backend/api/sales.php",
        products: "../backend/api/products.php",
        customers: "../backend/api/customers.php",
        payment: "../backend/api/sales-payment.php"
    },

    currency: "USD",

    defaultPerPage: 10,

    debounceDelay: 300

};


/* =========================================================
   STATE
========================================================= */

const salesState = {

    sales: [],

    products: [],

    customers: [],

    filteredSales: [],

    currentSale: null,

    editingSaleId: null,

    currentPage: 1,

    perPage: SALES_CONFIG.defaultPerPage,

    totalPages: 1,

    search: "",

    status: "",

    customer: "",

    sortField: "sale_date",

    sortDirection: "desc",

    loading: false,

    itemCounter: 0

};


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (selector, parent = document) =>
    parent.querySelector(selector);


const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initializeSalesPage();

});


async function initializeSalesPage() {

    bindEvents();

    setDefaultSaleDate();

    await Promise.all([
        loadProducts(),
        loadCustomers()
    ]);

    await loadSales();

}


/* =========================================================
   EVENT BINDINGS
========================================================= */

function bindEvents() {

    const addButton =
        $("#addSaleButton");

    if (addButton) {

        addButton.addEventListener(
            "click",
            () => openSaleModal()
        );

    }


    const refreshButton =
        $("#refreshSalesButton");

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            async () => {

                await loadSales();

                showToast(
                    "Sales data refreshed.",
                    "success"
                );

            }
        );

    }


    const search =
        $("#saleSearch");

    if (search) {

        search.addEventListener(
            "input",
            debounce(() => {

                salesState.search =
                    search.value.trim();

                salesState.currentPage = 1;

                applyFilters();

            }, SALES_CONFIG.debounceDelay)
        );

    }


    const status =
        $("#saleStatusFilter");

    if (status) {

        status.addEventListener(
            "change",
            () => {

                salesState.status =
                    status.value;

                salesState.currentPage = 1;

                applyFilters();

            }
        );

    }


    const customer =
        $("#saleCustomerFilter");

    if (customer) {

        customer.addEventListener(
            "change",
            () => {

                salesState.customer =
                    customer.value;

                salesState.currentPage = 1;

                applyFilters();

            }
        );

    }


    const perPage =
        $("#perPage");

    if (perPage) {

        perPage.addEventListener(
            "change",
            () => {

                salesState.perPage =
                    Number(perPage.value) || 10;

                salesState.currentPage = 1;

                applyFilters();

            }
        );

    }


    const previous =
        $("#previousPage");

    if (previous) {

        previous.addEventListener(
            "click",
            () => changePage(
                salesState.currentPage - 1
            )
        );

    }


    const next =
        $("#nextPage");

    if (next) {

        next.addEventListener(
            "click",
            () => changePage(
                salesState.currentPage + 1
            )
        );

    }


    $$("[data-sort-sale]").forEach(
        header => {

            header.addEventListener(
                "click",
                () => {

                    sortSales(
                        header.dataset.sortSale
                    );

                }
            );

        }
    );


    const form =
        $("#saleForm");

    if (form) {

        form.addEventListener(
            "submit",
            handleSaleSubmit
        );

    }


    const paymentForm =
        $("#paymentForm");

    if (paymentForm) {

        paymentForm.addEventListener(
            "submit",
            handlePaymentSubmit
        );

    }


    const addItem =
        $("#addSaleItemButton");

    if (addItem) {

        addItem.addEventListener(
            "click",
            () => addSaleItem()
        );

    }


    $$("[data-close-sale-modal]").forEach(
        button => {

            button.addEventListener(
                "click",
                closeSaleModal
            );

        }
    );


    $$("[data-close-sale-details]").forEach(
        button => {

            button.addEventListener(
                "click",
                closeSaleDetailsModal
            );

        }
    );


    $$("[data-close-payment-modal]").forEach(
        button => {

            button.addEventListener(
                "click",
                closePaymentModal
            );

        }
    );


    document.addEventListener(
        "click",
        handleDocumentActions
    );


    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                closeAllModals();

            }

        }
    );

}


/* =========================================================
   DOCUMENT ACTIONS
========================================================= */

function handleDocumentActions(event) {

    const button =
        event.target.closest(
            "[data-sale-action]"
        );

    if (!button) {
        return;
    }


    const action =
        button.dataset.saleAction;

    const id =
        button.dataset.saleId;


    if (!id) {
        return;
    }


    switch (action) {

        case "view":
            viewSale(id);
            break;

        case "edit":
            editSale(id);
            break;

        case "payment":
            openPaymentModal(id);
            break;

        case "delete":
            deleteSale(id);
            break;

        case "print":
            printSale(id);
            break;

        default:
            break;

    }

}


/* =========================================================
   LOAD SALES
========================================================= */

async function loadSales() {

    setLoading(true);

    try {

        const response =
            await apiRequest(
                SALES_CONFIG.api.sales,
                {
                    method: "GET"
                }
            );


        const data =
            normalizeResponse(response);


        salesState.sales =
            extractArray(
                data,
                [
                    "sales",
                    "data",
                    "items"
                ]
            );


        applyFilters();

        updateStatistics();

    } catch (error) {

        console.error(
            "Unable to load sales:",
            error
        );


        salesState.sales = [];

        applyFilters();

        showToast(
            error.message ||
            "Unable to load sales.",
            "error"
        );

    } finally {

        setLoading(false);

    }

}


/* =========================================================
   LOAD PRODUCTS
========================================================= */

async function loadProducts() {

    try {

        const response =
            await apiRequest(
                SALES_CONFIG.api.products,
                {
                    method: "GET"
                }
            );


        const data =
            normalizeResponse(response);


        salesState.products =
            extractArray(
                data,
                [
                    "products",
                    "data",
                    "items"
                ]
            );


        populateProductSelects();

    } catch (error) {

        console.error(
            "Unable to load products:",
            error
        );

    }

}


/* =========================================================
   LOAD CUSTOMERS
========================================================= */

async function loadCustomers() {

    try {

        const response =
            await apiRequest(
                SALES_CONFIG.api.customers,
                {
                    method: "GET"
                }
            );


        const data =
            normalizeResponse(response);


        salesState.customers =
            extractArray(
                data,
                [
                    "customers",
                    "data",
                    "items"
                ]
            );


        populateCustomerSelects();

    } catch (error) {

        console.error(
            "Unable to load customers:",
            error
        );

    }

}


/* =========================================================
   POPULATE CUSTOMER SELECTS
========================================================= */

function populateCustomerSelects() {

    const filter =
        $("#saleCustomerFilter");

    const formSelect =
        $("#saleCustomer");


    if (filter) {

        const selected =
            salesState.customer;

        filter.innerHTML =
            `<option value="">All Customers</option>`;


        salesState.customers.forEach(
            customer => {

                const id =
                    customer.id ??
                    customer.customer_id;

                const name =
                    customer.name ??
                    customer.customer_name ??
                    `${customer.first_name || ""} ${customer.last_name || ""}`.trim();


                if (id === undefined) {
                    return;
                }


                filter.insertAdjacentHTML(
                    "beforeend",
                    `<option value="${escapeHtml(id)}">
                        ${escapeHtml(name || `Customer #${id}`)}
                    </option>`
                );

            }
        );


        filter.value = selected;

    }


    if (formSelect) {

        const selected =
            formSelect.value;

        formSelect.innerHTML =
            `<option value="">Walk-in Customer</option>`;


        salesState.customers.forEach(
            customer => {

                const id =
                    customer.id ??
                    customer.customer_id;

                const name =
                    customer.name ??
                    customer.customer_name ??
                    `${customer.first_name || ""} ${customer.last_name || ""}`.trim();


                if (id === undefined) {
                    return;
                }


                formSelect.insertAdjacentHTML(
                    "beforeend",
                    `<option value="${escapeHtml(id)}">
                        ${escapeHtml(name || `Customer #${id}`)}
                    </option>`
                );

            }
        );


        if (selected) {
            formSelect.value = selected;
        }

    }

}


/* =========================================================
   POPULATE PRODUCT SELECTS
========================================================= */

function populateProductSelects() {

    $$(".sale-product-select").forEach(
        select => {

            const selected =
                select.value;

            fillProductSelect(
                select,
                selected
            );

        }
    );

}


function fillProductSelect(
    select,
    selected = ""
) {

    if (!select) {
        return;
    }


    select.innerHTML =
        `<option value="">Select product</option>`;


    salesState.products.forEach(
        product => {

            const id =
                product.id ??
                product.product_id;

            const name =
                product.name ??
                product.product_name ??
                `Product #${id}`;

            const sku =
                product.sku ??
                "";


            if (id === undefined) {
                return;
            }


            const label =
                sku
                    ? `${name} (${sku})`
                    : name;


            select.insertAdjacentHTML(
                "beforeend",
                `<option
                    value="${escapeHtml(id)}"
                >
                    ${escapeHtml(label)}
                </option>`
            );

        }
    );


    if (selected) {
        select.value = selected;
    }

}


/* =========================================================
   FILTER SALES
========================================================= */

function applyFilters() {

    let result =
        [...salesState.sales];


    const search =
        salesState.search.toLowerCase();


    if (search) {

        result =
            result.filter(
                sale => {

                    const values = [

                        sale.sale_number,

                        sale.invoice_number,

                        sale.customer_name,

                        sale.name,

                        sale.notes

                    ];


                    return values.some(
                        value =>
                            String(
                                value ?? ""
                            )
                            .toLowerCase()
                            .includes(search)
                    );

                }
            );

    }


    if (salesState.status) {

        result =
            result.filter(
                sale =>
                    String(
                        sale.status ?? ""
                    ).toLowerCase()
                    ===
                    salesState.status.toLowerCase()
            );

    }


    if (salesState.customer) {

        result =
            result.filter(
                sale =>
                    String(
                        sale.customer_id ?? ""
                    )
                    ===
                    String(
                        salesState.customer
                    )
            );

    }


    result.sort(
        compareSales
    );


    salesState.filteredSales =
        result;


    salesState.totalPages =
        Math.max(
            1,
            Math.ceil(
                result.length /
                salesState.perPage
            )
        );


    if (
        salesState.currentPage >
        salesState.totalPages
    ) {

        salesState.currentPage =
            salesState.totalPages;

    }


    renderSales();

    updatePagination();

}


/* =========================================================
   SORT SALES
========================================================= */

function sortSales(field) {

    if (
        salesState.sortField === field
    ) {

        salesState.sortDirection =
            salesState.sortDirection === "asc"
                ? "desc"
                : "asc";

    } else {

        salesState.sortField =
            field;

        salesState.sortDirection =
            "asc";

    }


    applyFilters();

}


/* =========================================================
   SORT COMPARATOR
========================================================= */

function compareSales(a, b) {

    const field =
        salesState.sortField;


    let first =
        getSaleValue(a, field);

    let second =
        getSaleValue(b, field);


    if (
        field === "sale_date" ||
        field === "created_at"
    ) {

        first =
            new Date(first || 0).getTime();

        second =
            new Date(second || 0).getTime();

    }


    if (
        field === "total" ||
        field === "paid" ||
        field === "due"
    ) {

        first =
            Number(first || 0);

        second =
            Number(second || 0);

    }


    first =
        String(first ?? "").toLowerCase();

    second =
        String(second ?? "").toLowerCase();


    let comparison = 0;


    if (first > second) {
        comparison = 1;
    }

    if (first < second) {
        comparison = -1;
    }


    return salesState.sortDirection === "asc"
        ? comparison
        : -comparison;

}


/* =========================================================
   SALE VALUE
========================================================= */

function getSaleValue(
    sale,
    field
) {

    switch (field) {

        case "sale_number":
            return sale.sale_number;

        case "customer_name":
            return getCustomerName(sale);

        case "sale_date":
            return sale.sale_date;

        case "total":
            return getSaleTotal(sale);

        case "paid":
            return getSalePaid(sale);

        case "due":
            return getSaleDue(sale);

        case "status":
            return sale.status;

        default:
            return sale[field];

    }

}


/* =========================================================
   RENDER SALES
========================================================= */

function renderSales() {

    const tbody =
        $("#salesTableBody");

    if (!tbody) {
        return;
    }


    const start =
        (
            salesState.currentPage - 1
        ) *
        salesState.perPage;


    const end =
        start +
        salesState.perPage;


    const pageItems =
        salesState.filteredSales.slice(
            start,
            end
        );


    if (!pageItems.length) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="10"
                    class="table-empty-state"
                >
                    <div class="empty-icon">
                        🛍️
                    </div>

                    <p>
                        No sales found.
                    </p>
                </td>
            </tr>
        `;

        return;

    }


    tbody.innerHTML =
        pageItems
            .map(
                sale =>
                    createSaleRow(sale)
            )
            .join("");

}


/* =========================================================
   CREATE SALE ROW
========================================================= */

function createSaleRow(sale) {

    const id =
        sale.id ??
        sale.sale_id;


    const saleNumber =
        sale.sale_number ??
        sale.invoice_number ??
        `SALE-${id}`;


    const customer =
        getCustomerName(sale);


    const date =
        formatDate(
            sale.sale_date ??
            sale.created_at
        );


    const total =
        getSaleTotal(sale);


    const paid =
        getSalePaid(sale);


    const due =
        getSaleDue(sale);


    const status =
        normalizeStatus(
            sale.status
        );


    const paymentStatus =
        normalizePaymentStatus(
            sale,
            due
        );


    return `
        <tr>

            <td>
                <span class="sale-number">
                    ${escapeHtml(saleNumber)}
                </span>
            </td>


            <td>
                <span class="customer-name">
                    ${escapeHtml(customer)}
                </span>
            </td>


            <td>
                ${escapeHtml(date)}
            </td>


            <td>
                <span class="amount">
                    ${formatCurrency(total)}
                </span>
            </td>


            <td>
                <span class="amount-paid">
                    ${formatCurrency(paid)}
                </span>
            </td>


            <td>
                <span class="amount-due">
                    ${formatCurrency(due)}
                </span>
            </td>


            <td>
                <span class="status-badge ${escapeHtml(status.className)}">
                    ${escapeHtml(status.label)}
                </span>
            </td>


            <td>
                <span class="payment-status ${paymentStatus.className}">
                    ${escapeHtml(paymentStatus.label)}
                </span>
            </td>


            <td>

                <div class="table-actions">

                    <button
                        type="button"
                        class="table-action view"
                        data-sale-action="view"
                        data-sale-id="${escapeHtml(id)}"
                        title="View"
                        aria-label="View sale"
                    >
                        👁
                    </button>


                    <button
                        type="button"
                        class="table-action edit"
                        data-sale-action="edit"
                        data-sale-id="${escapeHtml(id)}"
                        title="Edit"
                        aria-label="Edit sale"
                    >
                        ✎
                    </button>


                    <button
                        type="button"
                        class="table-action payment"
                        data-sale-action="payment"
                        data-sale-id="${escapeHtml(id)}"
                        title="Record payment"
                        aria-label="Record payment"
                    >
                        $
                    </button>


                    <button
                        type="button"
                        class="table-action"
                        data-sale-action="print"
                        data-sale-id="${escapeHtml(id)}"
                        title="Print"
                        aria-label="Print sale"
                    >
                        🖨
                    </button>


                    <button
                        type="button"
                        class="table-action delete"
                        data-sale-action="delete"
                        data-sale-id="${escapeHtml(id)}"
                        title="Delete"
                        aria-label="Delete sale"
                    >
                        🗑
                    </button>

                </div>

            </td>

        </tr>
    `;

}


/* =========================================================
   PAGINATION
========================================================= */

function changePage(page) {

    if (
        page < 1 ||
        page > salesState.totalPages
    ) {
        return;
    }


    salesState.currentPage =
        page;


    renderSales();

    updatePagination();

}


function updatePagination() {

    const total =
        salesState.filteredSales.length;


    const start =
        total === 0
            ? 0
            : (
                (
                    salesState.currentPage - 1
                ) *
                salesState.perPage
            ) + 1;


    const end =
        Math.min(
            salesState.currentPage *
            salesState.perPage,
            total
        );


    const info =
        $("#paginationInfo");

    if (info) {

        info.textContent =
            total
                ? `Showing ${start}-${end} of ${total} sales`
                : "No sales found";

    }


    const current =
        $("#currentPage");

    if (current) {
        current.textContent =
            salesState.currentPage;
    }


    const totalPages =
        $("#totalPages");

    if (totalPages) {
        totalPages.textContent =
            salesState.totalPages;
    }


    const previous =
        $("#previousPage");

    if (previous) {

        previous.disabled =
            salesState.currentPage <= 1;

    }


    const next =
        $("#nextPage");

    if (next) {

        next.disabled =
            salesState.currentPage >=
            salesState.totalPages;

    }

}


/* =========================================================
   STATISTICS
========================================================= */

function updateStatistics() {

    const sales =
        salesState.sales;


    const totalSales =
        sales.length;


    const pending =
        sales.filter(
            sale =>
                [
                    "draft",
                    "pending",
                    "processing"
                ].includes(
                    String(
                        sale.status ?? ""
                    ).toLowerCase()
                )
        ).length;


    const completed =
        sales.filter(
            sale =>
                [
                    "completed",
                    "paid",
                    "delivered"
                ].includes(
                    String(
                        sale.status ?? ""
                    ).toLowerCase()
                )
        ).length;


    const totalAmount =
        sales.reduce(
            (
                sum,
                sale
            ) =>
                sum +
                getSaleTotal(sale),
            0
        );


    const paidAmount =
        sales.reduce(
            (
                sum,
                sale
            ) =>
                sum +
                getSalePaid(sale),
            0
        );


    const dueAmount =
        sales.reduce(
            (
                sum,
                sale
            ) =>
                sum +
                getSaleDue(sale),
            0
        );


    setText(
        "#totalSales",
        totalSales
    );

    setText(
        "#pendingSales",
        pending
    );

    setText(
        "#completedSales",
        completed
    );

    setText(
        "#totalSalesAmount",
        formatCurrency(totalAmount)
    );

    setText(
        "#totalSalesPaid",
        formatCurrency(paidAmount)
    );

    setText(
        "#totalSalesDue",
        formatCurrency(dueAmount)
    );

}


/* =========================================================
   OPEN SALE MODAL
========================================================= */

function openSaleModal(
    sale = null
) {

    const modal =
        $("#saleModal");

    const form =
        $("#saleForm");


    if (!modal || !form) {
        return;
    }


    form.reset();


    salesState.editingSaleId =
        sale
            ? (
                sale.id ??
                sale.sale_id
            )
            : null;


    setDefaultSaleDate();


    setText(
        "#saleModalTitle",
        sale
            ? "Edit Sale"
            : "Add Sale"
    );


    populateCustomerSelects();


    if (sale) {

        populateSaleForm(
            sale
        );

    }


    modal.classList.add(
        "active"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );

}


/* =========================================================
   POPULATE SALE FORM
========================================================= */

function populateSaleForm(sale) {

    setValue(
        "#saleCustomer",
        sale.customer_id
    );

    setValue(
        "#saleNumber",
        sale.sale_number
    );

    setValue(
        "#invoiceNumber",
        sale.invoice_number
    );

    setValue(
        "#saleDate",
        toInputDate(
            sale.sale_date
        )
    );

    setValue(
        "#saleStatus",
        sale.status || "completed"
    );

    setValue(
        "#paymentStatus",
        sale.payment_status || "unpaid"
    );

    setValue(
        "#saleDiscount",
        sale.discount ?? 0
    );

    setValue(
        "#saleTax",
        sale.tax ?? 0
    );

    setValue(
        "#saleNotes",
        sale.notes ?? ""
    );


    renderExistingSaleItems(
        sale.items ||
        sale.sale_items ||
        []
    );

    calculateSaleTotals();

}


/* =========================================================
   RENDER EXISTING SALE ITEMS
========================================================= */

function renderExistingSaleItems(
    items
) {

    const container =
        $("#saleItems");

    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (!items.length) {

        addSaleItem();

        return;

    }


    items.forEach(
        item => {

            addSaleItem(item);

        }
    );

}


/* =========================================================
   ADD SALE ITEM
========================================================= */

function addSaleItem(
    item = null
) {

    const container =
        $("#saleItems");

    if (!container) {
        return;
    }


    const empty =
        container.querySelector(
            ".sale-items-empty"
        );


    if (empty) {
        empty.remove();
    }


    salesState.itemCounter++;


    const itemId =
        salesState.itemCounter;


    const productId =
        item?.product_id ??
        item?.id ??
        "";


    const quantity =
        item?.quantity ??
        1;


    const unitPrice =
        item?.unit_price ??
        item?.price ??
        0;


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "sale-item";


    row.dataset.itemId =
        itemId;


    row.innerHTML = `

        <div class="form-group">

            <label>
                Product
            </label>

            <select
                class="sale-product-select"
                name="items[${itemId}][product_id]"
                required
            >
                <option value="">
                    Select product
                </option>
            </select>

        </div>


        <div class="form-group">

            <label>
                Quantity
            </label>

            <input
                type="number"
                class="sale-item-quantity"
                name="items[${itemId}][quantity]"
                min="0.01"
                step="0.01"
                value="${escapeHtml(quantity)}"
                required
            >

        </div>


        <div class="form-group">

            <label>
                Unit Price
            </label>

            <input
                type="number"
                class="sale-item-price"
                name="items[${itemId}][unit_price]"
                min="0"
                step="0.01"
                value="${escapeHtml(unitPrice)}"
                required
            >

        </div>


        <div class="form-group">

            <label>
                Total
            </label>

            <div
                class="sale-item-total"
            >
                ${formatCurrency(
                    Number(quantity) *
                    Number(unitPrice)
                )}
            </div>

        </div>


        <button
            type="button"
            class="sale-item-remove"
            title="Remove item"
            aria-label="Remove item"
        >
            ×
        </button>

    `;


    container.appendChild(
        row
    );


    const productSelect =
        $(".sale-product-select", row);


    fillProductSelect(
        productSelect,
        productId
    );


    const quantityInput =
        $(".sale-item-quantity", row);


    const priceInput =
        $(".sale-item-price", row);


    const update =
        () => {

            const quantity =
                Number(
                    quantityInput.value
                ) || 0;


            const price =
                Number(
                    priceInput.value
                ) || 0;


            const total =
                quantity *
                price;


            const totalElement =
                $(".sale-item-total", row);


            if (totalElement) {

                totalElement.textContent =
                    formatCurrency(
                        total
                    );

            }


            calculateSaleTotals();

        };


    quantityInput.addEventListener(
        "input",
        update
    );


    priceInput.addEventListener(
        "input",
        update
    );


    productSelect.addEventListener(
        "change",
        () => {

            const product =
                salesState.products.find(
                    product =>
                        String(
                            product.id ??
                            product.product_id
                        )
                        ===
                        String(
                            productSelect.value
                        )
                );


            if (
                product &&
                (
                    !priceInput.value ||
                    Number(priceInput.value) === 0
                )
            ) {

                const price =
                    product.sale_price ??
                    product.selling_price ??
                    product.price ??
                    0;


                priceInput.value =
                    price;

            }


            update();

        }
    );


    const remove =
        $(".sale-item-remove", row);


    remove.addEventListener(
        "click",
        () => {

            row.remove();

            ensureSaleItemState();

            calculateSaleTotals();

        }
    );

}


/* =========================================================
   ENSURE ITEM STATE
========================================================= */

function ensureSaleItemState() {

    const container =
        $("#saleItems");

    if (!container) {
        return;
    }


    if (
        !container.querySelector(
            ".sale-item"
        )
    ) {

        container.innerHTML = `
            <div class="sale-items-empty">
                <span>No items added</span>
                <small>
                    Use "Add Item" to add products.
                </small>
            </div>
        `;

    }

}


/* =========================================================
   CALCULATE SALE TOTALS
========================================================= */

function calculateSaleTotals() {

    let subtotal = 0;


    $$(".sale-item").forEach(
        row => {

            const quantity =
                Number(
                    $(
                        ".sale-item-quantity",
                        row
                    )?.value
                ) || 0;


            const price =
                Number(
                    $(
                        ".sale-item-price",
                        row
                    )?.value
                ) || 0;


            subtotal +=
                quantity *
                price;

        }
    );


    const discount =
        Number(
            $("#saleDiscount")?.value
        ) || 0;


    const tax =
        Number(
            $("#saleTax")?.value
        ) || 0;


    const total =
        Math.max(
            0,
            subtotal -
            discount +
            tax
        );


    setText(
        "#saleSubtotal",
        formatCurrency(subtotal)
    );

    setText(
        "#saleTotal",
        formatCurrency(total)
    );


    return {
        subtotal,
        discount,
        tax,
        total
    };

}


/* =========================================================
   FORM SUBMISSION
========================================================= */

async function handleSaleSubmit(
    event
) {

    event.preventDefault();


    const form =
        event.currentTarget;


    if (
        !form.checkValidity()
    ) {

        form.reportValidity();

        return;

    }


    const items =
        collectSaleItems();


    if (!items.length) {

        showToast(
            "Add at least one product to the sale.",
            "warning"
        );

        return;

    }


    const totals =
        calculateSaleTotals();


    const formData =
        new FormData(form);


    const payload = {

        customer_id:
            formData.get(
                "customer_id"
            ) || null,

        sale_number:
            formData.get(
                "sale_number"
            ) || null,

        invoice_number:
            formData.get(
                "invoice_number"
            ) || null,

        sale_date:
            formData.get(
                "sale_date"
            ),

        status:
            formData.get(
                "status"
            ) || "completed",

        payment_status:
            formData.get(
                "payment_status"
            ) || "unpaid",

        subtotal:
            totals.subtotal,

        discount:
            totals.discount,

        tax:
            totals.tax,

        total:
            totals.total,

        notes:
            formData.get(
                "notes"
            ) || "",

        items

    };


    const id =
        salesState.editingSaleId;


    const url =
        id
            ? `${SALES_CONFIG.api.sales}?id=${encodeURIComponent(id)}`
            : SALES_CONFIG.api.sales;


    const method =
        id
            ? "PUT"
            : "POST";


    setFormSubmitting(
        form,
        true
    );


    try {

        await apiRequest(
            url,
            {
                method,
                body: JSON.stringify(
                    payload
                )
            }
        );


        closeSaleModal();

        await loadSales();


        showToast(
            id
                ? "Sale updated successfully."
                : "Sale created successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            error
        );


        showToast(
            error.message ||
            "Unable to save sale.",
            "error"
        );

    } finally {

        setFormSubmitting(
            form,
            false
        );

    }

}


/* =========================================================
   COLLECT SALE ITEMS
========================================================= */

function collectSaleItems() {

    return $$(".sale-item")
        .map(
            row => {

                const productId =
                    $(
                        ".sale-product-select",
                        row
                    )?.value;


                const quantity =
                    Number(
                        $(
                            ".sale-item-quantity",
                            row
                        )?.value
                    ) || 0;


                const unitPrice =
                    Number(
                        $(
                            ".sale-item-price",
                            row
                        )?.value
                    ) || 0;


                return {

                    product_id:
                        productId,

                    quantity,

                    unit_price:
                        unitPrice,

                    total:
                        quantity *
                        unitPrice

                };

            }
        )
        .filter(
            item =>
                item.product_id &&
                item.quantity > 0
        );

}


/* =========================================================
   EDIT SALE
========================================================= */

async function editSale(id) {

    try {

        const sale =
            await getSale(id);


        if (!sale) {

            showToast(
                "Sale could not be found.",
                "error"
            );

            return;

        }


        openSaleModal(
            sale
        );

    } catch (error) {

        showToast(
            error.message ||
            "Unable to load sale.",
            "error"
        );

    }

}


/* =========================================================
   GET SALE
========================================================= */

async function getSale(id) {

    const response =
        await apiRequest(
            `${SALES_CONFIG.api.sales}?id=${encodeURIComponent(id)}`,
            {
                method: "GET"
            }
        );


    const data =
        normalizeResponse(response);


    if (data.sale) {
        return data.sale;
    }


    if (
        Array.isArray(data.data)
    ) {

        return data.data[0] ||
            null;

    }


    if (
        Array.isArray(data.sales)
    ) {

        return data.sales[0] ||
            null;

    }


    return data.data ||
        data;

}


/* =========================================================
   VIEW SALE
========================================================= */

async function viewSale(id) {

    try {

        const sale =
            await getSale(id);


        if (!sale) {

            showToast(
                "Sale could not be found.",
                "error"
            );

            return;

        }


        salesState.currentSale =
            sale;


        populateSaleDetails(
            sale
        );


        openModal(
            "#saleDetailsModal"
        );

    } catch (error) {

        showToast(
            error.message ||
            "Unable to load sale details.",
            "error"
        );

    }

}


/* =========================================================
   SALE DETAILS
========================================================= */

function populateSaleDetails(
    sale
) {

    const id =
        sale.id ??
        sale.sale_id;


    setText(
        "#saleDetailsNumber",
        sale.sale_number ||
        sale.invoice_number ||
        `SALE-${id}`
    );


    setText(
        "#saleDetailsCustomer",
        getCustomerName(sale)
    );


    setText(
        "#saleDetailsDate",
        formatDate(
            sale.sale_date
        )
    );


    setText(
        "#saleDetailsInvoice",
        sale.invoice_number ||
        "—"
    );


    setText(
        "#saleDetailsTotal",
        formatCurrency(
            getSaleTotal(sale)
        )
    );


    setText(
        "#saleDetailsPaid",
        formatCurrency(
            getSalePaid(sale)
        )
    );


    setText(
        "#saleDetailsDue",
        formatCurrency(
            getSaleDue(sale)
        )
    );


    const status =
        normalizeStatus(
            sale.status
        );


    setText(
        "#saleDetailsStatus",
        status.label
    );


    const paymentStatus =
        normalizePaymentStatus(
            sale,
            getSaleDue(sale)
        );


    setText(
        "#saleDetailsPaymentStatus",
        paymentStatus.label
    );


    renderSaleDetailsItems(
        sale.items ||
        sale.sale_items ||
        []
    );


    setText(
        "#saleDetailsNotes",
        sale.notes ||
        "No notes available."
    );

}


/* =========================================================
   DETAILS ITEMS
========================================================= */

function renderSaleDetailsItems(
    items
) {

    const container =
        $("#saleDetailsItems");

    if (!container) {
        return;
    }


    if (!items.length) {

        container.innerHTML = `
            <div class="details-empty">
                No sale item details available.
            </div>
        `;

        return;

    }


    container.innerHTML = `

        <table class="sale-details-table">

            <thead>

                <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>

            </thead>


            <tbody>

                ${items.map(
                    item => {

                        const product =
                            getProductName(
                                item
                            );

                        const quantity =
                            Number(
                                item.quantity
                            ) || 0;

                        const price =
                            Number(
                                item.unit_price ??
                                item.price
                            ) || 0;

                        const total =
                            Number(
                                item.total
                            ) ||
                            quantity *
                            price;


                        return `
                            <tr>

                                <td>
                                    ${escapeHtml(product)}
                                </td>

                                <td>
                                    ${quantity}
                                </td>

                                <td>
                                    ${formatCurrency(price)}
                                </td>

                                <td>
                                    ${formatCurrency(total)}
                                </td>

                            </tr>
                        `;

                    }
                ).join("")}

            </tbody>

        </table>

    `;

}


/* =========================================================
   DELETE SALE
========================================================= */

async function deleteSale(id) {

    const sale =
        salesState.sales.find(
            item =>
                String(
                    item.id ??
                    item.sale_id
                )
                ===
                String(id)
        );


    const number =
        sale?.sale_number ||
        `SALE-${id}`;


    const confirmed =
        window.confirm(
            `Delete ${number}? This action cannot be undone.`
        );


    if (!confirmed) {
        return;
    }


    try {

        await apiRequest(
            `${SALES_CONFIG.api.sales}?id=${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );


        await loadSales();


        showToast(
            "Sale deleted successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            error
        );


        showToast(
            error.message ||
            "Unable to delete sale.",
            "error"
        );

    }

}


/* =========================================================
   PAYMENT MODAL
========================================================= */

function openPaymentModal(
    id
) {

    const sale =
        salesState.sales.find(
            item =>
                String(
                    item.id ??
                    item.sale_id
                )
                ===
                String(id)
        );


    if (!sale) {

        showToast(
            "Sale could not be found.",
            "error"
        );

        return;

    }


    salesState.currentSale =
        sale;


    const form =
        $("#paymentForm");


    if (form) {

        form.reset();


        const hidden =
            form.querySelector(
                '[name="sale_id"]'
            );


        if (hidden) {

            hidden.value =
                sale.id ??
                sale.sale_id;

        }

    }


    setText(
        "#paymentSaleNumber",
        sale.sale_number ||
        sale.invoice_number ||
        `SALE-${id}`
    );


    setText(
        "#paymentSaleTotal",
        formatCurrency(
            getSaleTotal(sale)
        )
    );


    setText(
        "#paymentSalePaid",
        formatCurrency(
            getSalePaid(sale)
        )
    );


    setText(
        "#paymentSaleDue",
        formatCurrency(
            getSaleDue(sale)
        )
    );


    const amount =
        $("#paymentAmount");


    if (amount) {

        amount.max =
            getSaleDue(sale).toFixed(2);

    }


    openModal(
        "#paymentModal"
    );

}


/* =========================================================
   PAYMENT SUBMISSION
========================================================= */

async function handlePaymentSubmit(
    event
) {

    event.preventDefault();


    const form =
        event.currentTarget;


    if (!form.checkValidity()) {

        form.reportValidity();

        return;

    }


    const formData =
        new FormData(form);


    const saleId =
        formData.get(
            "sale_id"
        );


    const amount =
        Number(
            formData.get(
                "amount"
            )
        );


    const sale =
        salesState.currentSale;


    if (!saleId || amount <= 0) {

        showToast(
            "Enter a valid payment amount.",
            "warning"
        );

        return;

    }


    const due =
        getSaleDue(sale);


    if (
        amount >
        due + 0.0001
    ) {

        showToast(
            "Payment cannot exceed the amount due.",
            "warning"
        );

        return;

    }


    const payload = {

        sale_id:
            saleId,

        amount,

        payment_method:
            formData.get(
                "payment_method"
            ),

        reference:
            formData.get(
                "reference"
            ) || "",

        notes:
            formData.get(
                "notes"
            ) || ""

    };


    setFormSubmitting(
        form,
        true
    );


    try {

        await apiRequest(
            SALES_CONFIG.api.payment,
            {
                method: "POST",
                body: JSON.stringify(
                    payload
                )
            }
        );


        closePaymentModal();

        await loadSales();


        showToast(
            "Payment recorded successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            error
        );


        showToast(
            error.message ||
            "Unable to record payment.",
            "error"
        );

    } finally {

        setFormSubmitting(
            form,
            false
        );

    }

}


/* =========================================================
   PRINT SALE
========================================================= */

async function printSale(id) {

    try {

        const sale =
            await getSale(id);


        if (!sale) {

            showToast(
                "Sale could not be found.",
                "error"
            );

            return;

        }


        const items =
            sale.items ||
            sale.sale_items ||
            [];


        const saleNumber =
            sale.sale_number ||
            sale.invoice_number ||
            `SALE-${id}`;


        const rows =
            items.map(
                item => {

                    const quantity =
                        Number(
                            item.quantity
                        ) || 0;

                    const price =
                        Number(
                            item.unit_price ??
                            item.price
                        ) || 0;

                    const total =
                        Number(
                            item.total
                        ) ||
                        quantity *
                        price;


                    return `
                        <tr>

                            <td>
                                ${escapeHtml(
                                    getProductName(item)
                                )}
                            </td>

                            <td>
                                ${quantity}
                            </td>

                            <td>
                                ${formatCurrency(price)}
                            </td>

                            <td>
                                ${formatCurrency(total)}
                            </td>

                        </tr>
                    `;

                }
            ).join("");


        const printWindow =
            window.open(
                "",
                "_blank",
                "width=900,height=700"
            );


        if (!printWindow) {

            showToast(
                "Please allow pop-ups to print the sale.",
                "warning"
            );

            return;

        }


        printWindow.document.write(`

            <!DOCTYPE html>

            <html>

            <head>

                <title>
                    ${escapeHtml(saleNumber)}
                </title>

                <style>

                    body {
                        font-family:
                            Arial,
                            sans-serif;

                        color: #111827;

                        margin: 40px;
                    }

                    h1 {
                        margin-bottom: 5px;
                    }

                    .meta {
                        color: #6b7280;
                        margin-bottom: 30px;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }

                    th,
                    td {
                        padding: 10px;
                        border-bottom:
                            1px solid #e5e7eb;

                        text-align: left;
                    }

                    th {
                        background: #f9fafb;
                    }

                    .totals {
                        width: 300px;
                        margin-left: auto;
                        margin-top: 25px;
                    }

                    .total-row {
                        display: flex;
                        justify-content:
                            space-between;

                        padding: 7px 0;
                    }

                    .grand-total {
                        border-top:
                            2px solid #111827;

                        font-weight: bold;

                        padding-top: 12px;
                    }

                </style>

            </head>


            <body>

                <h1>
                    Sale ${escapeHtml(saleNumber)}
                </h1>

                <div class="meta">

                    Customer:
                    ${escapeHtml(
                        getCustomerName(sale)
                    )}

                    <br>

                    Date:
                    ${escapeHtml(
                        formatDate(sale.sale_date)
                    )}

                </div>


                <table>

                    <thead>

                        <tr>
                            <th>Product</th>
                            <th>Quantity</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                        </tr>

                    </thead>

                    <tbody>
                        ${rows}
                    </tbody>

                </table>


                <div class="totals">

                    <div class="total-row">
                        <span>Subtotal</span>
                        <strong>
                            ${formatCurrency(
                                sale.subtotal ??
                                getSaleTotal(sale)
                            )}
                        </strong>
                    </div>

                    <div class="total-row">
                        <span>Discount</span>
                        <strong>
                            ${formatCurrency(
                                sale.discount
                            )}
                        </strong>
                    </div>

                    <div class="total-row">
                        <span>Tax</span>
                        <strong>
                            ${formatCurrency(
                                sale.tax
                            )}
                        </strong>
                    </div>

                    <div class="total-row grand-total">
                        <span>Total</span>
                        <strong>
                            ${formatCurrency(
                                getSaleTotal(sale)
                            )}
                        </strong>
                    </div>

                </div>

                <script>
                    window.onload = function () {
                        window.print();
                    };
                <\/script>

            </body>

            </html>

        `);


        printWindow.document.close();

    } catch (error) {

        showToast(
            error.message ||
            "Unable to print sale.",
            "error"
        );

    }

}


/* =========================================================
   MODAL HELPERS
========================================================= */

function openModal(
    selector
) {

    const modal =
        $(selector);

    if (!modal) {
        return;
    }


    modal.classList.add(
        "active"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );

}


function closeModal(
    selector
) {

    const modal =
        $(selector);

    if (!modal) {
        return;
    }


    modal.classList.remove(
        "active"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    if (
        !$(".modal.active")
    ) {

        document.body.classList.remove(
            "modal-open"
        );

    }

}


function closeSaleModal() {

    closeModal(
        "#saleModal"
    );

    salesState.editingSaleId =
        null;

}


function closeSaleDetailsModal() {

    closeModal(
        "#saleDetailsModal"
    );

}


function closePaymentModal() {

    closeModal(
        "#paymentModal"
    );

}


function closeAllModals() {

    $$(".modal.active").forEach(
        modal => {

            modal.classList.remove(
                "active"
            );

            modal.setAttribute(
                "aria-hidden",
                "true"
            );

        }
    );


    document.body.classList.remove(
        "modal-open"
    );

}


/* =========================================================
   DEFAULT DATE
========================================================= */

function setDefaultSaleDate() {

    const input =
        $("#saleDate");

    if (!input) {
        return;
    }


    if (!input.value) {

        const now =
            new Date();


        const year =
            now.getFullYear();


        const month =
            String(
                now.getMonth() + 1
            ).padStart(
                2,
                "0"
            );


        const day =
            String(
                now.getDate()
            ).padStart(
                2,
                "0"
            );


        input.value =
            `${year}-${month}-${day}`;

    }

}


/* =========================================================
   SALE HELPERS
========================================================= */

function getCustomerName(
    sale
) {

    if (
        sale.customer_name
    ) {

        return sale.customer_name;

    }


    if (
        sale.customer
    ) {

        if (
            typeof sale.customer ===
            "string"
        ) {

            return sale.customer;

        }


        return sale.customer.name ||
            `${sale.customer.first_name || ""} ${sale.customer.last_name || ""}`.trim() ||
            "Walk-in Customer";

    }


    const customer =
        salesState.customers.find(
            item =>
                String(
                    item.id ??
                    item.customer_id
                )
                ===
                String(
                    sale.customer_id
                )
        );


    if (customer) {

        return customer.name ||
            customer.customer_name ||
            `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
            "Customer";

    }


    return "Walk-in Customer";

}


function getProductName(
    item
) {

    if (
        item.product_name
    ) {

        return item.product_name;

    }


    if (
        item.product
    ) {

        if (
            typeof item.product ===
            "string"
        ) {

            return item.product;

        }


        return item.product.name ||
            item.product.product_name ||
            "Product";

    }


    const product =
        salesState.products.find(
            product =>
                String(
                    product.id ??
                    product.product_id
                )
                ===
                String(
                    item.product_id
                )
        );


    return product?.name ||
        product?.product_name ||
        `Product #${item.product_id ?? ""}`;

}


function getSaleTotal(
    sale
) {

    return Number(
        sale.total ??
        sale.grand_total ??
        sale.amount ??
        0
    ) || 0;

}


function getSalePaid(
    sale
) {

    return Number(
        sale.paid ??
        sale.paid_amount ??
        sale.amount_paid ??
        0
    ) || 0;

}


function getSaleDue(
    sale
) {

    if (
        sale.due !== undefined
    ) {

        return Math.max(
            0,
            Number(sale.due) || 0
        );

    }


    if (
        sale.amount_due !== undefined
    ) {

        return Math.max(
            0,
            Number(
                sale.amount_due
            ) || 0
        );

    }


    return Math.max(
        0,
        getSaleTotal(sale) -
        getSalePaid(sale)
    );

}


/* =========================================================
   STATUS HELPERS
========================================================= */

function normalizeStatus(
    status
) {

    const value =
        String(
            status ||
            "pending"
        )
        .toLowerCase()
        .trim();


    const labels = {

        draft: "Draft",

        pending: "Pending",

        processing: "Processing",

        confirmed: "Confirmed",

        completed: "Completed",

        delivered: "Delivered",

        cancelled: "Cancelled",

        refunded: "Refunded"

    };


    return {

        className:
            value.replace(
                /\s+/g,
                "-"
            ),

        label:
            labels[value] ||
            capitalize(value)

    };

}


function normalizePaymentStatus(
    sale,
    due
) {

    const explicit =
        String(
            sale.payment_status ||
            ""
        )
        .toLowerCase();


    if (
        explicit === "paid" ||
        due <= 0
    ) {

        return {

            className: "paid",
            label: "Paid"

        };

    }


    if (
        explicit === "partial" ||
        getSalePaid(sale) > 0
    ) {

        return {

            className: "partial",
            label: "Partial"

        };

    }


    return {

        className: "unpaid",
        label: "Unpaid"

    };

}


/* =========================================================
   API REQUEST
========================================================= */

async function apiRequest(
    url,
    options = {}
) {

    const requestOptions = {

        credentials: "same-origin",

        headers: {

            Accept:
                "application/json",

            ...(options.body
                ? {
                    "Content-Type":
                        "application/json"
                }
                : {}),

            ...(options.headers || {})

        },

        ...options

    };


    const response =
        await fetch(
            url,
            requestOptions
        );


    const text =
        await response.text();


    let data;


    try {

        data =
            text
                ? JSON.parse(text)
                : {};

    } catch {

        data = {
            raw: text
        };

    }


    if (
        !response.ok
    ) {

        throw new Error(
            data.message ||
            data.error ||
            `Request failed with status ${response.status}.`
        );

    }


    if (
        data &&
        data.success === false
    ) {

        throw new Error(
            data.message ||
            data.error ||
            "The server rejected the request."
        );

    }


    return data;

}


/* =========================================================
   RESPONSE HELPERS
========================================================= */

function normalizeResponse(
    response
) {

    if (
        response &&
        typeof response === "object"
    ) {

        return response;

    }


    return {};

}


function extractArray(
    data,
    keys
) {

    for (
        const key of keys
    ) {

        if (
            Array.isArray(
                data?.[key]
            )
        ) {

            return data[key];

        }

    }


    if (
        Array.isArray(data)
    ) {

        return data;

    }


    return [];

}


/* =========================================================
   UI HELPERS
========================================================= */

function setText(
    selector,
    value
) {

    const element =
        $(selector);

    if (element) {

        element.textContent =
            value ?? "";

    }

}


function setValue(
    selector,
    value
) {

    const element =
        $(selector);

    if (element) {

        element.value =
            value ?? "";

    }

}


function setLoading(
    loading
) {

    salesState.loading =
        loading;


    const refresh =
        $("#refreshSalesButton");

    if (refresh) {

        refresh.disabled =
            loading;

    }

}


/* =========================================================
   FORM SUBMIT STATE
========================================================= */

function setFormSubmitting(
    form,
    submitting
) {

    if (!form) {
        return;
    }


    const submit =
        form.querySelector(
            '[type="submit"]'
        );


    if (!submit) {
        return;
    }


    if (!submit.dataset.originalText) {

        submit.dataset.originalText =
            submit.textContent;

    }


    submit.disabled =
        submitting;


    submit.textContent =
        submitting
            ? "Saving..."
            : submit.dataset.originalText;

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = "info"
) {

    const container =
        $("#toastContainer");


    if (!container) {

        window.alert(
            message
        );

        return;

    }


    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        `toast ${type}`;


    toast.innerHTML = `

        <div class="toast-content">
            ${escapeHtml(message)}
        </div>

        <button
            type="button"
            class="toast-close"
            aria-label="Close notification"
        >
            ×
        </button>

    `;


    container.appendChild(
        toast
    );


    const close =
        $(".toast-close", toast);


    close.addEventListener(
        "click",
        () => toast.remove()
    );


    window.setTimeout(
        () => {

            if (
                toast.isConnected
            ) {

                toast.remove();

            }

        },
        5000
    );

}


/* =========================================================
   FORMATTERS
========================================================= */

function formatCurrency(
    amount
) {

    const value =
        Number(amount) || 0;


    try {

        return new Intl.NumberFormat(
            undefined,
            {
                style: "currency",
                currency:
                    SALES_CONFIG.currency
            }
        ).format(value);

    } catch {

        return `$${value.toFixed(2)}`;

    }

}


function formatDate(
    value
) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);

    }


    return new Intl.DateTimeFormat(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "2-digit"
        }
    ).format(date);

}


function toInputDate(
    value
) {

    if (!value) {
        return "";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(
            value
        ).substring(
            0,
            10
        );

    }


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;

}


function capitalize(
    value
) {

    if (!value) {
        return "";
    }


    return value.charAt(0).toUpperCase() +
        value.slice(1);

}


/* =========================================================
   HTML ESCAPING
========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


/* =========================================================
   DEBOUNCE
========================================================= */

function debounce(
    callback,
    delay
) {

    let timer;


    return function (...args) {

        clearTimeout(
            timer
        );


        timer =
            setTimeout(
                () => callback.apply(
                    this,
                    args
                ),
                delay
            );

    };

}


/* =========================================================
   PUBLIC API
========================================================= */

window.InventorySales = {

    state:
        salesState,

    load:
        loadSales,

    refresh:
        loadSales,

    add:
        () => openSaleModal(),

    edit:
        editSale,

    view:
        viewSale,

    remove:
        deleteSale,

    payment:
        openPaymentModal,

    print:
        printSale,

    addItem:
        addSaleItem,

    calculateTotals:
        calculateSaleTotals

};
