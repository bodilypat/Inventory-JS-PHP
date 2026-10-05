/**
 * =========================================================
 * INVENTORY MANAGEMENT SYSTEM
 * SUPPLIERS OPERATIONS
 * File: frontend/js/suppliers.js
 * ========================================================= *
 *
 * Expected API:
 *
 * GET    ../api/suppliers/list.php
 * GET    ../api/suppliers/get.php?id={id}
 * POST   ../api/suppliers/create.php
 * POST   ../api/suppliers/update.php
 * POST   ../api/suppliers/delete.php
 *
 * Optional:
 * GET    ../api/suppliers/search.php?q={query}
 *
 * Expected JSON response examples:
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

const SUPPLIERS_CONFIG = {

    api: {
        list: "../api/suppliers/list.php",
        get: "../api/suppliers/get.php",
        create: "../api/suppliers/create.php",
        update: "../api/suppliers/update.php",
        delete: "../api/suppliers/delete.php"
    },

    selectors: {
        tableBody: "#suppliersTableBody",

        search: "#supplierSearch",

        statusFilter: "#supplierStatusFilter",

        addButton: "#addSupplierButton",

        refreshButton: "#refreshSuppliersButton",

        form: "#supplierForm",

        modal: "#supplierModal",

        modalTitle: "#supplierModalTitle",

        detailsModal: "#supplierDetailsModal",

        toastContainer: "#toastContainer",

        previousPage: "#previousPage",

        nextPage: "#nextPage",

        currentPage: "#currentPage",

        totalPages: "#totalPages",

        paginationInfo: "#paginationInfo",

        perPage: "#perPage",

        totalSuppliers: "#totalSuppliers",

        activeSuppliers: "#activeSuppliers",

        inactiveSuppliers: "#inactiveSuppliers",

        totalPurchases: "#totalSupplierPurchases",

        totalPayable: "#totalSupplierPayable"
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
        suppliers: [],
        filteredSuppliers: [],
        editingId: null,
        loading: false
    }

};


/* =========================================================
   UTILITY FUNCTIONS
   ========================================================= */

/**
 * Get DOM element.
 */
function supplierElement(selector) {
    return document.querySelector(selector);
}


/**
 * Escape HTML to prevent XSS.
 */
function escapeSupplierHTML(value) {

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
 * Convert value to number.
 */
function supplierNumber(value) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;

}


/**
 * Format currency.
 */
