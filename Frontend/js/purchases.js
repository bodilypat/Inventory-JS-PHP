/**
 * ============================================================
 * INVENTORY MANAGEMENT SYSTEM
 * Purchase Operations
 *
 * File:
 * frontend/js/purchases.js
 *
 * Expected API:
 * frontend -> ../backend/api/purchases.php
 *
 * No mock data is used.
 * ============================================================
 */

"use strict";


/* ============================================================
   CONFIGURATION
============================================================ */

const PURCHASES_API = "../backend/api/purchases.php";

const PURCHASES_PER_PAGE = 10;


/* ============================================================
   STATE
============================================================ */

const purchaseState = {
    purchases: [],
    filteredPurchases: [],

    currentPage: 1,
    perPage: PURCHASES_PER_PAGE,

    search: "",
    status: "",
    supplier: "",

    sortField: "purchase_date",
    sortDirection: "desc",

    editingId: null,

    loading: false
};


/* ============================================================
   DOM HELPERS
============================================================ */

function getElement(id) {
    return document.getElementById(id);
}


function query(selector, parent = document) {
    return parent.querySelector(selector);
}


function queryAll(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
}


/* ============================================================
   API HELPER
============================================================ */

async function apiRequest(url, options = {}) {

    const config = {
        method: "GET",
        credentials: "same-origin",
        headers: {
            Accept: "application/json"
        },
        ...options
    };


    if (
        config.body &&
        typeof config.body !== "string"
    ) {
        config.headers["Content-Type"] = "application/json";

        config.body = JSON.stringify(config.body);
    }


    const response = await fetch(url, config);


    let result;

    try {
        result = await response.json();
    } catch (error) {
        throw new Error(
            `Invalid server response (${response.status}).`
        );
    }


    if (!response.ok) {

        throw new Error(
            result?.message ||
            result?.error ||
            `Request failed with status ${response.status}.`
        );
    }


    if (
        result &&
        result.success === false
    ) {
        throw new Error(
            result.message ||
            result.error ||
            "The operation could not be completed."
        );
    }


    return result;
}


/* ============================================================
   INITIALIZATION
============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    initializePurchases();

});


function initializePurchases() {

    bindEvents();

    loadSuppliers();

    loadPurchases();

}


/* ============================================================
   EVENT BINDINGS
============================================================ */

function bindEvents() {

    const searchInput =
        getElement("purchaseSearch") ||
        getElement("purchasesSearch");


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            debounce(() => {

                purchaseState.search =
                    searchInput.value.trim();

                purchaseState.currentPage = 1;

                applyFiltersAndRender();

            }, 300)
        );

    }


    const statusFilter =
        getElement("purchaseStatusFilter") ||
        getElement("statusFilter");


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            () => {

                purchaseState.status =
                    statusFilter.value;

                purchaseState.currentPage = 1;

                applyFiltersAndRender();

            }
        );

    }


    const supplierFilter =
        getElement("purchaseSupplierFilter") ||
        getElement("supplierFilter");


    if (supplierFilter) {

        supplierFilter.addEventListener(
            "change",
            () => {

                purchaseState.supplier =
                    supplierFilter.value;

                purchaseState.currentPage = 1;

                applyFiltersAndRender();

            }
        );

    }


    const perPage =
        getElement("perPage") ||
        getElement("purchasePerPage");


    if (perPage) {

        perPage.addEventListener(
            "change",
            () => {

                purchaseState.perPage =
                    Number(perPage.value) ||
                    PURCHASES_PER_PAGE;

                purchaseState.currentPage = 1;

                applyFiltersAndRender();

            }
        );

    }


    const refreshButton =
        getElement("refreshPurchasesButton") ||
        getElement("refreshPurchaseButton");


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            () => loadPurchases(true)
        );

    }


    const addButton =
        getElement("addPurchaseButton") ||
        getElement("addPurchase");


    if (addButton) {

        addButton.addEventListener(
            "click",
            () => openPurchaseModal()
        );

    }


    const purchaseForm =
        getElement("purchaseForm");


    if (purchaseForm) {

        purchaseForm.addEventListener(
            "submit",
            handlePurchaseSubmit
        );

    }


    const paymentForm =
        getElement("paymentForm");


    if (paymentForm) {

        paymentForm.addEventListener(
            "submit",
            handlePaymentSubmit
        );

    }


    const closeButtons =
        queryAll("[data-close-purchase-modal]");


    closeButtons.forEach(button => {

        button.addEventListener(
            "click",
            closePurchaseModal
        );

    });


    const closeDetailsButtons =
        queryAll("[data-close-purchase-details]");


    closeDetailsButtons.forEach(button => {

        button.addEventListener(
            "click",
            closePurchaseDetails
        );

    });


    const closePaymentButtons =
        queryAll("[data-close-payment-modal]");


    closePaymentButtons.forEach(button => {

        button.addEventListener(
            "click",
            closePaymentModal
        );

    });


    const previousButton =
        getElement("previousPage") ||
        getElement("previousPurchasePage");


    if (previousButton) {

        previousButton.addEventListener(
            "click",
            () => {

                if (purchaseState.currentPage > 1) {

                    purchaseState.currentPage--;

                    renderPurchases();

                }

            }
        );

    }


    const nextButton =
        getElement("nextPage") ||
        getElement("nextPurchasePage");


    if (nextButton) {

        nextButton.addEventListener(
            "click",
            () => {

                const totalPages =
                    getTotalPages();

                if (
                    purchaseState.currentPage <
                    totalPages
                ) {

                    purchaseState.currentPage++;

                    renderPurchases();

                }

            }
        );

    }


    queryAll("[data-sort-purchase]")
        .forEach(header => {

            header.addEventListener(
                "click",
                () => {

                    const field =
                        header.dataset.sortPurchase;

                    sortPurchases(field);

                }
            );

        });


    /*
     * Delegated actions for dynamically
     * generated purchase rows.
     */

    const tableBody =
        getElement("purchasesTableBody") ||
        getElement("purchaseTableBody");


    if (tableBody) {

        tableBody.addEventListener(
            "click",
            handleTableAction
        );

    }


    /*
     * Close modals when clicking outside.
     */

    queryAll(".modal").forEach(modal => {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {

                    closeModal(modal);

                }

            }
        );

    });


    /*
     * Escape key.
     */

    document.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Escape") {
                return;
            }

            closeAllModals();

        }
    );

}


