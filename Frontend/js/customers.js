/**
 * =========================================================
 * INVENTORY MANAGEMENT SYSTEM
 * CUSTOMER OPERATIONS
 * File: frontend/js/customers.js
 * =========================================================
 *
 * Expected API:
 *
 * GET    ../api/customers/list.php
 * GET    ../api/customers/get.php?id={id}
 * POST   ../api/customers/create.php
 * POST   ../api/customers/update.php
 * POST   ../api/customers/delete.php
 *
 * Expected JSON:
 *
 * {
 *     "success": true,
 *     "data": []
 * }
 *
 * or:
 *
 * {
 *     "success": false,
 *     "message": "Error message"
 * }
 * =========================================================
 */

"use strict";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const CUSTOMERS_CONFIG = {

    api: {
        list: "../api/customers/list.php",
        get: "../api/customers/get.php",
        create: "../api/customers/create.php",
        update: "../api/customers/update.php",
        delete: "../api/customers/delete.php"
    },

    selectors: {

        tableBody: "#customersTableBody",

        search: "#customerSearch",

        statusFilter: "#customerStatusFilter",

        typeFilter: "#customerTypeFilter",

        addButton: "#addCustomerButton",

        refreshButton: "#refreshCustomersButton",

        form: "#customerForm",

        modal: "#customerModal",

        modalTitle: "#customerModalTitle",

        detailsModal: "#customerDetailsModal",

        toastContainer: "#toastContainer",

        previousPage: "#previousPage",

        nextPage: "#nextPage",

        currentPage: "#currentPage",

        totalPages: "#totalPages",

        paginationInfo: "#paginationInfo",

        perPage: "#perPage",

        totalCustomers: "#totalCustomers",

        activeCustomers: "#activeCustomers",

        inactiveCustomers: "#inactiveCustomers",

        totalSales: "#totalCustomerSales",

        totalReceivable: "#totalCustomerReceivable",

        recordCount: "#customerRecordCount"

    },

    pagination: {
        page: 1,
        perPage: 10
    },

    sort: {
        field: "name",
        direction: "asc"
    },

    state: {
        customers: [],
        filteredCustomers: [],
        editingId: null,
        loading: false
    }

};


/* =========================================================
   UTILITY FUNCTIONS
   ========================================================= */

/**
 * Find DOM element.
 */
function customerElement(selector) {

    return document.querySelector(selector);

}


/**
 * Escape HTML.
 */
function escapeCustomerHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/**
 * Convert to number.
 */
function customerNumber(value) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;

}


/**
 * Format currency.
 */
function formatCustomerCurrency(value) {

    return new Intl.NumberFormat(
        undefined,
        {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(
        customerNumber(value)
    );

}


/**
 * Format date.
 */
function formatCustomerDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeCustomerHTML(value);
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    ).format(date);

}


/**
 * Get customer initials.
 */
function getCustomerInitials(name) {

    if (!name) {
        return "?";
    }

    const words =
        String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (words.length === 1) {

        return words[0]
            .substring(0, 2)
            .toUpperCase();

    }

    return (
        words[0][0] +
        words[words.length - 1][0]
    ).toUpperCase();

}


/**
 * Normalize API response.
 */
function normalizeCustomerResponse(response) {

    if (!response) {

        return {
            success: false,
            data: [],
            message: "Empty server response."
        };

    }


    if (Array.isArray(response)) {

        return {
            success: true,
            data: response,
            message: ""
        };

    }


    return {

        success:
            response.success !== false,

        data:
            response.data ??
            response.customers ??
            response.results ??
            [],

        message:
            response.message ??
            ""

    };

}


/**
 * Fetch JSON API.
 */
async function customerFetch(
    url,
    options = {}
) {

    const defaultOptions = {

        credentials: "same-origin",

        headers: {
            "Accept": "application/json"
        }

    };


    const requestOptions = {

        ...defaultOptions,

        ...options,

        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {})
        }

    };


    const response =
        await fetch(
            url,
            requestOptions
        );


    const contentType =
        response.headers.get(
            "content-type"
        ) || "";


    let result;


    if (
        contentType.includes(
            "application/json"
        )
    ) {

        result =
            await response.json();

    } else {

        const text =
            await response.text();

        try {

            result =
                JSON.parse(text);

        } catch {

            result = {

                success: false,

                message:
                    text ||
                    `Server returned HTTP ${response.status}.`

            };

        }

    }


    if (!response.ok) {

        throw new Error(
            result?.message ||
            `Request failed with HTTP ${response.status}.`
        );

    }


    return result;

}


