/**
 * ============================================================
 * INVENTORY MANAGEMENT SYSTEM
 * Inventory Operations
 *
 * File:
 * frontend/js/inventory.js
 *
 * Expected backend:
 * backend/api/inventory.php
 *
 * Supported operations:
 *
 * GET    inventory.php
 * GET    inventory.php?id=1
 * POST   inventory.php
 * PUT    inventory.php?id=1
 * DELETE inventory.php?id=1
 *
 * No mock data is used.
 * ============================================================
 */

"use strict";


/* ============================================================
   CONFIGURATION
============================================================ */

const INVENTORY_API =
    "../../backend/api/inventory.php";


/* ============================================================
   APPLICATION STATE
============================================================ */

const InventoryState = {

    inventory: [],

    filteredInventory: [],

    currentInventoryId: null,

    currentPage: 1,

    perPage: 10,

    search: "",

    status: "",

    category: "",

    stockStatus: "",

    sortBy: "product_name",

    sortDirection: "asc",

    isLoading: false

};


/* ============================================================
   DOM HELPERS
============================================================ */

function $(selector) {
    return document.querySelector(selector);
}


function $$(selector) {
    return document.querySelectorAll(selector);
}


function getElement(id) {
    return document.getElementById(id);
}


/* ============================================================
   API REQUEST
============================================================ */

async function inventoryRequest(
    url,
    options = {}
) {

    const config = {

        credentials: "same-origin",

        headers: {
            "Accept": "application/json"
        },

        ...options

    };


    /*
     * Convert JavaScript objects to JSON.
     */
    if (
        config.body &&
        typeof config.body === "object"
    ) {

        config.headers = {

            ...config.headers,

            "Content-Type":
                "application/json"

        };


        config.body =
            JSON.stringify(
                config.body
            );

    }


    const response =
        await fetch(
            url,
            config
        );


    let data = null;


    try {

        data =
            await response.json();

    } catch (error) {

        data = null;

    }


    if (!response.ok) {

        throw new Error(
            data?.message ||
            `Request failed with status ${response.status}`
        );

    }


    if (
        data &&
        data.success === false
    ) {

        throw new Error(
            data.message ||
            "Inventory operation failed."
        );

    }


    return data;

}


/* ============================================================
   RESPONSE NORMALIZATION
============================================================ */

function normalizeInventory(response) {

    if (!response) {
        return [];
    }


    if (
        Array.isArray(
            response.data
        )
    ) {

        return response.data;

    }


    if (
        Array.isArray(
            response.inventory
        )
    ) {

        return response.inventory;

    }


    if (
        Array.isArray(
            response.items
        )
    ) {

        return response.items;

    }


    if (
        Array.isArray(response)
    ) {

        return response;

    }


    return [];

}


/* ============================================================
   LOAD INVENTORY
============================================================ */

async function loadInventory() {

    setLoading(true);

    showInventoryLoading();


    try {

        const response =
            await inventoryRequest(
                INVENTORY_API
            );


        InventoryState.inventory =
            normalizeInventory(
                response
            );


        InventoryState.currentPage =
            1;


        populateCategoryFilter(
            InventoryState.inventory
        );


        applyInventoryFilters();

        updateInventoryStatistics();


    } catch (error) {

        console.error(
            "Unable to load inventory:",
            error
        );


        showInventoryError(
            error.message ||
            "Unable to load inventory."
        );


    } finally {

        setLoading(false);

    }

}


/* ============================================================
   GET SINGLE INVENTORY RECORD
============================================================ */

async function getInventory(
    inventoryId
) {

    if (!inventoryId) {

        throw new Error(
            "Inventory ID is required."
        );

    }


    const url =
        `${INVENTORY_API}?id=${encodeURIComponent(inventoryId)}`;


    const response =
        await inventoryRequest(
            url
        );


    if (
        response?.data &&
        !Array.isArray(
            response.data
        )
    ) {

        return response.data;

    }


    if (
        response?.inventory &&
        !Array.isArray(
            response.inventory
        )
    ) {

        return response.inventory;

    }


    return response;

}


/* ============================================================
   CREATE INVENTORY RECORD
============================================================ */

async function createInventory(
    inventoryData
) {

    const data =
        validateInventory(
            inventoryData
        );


    const response =
        await inventoryRequest(
            INVENTORY_API,
            {
                method: "POST",
                body: data
            }
        );


    await loadInventory();


    return response;

}


/* ============================================================
   UPDATE INVENTORY RECORD
============================================================ */

async function updateInventory(
    inventoryId,
    inventoryData
) {

    if (!inventoryId) {

        throw new Error(
            "Inventory ID is required."
        );

    }


    const data =
        validateInventory(
            inventoryData
        );


    const url =
        `${INVENTORY_API}?id=${encodeURIComponent(inventoryId)}`;


    const response =
        await inventoryRequest(
            url,
            {
                method: "PUT",
                body: data
            }
        );


    await loadInventory();


    return response;

}


/* ============================================================
   DELETE INVENTORY RECORD
============================================================ */