/* ============================================================
   LOAD PURCHASES
============================================================ */

async function loadPurchases(showNotification = false) {

    if (purchaseState.loading) {
        return;
    }


    purchaseState.loading = true;

    setLoadingState(true);


    try {

        const result =
            await apiRequest(PURCHASES_API);


        purchaseState.purchases =
            normalizePurchaseResponse(result);


        applyFiltersAndRender();


        if (showNotification) {

            showToast(
                "Purchases refreshed successfully.",
                "success"
            );

        }

    } catch (error) {

        console.error(
            "Unable to load purchases:",
            error
        );


        purchaseState.purchases = [];

        purchaseState.filteredPurchases = [];

        renderPurchases();

        showToast(
            error.message ||
            "Unable to load purchases.",
            "error"
        );

    } finally {

        purchaseState.loading = false;

        setLoadingState(false);

    }

}


/* ============================================================
   NORMALIZE API RESPONSE
============================================================ */

function normalizePurchaseResponse(result) {

    if (Array.isArray(result)) {
        return result;
    }


    if (
        Array.isArray(result?.data)
    ) {
        return result.data;
    }


    if (
        Array.isArray(result?.purchases)
    ) {
        return result.purchases;
    }


    if (
        Array.isArray(result?.items)
    ) {
        return result.items;
    }


    if (
        Array.isArray(result?.results)
    ) {
        return result.results;
    }


    return [];

}


/* ============================================================
   FILTERING
============================================================ */

function applyFiltersAndRender() {

    const search =
        purchaseState.search
            .toLowerCase()
            .trim();


    purchaseState.filteredPurchases =
        purchaseState.purchases.filter(
            purchase => {

                const searchableText = [
                    purchase.id,
                    purchase.purchase_id,
                    purchase.purchase_number,
                    purchase.reference,
                    purchase.invoice_number,
                    purchase.supplier_name,
                    purchase.supplier,
                    purchase.product_name,
                    purchase.notes
                ]
                    .filter(value =>
                        value !== undefined &&
                        value !== null
                    )
                    .join(" ")
                    .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchableText.includes(search);


                const purchaseStatus =
                    normalizeStatus(
                        purchase.status
                    );


                const matchesStatus =
                    !purchaseState.status ||
                    purchaseStatus ===
                    normalizeStatus(
                        purchaseState.status
                    );


                const supplierId =
                    String(
                        purchase.supplier_id ??
                        purchase.supplierId ??
                        ""
                    );


                const matchesSupplier =
                    !purchaseState.supplier ||
                    supplierId ===
                    String(
                        purchaseState.supplier
                    );


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesSupplier
                );

            }
        );


    sortPurchaseCollection(
        purchaseState.filteredPurchases
    );


    const totalPages =
        getTotalPages();


    if (
        purchaseState.currentPage >
        totalPages
    ) {

        purchaseState.currentPage =
            Math.max(totalPages, 1);

    }


    renderPurchases();

}


/* ============================================================
   SORTING
============================================================ */

function sortPurchases(field) {

    if (
        purchaseState.sortField === field
    ) {

        purchaseState.sortDirection =
            purchaseState.sortDirection === "asc"
                ? "desc"
                : "asc";

    } else {

        purchaseState.sortField = field;

        purchaseState.sortDirection = "asc";

    }


    sortPurchaseCollection(
        purchaseState.filteredPurchases
    );


    renderPurchases();

}


function sortPurchaseCollection(collection) {

    const field =
        purchaseState.sortField;


    const direction =
        purchaseState.sortDirection === "asc"
            ? 1
            : -1;


    collection.sort(
        (a, b) => {

            const first =
                getPurchaseSortValue(
                    a,
                    field
                );


            const second =
                getPurchaseSortValue(
                    b,
                    field
                );


            if (
                typeof first === "number" &&
                typeof second === "number"
            ) {

                return (
                    first - second
                ) * direction;

            }


            return String(first)
                .localeCompare(
                    String(second),
                    undefined,
                    {
                        numeric: true,
                        sensitivity: "base"
                    }
                ) * direction;

        }
    );

}


function getPurchaseSortValue(
    purchase,
    field
) {

    switch (field) {

        case "purchase_number":
            return (
                purchase.purchase_number ??
                purchase.purchaseNumber ??
                purchase.id ??
                ""
            );


        case "supplier_name":
            return (
                purchase.supplier_name ??
                purchase.supplier ??
                ""
            );


        case "purchase_date":
            return (
                parseDate(
                    purchase.purchase_date ??
                    purchase.date ??
                    purchase.created_at
                )?.getTime() || 0
            );


        case "total":
            return getPurchaseTotal(
                purchase
            );


        case "paid":
            return getPaidAmount(
                purchase
            );


        case "due":
            return getDueAmount(
                purchase
            );


        case "status":
            return normalizeStatus(
                purchase.status
            );


        default:
            return (
                purchase[field] ??
                ""
            );

    }

}