function formatSupplierCurrency(value) {

    const amount = supplierNumber(value);

    return new Intl.NumberFormat(
        undefined,
        {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(amount);

}


/**
 * Format date.
 */
function formatSupplierDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeSupplierHTML(value);
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
 * Get initials from supplier name.
 */
function getSupplierInitials(name) {

    if (!name) {
        return "?";
    }

    const words = String(name)
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
function normalizeSupplierResponse(response) {

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
            data: response
        };

    }

    return {
        success: response.success !== false,
        data:
            response.data ??
            response.suppliers ??
            response.results ??
            [],
        message:
            response.message ??
            ""
    };

}


/**
 * Get JSON response.
 */
async function supplierFetch(
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

    const response = await fetch(
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

        result = await response.json();

    } else {

        const text = await response.text();

        try {

            result = JSON.parse(text);

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
 * Display toast.
 */
function showSupplierToast(
    message,
    type = "info"
) {

    const container =
        supplierElement(
            SUPPLIERS_CONFIG
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

    toast.textContent = message;

    container.appendChild(toast);

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
   SUPPLIER OPERATIONS
   ========================================================= */

const InventorySuppliers = {

    /**
     * Initialize supplier module.
     */
    async init() {

        this.bindEvents();

        this.updatePerPage();

        await this.load();

    },


    /**
     * Bind page events.
     */
    bindEvents() {

        const addButton =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .addButton
            );

        if (addButton) {

            addButton.addEventListener(
                "click",
                () => this.openCreateModal()
            );

        }


        const refreshButton =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .refreshButton
            );

        if (refreshButton) {

            refreshButton.addEventListener(
                "click",
                () => this.refresh()
            );

        }


        const search =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .search
            );

        if (search) {

            search.addEventListener(
                "input",
                () => {

                    SUPPLIERS_CONFIG.pagination.page = 1;

                    this.applyFilters();

                }
            );

        }


        const statusFilter =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .statusFilter
            );

        if (statusFilter) {

            statusFilter.addEventListener(
                "change",
                () => {

                    SUPPLIERS_CONFIG.pagination.page = 1;

                    this.applyFilters();

                }
            );

        }


        const perPage =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .perPage
            );

        if (perPage) {

            perPage.addEventListener(
                "change",
                () => {

                    this.updatePerPage();

                    SUPPLIERS_CONFIG
                        .pagination
                        .page = 1;

                    this.render();

                }
            );

        }


        const previous =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .previousPage
            );

        if (previous) {

            previous.addEventListener(
                "click",
                () => this.previousPage()
            );

        }


        const next =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .nextPage
            );

        if (next) {

            next.addEventListener(
                "click",
                () => this.nextPage()
            );

        }


        const form =
            supplierElement(
                SUPPLIERS_CONFIG
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
         * Close supplier modal.
         */
        document.addEventListener(
            "click",
            event => {

                const closeButton =
                    event.target.closest(
                        "[data-close-supplier-modal]"
                    );

                if (closeButton) {

                    this.closeModal();

                }


                const detailsClose =
                    event.target.closest(
                        "[data-close-supplier-details]"
                    );

                if (detailsClose) {

                    this.closeDetailsModal();

                }


                if (
                    event.target.classList.contains(
                        "modal-overlay"
                    )
                ) {

                    const modal =
                        event.target.closest(
                            ".modal"
                        );

                    if (
                        modal?.id ===
                        "supplierModal"
                    ) {

                        this.closeModal();

                    }

                    if (
                        modal?.id ===
                        "supplierDetailsModal"
                    ) {

                        this.closeDetailsModal();

                    }

                }

            }
        );


        /*
         * Table action delegation.
         */
        const tableBody =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .tableBody
            );

        if (tableBody) {

            tableBody.addEventListener(
                "click",
                event => {

                    const button =
                        event.target.closest(
                            "[data-supplier-action]"
                        );

                    if (!button) {
                        return;
                    }

                    const action =
                        button.dataset
                            .supplierAction;

                    const id =
                        button.dataset
                            .supplierId;

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
         * Table sorting.
         */
        document.addEventListener(
            "click",
            event => {

                const header =
                    event.target.closest(
                        "[data-sort-supplier]"
                    );

                if (!header) {
                    return;
                }

                const field =
                    header.dataset
                        .sortSupplier;

                this.sortBy(field);

            }
        );


        /*
         * Escape closes modals.
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


    /**
     * Load suppliers from PHP API.
     */
    async load() {

        if (this.state.loading) {
            return;
        }

        this.state.loading = true;

        this.showLoading();

        try {

            const response =
                await supplierFetch(
                    SUPPLIERS_CONFIG.api.list,
                    {
                        method: "GET"
                    }
                );

            const normalized =
                normalizeSupplierResponse(
                    response
                );

            if (!normalized.success) {

                throw new Error(
                    normalized.message ||
                    "Unable to load suppliers."
                );

            }

            this.state.suppliers =
                Array.isArray(
                    normalized.data
                )
                    ? normalized.data
                    : [];

            this.applyFilters();

        } catch (error) {

            console.error(
                "Supplier loading error:",
                error
            );

            this.state.suppliers = [];
            this.state.filteredSuppliers = [];

            this.render();

            showSupplierToast(
                error.message ||
                "Unable to load suppliers.",
                "error"
            );

        } finally {

            this.state.loading = false;

        }

    },


    /**
     * Refresh suppliers.
     */
    async refresh() {

        await this.load();

        showSupplierToast(
            "Supplier list refreshed.",
            "success"
        );

    },


    /**
     * Apply search and status filters.
     */
    applyFilters() {

        const searchInput =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .search
            );

        const statusInput =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .statusFilter
            );

        const search =
            searchInput?.value
                ?.trim()
                .toLowerCase() || "";

        const status =
            statusInput?.value
                ?.trim()
                .toLowerCase() || "";


        this.state.filteredSuppliers =
            this.state.suppliers.filter(
                supplier => {

                    const searchable = [
                        supplier.id,
                        supplier.name,
                        supplier.company_name,
                        supplier.email,
                        supplier.phone,
                        supplier.contact_person,
                        supplier.address,
                        supplier.city,
                        supplier.country
                    ]
                        .filter(
                            value =>
                                value !==
                                null &&
                                value !==
                                undefined
                        )
                        .join(" ")
                        .toLowerCase();


                    const matchesSearch =
                        !search ||
                        searchable.includes(
                            search
                        );


                    const supplierStatus =
                        String(
                            supplier.status ??
                            "active"
                        ).toLowerCase();


                    const matchesStatus =
                        !status ||
                        supplierStatus ===
                        status;


                    return (
                        matchesSearch &&
                        matchesStatus
                    );

                }
            );


        this.render();

    },


    /**
     * Sort suppliers.
     */
    sortBy(field) {

        if (
            SUPPLIERS_CONFIG.sort.field ===
            field
        ) {

            SUPPLIERS_CONFIG.sort.direction =
                SUPPLIERS_CONFIG.sort.direction ===
                "asc"
                    ? "desc"
                    : "asc";

        } else {

            SUPPLIERS_CONFIG.sort.field =
                field;

            SUPPLIERS_CONFIG.sort.direction =
                "asc";

        }


        const direction =
            SUPPLIERS_CONFIG.sort.direction;


        this.state.filteredSuppliers.sort(
            (a, b) => {

                let first = a[field];
                let second = b[field];


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
                        supplierNumber(
                            first
                        );

                    second =
                        supplierNumber(
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
                    return direction === "asc"
                        ? -1
                        : 1;
                }

                if (first > second) {
                    return direction === "asc"
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
     * Update table sort indicators.
     */
    updateSortIndicators() {

        document
            .querySelectorAll(
                "[data-sort-supplier]"
            )
            .forEach(header => {

                header.classList.remove(
                    "sort-asc",
                    "sort-desc"
                );

                if (
                    header.dataset
                        .sortSupplier ===
                    SUPPLIERS_CONFIG.sort.field
                ) {

                    header.classList.add(
                        SUPPLIERS_CONFIG
                            .sort
                            .direction ===
                            "asc"
                            ? "sort-asc"
                            : "sort-desc"
                    );

                }

            });

    },


    /**
     * Render supplier table.
     */
    render() {

        const tableBody =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .tableBody
            );

        if (!tableBody) {
            return;
        }


        const suppliers =
            this.getCurrentPageItems();


        if (!suppliers.length) {

            tableBody.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="table-empty"
                    >
                        <span class="table-empty-icon">
                            🏢
                        </span>

                        <span class="table-empty-title">
                            No suppliers found
                        </span>

                        <span class="table-empty-message">
                            Try changing your search or filters,
                            or add a new supplier.
                        </span>
                    </td>
                </tr>
            `;

            this.updatePagination();

            this.updateStatistics();

            return;

        }


        tableBody.innerHTML =
            suppliers
                .map(
                    supplier =>
                        this.renderRow(
                            supplier
                        )
                )
                .join("");


        this.updatePagination();

        this.updateStatistics();

        this.updateSortIndicators();

    },


    /**
     * Render one supplier row.
     */
    renderRow(supplier) {

        const id =
            supplier.id ??
            supplier.supplier_id ??
            "";


        const name =
            supplier.name ??
            supplier.company_name ??
            "Unnamed Supplier";


        const contactPerson =
            supplier.contact_person ??
            supplier.contact_name ??
            "—";


        const email =
            supplier.email ??
            "—";


        const phone =
            supplier.phone ??
            supplier.mobile ??
            "—";


        const status =
            String(
                supplier.status ??
                "active"
            ).toLowerCase();


        const purchases =
            supplier.total_purchases ??
            supplier.purchase_total ??
            0;


        const payable =
            supplier.total_payable ??
            supplier.payable ??
            supplier.balance_due ??
            0;


        const initials =
            getSupplierInitials(name);


        const statusLabel =
            status.charAt(0).toUpperCase() +
            status.slice(1);


        return `
            <tr data-supplier-id="${escapeSupplierHTML(id)}">

                <td>
                    <div class="supplier-info">

                        <div class="supplier-avatar">
                            ${escapeSupplierHTML(initials)}
                        </div>

                        <div class="supplier-name-wrapper">

                            <span class="supplier-name">
                                ${escapeSupplierHTML(name)}
                            </span>

                            ${
                                supplier.supplier_code
                                    ? `
                                        <small class="supplier-code">
                                            ${escapeSupplierHTML(
                                                supplier.supplier_code
                                            )}
                                        </small>
                                      `
                                    : ""
                            }

                        </div>

                    </div>
                </td>


                <td>
                    ${escapeSupplierHTML(contactPerson)}
                </td>


                <td>
                    <div class="supplier-contact">

                        <span>
                            ${escapeSupplierHTML(email)}
                        </span>

                        <span>
                            ${escapeSupplierHTML(phone)}
                        </span>

                    </div>
                </td>


                <td>
                    <span class="amount">
                        ${formatSupplierCurrency(purchases)}
                    </span>
                </td>


                <td>
                    <span
                        class="amount-due ${
                            supplierNumber(payable) <= 0
                                ? "zero"
                                : ""
                        }"
                    >
                        ${formatSupplierCurrency(payable)}
                    </span>
                </td>


                <td>
                    <span
                        class="status-badge ${escapeSupplierHTML(status)}"
                    >
                        ${escapeSupplierHTML(statusLabel)}
                    </span>
                </td>


                <td>
                    ${
                        supplier.updated_at
                            ? formatSupplierDate(
                                supplier.updated_at
                            )
                            : "—"
                    }
                </td>


                <td>

                    <div class="supplier-actions">

                        <button
                            type="button"
                            class="table-action view"
                            data-supplier-action="view"
                            data-supplier-id="${escapeSupplierHTML(id)}"
                            title="View supplier"
                            aria-label="View supplier"
                        >
                            👁
                        </button>


                        <button
                            type="button"
                            class="table-action edit"
                            data-supplier-action="edit"
                            data-supplier-id="${escapeSupplierHTML(id)}"
                            title="Edit supplier"
                            aria-label="Edit supplier"
                        >
                            ✏
                        </button>


                        <button
                            type="button"
                            class="table-action delete"
                            data-supplier-action="delete"
                            data-supplier-id="${escapeSupplierHTML(id)}"
                            title="Delete supplier"
                            aria-label="Delete supplier"
                        >
                            🗑
                        </button>

                    </div>

                </td>

            </tr>
        `;

    },


    /**
     * Return current page items.
     */
    getCurrentPageItems() {

        const {
            page,
            perPage
        } = SUPPLIERS_CONFIG.pagination;


        const start =
            (page - 1) * perPage;


        return this.state.filteredSuppliers
            .slice(
                start,
                start + perPage
            );

    },


    /**
     * Update pagination.
     */
    updatePagination() {

        const total =
            this.state.filteredSuppliers.length;


        const perPage =
            SUPPLIERS_CONFIG
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
            SUPPLIERS_CONFIG
                .pagination
                .page > totalPages
        ) {

            SUPPLIERS_CONFIG
                .pagination
                .page =
                totalPages;

        }


        const page =
            SUPPLIERS_CONFIG
                .pagination
                .page;


        const start =
            total === 0
                ? 0
                : (page - 1) * perPage + 1;


        const end =
            Math.min(
                page * perPage,
                total
            );


        const info =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .paginationInfo
            );

        if (info) {

            info.textContent =
                total === 0
                    ? "No suppliers found"
                    : `Showing ${start}-${end} of ${total} suppliers`;

        }


        const currentPage =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .currentPage
            );

        if (currentPage) {

            currentPage.textContent =
                String(page);

        }


        const totalPagesElement =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .totalPages
            );

        if (totalPagesElement) {

            totalPagesElement.textContent =
                String(totalPages);

        }


        const previous =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .previousPage
            );

        if (previous) {

            previous.disabled =
                page <= 1;

        }


        const next =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .nextPage
            );

        if (next) {

            next.disabled =
                page >= totalPages;

        }

    },


    /**
     * Go to previous page.
     */
    previousPage() {

        if (
            SUPPLIERS_CONFIG
                .pagination
                .page <= 1
        ) {
            return;
        }

        SUPPLIERS_CONFIG
            .pagination
            .page--;

        this.render();

    },


    /**
     * Go to next page.
     */
    nextPage() {

        const totalPages =
            Math.max(
                1,
                Math.ceil(
                    this.state
                        .filteredSuppliers
                        .length /
                    SUPPLIERS_CONFIG
                        .pagination
                        .perPage
                )
            );


        if (
            SUPPLIERS_CONFIG
                .pagination
                .page >=
            totalPages
        ) {
            return;
        }


        SUPPLIERS_CONFIG
            .pagination
            .page++;

        this.render();

    },


    /**
     * Update records per page.
     */
    updatePerPage() {

        const select =
            supplierElement(
                SUPPLIERS_CONFIG
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

            SUPPLIERS_CONFIG
                .pagination
                .perPage = value;

        }

    },


    /**
     * Update supplier statistics.
     */
    updateStatistics() {

        const suppliers =
            this.state.suppliers;


        const total =
            suppliers.length;


        const active =
            suppliers.filter(
                supplier =>
                    String(
                        supplier.status ??
                        "active"
                    ).toLowerCase() ===
                    "active"
            ).length;


        const inactive =
            suppliers.filter(
                supplier =>
                    String(
                        supplier.status ??
                        ""
                    ).toLowerCase() !==
                    "active"
            ).length;


        const totalPurchases =
            suppliers.reduce(
                (sum, supplier) =>
                    sum +
                    supplierNumber(
                        supplier.total_purchases ??
                        supplier.purchase_total
                    ),
                0
            );


        const totalPayable =
            suppliers.reduce(
                (sum, supplier) =>
                    sum +
                    supplierNumber(
                        supplier.total_payable ??
                        supplier.payable ??
                        supplier.balance_due
                    ),
                0
            );


        this.setText(
            SUPPLIERS_CONFIG
                .selectors
                .totalSuppliers,
            total
        );


        this.setText(
            SUPPLIERS_CONFIG
                .selectors
                .activeSuppliers,
            active
        );


        this.setText(
            SUPPLIERS_CONFIG
                .selectors
                .inactiveSuppliers,
            inactive
        );


        this.setText(
            SUPPLIERS_CONFIG
                .selectors
                .totalPurchases,
            formatSupplierCurrency(
                totalPurchases
            )
        );


        this.setText(
            SUPPLIERS_CONFIG
                .selectors
                .totalPayable,
            formatSupplierCurrency(
                totalPayable
            )
        );

    },


    /**
     * Set element text safely.
     */
    setText(selector, value) {

        const element =
            supplierElement(selector);

        if (element) {
            element.textContent = value;
        }

    },


    /* =====================================================
       CREATE / EDIT
       ===================================================== */

    /**
     * Open create supplier modal.
     */
    openCreateModal() {

        SUPPLIERS_CONFIG
            .state
            .editingId = null;


        const form =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .form
            );

        if (form) {
            form.reset();
        }


        this.setText(
            SUPPLIERS_CONFIG
                .selectors
                .modalTitle,
            "Add Supplier"
        );


        const status =
            document.querySelector(
                "#supplierStatus"
            );

        if (status) {
            status.value = "active";
        }


        this.openModal();

    },


    /**
     * Open edit supplier modal.
     */
    async openEditModal(id) {

        try {

            const supplier =
                await this.getById(id);


            if (!supplier) {

                throw new Error(
                    "Supplier was not found."
                );

            }


            SUPPLIERS_CONFIG
                .state
                .editingId = id;


            this.fillForm(supplier);


            this.setText(
                SUPPLIERS_CONFIG
                    .selectors
                    .modalTitle,
                "Edit Supplier"
            );


            this.openModal();

        } catch (error) {

            console.error(
                "Supplier edit error:",
                error
            );

            showSupplierToast(
                error.message ||
                "Unable to load supplier.",
                "error"
            );

        }

    },


    /**
     * Fill supplier form.
     */
    fillForm(supplier) {

        const form =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .form
            );

        if (!form) {
            return;
        }


        const fields = [
            "supplier_id",
            "supplier_code",
            "name",
            "company_name",
            "contact_person",
            "email",
            "phone",
            "mobile",
            "address",
            "city",
            "state",
            "postal_code",
            "country",
            "tax_number",
            "website",
            "payment_terms",
            "credit_limit",
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
                    supplier[fieldName] ??
                    "";

            }
        );

    },


    /**
     * Save supplier.
     */
    async save() {

        const form =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .form
            );

        if (!form) {
            return;
        }


        if (!form.checkValidity()) {

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
            SUPPLIERS_CONFIG
                .state
                .editingId
        ) {

            payload.id =
                SUPPLIERS_CONFIG
                    .state
                    .editingId;

        }


        const isEditing =
            Boolean(
                SUPPLIERS_CONFIG
                    .state
                    .editingId
            );


        const url =
            isEditing
                ? SUPPLIERS_CONFIG.api.update
                : SUPPLIERS_CONFIG.api.create;


        const submitButton =
            form.querySelector(
                '[type="submit"]'
            );


        if (submitButton) {

            submitButton.disabled = true;
            submitButton.dataset.originalText =
                submitButton.textContent;
            submitButton.textContent =
                "Saving...";

        }


        try {

            const response =
                await supplierFetch(
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
                normalizeSupplierResponse(
                    response
                );


            if (!normalized.success) {

                throw new Error(
                    normalized.message ||
                    "Unable to save supplier."
                );

            }


            this.closeModal();


            showSupplierToast(
                isEditing
                    ? "Supplier updated successfully."
                    : "Supplier created successfully.",
                "success"
            );


            await this.load();

        } catch (error) {

            console.error(
                "Supplier save error:",
                error
            );

            showSupplierToast(
                error.message ||
                "Unable to save supplier.",
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
                    "Save Supplier";

            }

        }

    },


    /**
     * Get supplier by ID.
     */
    async getById(id) {

        const url =
            new URL(
                SUPPLIERS_CONFIG.api.get,
                window.location.href
            );


        url.searchParams.set(
            "id",
            id
        );


        const response =
            await supplierFetch(
                url.toString(),
                {
                    method: "GET"
                }
            );


        const normalized =
            normalizeSupplierResponse(
                response
            );


        if (!normalized.success) {

            throw new Error(
                normalized.message ||
                "Unable to retrieve supplier."
            );

        }


        /*
         * API may return one object or
         * an array containing one object.
         */
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

            return normalized.data[0] ||
                null;

        }


        return null;

    },


    /* =====================================================
       VIEW
       ===================================================== */

    /**
     * View supplier details.
     */
    async openDetails(id) {

        try {

            const supplier =
                await this.getById(id);


            if (!supplier) {

                throw new Error(
                    "Supplier was not found."
                );

            }


            this.renderDetails(
                supplier
            );

            this.openDetailsModal();

        } catch (error) {

            console.error(
                "Supplier details error:",
                error
            );

            showSupplierToast(
                error.message ||
                "Unable to load supplier details.",
                "error"
            );

        }

    },


    /**
     * Render supplier details.
     */
    renderDetails(supplier) {

        const values = {

            "#supplierDetailsName":
                supplier.name ??
                supplier.company_name ??
                "—",

            "#supplierDetailsCode":
                supplier.supplier_code ??
                "—",

            "#supplierDetailsContact":
                supplier.contact_person ??
                supplier.contact_name ??
                "—",

            "#supplierDetailsEmail":
                supplier.email ??
                "—",

            "#supplierDetailsPhone":
                supplier.phone ??
                supplier.mobile ??
                "—",

            "#supplierDetailsAddress":
                supplier.address ??
                "—",

            "#supplierDetailsCity":
                supplier.city ??
                "—",

            "#supplierDetailsCountry":
                supplier.country ??
                "—",

            "#supplierDetailsTaxNumber":
                supplier.tax_number ??
                "—",

            "#supplierDetailsPaymentTerms":
                supplier.payment_terms ??
                "—",

            "#supplierDetailsCreditLimit":
                formatSupplierCurrency(
                    supplier.credit_limit
                ),

            "#supplierDetailsPurchases":
                formatSupplierCurrency(
                    supplier.total_purchases ??
                    supplier.purchase_total
                ),

            "#supplierDetailsPayable":
                formatSupplierCurrency(
                    supplier.total_payable ??
                    supplier.payable ??
                    supplier.balance_due
                ),

            "#supplierDetailsNotes":
                supplier.notes ??
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
            supplierElement(
                "#supplierDetailsStatus"
            );


        if (statusElement) {

            const status =
                String(
                    supplier.status ??
                    "active"
                ).toLowerCase();


            statusElement.textContent =
                status
                    .charAt(0)
                    .toUpperCase() +
                status.slice(1);


            statusElement.className =
                `status-badge ${escapeSupplierHTML(status)}`;

        }

    },


    /* =====================================================
       DELETE
       ===================================================== */

    /**
     * Delete supplier.
     */
    async delete(id) {

        const supplier =
            this.state.suppliers.find(
                item =>
                    String(
                        item.id ??
                        item.supplier_id
                    ) === String(id)
            );


        const name =
            supplier?.name ??
            supplier?.company_name ??
            "this supplier";


        const confirmed =
            window.confirm(
                `Are you sure you want to delete ${name}?`
            );


        if (!confirmed) {
            return;
        }


        try {

            const response =
                await supplierFetch(
                    SUPPLIERS_CONFIG
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
                normalizeSupplierResponse(
                    response
                );


            if (!normalized.success) {

                throw new Error(
                    normalized.message ||
                    "Unable to delete supplier."
                );

            }


            showSupplierToast(
                "Supplier deleted successfully.",
                "success"
            );


            await this.load();

        } catch (error) {

            console.error(
                "Supplier deletion error:",
                error
            );

            showSupplierToast(
                error.message ||
                "Unable to delete supplier.",
                "error"
            );

        }

    },


    /* =====================================================
       ACTION HANDLER
       ===================================================== */

    /**
     * Handle table actions.
     */
    handleAction(action, id) {

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
                    `Unknown supplier action: ${action}`
                );

        }

    },


    /* =====================================================
       MODALS
       ===================================================== */

    /**
     * Open supplier modal.
     */
    openModal() {

        const modal =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .modal
            );

        if (!modal) {
            return;
        }

        modal.classList.add("active");

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
                () => firstInput.focus(),
                100
            );

        }

    },


    /**
     * Close supplier modal.
     */
    closeModal() {

        const modal =
            supplierElement(
                SUPPLIERS_CONFIG
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


    /**
     * Open details modal.
     */
    openDetailsModal() {

        const modal =
            supplierElement(
                SUPPLIERS_CONFIG
                    .selectors
                    .detailsModal
            );

        if (!modal) {
            return;
        }

        modal.classList.add("active");

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "modal-open"
        );

    },


    /**
     * Close details modal.
     */
    closeDetailsModal() {

        const modal =
            supplierElement(
                SUPPLIERS_CONFIG
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


    /**
     * Display table loading state.
     */
    showLoading() {

        const tableBody =
            supplierElement(
                SUPPLIERS_CONFIG
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
                    Loading suppliers...
                </td>
            </tr>
        `;

    }

};


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.InventorySuppliers =
    InventorySuppliers;


/* =========================================================
   AUTO INITIALIZATION
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => InventorySuppliers.init()
    );

} else {

    InventorySuppliers.init();

}