async function deleteInventory(
    inventoryId
) {

    if (!inventoryId) {

        throw new Error(
            "Inventory ID is required."
        );

    }


    const confirmed =
        window.confirm(
            "Are you sure you want to delete this inventory record?"
        );


    if (!confirmed) {
        return false;
    }


    try {

        setLoading(true);


        const url =
            `${INVENTORY_API}?id=${encodeURIComponent(inventoryId)}`;


        await inventoryRequest(
            url,
            {
                method: "DELETE"
            }
        );


        await loadInventory();


        showToast(
            "Inventory record deleted successfully.",
            "success"
        );


        return true;


    } catch (error) {

        console.error(
            "Unable to delete inventory:",
            error
        );


        showToast(
            error.message ||
            "Unable to delete inventory record.",
            "error"
        );


        return false;


    } finally {

        setLoading(false);

    }

}


/* ============================================================
   STOCK ADJUSTMENT
============================================================ */

async function adjustStock(
    inventoryId,
    quantity,
    adjustmentType = "adjustment"
) {

    if (!inventoryId) {

        throw new Error(
            "Inventory ID is required."
        );

    }


    const amount =
        Number(quantity);


    if (
        !Number.isFinite(amount) ||
        amount === 0
    ) {

        throw new Error(
            "A valid non-zero quantity is required."
        );

    }


    const allowedTypes = [
        "increase",
        "decrease",
        "adjustment"
    ];


    if (
        !allowedTypes.includes(
            adjustmentType
        )
    ) {

        throw new Error(
            "Invalid stock adjustment type."
        );

    }


    const url =
        `${INVENTORY_API}?id=${encodeURIComponent(inventoryId)}`;


    const response =
        await inventoryRequest(
            url,
            {
                method: "PATCH",

                body: {

                    quantity: amount,

                    adjustment_type:
                        adjustmentType

                }

            }
        );


    await loadInventory();


    return response;

}


/* ============================================================
   VALIDATE INVENTORY
============================================================ */

function validateInventory(data) {

    if (
        !data ||
        typeof data !== "object"
    ) {

        throw new Error(
            "Invalid inventory data."
        );

    }


    const productId =
        data.product_id ??
        data.productId;


    if (
        productId === undefined ||
        productId === null ||
        productId === ""
    ) {

        throw new Error(
            "Product is required."
        );

    }


    const quantity =
        Number(
            data.quantity ??
            data.stock ??
            data.current_stock ??
            0
        );


    const minimumStock =
        Number(
            data.minimum_stock ??
            data.min_stock ??
            0
        );


    const maximumStock =
        data.maximum_stock ??
        data.max_stock;


    if (
        !Number.isFinite(quantity) ||
        quantity < 0
    ) {

        throw new Error(
            "Stock quantity must be a valid non-negative number."
        );

    }


    if (
        !Number.isFinite(minimumStock) ||
        minimumStock < 0
    ) {

        throw new Error(
            "Minimum stock must be a valid non-negative number."
        );

    }


    if (
        maximumStock !== undefined &&
        maximumStock !== null &&
        maximumStock !== ""
    ) {

        const max =
            Number(
                maximumStock
            );


        if (
            !Number.isFinite(max) ||
            max < minimumStock
        ) {

            throw new Error(
                "Maximum stock must be greater than or equal to minimum stock."
            );

        }

    }


    return {

        ...data,

        product_id:
            productId,

        quantity,

        minimum_stock:
            minimumStock

    };

}


/* ============================================================
   APPLY FILTERS
============================================================ */