/* ============================================================
   RENDER PURCHASES
============================================================ */

function renderPurchases() {

    const tableBody =
        getElement("purchasesTableBody") ||
        getElement("purchaseTableBody");


    if (!tableBody) {
        return;
    }


    const total =
        purchaseState.filteredPurchases.length;


    if (!total) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="9"
                    class="table-empty-state"
                >
                    <div class="empty-icon">
                        🛒
                    </div>

                    <h3>
                        No purchases found
                    </h3>

                    <p>
                        No purchase records match the
                        current filters.
                    </p>
                </td>
            </tr>
        `;


        updatePagination();

        updatePurchaseStatistics();

        return;

    }


    const start =
        (
            purchaseState.currentPage - 1
        ) * purchaseState.perPage;


    const end =
        start +
        purchaseState.perPage;


    const purchases =
        purchaseState.filteredPurchases
            .slice(start, end);


    tableBody.innerHTML =
        purchases
            .map(
                purchase =>
                    renderPurchaseRow(
                        purchase
                    )
            )
            .join("");


    updatePagination();

    updatePurchaseStatistics();

}


/* ============================================================
   PURCHASE ROW
============================================================ */

function renderPurchaseRow(purchase) {

    const id =
        getPurchaseId(purchase);


    const purchaseNumber =
        purchase.purchase_number ??
        purchase.purchaseNumber ??
        `#${id}`;


    const supplier =
        purchase.supplier_name ??
        purchase.supplier ??
        "—";


    const date =
        formatDate(
            purchase.purchase_date ??
            purchase.date ??
            purchase.created_at
        );


    const total =
        getPurchaseTotal(
            purchase
        );


    const paid =
        getPaidAmount(
            purchase
        );


    const due =
        getDueAmount(
            purchase
        );


    const status =
        normalizeStatus(
            purchase.status ||
            "pending"
        );


    const paymentStatus =
        normalizeStatus(
            purchase.payment_status ||
            (
                due <= 0
                    ? "paid"
                    : paid > 0
                        ? "partial"
                        : "unpaid"
            )
        );


    return `
        <tr
            data-purchase-id="${escapeHtml(id)}"
        >

            <td>

                <div class="purchase-number-cell">

                    <strong>
                        ${escapeHtml(
                            purchaseNumber
                        )}
                    </strong>

                    ${
                        purchase.invoice_number
                            ? `
                                <small>
                                    Invoice:
                                    ${escapeHtml(
                                        purchase.invoice_number
                                    )}
                                </small>
                              `
                            : ""
                    }

                </div>

            </td>


            <td>
                ${escapeHtml(supplier)}
            </td>


            <td>
                ${escapeHtml(date)}
            </td>


            <td>
                ${formatCurrency(total)}
            </td>


            <td>
                ${formatCurrency(paid)}
            </td>


            <td>
                <span
                    class="
                        purchase-due
                        ${
                            due > 0
                                ? "has-due"
                                : "paid-due"
                        }
                    "
                >
                    ${formatCurrency(due)}
                </span>
            </td>


            <td>

                <span
                    class="
                        status-badge
                        ${getStatusClass(status)}
                    "
                >
                    ${escapeHtml(
                        formatStatus(status)
                    )}
                </span>

            </td>


            <td>

                <span
                    class="
                        status-badge
                        ${getPaymentStatusClass(
                            paymentStatus
                        )}
                    "
                >
                    ${escapeHtml(
                        formatStatus(
                            paymentStatus
                        )
                    )}
                </span>

            </td>


            <td>

                <div class="purchase-actions">

                    <button
                        type="button"
                        class="action-button"
                        data-action="view"
                        data-id="${escapeHtml(id)}"
                        title="View purchase"
                        aria-label="View purchase"
                    >
                        👁
                    </button>


                    <button
                        type="button"
                        class="action-button"
                        data-action="edit"
                        data-id="${escapeHtml(id)}"
                        title="Edit purchase"
                        aria-label="Edit purchase"
                    >
                        ✏
                    </button>


                    <button
                        type="button"
                        class="action-button"
                        data-action="payment"
                        data-id="${escapeHtml(id)}"
                        title="Record payment"
                        aria-label="Record payment"
                    >
                        💳
                    </button>


                    <button
                        type="button"
                        class="action-button delete-purchase"
                        data-action="delete"
                        data-id="${escapeHtml(id)}"
                        title="Delete purchase"
                        aria-label="Delete purchase"
                    >
                        🗑
                    </button>

                </div>

            </td>

        </tr>
    `;

}


/* ============================================================
   TABLE ACTIONS
============================================================ */

async function handleTableAction(event) {

    const button =
        event.target.closest(
            "[data-action]"
        );


    if (!button) {
        return;
    }


    const action =
        button.dataset.action;


    const id =
        button.dataset.id;


    if (!id) {
        return;
    }


    switch (action) {

        case "view":
            viewPurchase(id);
            break;


        case "edit":
            editPurchase(id);
            break;


        case "payment":
            openPaymentModal(id);
            break;


        case "delete":
            await deletePurchase(id);
            break;

    }

}


/* ============================================================
   CREATE / UPDATE PURCHASE
============================================================ */