/**
 * Display toast notification.
 */
function showCustomerToast(
    message,
    type = "info"
) {

    const container =
        customerElement(
            CUSTOMERS_CONFIG
                .selectors
                .toastContainer
        );


    if (!container) {
        return;
    }


    const toast =
        document.createElement("div");


    toast.className =
        `toast ${type}`;


    toast.setAttribute(
        "role",
        "status"
    );


    toast.textContent =
        message;


    container.appendChild(
        toast
    );


    window.setTimeout(
        () => {

            toast.style.opacity = "0";

            toast.style.transform =
                "translateY(8px)";

            window.setTimeout(
                () => toast.remove(),
                200
            );

        },
        3500
    );

}


/* =========================================================
   CUSTOMER MODULE
   ========================================================= */

const InventoryCustomers = {


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    async init() {

        this.bindEvents();

        this.updatePerPage();

        await this.load();

    },


    /* =====================================================
       EVENTS
       ===================================================== */

    bindEvents() {

        const addButton =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .addButton
            );


        if (addButton) {

            addButton.addEventListener(
                "click",
                () =>
                    this.openCreateModal()
            );

        }


        const refreshButton =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .refreshButton
            );


        if (refreshButton) {

            refreshButton.addEventListener(
                "click",
                () =>
                    this.refresh()
            );

        }


        const search =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .search
            );


        if (search) {

            search.addEventListener(
                "input",
                () => {

                    CUSTOMERS_CONFIG
                        .pagination
                        .page = 1;

                    this.applyFilters();

                }
            );

        }


        const statusFilter =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .statusFilter
            );


        if (statusFilter) {

            statusFilter.addEventListener(
                "change",
                () => {

                    CUSTOMERS_CONFIG
                        .pagination
                        .page = 1;

                    this.applyFilters();

                }
            );

        }


        const typeFilter =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .typeFilter
            );


        if (typeFilter) {

            typeFilter.addEventListener(
                "change",
                () => {

                    CUSTOMERS_CONFIG
                        .pagination
                        .page = 1;

                    this.applyFilters();

                }
            );

        }


        const perPage =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .perPage
            );


        if (perPage) {

            perPage.addEventListener(
                "change",
                () => {

                    this.updatePerPage();

                    CUSTOMERS_CONFIG
                        .pagination
                        .page = 1;

                    this.render();

                }
            );

        }


        const previous =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .previousPage
            );


        if (previous) {

            previous.addEventListener(
                "click",
                () =>
                    this.previousPage()
            );

        }


        const next =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .nextPage
            );


        if (next) {

            next.addEventListener(
                "click",
                () =>
                    this.nextPage()
            );

        }


        const form =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .form
            );


        if (form) {

            form.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    this.save();

                }
            );

        }


        /*
         * Modal close events.
         */
        document.addEventListener(
            "click",
            event => {

                const closeForm =
                    event.target.closest(
                        "[data-close-customer-modal]"
                    );


                if (closeForm) {

                    this.closeModal();

                    return;

                }


                const closeDetails =
                    event.target.closest(
                        "[data-close-customer-details]"
                    );


                if (closeDetails) {

                    this.closeDetailsModal();

                    return;

                }


                /*
                 * Clicking overlay closes modal.
                 */
                if (
                    event.target.classList
                        .contains("modal-overlay")
                ) {

                    const modal =
                        event.target.closest(
                            ".modal"
                        );


                    if (
                        modal?.id ===
                        "customerModal"
                    ) {

                        this.closeModal();

                    }


                    if (
                        modal?.id ===
                        "customerDetailsModal"
                    ) {

                        this.closeDetailsModal();

                    }

                }

            }
        );


        /*
         * Table actions.
         */
        const tableBody =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .tableBody
            );


        if (tableBody) {

            tableBody.addEventListener(
                "click",
                event => {

                    const button =
                        event.target.closest(
                            "[data-customer-action]"
                        );


                    if (!button) {
                        return;
                    }


                    const action =
                        button.dataset
                            .customerAction;


                    const id =
                        button.dataset
                            .customerId;


                    if (!id) {
                        return;
                    }


                    this.handleAction(
                        action,
                        id
                    );

                }
            );

        }


        /*
         * Sorting.
         */
        document.addEventListener(
            "click",
            event => {

                const header =
                    event.target.closest(
                        "[data-sort-customer]"
                    );


                if (!header) {
                    return;
                }


                const field =
                    header.dataset
                        .sortCustomer;


                this.sortBy(field);

            }
        );


        /*
         * Escape key.
         */
        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !== "Escape"
                ) {
                    return;
                }


                this.closeModal();

                this.closeDetailsModal();

            }
        );

    },


    /* =====================================================
       LOAD
       ===================================================== */

    async load() {

        if (
            this.state.loading
        ) {
            return;
        }


        this.state.loading = true;

        this.showLoading();


        try {

            const response =
                await customerFetch(
                    CUSTOMERS_CONFIG
                        .api
                        .list,
                    {
                        method: "GET"
                    }
                );


            const normalized =
                normalizeCustomerResponse(
                    response
                );


            if (
                !normalized.success
            ) {

                throw new Error(
                    normalized.message ||
                    "Unable to load customers."
                );

            }


            this.state.customers =
                Array.isArray(
                    normalized.data
                )
                    ? normalized.data
                    : [];


            this.applyFilters();

        } catch (error) {

            console.error(
                "Customer loading error:",
                error
            );


            this.state.customers = [];

            this.state.filteredCustomers =
                [];


            this.render();


            showCustomerToast(
                error.message ||
                "Unable to load customers.",
                "error"
            );

        } finally {

            this.state.loading =
                false;

        }

    },


    /**
     * Refresh.
     */
    async refresh() {

        await this.load();


        showCustomerToast(
            "Customer list refreshed.",
            "success"
        );

    },


    /* =====================================================
       FILTERING
       ===================================================== */

    applyFilters() {

        const searchInput =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .search
            );


        const statusInput =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .statusFilter
            );


        const typeInput =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .typeFilter
            );


        const search =
            searchInput?.value
                ?.trim()
                .toLowerCase() ||
            "";


        const status =
            statusInput?.value
                ?.trim()
                .toLowerCase() ||
            "";


        const type =
            typeInput?.value
                ?.trim()
                .toLowerCase() ||
            "";


        this.state.filteredCustomers =
            this.state.customers.filter(
                customer => {

                    const searchable = [

                        customer.id,

                        customer.customer_id,

                        customer.customer_code,

                        customer.name,

                        customer.first_name,

                        customer.last_name,

                        customer.company_name,

                        customer.email,

                        customer.phone,

                        customer.mobile,

                        customer.address,

                        customer.city,

                        customer.country

                    ]
                        .filter(
                            value =>
                                value !== null &&
                                value !== undefined
                        )
                        .join(" ")
                        .toLowerCase();


                    const customerStatus =
                        String(
                            customer.status ??
                            "active"
                        ).toLowerCase();


                    const customerType =
                        String(
                            customer.customer_type ??
                            customer.type ??
                            "individual"
                        ).toLowerCase();


                    const matchesSearch =
                        !search ||
                        searchable.includes(
                            search
                        );


                    const matchesStatus =
                        !status ||
                        customerStatus ===
                        status;


                    const matchesType =
                        !type ||
                        customerType ===
                        type;


                    return (
                        matchesSearch &&
                        matchesStatus &&
                        matchesType
                    );

                }
            );


        this.render();

    },


    /* =====================================================
       SORTING
       ===================================================== */

    sortBy(field) {

        if (
            CUSTOMERS_CONFIG.sort.field ===
            field
        ) {

            CUSTOMERS_CONFIG.sort.direction =
                CUSTOMERS_CONFIG
                    .sort
                    .direction === "asc"
                    ? "desc"
                    : "asc";

        } else {

            CUSTOMERS_CONFIG.sort.field =
                field;

            CUSTOMERS_CONFIG.sort.direction =
                "asc";

        }


        const direction =
            CUSTOMERS_CONFIG
                .sort
                .direction;


        this.state.filteredCustomers.sort(
            (a, b) => {

                let first =
                    a[field];

                let second =
                    b[field];


                if (
                    first === null ||
                    first === undefined
                ) {
                    first = "";
                }


                if (
                    second === null ||
                    second === undefined
                ) {
                    second = "";
                }


                if (
                    typeof first ===
                        "number" ||
                    typeof second ===
                        "number"
                ) {

                    first =
                        customerNumber(
                            first
                        );

                    second =
                        customerNumber(
                            second
                        );

                } else {

                    first =
                        String(first)
                            .toLowerCase();

                    second =
                        String(second)
                            .toLowerCase();

                }


                if (first < second) {

                    return direction ===
                        "asc"
                        ? -1
                        : 1;

                }


                if (first > second) {

                    return direction ===
                        "asc"
                        ? 1
                        : -1;

                }


                return 0;

            }
        );


        this.updateSortIndicators();

        this.render();

    },


    /**
     * Update sort indicators.
     */
    updateSortIndicators() {

        document
            .querySelectorAll(
                "[data-sort-customer]"
            )
            .forEach(header => {

                header.classList.remove(
                    "sort-asc",
                    "sort-desc"
                );


                if (
                    header.dataset
                        .sortCustomer ===
                    CUSTOMERS_CONFIG
                        .sort
                        .field
                ) {

                    header.classList.add(
                        CUSTOMERS_CONFIG
                            .sort
                            .direction ===
                            "asc"
                            ? "sort-asc"
                            : "sort-desc"
                    );

                }

            });

    },


    /* =====================================================
       RENDERING
       ===================================================== */

    render() {

        const tableBody =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .tableBody
            );


        if (!tableBody) {
            return;
        }


        const customers =
            this.getCurrentPageItems();


        if (!customers.length) {

            tableBody.innerHTML = `

                <tr>

                    <td
                        colspan="8"
                        class="table-empty"
                    >

                        <span
                            class="table-empty-icon"
                        >
                            👥
                        </span>

                        <span
                            class="table-empty-title"
                        >
                            No customers found
                        </span>

                        <span
                            class="table-empty-message"
                        >
                            Try changing your search
                            or filters, or add a new customer.
                        </span>

                    </td>

                </tr>

            `;


            this.updatePagination();

            this.updateStatistics();

            return;

        }


        tableBody.innerHTML =
            customers
                .map(
                    customer =>
                        this.renderRow(
                            customer
                        )
                )
                .join("");


        this.updatePagination();

        this.updateStatistics();

        this.updateSortIndicators();

    },


    /**
     * Render customer table row.
     */
    renderRow(customer) {

        const id =
            customer.id ??
            customer.customer_id ??
            "";


        const name =
            customer.name ??
            [
                customer.first_name,
                customer.last_name
            ]
                .filter(Boolean)
                .join(" ") ||
            customer.company_name ||
            "Unnamed Customer";


        const customerCode =
            customer.customer_code ??
            "";


        const email =
            customer.email ??
            "—";


        const phone =
            customer.phone ??
            customer.mobile ??
            "—";


        const type =
            String(
                customer.customer_type ??
                customer.type ??
                "individual"
            ).toLowerCase();


        const status =
            String(
                customer.status ??
                "active"
            ).toLowerCase();


        const totalSales =
            customer.total_sales ??
            customer.sales_total ??
            0;


        const receivable =
            customer.total_receivable ??
            customer.receivable ??
            customer.balance_due ??
            0;


        const initials =
            getCustomerInitials(
                name
            );


        const statusLabel =
            status.charAt(0).toUpperCase() +
            status.slice(1);


        const typeLabel =
            type.charAt(0).toUpperCase() +
            type.slice(1);


        return `

            <tr
                data-customer-id="${escapeCustomerHTML(id)}"
            >

                <td>

                    <div class="customer-info">

                        <div class="customer-avatar">
                            ${escapeCustomerHTML(initials)}
                        </div>

                        <div
                            class="customer-name-wrapper"
                        >

                            <span
                                class="customer-name"
                            >
                                ${escapeCustomerHTML(name)}
                            </span>

                            ${
                                customerCode
                                    ? `
                                        <small
                                            class="customer-code"
                                        >
                                            ${escapeCustomerHTML(
                                                customerCode
                                            )}
                                        </small>
                                    `
                                    : ""
                            }

                        </div>

                    </div>

                </td>


                <td>

                    <span
                        class="customer-type-badge ${escapeCustomerHTML(type)}"
                    >
                        ${escapeCustomerHTML(typeLabel)}
                    </span>

                </td>


                <td>

                    <div
                        class="customer-contact"
                    >

                        <span>
                            ${escapeCustomerHTML(email)}
                        </span>

                        <span>
                            ${escapeCustomerHTML(phone)}
                        </span>

                    </div>

                </td>


                <td>

                    <span class="amount">
                        ${formatCustomerCurrency(totalSales)}
                    </span>

                </td>


                <td>

                    <span
                        class="amount-receivable ${
                            customerNumber(receivable) <= 0
                                ? "zero"
                                : ""
                        }"
                    >
                        ${formatCustomerCurrency(receivable)}
                    </span>

                </td>


                <td>

                    <span
                        class="status-badge ${escapeCustomerHTML(status)}"
                    >
                        ${escapeCustomerHTML(statusLabel)}
                    </span>

                </td>


                <td>

                    ${
                        customer.updated_at
                            ? formatCustomerDate(
                                customer.updated_at
                            )
                            : "—"
                    }

                </td>


                <td>

                    <div
                        class="customer-actions"
                    >

                        <button
                            type="button"
                            class="table-action view"
                            data-customer-action="view"
                            data-customer-id="${escapeCustomerHTML(id)}"
                            title="View customer"
                            aria-label="View customer"
                        >
                            👁
                        </button>


                        <button
                            type="button"
                            class="table-action edit"
                            data-customer-action="edit"
                            data-customer-id="${escapeCustomerHTML(id)}"
                            title="Edit customer"
                            aria-label="Edit customer"
                        >
                            ✏
                        </button>


                        <button
                            type="button"
                            class="table-action delete"
                            data-customer-action="delete"
                            data-customer-id="${escapeCustomerHTML(id)}"
                            title="Delete customer"
                            aria-label="Delete customer"
                        >
                            🗑
                        </button>

                    </div>

                </td>

            </tr>

        `;

    },


    /* =====================================================
       PAGINATION
       ===================================================== */

    getCurrentPageItems() {

        const {
            page,
            perPage
        } = CUSTOMERS_CONFIG.pagination;


        const start =
            (page - 1) *
            perPage;


        return this.state
            .filteredCustomers
            .slice(
                start,
                start + perPage
            );

    },


    updatePagination() {

        const total =
            this.state
                .filteredCustomers
                .length;


        const perPage =
            CUSTOMERS_CONFIG
                .pagination
                .perPage;


        const totalPages =
            Math.max(
                1,
                Math.ceil(
                    total / perPage
                )
            );


        if (
            CUSTOMERS_CONFIG
                .pagination
                .page >
            totalPages
        ) {

            CUSTOMERS_CONFIG
                .pagination
                .page =
                totalPages;

        }


        const page =
            CUSTOMERS_CONFIG
                .pagination
                .page;


        const start =
            total === 0
                ? 0
                : (page - 1) *
                    perPage +
                  1;


        const end =
            Math.min(
                page * perPage,
                total
            );


        this.setText(
            CUSTOMERS_CONFIG
                .selectors
                .paginationInfo,
            total === 0
                ? "No customers found"
                : `Showing ${start}-${end} of ${total} customers`
        );


        this.setText(
            CUSTOMERS_CONFIG
                .selectors
                .currentPage,
            page
        );


        this.setText(
            CUSTOMERS_CONFIG
                .selectors
                .totalPages,
            totalPages
        );


        const previous =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .previousPage
            );


        if (previous) {

            previous.disabled =
                page <= 1;

        }


        const next =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .nextPage
            );


        if (next) {

            next.disabled =
                page >= totalPages;

        }

    },


    previousPage() {

        if (
            CUSTOMERS_CONFIG
                .pagination
                .page <= 1
        ) {
            return;
        }


        CUSTOMERS_CONFIG
            .pagination
            .page--;


        this.render();

    },


    nextPage() {

        const totalPages =
            Math.max(
                1,
                Math.ceil(
                    this.state
                        .filteredCustomers
                        .length /
                    CUSTOMERS_CONFIG
                        .pagination
                        .perPage
                )
            );


        if (
            CUSTOMERS_CONFIG
                .pagination
                .page >=
            totalPages
        ) {
            return;
        }


        CUSTOMERS_CONFIG
            .pagination
            .page++;


        this.render();

    },


    updatePerPage() {

        const select =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .perPage
            );


        if (!select) {
            return;
        }


        const value =
            parseInt(
                select.value,
                10
            );


        if (
            Number.isFinite(value) &&
            value > 0
        ) {

            CUSTOMERS_CONFIG
                .pagination
                .perPage =
                value;

        }

    },


    /* =====================================================
       STATISTICS
       ===================================================== */

    updateStatistics() {

        const customers =
            this.state.customers;


        const total =
            customers.length;


        const active =
            customers.filter(
                customer =>
                    String(
                        customer.status ??
                        "active"
                    ).toLowerCase() ===
                    "active"
            ).length;


        const inactive =
            customers.filter(
                customer =>
                    String(
                        customer.status ??
                        ""
                    ).toLowerCase() !==
                    "active"
            ).length;


        const totalSales =
            customers.reduce(
                (sum, customer) =>
                    sum +
                    customerNumber(
                        customer.total_sales ??
                        customer.sales_total
                    ),
                0
            );


        const totalReceivable =
            customers.reduce(
                (sum, customer) =>
                    sum +
                    customerNumber(
                        customer.total_receivable ??
                        customer.receivable ??
                        customer.balance_due
                    ),
                0
            );


        this.setText(
            CUSTOMERS_CONFIG
                .selectors
                .totalCustomers,
            total
        );


        this.setText(
            CUSTOMERS_CONFIG
                .selectors
                .activeCustomers,
            active
        );


        this.setText(
            CUSTOMERS_CONFIG
                .selectors
                .inactiveCustomers,
            inactive
        );


        this.setText(
            CUSTOMERS_CONFIG
                .selectors
                .totalSales,
            formatCustomerCurrency(
                totalSales
            )
        );


        this.setText(
            CUSTOMERS_CONFIG
                .selectors
                .totalReceivable,
            formatCustomerCurrency(
                totalReceivable
            )
        );


        this.setText(
            CUSTOMERS_CONFIG
                .selectors
                .recordCount,
            total
        );

    },


    setText(
        selector,
        value
    ) {

        const element =
            customerElement(
                selector
            );


        if (element) {

            element.textContent =
                value;

        }

    },


    /* =====================================================
       CREATE CUSTOMER
       ===================================================== */

    openCreateModal() {

        CUSTOMERS_CONFIG
            .state
            .editingId = null;


        const form =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .form
            );


        if (form) {

            form.reset();

        }


        this.setText(
            CUSTOMERS_CONFIG
                .selectors
                .modalTitle,
            "Add Customer"
        );


        const status =
            document.getElementById(
                "customerStatus"
            );


        if (status) {

            status.value =
                "active";

        }


        const type =
            document.getElementById(
                "customerType"
            );


        if (type) {

            type.value =
                "individual";

        }


        this.openModal();

    },


    /* =====================================================
       EDIT CUSTOMER
       ===================================================== */

    async openEditModal(id) {

        try {

            const customer =
                await this.getById(id);


            if (!customer) {

                throw new Error(
                    "Customer was not found."
                );

            }


            CUSTOMERS_CONFIG
                .state
                .editingId = id;


            this.fillForm(
                customer
            );


            this.setText(
                CUSTOMERS_CONFIG
                    .selectors
                    .modalTitle,
                "Edit Customer"
            );


            this.openModal();

        } catch (error) {

            console.error(
                "Customer edit error:",
                error
            );


            showCustomerToast(
                error.message ||
                "Unable to load customer.",
                "error"
            );

        }

    },


    /**
     * Fill customer form.
     */
    fillForm(customer) {

        const form =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .form
            );


        if (!form) {
            return;
        }


        const fields = [

            "customer_id",

            "customer_code",

            "name",

            "first_name",

            "last_name",

            "company_name",

            "customer_type",

            "type",

            "email",

            "phone",

            "mobile",

            "address",

            "city",

            "state",

            "postal_code",

            "country",

            "tax_number",

            "credit_limit",

            "payment_terms",

            "status",

            "notes"

        ];


        fields.forEach(
            fieldName => {

                const field =
                    form.elements[
                        fieldName
                    ];


                if (!field) {
                    return;
                }


                field.value =
                    customer[fieldName] ??
                    "";

            }
        );

    },


    /* =====================================================
       SAVE CUSTOMER
       ===================================================== */

    async save() {

        const form =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .form
            );


        if (!form) {
            return;
        }


        if (
            !form.checkValidity()
        ) {

            form.reportValidity();

            return;

        }


        const formData =
            new FormData(form);


        const payload =
            Object.fromEntries(
                formData.entries()
            );


        if (
            CUSTOMERS_CONFIG
                .state
                .editingId
        ) {

            payload.id =
                CUSTOMERS_CONFIG
                    .state
                    .editingId;

        }


        const isEditing =
            Boolean(
                CUSTOMERS_CONFIG
                    .state
                    .editingId
            );


        const url =
            isEditing
                ? CUSTOMERS_CONFIG
                    .api
                    .update
                : CUSTOMERS_CONFIG
                    .api
                    .create;


        const submitButton =
            form.querySelector(
                '[type="submit"]'
            );


        if (submitButton) {

            submitButton.disabled =
                true;


            submitButton
                .dataset
                .originalText =
                submitButton.textContent;


            submitButton.textContent =
                "Saving...";

        }


        try {

            const response =
                await customerFetch(
                    url,
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                payload
                            )

                    }
                );


            const normalized =
                normalizeCustomerResponse(
                    response
                );


            if (
                !normalized.success
            ) {

                throw new Error(
                    normalized.message ||
                    "Unable to save customer."
                );

            }


            this.closeModal();


            showCustomerToast(
                isEditing
                    ? "Customer updated successfully."
                    : "Customer created successfully.",
                "success"
            );


            await this.load();

        } catch (error) {

            console.error(
                "Customer save error:",
                error
            );


            showCustomerToast(
                error.message ||
                "Unable to save customer.",
                "error"
            );

        } finally {

            if (submitButton) {

                submitButton.disabled =
                    false;


                submitButton.textContent =
                    submitButton
                        .dataset
                        .originalText ||
                    "Save Customer";

            }

        }

    },


    /* =====================================================
       GET CUSTOMER
       ===================================================== */

    async getById(id) {

        const url =
            new URL(
                CUSTOMERS_CONFIG
                    .api
                    .get,
                window.location.href
            );


        url.searchParams.set(
            "id",
            id
        );


        const response =
            await customerFetch(
                url.toString(),
                {
                    method: "GET"
                }
            );


        const normalized =
            normalizeCustomerResponse(
                response
            );


        if (
            !normalized.success
        ) {

            throw new Error(
                normalized.message ||
                "Unable to retrieve customer."
            );

        }


        if (
            normalized.data &&
            !Array.isArray(
                normalized.data
            )
        ) {

            return normalized.data;

        }


        if (
            Array.isArray(
                normalized.data
            )
        ) {

            return (
                normalized.data[0] ||
                null
            );

        }


        return null;

    },


    /* =====================================================
       VIEW CUSTOMER
       ===================================================== */

    async openDetails(id) {

        try {

            const customer =
                await this.getById(id);


            if (!customer) {

                throw new Error(
                    "Customer was not found."
                );

            }


            this.renderDetails(
                customer
            );


            this.openDetailsModal();

        } catch (error) {

            console.error(
                "Customer details error:",
                error
            );


            showCustomerToast(
                error.message ||
                "Unable to load customer details.",
                "error"
            );

        }

    },


    /**
     * Render customer details.
     */
    renderDetails(customer) {

        const name =
            customer.name ??
            [
                customer.first_name,
                customer.last_name
            ]
                .filter(Boolean)
                .join(" ") ||
            customer.company_name ||
            "Customer";


        const type =
            String(
                customer.customer_type ??
                customer.type ??
                "individual"
            );


        const status =
            String(
                customer.status ??
                "active"
            ).toLowerCase();


        const values = {

            "#customerDetailsName":
                name,

            "#customerDetailsCode":
                customer.customer_code ??
                "—",

            "#customerDetailsType":
                type,

            "#customerDetailsEmail":
                customer.email ??
                "—",

            "#customerDetailsPhone":
                customer.phone ??
                customer.mobile ??
                "—",

            "#customerDetailsAddress":
                customer.address ??
                "—",

            "#customerDetailsCity":
                customer.city ??
                "—",

            "#customerDetailsState":
                customer.state ??
                "—",

            "#customerDetailsCountry":
                customer.country ??
                "—",

            "#customerDetailsTaxNumber":
                customer.tax_number ??
                "—",

            "#customerDetailsPaymentTerms":
                customer.payment_terms ??
                "—",

            "#customerDetailsCreditLimit":
                formatCustomerCurrency(
                    customer.credit_limit
                ),

            "#customerDetailsSales":
                formatCustomerCurrency(
                    customer.total_sales ??
                    customer.sales_total
                ),

            "#customerDetailsReceivable":
                formatCustomerCurrency(
                    customer.total_receivable ??
                    customer.receivable ??
                    customer.balance_due
                ),

            "#customerDetailsNotes":
                customer.notes ??
                "No notes available."

        };


        Object.entries(values)
            .forEach(
                ([selector, value]) => {

                    this.setText(
                        selector,
                        value
                    );

                }
            );


        const statusElement =
            customerElement(
                "#customerDetailsStatus"
            );


        if (statusElement) {

            statusElement.textContent =
                status
                    .charAt(0)
                    .toUpperCase() +
                status.slice(1);


            statusElement.className =
                `status-badge ${escapeCustomerHTML(status)}`;

        }


        const avatar =
            customerElement(
                "#customerDetailsAvatar"
            );


        if (avatar) {

            avatar.textContent =
                getCustomerInitials(
                    name
                );

        }

    },


    /* =====================================================
       DELETE
       ===================================================== */

    async delete(id) {

        const customer =
            this.state.customers.find(
                item =>
                    String(
                        item.id ??
                        item.customer_id
                    ) === String(id)
            );


        const name =
            customer?.name ??
            customer?.company_name ??
            "this customer";


        const confirmed =
            window.confirm(
                `Are you sure you want to delete ${name}?`
            );


        if (!confirmed) {
            return;
        }


        try {

            const response =
                await customerFetch(
                    CUSTOMERS_CONFIG
                        .api
                        .delete,
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                id: id
                            })

                    }
                );


            const normalized =
                normalizeCustomerResponse(
                    response
                );


            if (
                !normalized.success
            ) {

                throw new Error(
                    normalized.message ||
                    "Unable to delete customer."
                );

            }


            showCustomerToast(
                "Customer deleted successfully.",
                "success"
            );


            await this.load();

        } catch (error) {

            console.error(
                "Customer deletion error:",
                error
            );


            showCustomerToast(
                error.message ||
                "Unable to delete customer.",
                "error"
            );

        }

    },


    /* =====================================================
       ACTION HANDLER
       ===================================================== */

    handleAction(
        action,
        id
    ) {

        switch (action) {

            case "view":

                this.openDetails(id);

                break;


            case "edit":

                this.openEditModal(id);

                break;


            case "delete":

                this.delete(id);

                break;


            default:

                console.warn(
                    `Unknown customer action: ${action}`
                );

        }

    },


    /* =====================================================
       MODALS
       ===================================================== */

    openModal() {

        const modal =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .modal
            );


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


        const firstInput =
            modal.querySelector(
                "input:not([type='hidden']), select, textarea"
            );


        if (firstInput) {

            window.setTimeout(
                () =>
                    firstInput.focus(),
                100
            );

        }

    },


    closeModal() {

        const modal =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .modal
            );


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


        document.body.classList.remove(
            "modal-open"
        );

    },


    openDetailsModal() {

        const modal =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .detailsModal
            );


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

    },


    closeDetailsModal() {

        const modal =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .detailsModal
            );


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


        document.body.classList.remove(
            "modal-open"
        );

    },


    /* =====================================================
       LOADING STATE
       ===================================================== */

    showLoading() {

        const tableBody =
            customerElement(
                CUSTOMERS_CONFIG
                    .selectors
                    .tableBody
            );


        if (!tableBody) {
            return;
        }


        tableBody.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="table-loading"
                >
                    Loading customers...
                </td>

            </tr>

        `;

    }

};


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.InventoryCustomers =
    InventoryCustomers;


/* =========================================================
   AUTO INITIALIZATION
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () =>
            InventoryCustomers.init()
    );

} else {

    InventoryCustomers.init();

}