function applyInventoryFilters() {

    let inventory =
        [
            ...InventoryState.inventory
        ];


    /*
     * Search
     */
    const search =
        InventoryState.search
            .toLowerCase()
            .trim();


    if (search) {

        inventory =
            inventory.filter(
                item => {

                    const searchable = [

                        item.product_name,

                        item.name,

                        item.sku,

                        item.barcode,

                        item.category_name,

                        item.category

                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();


                    return searchable.includes(
                        search
                    );

                }
            );

    }


    /*
     * Category
     */
    if (
        InventoryState.category
    ) {

        inventory =
            inventory.filter(
                item => {

                    const categoryId =
                        String(
                            item.category_id ??
                            ""
                        );


                    const categoryName =
                        String(
                            item.category_name ??
                            item.category ??
                            ""
                        );


                    return (
                        categoryId ===
                        String(
                            InventoryState.category
                        )
                    ) ||
                    (
                        categoryName
                            .toLowerCase() ===
                        String(
                            InventoryState.category
                        )
                            .toLowerCase()
                    );

                }
            );

    }


    /*
     * Stock status
     */
    if (
        InventoryState.stockStatus
    ) {

        inventory =
            inventory.filter(
                item =>
                    getStockStatus(
                        item
                    ) ===
                    InventoryState.stockStatus
            );

    }


    /*
     * General status
     */
    if (
        InventoryState.status
    ) {

        inventory =
            inventory.filter(
                item =>
                    getInventoryStatus(
                        item
                    ) ===
                    InventoryState.status
            );

    }


    /*
     * Sort
     */
    inventory.sort(
        compareInventory
    );


    InventoryState.filteredInventory =
        inventory;


    renderInventory();

}


/* ============================================================
   SORT INVENTORY
============================================================ */

function compareInventory(
    a,
    b
) {

    let valueA =
        getInventorySortValue(
            a,
            InventoryState.sortBy
        );


    let valueB =
        getInventorySortValue(
            b,
            InventoryState.sortBy
        );


    if (
        typeof valueA === "string"
    ) {

        valueA =
            valueA.toLowerCase();

    }


    if (
        typeof valueB === "string"
    ) {

        valueB =
            valueB.toLowerCase();

    }


    if (valueA < valueB) {

        return InventoryState.sortDirection ===
            "asc"
            ? -1
            : 1;

    }


    if (valueA > valueB) {

        return InventoryState.sortDirection ===
            "asc"
            ? 1
            : -1;

    }


    return 0;

}


function getInventorySortValue(
    item,
    field
) {

    switch (field) {

        case "stock":

            return getQuantity(item);


        case "minimum_stock":

            return getMinimumStock(item);


        case "value":

            return (
                getQuantity(item) *
                getUnitCost(item)
            );


        case "status":

            return getStockStatus(item);


        case "product_name":

        default:

            return (
                item.product_name ??
                item.name ??
                ""
            );

    }

}


/* ============================================================
   INVENTORY STATUS
============================================================ */

function getInventoryStatus(
    item
) {

    const status =
        String(
            item.status ??
            "active"
        ).toLowerCase();


    return status === "inactive"
        ? "inactive"
        : "active";

}


function getStockStatus(
    item
) {

    const quantity =
        getQuantity(item);


    const minimum =
        getMinimumStock(item);


    if (
        quantity <= 0
    ) {

        return "out_of_stock";

    }


    if (
        quantity <= minimum
    ) {

        return "low_stock";

    }


    return "in_stock";

}


function getStockStatusLabel(
    status
) {

    switch (status) {

        case "out_of_stock":
            return "Out of Stock";

        case "low_stock":
            return "Low Stock";

        case "in_stock":
            return "In Stock";

        default:
            return "Unknown";

    }

}


function getStockStatusClass(
    status
) {

    switch (status) {

        case "out_of_stock":
            return "status-out-of-stock";

        case "low_stock":
            return "status-low-stock";

        case "in_stock":
            return "status-in-stock";

        default:
            return "status-neutral";

    }

}


/* ============================================================
   VALUE HELPERS
============================================================ */

function getQuantity(item) {

    return Number(
        item.quantity ??
        item.stock ??
        item.current_stock ??
        0
    );

}


function getMinimumStock(item) {

    return Number(
        item.minimum_stock ??
        item.min_stock ??
        0
    );

}


function getMaximumStock(item) {

    const value =
        item.maximum_stock ??
        item.max_stock;


    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        return null;

    }


    return Number(value);

}


function getUnitCost(item) {

    return Number(
        item.unit_cost ??
        item.cost_price ??
        item.cost ??
        0
    );

}


function getInventoryValue(item) {

    return (
        getQuantity(item) *
        getUnitCost(item)
    );

}


/* ============================================================
   RENDER INVENTORY
============================================================ */