async function handlePurchaseSubmit(event) {

    event.preventDefault();


    const form =
        event.currentTarget;


    if (!form.checkValidity()) {

        form.reportValidity();

        return;

    }


    const formData =
        new FormData(form);


    const data =
        Object.fromEntries(
            formData.entries()
        );


    const items =
        collectPurchaseItems();


    if (
        items.length &&
        !validatePurchaseItems(items)
    ) {

        return;

    }


    if (items.length) {
        data.items = items;
    }


    const isEditing =
        Boolean(
            purchaseState.editingId
        );


    const url =
        isEditing
            ? `${PURCHASES_API}?id=${encodeURIComponent(
                purchaseState.editingId
            )}`
            : PURCHASES_API;


    try {

        setFormSubmitting(
            form,
            true
        );


        const result =
            await apiRequest(
                url,
                {
                    method:
                        isEditing
                            ? "PUT"
                            : "POST",

                    body: data
                }
            );


        closePurchaseModal();

        showToast(
            result?.message ||
            (
                isEditing
                    ? "Purchase updated successfully."
                    : "Purchase created successfully."
            ),
            "success"
        );


        purchaseState.editingId = null;

        await loadPurchases();

    } catch (error) {

        console.error(
            "Purchase save failed:",
            error
        );


        showToast(
            error.message ||
            "Unable to save purchase.",
            "error"
        );

    } finally {

        setFormSubmitting(
            form,
            false
        );

    }

}


/* ============================================================
   PURCHASE ITEMS
============================================================ */

function collectPurchaseItems() {

    const rows =
        queryAll(
            "[data-purchase-item]"
        );


    if (!rows.length) {
        return [];
    }


    return rows
        .map(row => {

            const product =
                query(
                    '[name="product_id"]',
                    row
                );


            const quantity =
                query(
                    '[name="quantity"]',
                    row
                );


            const unitPrice =
                query(
                    '[name="unit_price"]',
                    row
                );


            return {

                product_id:
                    product?.value || null,

                quantity:
                    Number(
                        quantity?.value || 0
                    ),

                unit_price:
                    Number(
                        unitPrice?.value || 0
                    )

            };

        })
        .filter(item =>
            item.product_id ||
            item.quantity ||
            item.unit_price
        );

}


function validatePurchaseItems(items) {

    for (const item of items) {

        if (!item.product_id) {

            showToast(
                "Please select a product for every purchase item.",
                "error"
            );

            return false;

        }


        if (
            !Number.isFinite(
                item.quantity
            ) ||
            item.quantity <= 0
        ) {

            showToast(
                "Purchase quantity must be greater than zero.",
                "error"
            );

            return false;

        }


        if (
            !Number.isFinite(
                item.unit_price
            ) ||
            item.unit_price < 0
        ) {

            showToast(
                "Unit price cannot be negative.",
                "error"
            );

            return false;

        }

    }


    return true;

}


/* ============================================================
   EDIT PURCHASE
============================================================ */

function editPurchase(id) {

    const purchase =
        findPurchase(id);


    if (!purchase) {

        showToast(
            "Purchase record was not found.",
            "error"
        );

        return;

    }


    purchaseState.editingId = id;


    const form =
        getElement("purchaseForm");


    if (!form) {
        return;
    }


    setFormValue(
        form,
        "supplier_id",
        purchase.supplier_id ??
        purchase.supplierId ??
        ""
    );


    setFormValue(
        form,
        "purchase_number",
        purchase.purchase_number ??
        purchase.purchaseNumber ??
        ""
    );


    setFormValue(
        form,
        "invoice_number",
        purchase.invoice_number ??
        ""
    );


    setFormValue(
        form,
        "purchase_date",
        toInputDate(
            purchase.purchase_date ??
            purchase.date
        )
    );


    setFormValue(
        form,
        "status",
        purchase.status ??
        "pending"
    );


    setFormValue(
        form,
        "payment_status",
        purchase.payment_status ??
        "unpaid"
    );


    setFormValue(
        form,
        "notes",
        purchase.notes ??
        ""
    );


    /*
     * Populate optional item rows
     * when purchase items are included
     * in the API response.
     */

    if (
        Array.isArray(
            purchase.items
        )
    ) {

        populatePurchaseItems(
            purchase.items
        );

    }


    setModalTitle(
        "purchaseModal",
        "Edit Purchase"
    );


    openModal(
        "purchaseModal"
    );

}


/* ============================================================
   CREATE PURCHASE
============================================================ */

function openPurchaseModal() {

    purchaseState.editingId = null;


    const form =
        getElement("purchaseForm");


    if (form) {

        form.reset();

        clearPurchaseItems();

    }


    setModalTitle(
        "purchaseModal",
        "Add Purchase"
    );


    openModal(
        "purchaseModal"
    );

}


/* ============================================================
   VIEW PURCHASE
============================================================ */

function viewPurchase(id) {

    const purchase =
        findPurchase(id);


    if (!purchase) {

        showToast(
            "Purchase record was not found.",
            "error"
        );

        return;

    }


    setText(
        "purchaseDetailsNumber",
        purchase.purchase_number ??
        purchase.purchaseNumber ??
        `#${id}`
    );


    setText(
        "purchaseDetailsSupplier",
        purchase.supplier_name ??
        purchase.supplier ??
        "—"
    );


    setText(
        "purchaseDetailsDate",
        formatDate(
            purchase.purchase_date ??
            purchase.date ??
            purchase.created_at
        )
    );


    setText(
        "purchaseDetailsInvoice",
        purchase.invoice_number ||
        "—"
    );


    setText(
        "purchaseDetailsTotal",
        formatCurrency(
            getPurchaseTotal(
                purchase
            )
        )
    );


    setText(
        "purchaseDetailsPaid",
        formatCurrency(
            getPaidAmount(
                purchase
            )
        )
    );


    setText(
        "purchaseDetailsDue",
        formatCurrency(
            getDueAmount(
                purchase
            )
        )
    );


    setText(
        "purchaseDetailsStatus",
        formatStatus(
            purchase.status ||
            "pending"
        )
    );


    setText(
        "purchaseDetailsPaymentStatus",
        formatStatus(
            purchase.payment_status ||
            "unpaid"
        )
    );


    setText(
        "purchaseDetailsNotes",
        purchase.notes ||
        "No notes available."
    );


    renderPurchaseDetailsItems(
        purchase.items
    );


    openModal(
        "purchaseDetailsModal"
    );

}