function renderInventory() {

    const tbody =
        getElement(
            "inventoryTableBody"
        );


    if (!tbody) {
        return;
    }


    const inventory =
        getPaginatedInventory();


    tbody.innerHTML = "";


    if (
        InventoryState.filteredInventory
            .length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="100"
                    class="table-empty-state"
                >

                    <div class="inventory-empty">

                        <div class="empty-icon">
                            📦
                        </div>

                        <h3>
                            No inventory records found
                        </h3>

                        <p>
                            There are no inventory records
                            matching your filters.
                        </p>

                    </div>

                </td>

            </tr>

        `;


        updatePagination();

        return;

    }


    inventory.forEach(
        item => {

            tbody.appendChild(
                createInventoryRow(
                    item
                )
            );

        }
    );


    updatePagination();

}


/* ============================================================
   CREATE INVENTORY TABLE ROW
============================================================ */

function createInventoryRow(
    item
) {

    const tr =
        document.createElement(
            "tr"
        );


    const id =
        item.id ??
        item.inventory_id;


    const productName =
        escapeHTML(
            item.product_name ??
            item.name ??
            "Unknown Product"
        );


    const sku =
        escapeHTML(
            item.sku ??
            "—"
        );


    const category =
        escapeHTML(
            item.category_name ??
            item.category ??
            "Uncategorized"
        );


    const quantity =
        getQuantity(item);


    const minimum =
        getMinimumStock(item);


    const status =
        getStockStatus(item);


    const inventoryValue =
        getInventoryValue(item);


    const generalStatus =
        getInventoryStatus(item);


    tr.innerHTML = `

        <td>

            <div class="inventory-product-cell">

                <div class="inventory-product-icon">
                    📦
                </div>

                <div>

                    <strong>
                        ${productName}
                    </strong>

                    <small>
                        SKU: ${sku}
                    </small>

                </div>

            </div>

        </td>


        <td>
            ${category}
        </td>


        <td>

            <strong>
                ${formatNumber(quantity)}
            </strong>

        </td>


        <td>
            ${formatNumber(minimum)}
        </td>


        <td>

            <span
                class="status-badge
                ${getStockStatusClass(status)}"
            >
                ${getStockStatusLabel(status)}
            </span>

        </td>


        <td>

            <strong>
                ${formatCurrency(inventoryValue)}
            </strong>

        </td>


        <td>

            <span
                class="status-badge
                ${generalStatus === "active"
                    ? "status-active"
                    : "status-inactive"}"
            >
                ${generalStatus === "active"
                    ? "Active"
                    : "Inactive"}
            </span>

        </td>


        <td>

            <div class="inventory-actions">

                <button
                    type="button"
                    class="action-button view-inventory"
                    data-id="${escapeAttribute(id)}"
                    title="View inventory"
                >
                    👁️
                </button>


                <button
                    type="button"
                    class="action-button adjust-inventory"
                    data-id="${escapeAttribute(id)}"
                    title="Adjust stock"
                >
                    ↕️
                </button>


                <button
                    type="button"
                    class="action-button edit-inventory"
                    data-id="${escapeAttribute(id)}"
                    title="Edit inventory"
                >
                    ✏️
                </button>


                <button
                    type="button"
                    class="action-button delete-inventory"
                    data-id="${escapeAttribute(id)}"
                    title="Delete inventory"
                >
                    🗑️
                </button>

            </div>

        </td>

    `;


    return tr;

}


/* ============================================================
   PAGINATION
============================================================ */

function getPaginatedInventory() {

    const start =
        (
            InventoryState.currentPage -
            1
        ) *
        InventoryState.perPage;


    const end =
        start +
        InventoryState.perPage;


    return InventoryState
        .filteredInventory
        .slice(
            start,
            end
        );

}


function updatePagination() {

    const total =
        InventoryState
            .filteredInventory
            .length;


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                total /
                InventoryState.perPage
            )
        );


    if (
        InventoryState.currentPage >
        totalPages
    ) {

        InventoryState.currentPage =
            totalPages;

    }


    setText(
        "currentPage",
        InventoryState.currentPage
    );


    setText(
        "totalPages",
        totalPages
    );


    const previousButton =
        getElement(
            "previousPage"
        );


    const nextButton =
        getElement(
            "nextPage"
        );


    if (previousButton) {

        previousButton.disabled =
            InventoryState.currentPage <= 1;

    }


    if (nextButton) {

        nextButton.disabled =
            InventoryState.currentPage >=
            totalPages;

    }


    const info =
        getElement(
            "paginationInfo"
        );


    if (!info) {
        return;
    }


    if (total === 0) {

        info.textContent =
            "No inventory records";

        return;

    }


    const start =
        (
            InventoryState.currentPage -
            1
        ) *
        InventoryState.perPage +
        1;


    const end =
        Math.min(
            InventoryState.currentPage *
            InventoryState.perPage,
            total
        );


    info.textContent =
        `Showing ${start}-${end} of ${total}`;

}


function nextPage() {

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                InventoryState
                    .filteredInventory
                    .length /
                InventoryState.perPage
            )
        );


    if (
        InventoryState.currentPage <
        totalPages
    ) {

        InventoryState.currentPage++;

        renderInventory();

    }

}


function previousPage() {

    if (
        InventoryState.currentPage >
        1
    ) {

        InventoryState.currentPage--;

        renderInventory();

    }

}


/* ============================================================
   INVENTORY STATISTICS
============================================================ */

function updateInventoryStatistics() {

    const inventory =
        InventoryState.inventory;


    const totalRecords =
        inventory.length;


    const totalUnits =
        inventory.reduce(
            (
                total,
                item
            ) => {

                return total +
                    getQuantity(item);

            },
            0
        );


    const lowStock =
        inventory.filter(
            item =>
                getStockStatus(item) ===
                "low_stock"
        ).length;


    const outOfStock =
        inventory.filter(
            item =>
                getStockStatus(item) ===
                "out_of_stock"
        ).length;


    const inStock =
        inventory.filter(
            item =>
                getStockStatus(item) ===
                "in_stock"
        ).length;


    const totalValue =
        inventory.reduce(
            (
                total,
                item
            ) => {

                return total +
                    getInventoryValue(item);

            },
            0
        );


    setText(
        "totalInventoryItems",
        formatNumber(totalRecords)
    );


    setText(
        "totalStockUnits",
        formatNumber(totalUnits)
    );


    setText(
        "lowStockItems",
        formatNumber(lowStock)
    );


    setText(
        "outOfStockItems",
        formatNumber(outOfStock)
    );


    setText(
        "inStockItems",
        formatNumber(inStock)
    );


    setText(
        "totalInventoryValue",
        formatCurrency(totalValue)
    );

}


/* ============================================================
   CATEGORY FILTER
============================================================ */

function populateCategoryFilter(
    inventory
) {

    const select =
        getElement(
            "inventoryCategoryFilter"
        );


    if (!select) {
        return;
    }


    const existingValue =
        select.value;


    const categories =
        new Map();


    inventory.forEach(
        item => {

            const id =
                item.category_id ??
                item.category;


            const name =
                item.category_name ??
                item.category;


            if (
                id !== undefined &&
                id !== null &&
                name
            ) {

                categories.set(
                    String(id),
                    String(name)
                );

            }

        }
    );


    select.innerHTML = `

        <option value="">
            All Categories
        </option>

    `;


    Array.from(
        categories.entries()
    )
        .sort(
            (
                a,
                b
            ) =>
                a[1].localeCompare(
                    b[1]
                )
        )
        .forEach(
            (
                [id, name]
            ) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    id;


                option.textContent =
                    name;


                select.appendChild(
                    option
                );

            }
        );


    if (
        categories.has(
            existingValue
        )
    ) {

        select.value =
            existingValue;

    }

}


/* ============================================================
   FORM DATA
============================================================ */

function getInventoryFormData() {

    const form =
        getElement(
            "inventoryForm"
        );


    if (!form) {

        throw new Error(
            "Inventory form was not found."
        );

    }


    const formData =
        new FormData(form);


    return Object.fromEntries(
        formData.entries()
    );

}


/* ============================================================
   SUBMIT INVENTORY FORM
============================================================ */

async function handleInventorySubmit(
    event
) {

    event.preventDefault();


    const form =
        event.currentTarget;


    const submitButton =
        form.querySelector(
            "[type='submit']"
        );


    try {

        const data =
            getInventoryFormData();


        if (submitButton) {

            submitButton.disabled =
                true;


            submitButton.dataset.originalText =
                submitButton.textContent;


            submitButton.textContent =
                InventoryState.currentInventoryId
                    ? "Updating..."
                    : "Saving...";

        }


        if (
            InventoryState.currentInventoryId
        ) {

            await updateInventory(
                InventoryState.currentInventoryId,
                data
            );


            showToast(
                "Inventory updated successfully.",
                "success"
            );

        } else {

            await createInventory(
                data
            );


            showToast(
                "Inventory record created successfully.",
                "success"
            );

        }


        InventoryState.currentInventoryId =
            null;


        form.reset();


        closeInventoryModal();


    } catch (error) {

        console.error(
            "Inventory save error:",
            error
        );


        showToast(
            error.message ||
            "Unable to save inventory.",
            "error"
        );


    } finally {

        if (submitButton) {

            submitButton.disabled =
                false;


            submitButton.textContent =
                submitButton.dataset.originalText ||
                "Save Inventory";

        }

    }

}


/* ============================================================
   OPEN CREATE MODAL
============================================================ */

function openCreateInventory() {

    InventoryState.currentInventoryId =
        null;


    const form =
        getElement(
            "inventoryForm"
        );


    if (form) {
        form.reset();
    }


    setText(
        "inventoryModalTitle",
        "Add Inventory"
    );


    openInventoryModal();

}


/* ============================================================
   OPEN EDIT MODAL
============================================================ */

async function openEditInventory(
    inventoryId
) {

    try {

        InventoryState.currentInventoryId =
            inventoryId;


        setText(
            "inventoryModalTitle",
            "Edit Inventory"
        );


        openInventoryModal();


        setInventoryFormLoading(
            true
        );


        const inventory =
            await getInventory(
                inventoryId
            );


        populateInventoryForm(
            inventory
        );


    } catch (error) {

        console.error(
            "Unable to load inventory:",
            error
        );


        showToast(
            error.message ||
            "Unable to load inventory.",
            "error"
        );


        closeInventoryModal();


    } finally {

        setInventoryFormLoading(
            false
        );

    }

}


/* ============================================================
   POPULATE INVENTORY FORM
============================================================ */

function populateInventoryForm(
    item
) {

    const form =
        getElement(
            "inventoryForm"
        );


    if (
        !form ||
        !item
    ) {
        return;
    }


    setFormValue(
        form,
        "product_id",
        item.product_id ??
        ""
    );


    setFormValue(
        form,
        "quantity",
        getQuantity(item)
    );


    setFormValue(
        form,
        "minimum_stock",
        getMinimumStock(item)
    );


    setFormValue(
        form,
        "maximum_stock",
        getMaximumStock(item) ?? ""
    );


    setFormValue(
        form,
        "location",
        item.location ??
        item.storage_location ??
        ""
    );


    setFormValue(
        form,
        "status",
        getInventoryStatus(item)
    );


    setFormValue(
        form,
        "notes",
        item.notes ??
        ""
    );

}


/* ============================================================
   SET FORM VALUE
============================================================ */

function setFormValue(
    form,
    fieldName,
    value
) {

    const field =
        form.elements[fieldName];


    if (field) {

        field.value =
            value;

    }

}


/* ============================================================
   VIEW INVENTORY
============================================================ */

async function openViewInventory(
    inventoryId
) {

    try {

        const item =
            await getInventory(
                inventoryId
            );


        showInventoryDetails(
            item
        );


    } catch (error) {

        console.error(
            "Unable to load inventory details:",
            error
        );


        showToast(
            error.message ||
            "Unable to load inventory details.",
            "error"
        );

    }

}


/* ============================================================
   SHOW INVENTORY DETAILS
============================================================ */

function showInventoryDetails(
    item
) {

    const modal =
        getElement(
            "inventoryDetailsModal"
        );


    if (!modal) {

        openEditInventory(
            item.id ??
            item.inventory_id
        );


        return;

    }


    setText(
        "inventoryDetailsProduct",
        item.product_name ??
        item.name ??
        "—"
    );


    setText(
        "inventoryDetailsSku",
        item.sku ??
        "—"
    );


    setText(
        "inventoryDetailsCategory",
        item.category_name ??
        item.category ??
        "—"
    );


    setText(
        "inventoryDetailsStock",
        formatNumber(
            getQuantity(item)
        )
    );


    setText(
        "inventoryDetailsMinimum",
        formatNumber(
            getMinimumStock(item)
        )
    );


    setText(
        "inventoryDetailsValue",
        formatCurrency(
            getInventoryValue(item)
        )
    );


    setText(
        "inventoryDetailsStatus",
        getStockStatusLabel(
            getStockStatus(item)
        )
    );


    setText(
        "inventoryDetailsLocation",
        item.location ??
        item.storage_location ??
        "—"
    );


    setText(
        "inventoryDetailsNotes",
        item.notes ??
        "No notes available."
    );


    modal.classList.add(
        "active"
    );


    document.body.classList.add(
        "modal-open"
    );

}


/* ============================================================
   STOCK ADJUSTMENT MODAL
============================================================ */

async function openStockAdjustment(
    inventoryId
) {

    const item =
        InventoryState.inventory.find(
            record =>
                String(
                    record.id ??
                    record.inventory_id
                ) ===
                String(inventoryId)
        );


    if (!item) {

        showToast(
            "Inventory record not found.",
            "error"
        );


        return;

    }


    InventoryState.currentInventoryId =
        inventoryId;


    const modal =
        getElement(
            "stockAdjustmentModal"
        );


    if (!modal) {

        /*
         * Fallback to edit modal if a dedicated
         * stock adjustment modal is not present.
         */
        await openEditInventory(
            inventoryId
        );


        return;

    }


    setText(
        "adjustmentProductName",
        item.product_name ??
        item.name ??
        "Unknown Product"
    );


    setText(
        "adjustmentCurrentStock",
        formatNumber(
            getQuantity(item)
        )
    );


    const form =
        getElement(
            "stockAdjustmentForm"
        );


    if (form) {
        form.reset();
    }


    modal.classList.add(
        "active"
    );


    document.body.classList.add(
        "modal-open"
    );

}


/* ============================================================
   SUBMIT STOCK ADJUSTMENT
============================================================ */

async function handleStockAdjustmentSubmit(
    event
) {

    event.preventDefault();


    const form =
        event.currentTarget;


    const formData =
        new FormData(form);


    const quantity =
        Number(
            formData.get(
                "quantity"
            )
        );


    const adjustmentType =
        String(
            formData.get(
                "adjustment_type"
            ) ||
            "adjustment"
        );


    try {

        const button =
            form.querySelector(
                "[type='submit']"
            );


        if (button) {

            button.disabled =
                true;

        }


        await adjustStock(
            InventoryState.currentInventoryId,
            quantity,
            adjustmentType
        );


        showToast(
            "Stock adjusted successfully.",
            "success"
        );


        closeStockAdjustmentModal();


    } catch (error) {

        console.error(
            "Stock adjustment error:",
            error
        );


        showToast(
            error.message ||
            "Unable to adjust stock.",
            "error"
        );


    } finally {

        const button =
            form.querySelector(
                "[type='submit']"
            );


        if (button) {

            button.disabled =
                false;

        }

    }

}


/* ============================================================
   MODALS
============================================================ */

function openInventoryModal() {

    const modal =
        getElement(
            "inventoryModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        "active"
    );


    document.body.classList.add(
        "modal-open"
    );

}


function closeInventoryModal() {

    const modal =
        getElement(
            "inventoryModal"
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );

    }


    document.body.classList.remove(
        "modal-open"
    );

}


function closeInventoryDetailsModal() {

    const modal =
        getElement(
            "inventoryDetailsModal"
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );

    }


    document.body.classList.remove(
        "modal-open"
    );

}


function closeStockAdjustmentModal() {

    const modal =
        getElement(
            "stockAdjustmentModal"
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );

    }


    document.body.classList.remove(
        "modal-open"
    );

}


function setInventoryFormLoading(
    isLoading
) {

    const form =
        getElement(
            "inventoryForm"
        );


    if (!form) {
        return;
    }


    form.classList.toggle(
        "is-loading",
        isLoading
    );


    Array.from(
        form.elements
    ).forEach(
        element => {

            element.disabled =
                isLoading;

        }
    );

}


/* ============================================================
   TABLE ACTIONS
============================================================ */

async function handleInventoryTableAction(
    event
) {

    const button =
        event.target.closest(
            "button[data-id]"
        );


    if (!button) {
        return;
    }


    const inventoryId =
        button.dataset.id;


    if (!inventoryId) {
        return;
    }


    if (
        button.classList.contains(
            "view-inventory"
        )
    ) {

        await openViewInventory(
            inventoryId
        );


        return;

    }


    if (
        button.classList.contains(
            "adjust-inventory"
        )
    ) {

        await openStockAdjustment(
            inventoryId
        );


        return;

    }


    if (
        button.classList.contains(
            "edit-inventory"
        )
    ) {

        await openEditInventory(
            inventoryId
        );


        return;

    }


    if (
        button.classList.contains(
            "delete-inventory"
        )
    ) {

        await deleteInventory(
            inventoryId
        );

    }

}


/* ============================================================
   EVENT INITIALIZATION
============================================================ */

function initializeInventoryEvents() {

    /*
     * Inventory form.
     */
    const form =
        getElement(
            "inventoryForm"
        );


    if (form) {

        form.addEventListener(
            "submit",
            handleInventorySubmit
        );

    }


    /*
     * Stock adjustment form.
     */
    const adjustmentForm =
        getElement(
            "stockAdjustmentForm"
        );


    if (adjustmentForm) {

        adjustmentForm.addEventListener(
            "submit",
            handleStockAdjustmentSubmit
        );

    }


    /*
     * Add inventory.
     */
    $$(
        "[data-action='add-inventory'], #addInventoryButton"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                openCreateInventory
            );

        }
    );


    /*
     * Search.
     */
    const search =
        getElement(
            "inventorySearch"
        );


    if (search) {

        search.addEventListener(
            "input",
            function () {

                InventoryState.search =
                    this.value;


                InventoryState.currentPage =
                    1;


                applyInventoryFilters();

            }
        );

    }


    /*
     * Category filter.
     */
    const categoryFilter =
        getElement(
            "inventoryCategoryFilter"
        );


    if (categoryFilter) {

        categoryFilter.addEventListener(
            "change",
            function () {

                InventoryState.category =
                    this.value;


                InventoryState.currentPage =
                    1;


                applyInventoryFilters();

            }
        );

    }


    /*
     * Stock status filter.
     */
    const stockFilter =
        getElement(
            "inventoryStockStatusFilter"
        );


    if (stockFilter) {

        stockFilter.addEventListener(
            "change",
            function () {

                InventoryState.stockStatus =
                    this.value;


                InventoryState.currentPage =
                    1;


                applyInventoryFilters();

            }
        );

    }


    /*
     * General status filter.
     */
    const statusFilter =
        getElement(
            "inventoryStatusFilter"
        );


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            function () {

                InventoryState.status =
                    this.value;


                InventoryState.currentPage =
                    1;


                applyInventoryFilters();

            }
        );

    }


    /*
     * Page size.
     */
    const perPage =
        getElement(
            "perPage"
        );


    if (perPage) {

        perPage.addEventListener(
            "change",
            function () {

                InventoryState.perPage =
                    Number(
                        this.value
                    ) || 10;


                InventoryState.currentPage =
                    1;


                renderInventory();

            }
        );

    }


    /*
     * Pagination.
     */
    const previous =
        getElement(
            "previousPage"
        );


    if (previous) {

        previous.addEventListener(
            "click",
            previousPage
        );

    }


    const next =
        getElement(
            "nextPage"
        );


    if (next) {

        next.addEventListener(
            "click",
            nextPage
        );

    }


    /*
     * Table actions.
     */
    const table =
        getElement(
            "inventoryTableBody"
        );


    if (table) {

        table.addEventListener(
            "click",
            handleInventoryTableAction
        );

    }


    /*
     * Refresh.
     */
    const refresh =
        getElement(
            "refreshInventoryButton"
        );


    if (refresh) {

        refresh.addEventListener(
            "click",
            loadInventory
        );

    }


    /*
     * Close modals.
     */
    $$(
        "[data-close-inventory-modal]"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                closeInventoryModal
            );

        }
    );


    $$(
        "[data-close-inventory-details]"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                closeInventoryDetailsModal
            );

        }
    );


    $$(
        "[data-close-stock-adjustment]"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                closeStockAdjustmentModal
            );

        }
    );


    /*
     * Close modal by clicking backdrop.
     */
    $$(".modal").forEach(
        modal => {

            modal.addEventListener(
                "click",
                function (event) {

                    if (
                        event.target !==
                        modal
                    ) {
                        return;
                    }


                    modal.classList.remove(
                        "active"
                    );


                    document.body.classList.remove(
                        "modal-open"
                    );

                }
            );

        }
    );


    /*
     * Escape key.
     */
    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key !==
                "Escape"
            ) {
                return;
            }


            closeInventoryModal();

            closeInventoryDetailsModal();

            closeStockAdjustmentModal();

        }
    );

}


/* ============================================================
   SORTING
============================================================ */

function initializeInventorySorting() {

    $$(
        "[data-sort-inventory]"
    ).forEach(
        header => {

            header.addEventListener(
                "click",
                function () {

                    sortInventory(
                        this.dataset.sortInventory
                    );

                }
            );

        }
    );

}


function sortInventory(field) {

    if (
        InventoryState.sortBy ===
        field
    ) {

        InventoryState.sortDirection =
            InventoryState.sortDirection ===
            "asc"
                ? "desc"
                : "asc";

    } else {

        InventoryState.sortBy =
            field;

        InventoryState.sortDirection =
            "asc";

    }


    applyInventoryFilters();

}


/* ============================================================
   LOADING UI
============================================================ */

function setLoading(
    isLoading
) {

    InventoryState.isLoading =
        isLoading;


    document.body.classList.toggle(
        "inventory-loading",
        isLoading
    );


    const refresh =
        getElement(
            "refreshInventoryButton"
        );


    if (refresh) {

        refresh.disabled =
            isLoading;

    }

}


function showInventoryLoading() {

    const tbody =
        getElement(
            "inventoryTableBody"
        );


    if (!tbody) {
        return;
    }


    tbody.innerHTML = `

        <tr>

            <td
                colspan="100"
                class="table-loading-state"
            >

                <div class="loading-spinner">
                    <span></span>
                </div>

                <p>
                    Loading inventory...
                </p>

            </td>

        </tr>

    `;

}


/* ============================================================
   ERROR UI
============================================================ */

function showInventoryError(
    message
) {

    const tbody =
        getElement(
            "inventoryTableBody"
        );


    if (!tbody) {
        return;
    }


    tbody.innerHTML = `

        <tr>

            <td
                colspan="100"
                class="table-error-state"
            >

                <div class="error-icon">
                    ⚠️
                </div>

                <h3>
                    Unable to load inventory
                </h3>

                <p>
                    ${escapeHTML(message)}
                </p>

                <button
                    type="button"
                    class="btn btn-primary"
                    id="retryInventoryButton"
                >
                    Try Again
                </button>

            </td>

        </tr>

    `;


    const retry =
        getElement(
            "retryInventoryButton"
        );


    if (retry) {

        retry.addEventListener(
            "click",
            loadInventory
        );

    }

}


/* ============================================================
   TOAST NOTIFICATIONS
============================================================ */

function showToast(
    message,
    type = "info"
) {

    let container =
        getElement(
            "toastContainer"
        );


    if (!container) {

        container =
            document.createElement(
                "div"
            );


        container.id =
            "toastContainer";


        container.className =
            "toast-container";


        document.body.appendChild(
            container
        );

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
            ${escapeHTML(message)}
        </span>

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
        toast.querySelector(
            ".toast-close"
        );


    if (close) {

        close.addEventListener(
            "click",
            () => removeToast(toast)
        );

    }


    setTimeout(
        () => {

            removeToast(
                toast
            );

        },
        5000
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
        () => {

            toast.remove();

        },
        200
    );

}


/* ============================================================
   FORMATTERS
============================================================ */

function formatNumber(value) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return "0";

    }


    return new Intl.NumberFormat(
        undefined,
        {
            maximumFractionDigits: 2
        }
    ).format(number);

}


function formatCurrency(value) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return "$0.00";

    }


    return new Intl.NumberFormat(
        undefined,
        {
            style: "currency",
            currency: "USD"
        }
    ).format(number);

}


/* ============================================================
   TEXT HELPERS
============================================================ */

function setText(
    id,
    value
) {

    const element =
        getElement(id);


    if (element) {

        element.textContent =
            value;

    }

}


/* ============================================================
   HTML ESCAPING
============================================================ */

function escapeHTML(value) {

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


function escapeAttribute(value) {

    return escapeHTML(
        value
    );

}


/* ============================================================
   GLOBAL API
============================================================ */

window.InventoryOperations = {

    loadInventory,

    getInventory,

    createInventory,

    updateInventory,

    deleteInventory,

    adjustStock,

    openCreateInventory,

    openEditInventory,

    openViewInventory,

    openStockAdjustment,

    applyInventoryFilters,

    sortInventory,

    nextPage,

    previousPage,

    showToast

};


/*
 * Optional global functions for
 * HTML onclick handlers.
 */

window.loadInventory =
    loadInventory;

window.openCreateInventory =
    openCreateInventory;

window.openEditInventory =
    openEditInventory;

window.openViewInventory =
    openViewInventory;

window.openStockAdjustment =
    openStockAdjustment;

window.deleteInventory =
    deleteInventory;


/* ============================================================
   INITIALIZATION
============================================================ */

async function initializeInventory() {

    initializeInventoryEvents();

    initializeInventorySorting();

    await loadInventory();

}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeInventory
    );

} else {

    initializeInventory();

}