/* ============================================================
   DELETE PURCHASE
============================================================ */

async function deletePurchase(id) {

    const purchase =
        findPurchase(id);


    if (!purchase) {

        showToast(
            "Purchase record was not found.",
            "error"
        );

        return;

    }


    const purchaseNumber =
        purchase.purchase_number ??
        purchase.purchaseNumber ??
        `#${id}`;


    const confirmed =
        window.confirm(
            `Delete purchase ${purchaseNumber}? This action cannot be undone.`
        );


    if (!confirmed) {
        return;
    }


    try {

        await apiRequest(
            `${PURCHASES_API}?id=${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );


        showToast(
            "Purchase deleted successfully.",
            "success"
        );


        await loadPurchases();

    } catch (error) {

        console.error(
            "Purchase deletion failed:",
            error
        );


        showToast(
            error.message ||
            "Unable to delete purchase.",
            "error"
        );

    }

}


/* ============================================================
   PAYMENT
============================================================ */

function openPaymentModal(id) {

    const purchase =
        findPurchase(id);


    if (!purchase) {

        showToast(
            "Purchase record was not found.",
            "error"
        );

        return;

    }


    setData(
        "paymentPurchaseId",
        id
    );


    setText(
        "paymentPurchaseNumber",
        purchase.purchase_number ??
        purchase.purchaseNumber ??
        `#${id}`
    );


    setText(
        "paymentPurchaseTotal",
        formatCurrency(
            getPurchaseTotal(
                purchase
            )
        )
    );


    setText(
        "paymentPurchasePaid",
        formatCurrency(
            getPaidAmount(
                purchase
            )
        )
    );


    setText(
        "paymentPurchaseDue",
        formatCurrency(
            getDueAmount(
                purchase
            )
        )
    );


    const amountInput =
        getElement(
            "paymentAmount"
        );


    if (amountInput) {

        amountInput.value =
            getDueAmount(
                purchase
            ) > 0
                ? getDueAmount(
                    purchase
                ).toFixed(2)
                : "";

    }


    const form =
        getElement("paymentForm");


    if (form) {

        const purchaseIdInput =
            query(
                '[name="purchase_id"]',
                form
            );


        if (purchaseIdInput) {

            purchaseIdInput.value =
                id;

        }

    }


    openModal(
        "paymentModal"
    );

}


async function handlePaymentSubmit(event) {

    event.preventDefault();


    const form =
        event.currentTarget;


    if (!form.checkValidity()) {

        form.reportValidity();

        return;

    }


    const formData =
        new FormData(form);


    const data =
        Object.fromEntries(
            formData.entries()
        );


    const purchaseId =
        data.purchase_id ||
        getData(
            "paymentPurchaseId"
        );


    if (!purchaseId) {

        showToast(
            "Purchase ID is required.",
            "error"
        );

        return;

    }


    data.amount =
        Number(
            data.amount
        );


    if (
        !Number.isFinite(
            data.amount
        ) ||
        data.amount <= 0
    ) {

        showToast(
            "Payment amount must be greater than zero.",
            "error"
        );

        return;

    }


    try {

        setFormSubmitting(
            form,
            true
        );


        const result =
            await apiRequest(
                `${PURCHASES_API}/payment`,
                {
                    method: "POST",
                    body: {
                        ...data,
                        purchase_id:
                            purchaseId
                    }
                }
            );


        closePaymentModal();


        showToast(
            result?.message ||
            "Payment recorded successfully.",
            "success"
        );


        await loadPurchases();

    } catch (error) {

        console.error(
            "Payment failed:",
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


/* ============================================================
   SUPPLIERS
============================================================ */

async function loadSuppliers() {

    const supplierSelect =
        getElement(
            "purchaseSupplierFilter"
        ) ||
        getElement(
            "supplierFilter"
        );


    const formSupplierSelect =
        getElement(
            "purchaseSupplier"
        );


    if (
        !supplierSelect &&
        !formSupplierSelect
    ) {

        return;

    }


    try {

        const result =
            await apiRequest(
                "../backend/api/suppliers.php"
            );


        const suppliers =
            normalizeSupplierResponse(
                result
            );


        populateSupplierSelect(
            supplierSelect,
            suppliers,
            "All Suppliers"
        );


        populateSupplierSelect(
            formSupplierSelect,
            suppliers,
            "Select supplier"
        );

    } catch (error) {

        console.error(
            "Unable to load suppliers:",
            error
        );

    }

}


function normalizeSupplierResponse(result) {

    if (Array.isArray(result)) {
        return result;
    }


    if (
        Array.isArray(result?.data)
    ) {
        return result.data;
    }


    if (
        Array.isArray(result?.suppliers)
    ) {
        return result.suppliers;
    }


    if (
        Array.isArray(result?.items)
    ) {
        return result.items;
    }


    return [];

}


function populateSupplierSelect(
    select,
    suppliers,
    firstOption
) {

    if (!select) {
        return;
    }


    const currentValue =
        select.value;


    select.innerHTML = "";


    const defaultOption =
        document.createElement("option");


    defaultOption.value = "";

    defaultOption.textContent =
        firstOption;


    select.appendChild(
        defaultOption
    );


    suppliers.forEach(
        supplier => {

            const option =
                document.createElement(
                    "option"
                );


            const id =
                supplier.id ??
                supplier.supplier_id;


            const name =
                supplier.name ??
                supplier.supplier_name ??
                supplier.company_name ??
                `Supplier #${id}`;


            option.value =
                id ?? "";


            option.textContent =
                name;


            select.appendChild(
                option
            );

        }
    );


    if (
        currentValue
    ) {

        select.value =
            currentValue;

    }

}


/* ============================================================
   PURCHASE DETAILS ITEMS
============================================================ */

function renderPurchaseDetailsItems(items) {

    const container =
        getElement(
            "purchaseDetailsItems"
        );


    if (!container) {
        return;
    }


    if (
        !Array.isArray(items) ||
        !items.length
    ) {

        container.innerHTML = `
            <div class="details-empty">
                No purchase item details available.
            </div>
        `;

        return;

    }


    container.innerHTML =
        items.map(item => {

            const product =
                item.product_name ??
                item.product ??
                `Product #${
                    item.product_id ?? "—"
                }`;


            const quantity =
                Number(
                    item.quantity || 0
                );


            const unitPrice =
                Number(
                    item.unit_price ||
                    item.price ||
                    0
                );


            const subtotal =
                Number(
                    item.subtotal
                );


            const calculatedSubtotal =
                Number.isFinite(
                    subtotal
                )
                    ? subtotal
                    : quantity * unitPrice;


            return `
                <div class="purchase-detail-item">

                    <div>
                        <strong>
                            ${escapeHtml(product)}
                        </strong>

                        ${
                            item.sku
                                ? `
                                    <small>
                                        SKU:
                                        ${escapeHtml(
                                            item.sku
                                        )}
                                    </small>
                                  `
                                : ""
                        }
                    </div>

                    <span>
                        ${quantity}
                        ×
                        ${formatCurrency(
                            unitPrice
                        )}
                    </span>

                    <strong>
                        ${formatCurrency(
                            calculatedSubtotal
                        )}
                    </strong>

                </div>
            `;

        }).join("");

}


/* ============================================================
   PURCHASE ITEM FORM HELPERS
============================================================ */

function populatePurchaseItems(items) {

    const container =
        getElement(
            "purchaseItems"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    items.forEach(item => {

        addPurchaseItemRow(
            item
        );

    });

}


function addPurchaseItemRow(item = {}) {

    const container =
        getElement(
            "purchaseItems"
        );


    if (!container) {
        return;
    }


    const row =
        document.createElement("div");


    row.className =
        "purchase-item-row";


    row.dataset.purchaseItem =
        "true";


    row.innerHTML = `
        <div class="form-group">

            <label>
                Product
            </label>

            <select name="product_id">
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
                name="quantity"
                min="1"
                step="1"
                value="${escapeHtml(
                    item.quantity ??
                    ""
                )}"
            >

        </div>


        <div class="form-group">

            <label>
                Unit Price
            </label>

            <input
                type="number"
                name="unit_price"
                min="0"
                step="0.01"
                value="${escapeHtml(
                    item.unit_price ??
                    ""
                )}"
            >

        </div>


        <button
            type="button"
            class="action-button delete-purchase-item"
            data-remove-purchase-item
            aria-label="Remove item"
        >
            ×
        </button>
    `;


    container.appendChild(
        row
    );


    const removeButton =
        query(
            "[data-remove-purchase-item]",
            row
        );


    if (removeButton) {

        removeButton.addEventListener(
            "click",
            () => row.remove()
        );

    }


    /*
     * Product options can be loaded by
     * the products operation module.
     *
     * If products are available globally,
     * populate the select.
     */

    populateProductSelectIfAvailable(
        query(
            '[name="product_id"]',
            row
        ),
        item.product_id
    );

}


function clearPurchaseItems() {

    const container =
        getElement(
            "purchaseItems"
        );


    if (container) {
        container.innerHTML = "";
    }

}


function populateProductSelectIfAvailable(
    select,
    selectedId = null
) {

    if (!select) {
        return;
    }


    /*
     * Supports products loaded by
     * products.js when exposed globally.
     */

    const products =
        Array.isArray(
            window.inventoryProducts
        )
            ? window.inventoryProducts
            : [];


    if (!products.length) {
        return;
    }


    select.innerHTML = `
        <option value="">
            Select product
        </option>
    `;


    products.forEach(product => {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            product.id ??
            product.product_id ??
            "";


        option.textContent =
            product.name ??
            product.product_name ??
            `Product #${option.value}`;


        select.appendChild(
            option
        );

    });


    if (selectedId !== null) {

        select.value =
            selectedId;

    }

}


/* ============================================================
   STATISTICS
============================================================ */

function updatePurchaseStatistics() {

    const purchases =
        purchaseState.filteredPurchases;


    const totalPurchases =
        purchases.length;


    const totalAmount =
        purchases.reduce(
            (sum, purchase) =>
                sum +
                getPurchaseTotal(
                    purchase
                ),
            0
        );


    const totalPaid =
        purchases.reduce(
            (sum, purchase) =>
                sum +
                getPaidAmount(
                    purchase
                ),
            0
        );


    const totalDue =
        purchases.reduce(
            (sum, purchase) =>
                sum +
                getDueAmount(
                    purchase
                ),
            0
        );


    const pending =
        purchases.filter(
            purchase =>
                [
                    "pending",
                    "draft",
                    "ordered"
                ].includes(
                    normalizeStatus(
                        purchase.status
                    )
                )
        ).length;


    const completed =
        purchases.filter(
            purchase =>
                [
                    "completed",
                    "received",
                    "approved"
                ].includes(
                    normalizeStatus(
                        purchase.status
                    )
                )
        ).length;


    setNumber(
        "totalPurchases",
        totalPurchases
    );


    setNumber(
        "pendingPurchases",
        pending
    );


    setNumber(
        "completedPurchases",
        completed
    );


    setCurrency(
        "totalPurchaseAmount",
        totalAmount
    );


    setCurrency(
        "totalPaidAmount",
        totalPaid
    );


    setCurrency(
        "totalDueAmount",
        totalDue
    );

}


/* ============================================================
   PAGINATION
============================================================ */

function getTotalPages() {

    return Math.max(
        1,
        Math.ceil(
            purchaseState.filteredPurchases.length /
            purchaseState.perPage
        )
    );

}


function updatePagination() {

    const total =
        purchaseState.filteredPurchases.length;


    const totalPages =
        getTotalPages();


    const start =
        total === 0
            ? 0
            : (
                (
                    purchaseState.currentPage -
                    1
                ) *
                purchaseState.perPage
            ) + 1;


    const end =
        Math.min(
            purchaseState.currentPage *
            purchaseState.perPage,
            total
        );


    const info =
        getElement("paginationInfo") ||
        getElement("purchasePaginationInfo");


    if (info) {

        info.textContent =
            total
                ? `Showing ${start}-${end} of ${total} purchases`
                : "No purchases found";

    }


    const currentPage =
        getElement("currentPage") ||
        getElement("purchaseCurrentPage");


    if (currentPage) {

        currentPage.textContent =
            purchaseState.currentPage;

    }


    const totalPagesElement =
        getElement("totalPages") ||
        getElement("purchaseTotalPages");


    if (totalPagesElement) {

        totalPagesElement.textContent =
            totalPages;

    }


    const previous =
        getElement("previousPage") ||
        getElement("previousPurchasePage");


    const next =
        getElement("nextPage") ||
        getElement("nextPurchasePage");


    if (previous) {

        previous.disabled =
            purchaseState.currentPage <= 1;

    }


    if (next) {

        next.disabled =
            purchaseState.currentPage >=
            totalPages;

    }

}


/* ============================================================
   LOADING STATE
============================================================ */

function setLoadingState(isLoading) {

    const tableBody =
        getElement("purchasesTableBody") ||
        getElement("purchaseTableBody");


    if (
        isLoading &&
        tableBody
    ) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="9"
                    class="table-loading-state"
                >
                    <div class="loading-spinner">
                        <span></span>
                    </div>

                    <p>
                        Loading purchases...
                    </p>
                </td>
            </tr>
        `;

    }


    const refreshButton =
        getElement("refreshPurchasesButton") ||
        getElement("refreshPurchaseButton");


    if (refreshButton) {

        refreshButton.disabled =
            isLoading;

    }

}


/* ============================================================
   MODALS
============================================================ */

function openModal(id) {

    const modal =
        getElement(id);


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


    const focusable =
        query(
            "input, select, textarea, button",
            modal
        );


    if (focusable) {

        setTimeout(
            () => focusable.focus(),
            50
        );

    }

}


function closeModal(modal) {

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
        !query(
            ".modal.active"
        )
    ) {

        document.body.classList.remove(
            "modal-open"
        );

    }

}


function closeAllModals() {

    queryAll(
        ".modal.active"
    ).forEach(
        closeModal
    );

}


function closePurchaseModal() {

    closeModal(
        getElement(
            "purchaseModal"
        )
    );

    purchaseState.editingId = null;

}


function closePurchaseDetails() {

    closeModal(
        getElement(
            "purchaseDetailsModal"
        )
    );

}


function closePaymentModal() {

    closeModal(
        getElement(
            "paymentModal"
        )
    );

}


function setModalTitle(
    modalId,
    title
) {

    const modal =
        getElement(modalId);


    if (!modal) {
        return;
    }


    const titleElement =
        query(
            "h2",
            modal
        );


    if (titleElement) {

        titleElement.textContent =
            title;

    }

}


/* ============================================================
   FORM HELPERS
============================================================ */

function setFormValue(
    form,
    name,
    value
) {

    const field =
        query(
            `[name="${name}"]`,
            form
        );


    if (field) {

        field.value =
            value ?? "";

    }

}


function setFormSubmitting(
    form,
    submitting
) {

    const submitButton =
        query(
            '[type="submit"]',
            form
        );


    if (!submitButton) {
        return;
    }


    if (!submitButton.dataset.originalText) {

        submitButton.dataset.originalText =
            submitButton.textContent;

    }


    submitButton.disabled =
        submitting;


    submitButton.textContent =
        submitting
            ? "Saving..."
            : submitButton.dataset.originalText;

}


/* ============================================================
   PURCHASE HELPERS
============================================================ */

function findPurchase(id) {

    return purchaseState.purchases.find(
        purchase =>
            String(
                getPurchaseId(
                    purchase
                )
            ) === String(id)
    );

}


function getPurchaseId(purchase) {

    return (
        purchase.id ??
        purchase.purchase_id ??
        purchase.purchaseId
    );

}


function getPurchaseTotal(purchase) {

    const value =
        Number(
            purchase.total ??
            purchase.total_amount ??
            purchase.grand_total ??
            purchase.amount ??
            purchase.purchase_total ??
            0
        );


    if (
        Number.isFinite(value)
    ) {

        return value;

    }


    if (
        Array.isArray(
            purchase.items
        )
    ) {

        return purchase.items.reduce(
            (sum, item) => {

                const quantity =
                    Number(
                        item.quantity || 0
                    );


                const price =
                    Number(
                        item.unit_price ??
                        item.price ??
                        0
                    );


                return sum +
                    quantity *
                    price;

            },
            0
        );

    }


    return 0;

}


function getPaidAmount(purchase) {

    return Number(
        purchase.paid_amount ??
        purchase.paid ??
        purchase.amount_paid ??
        0
    ) || 0;

}


function getDueAmount(purchase) {

    const explicitDue =
        purchase.due_amount ??
        purchase.due ??
        purchase.balance_due;


    if (
        explicitDue !== undefined &&
        explicitDue !== null
    ) {

        return Number(
            explicitDue
        ) || 0;

    }


    return Math.max(
        0,
        getPurchaseTotal(
            purchase
        ) -
        getPaidAmount(
            purchase
        )
    );

}


function normalizeStatus(status) {

    return String(
        status ??
        ""
    )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/-/g, "_");

}


function formatStatus(status) {

    const value =
        normalizeStatus(status);


    if (!value) {
        return "Unknown";
    }


    return value
        .split("_")
        .map(
            word =>
                word.charAt(0).toUpperCase() +
                word.slice(1)
        )
        .join(" ");

}


function getStatusClass(status) {

    switch (
        normalizeStatus(status)
    ) {

        case "completed":
        case "received":
        case "approved":
        case "paid":
            return "status-active";


        case "pending":
        case "ordered":
        case "processing":
            return "status-low-stock";


        case "cancelled":
        case "canceled":
        case "rejected":
            return "status-out-of-stock";


        case "draft":
            return "status-neutral";


        default:
            return "status-neutral";

    }

}


function getPaymentStatusClass(status) {

    switch (
        normalizeStatus(status)
    ) {

        case "paid":
            return "status-active";


        case "partial":
        case "partially_paid":
            return "status-low-stock";


        case "unpaid":
        case "overdue":
            return "status-out-of-stock";


        default:
            return "status-neutral";

    }

}


/* ============================================================
   DATE / CURRENCY
============================================================ */

function parseDate(value) {

    if (!value) {
        return null;
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return null;

    }


    return date;

}


function formatDate(value) {

    const date =
        parseDate(value);


    if (!date) {
        return "—";
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


function toInputDate(value) {

    const date =
        parseDate(value);


    if (!date) {
        return "";
    }


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    return `${year}-${month}-${day}`;

}


function formatCurrency(value) {

    const amount =
        Number(value) || 0;


    return new Intl.NumberFormat(
        undefined,
        {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2
        }
    ).format(amount);

}


/* ============================================================
   DOM VALUE HELPERS
============================================================ */

function setText(id, value) {

    const element =
        getElement(id);


    if (element) {

        element.textContent =
            value ?? "";

    }

}


function setNumber(id, value) {

    const element =
        getElement(id);


    if (element) {

        element.textContent =
            Number(value || 0)
                .toLocaleString();

    }

}


function setCurrency(id, value) {

    const element =
        getElement(id);


    if (element) {

        element.textContent =
            formatCurrency(value);

    }

}


function setData(
    id,
    value
) {

    const element =
        getElement(id);


    if (element) {

        element.dataset.value =
            value ?? "";

    }

}


function getData(id) {

    const element =
        getElement(id);


    return element?.dataset?.value ||
        null;

}


/* ============================================================
   SECURITY
============================================================ */

function escapeHtml(value) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }


    return String(value)
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


/* ============================================================
   TOAST
============================================================ */

function showToast(
    message,
    type = "info"
) {

    const container =
        getElement(
            "toastContainer"
        );


    if (!container) {

        window.alert(message);

        return;

    }


    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        `toast toast-${type}`;


    const icon =
        type === "success"
            ? "✓"
            : type === "error"
                ? "!"
                : "i";


    toast.innerHTML = `
        <span class="toast-icon">
            ${icon}
        </span>

        <span class="toast-message">
            ${escapeHtml(message)}
        </span>

        <button
            type="button"
            class="toast-close"
            aria-label="Close notification"
        >
            ×
        </button>
    `;


    const closeButton =
        query(
            ".toast-close",
            toast
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => removeToast(toast)
        );

    }


    container.appendChild(
        toast
    );


    setTimeout(
        () => removeToast(toast),
        4500
    );

}


function removeToast(toast) {

    if (!toast) {
        return;
    }


    toast.classList.add(
        "toast-removing"
    );


    setTimeout(
        () => toast.remove(),
        200
    );

}


/* ============================================================
   DEBOUNCE
============================================================ */

function debounce(
    callback,
    delay
) {

    let timeout;


    return function (...args) {

        clearTimeout(
            timeout
        );


        timeout =
            setTimeout(
                () => callback.apply(
                    this,
                    args
                ),
                delay
            );

    };

}


/* ============================================================
   PUBLIC API
============================================================ */

window.InventoryPurchases = {

    load: loadPurchases,

    refresh: () =>
        loadPurchases(true),

    add: openPurchaseModal,

    edit: editPurchase,

    view: viewPurchase,

    delete: deletePurchase,

    openPayment: openPaymentModal,

    getState: () => ({
        ...purchaseState
    })

};
