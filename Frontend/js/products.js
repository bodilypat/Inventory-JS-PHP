/**
 * ============================================================
 * INVENTORY MANAGEMENT SYSTEM
 * Product Operations
 *
 * File:
 * frontend/products.js
 *
 * Backend expected:
 * PHP REST-style API
 *
 * Example:
 * frontend/products.js
 *            ↓
 * backend/api/products.php
 *            ↓
 * MySQL Database
 * ============================================================
 */

"use strict";


/* ============================================================
   CONFIGURATION
============================================================ */

const PRODUCT_API = "../backend/api/products.php";


/*
 * Change this if your PHP API is located elsewhere.
 *
 * Expected endpoints:
 *
 * GET    products.php
 * GET    products.php?id=1
 * POST   products.php
 * PUT    products.php?id=1
 * DELETE products.php?id=1
 */


/* ============================================================
   APPLICATION STATE
============================================================ */

const ProductState = {

    products: [],

    filteredProducts: [],

    categories: [],

    currentProductId: null,

    isLoading: false,

    currentPage: 1,

    perPage: 10,

    search: "",

    category: "",

    status: "",

    sortBy: "name",

    sortDirection: "asc"

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

async function productRequest(
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
     * Add JSON content type automatically when
     * sending a request body.
     */
    if (config.body && typeof config.body === "object") {

        config.headers = {
            ...config.headers,

            "Content-Type": "application/json"
        };

        config.body =
            JSON.stringify(config.body);
    }


    const response =
        await fetch(url, config);


    /*
     * Try to parse JSON even for error responses.
     */
    let data = null;

    try {

        data = await response.json();

    } catch (error) {

        data = null;

    }


    if (!response.ok) {

        const message =
            data?.message ||
            `Request failed with status ${response.status}`;

        throw new Error(message);
    }


    /*
     * Support APIs that return:
     *
     * {
     *   success: true,
     *   data: [...]
     * }
     *
     * or:
     *
     * [...]
     */
    return data;
}


/* ============================================================
   RESPONSE NORMALIZATION
============================================================ */

function normalizeProducts(response) {

    if (!response) {
        return [];
    }


    /*
     * Common PHP API response:
     *
     * {
     *   success: true,
     *   data: [...]
     * }
     */
    if (Array.isArray(response.data)) {
        return response.data;
    }


    /*
     * Alternative:
     *
     * {
     *   products: [...]
     * }
     */
    if (Array.isArray(response.products)) {
        return response.products;
    }


    /*
     * Direct array response.
     */
    if (Array.isArray(response)) {
        return response;
    }


    return [];
}


/* ============================================================
   LOAD PRODUCTS
============================================================ */

async function loadProducts() {

    setLoading(true);

    showTableLoading();


    try {

        const response =
            await productRequest(PRODUCT_API);


        ProductState.products =
            normalizeProducts(response);


        ProductState.currentPage = 1;


        applyProductFilters();


        updateProductStatistics();


    } catch (error) {

        console.error(
            "Unable to load products:",
            error
        );


        showProductError(
            error.message ||
            "Unable to load products."
        );

    } finally {

        setLoading(false);

    }

}


/* ============================================================
   LOAD SINGLE PRODUCT
============================================================ */

async function getProduct(productId) {

    if (!productId) {
        throw new Error("Product ID is required.");
    }


    const url =
        `${PRODUCT_API}?id=${encodeURIComponent(productId)}`;


    const response =
        await productRequest(url);


    /*
     * Support:
     *
     * { success: true, data: {...} }
     *
     * or:
     *
     * { product: {...} }
     */
    if (response?.data && !Array.isArray(response.data)) {
        return response.data;
    }


    if (
        response?.product &&
        !Array.isArray(response.product)
    ) {
        return response.product;
    }


    return response;
}


/* ============================================================
   CREATE PRODUCT
============================================================ */

async function createProduct(productData) {

    const product =
        validateProduct(productData);


    const response =
        await productRequest(
            PRODUCT_API,
            {
                method: "POST",

                body: product
            }
        );


    /*
     * Reload from server rather than manually
     * inserting a potentially incomplete object.
     */
    await loadProducts();


    return response;

}


/* ============================================================
   UPDATE PRODUCT
============================================================ */

async function updateProduct(
    productId,
    productData
) {

    if (!productId) {
        throw new Error("Product ID is required.");
    }


    const product =
        validateProduct(productData);


    const url =
        `${PRODUCT_API}?id=${encodeURIComponent(productId)}`;


    const response =
        await productRequest(
            url,
            {
                method: "PUT",

                body: product
            }
        );


    await loadProducts();


    return response;

}


/* ============================================================
   DELETE PRODUCT
============================================================ */

async function deleteProduct(productId) {

    if (!productId) {

        throw new Error(
            "Product ID is required."
        );

    }


    const confirmed =
        window.confirm(
            "Are you sure you want to delete this product?"
        );


    if (!confirmed) {
        return false;
    }


    const url =
        `${PRODUCT_API}?id=${encodeURIComponent(productId)}`;


    try {

        setLoading(true);


        await productRequest(
            url,
            {
                method: "DELETE"
            }
        );


        await loadProducts();


        showToast(
            "Product deleted successfully.",
            "success"
        );


        return true;


    } catch (error) {

        console.error(
            "Unable to delete product:",
            error
        );


        showToast(
            error.message ||
            "Unable to delete product.",
            "error"
        );


        return false;


    } finally {

        setLoading(false);

    }

}


/* ============================================================
   VALIDATE PRODUCT
============================================================ */

function validateProduct(data) {

    if (!data || typeof data !== "object") {

        throw new Error(
            "Invalid product data."
        );

    }


    const name =
        String(
            data.name ??
            data.product_name ??
            ""
        ).trim();


    if (!name) {

        throw new Error(
            "Product name is required."
        );

    }


    const sku =
        String(
            data.sku ??
            data.product_code ??
            ""
        ).trim();


    if (!sku) {

        throw new Error(
            "SKU is required."
        );

    }


    const price =
        Number(
            data.price ??
            data.selling_price ??
            0
        );


    if (
        Number.isNaN(price) ||
        price < 0
    ) {

        throw new Error(
            "Selling price must be a valid positive number."
        );

    }


    return {
        ...data,

        name,

        sku,

        price
    };

}


/* ============================================================
   SEARCH / FILTER
============================================================ */

function applyProductFilters() {

    let products =
        [...ProductState.products];


    /*
     * Search
     */
    const search =
        ProductState.search
            .toLowerCase()
            .trim();


    if (search) {

        products =
            products.filter(
                product => {

                    const searchable = [

                        product.name,

                        product.product_name,

                        product.sku,

                        product.product_code,

                        product.barcode,

                        product.category_name

                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();


                    return searchable.includes(search);

                }
            );

    }


    /*
     * Category filter
     */
    if (ProductState.category) {

        products =
            products.filter(
                product => {

                    const categoryId =
                        String(
                            product.category_id ??
                            product.categoryId ??
                            ""
                        );


                    return (
                        categoryId ===
                        String(ProductState.category)
                    );

                }
            );

    }


    /*
     * Status filter
     */
    if (ProductState.status) {

        products =
            products.filter(
                product => {

                    return getProductStatus(
                        product
                    ) === ProductState.status;

                }
            );

    }


    /*
     * Sort
     */
    products.sort(
        compareProducts
    );


    ProductState.filteredProducts =
        products;


    renderProducts();

}


/* ============================================================
   PRODUCT SORTING
============================================================ */

function compareProducts(a, b) {

    const field =
        ProductState.sortBy;


    let valueA =
        getSortableValue(
            a,
            field
        );


    let valueB =
        getSortableValue(
            b,
            field
        );


    if (
        typeof valueA === "string" &&
        typeof valueB === "string"
    ) {

        valueA =
            valueA.toLowerCase();

        valueB =
            valueB.toLowerCase();

    }


    if (valueA < valueB) {
        return ProductState.sortDirection === "asc"
            ? -1
            : 1;
    }


    if (valueA > valueB) {
        return ProductState.sortDirection === "asc"
            ? 1
            : -1;
    }


    return 0;

}


function getSortableValue(
    product,
    field
) {

    switch (field) {

        case "price":
            return Number(
                product.price ??
                product.selling_price ??
                0
            );


        case "stock":
            return Number(
                product.stock ??
                product.quantity ??
                product.stock_quantity ??
                0
            );


        case "sku":
            return (
                product.sku ??
                product.product_code ??
                ""
            );


        case "category":
            return (
                product.category_name ??
                ""
            );


        case "name":
        default:
            return (
                product.name ??
                product.product_name ??
                ""
            );

    }

}


/* ============================================================
   PRODUCT STATUS
============================================================ */

function getProductStatus(product) {

    const stock =
        Number(
            product.stock ??
            product.quantity ??
            product.stock_quantity ??
            0
        );


    const minimumStock =
        Number(
            product.minimum_stock ??
            product.min_stock ??
            product.reorder_level ??
            0
        );


    /*
     * Explicit backend status takes priority.
     */
    if (product.status) {

        const status =
            String(
                product.status
            ).toLowerCase();


        if (
            [
                "active",
                "inactive",
                "low_stock",
                "out_of_stock"
            ].includes(status)
        ) {
            return status;
        }

    }


    if (stock <= 0) {
        return "out_of_stock";
    }


    if (
        minimumStock > 0 &&
        stock <= minimumStock
    ) {
        return "low_stock";
    }


    return "active";

}


/* ============================================================
   RENDER PRODUCTS
============================================================ */

function renderProducts() {

    const tbody =
        getElement(
            "productsTableBody"
        );


    if (!tbody) {
        return;
    }


    const products =
        getPaginatedProducts();


    tbody.innerHTML = "";


    if (
        ProductState.filteredProducts.length === 0
    ) {

        tbody.innerHTML = `

            <tr>
                <td
                    colspan="100"
                    class="table-empty-state"
                >
                    <div class="products-empty">

                        <div class="empty-icon">
                            📦
                        </div>

                        <h3>
                            No products found
                        </h3>

                        <p>
                            There are no products
                            matching your search
                            or filter.
                        </p>

                    </div>
                </td>
            </tr>

        `;


        updatePagination();

        return;
    }


    products.forEach(
        product => {

            tbody.appendChild(
                createProductRow(
                    product
                )
            );

        }
    );


    updatePagination();

}


/* ============================================================
   CREATE PRODUCT TABLE ROW
============================================================ */

function createProductRow(product) {

    const tr =
        document.createElement("tr");


    const id =
        product.id ??
        product.product_id;


    const name =
        escapeHTML(
            product.name ??
            product.product_name ??
            "Unnamed Product"
        );


    const sku =
        escapeHTML(
            product.sku ??
            product.product_code ??
            "—"
        );


    const category =
        escapeHTML(
            product.category_name ??
            "—"
        );


    const price =
        formatCurrency(
            product.price ??
            product.selling_price
        );


    const stock =
        Number(
            product.stock ??
            product.quantity ??
            product.stock_quantity ??
            0
        );


    const status =
        getProductStatus(
            product
        );


    const statusLabel =
        getStatusLabel(
            status
        );


    tr.innerHTML = `

        <td>

            <div class="product-table-name">

                <div class="product-table-image">
                    ${getProductImage(product)}
                </div>

                <div>

                    <strong>
                        ${name}
                    </strong>

                    <small>
                        ${sku}
                    </small>

                </div>

            </div>

        </td>


        <td>
            ${category}
        </td>


        <td>
            ${price}
        </td>


        <td>

            <span
                class="stock-value
                ${getStockClass(product)}"
            >
                ${formatNumber(stock)}
            </span>

        </td>


        <td>

            <span
                class="status-badge
                ${getStatusClass(status)}"
            >
                ${statusLabel}
            </span>

        </td>


        <td>

            <div class="product-actions">

                <button
                    type="button"
                    class="action-button view-product"
                    data-id="${escapeAttribute(id)}"
                    title="View product"
                >
                    👁️
                </button>


                <button
                    type="button"
                    class="action-button edit-product"
                    data-id="${escapeAttribute(id)}"
                    title="Edit product"
                >
                    ✏️
                </button>


                <button
                    type="button"
                    class="action-button delete-product"
                    data-id="${escapeAttribute(id)}"
                    title="Delete product"
                >
                    🗑️
                </button>

            </div>

        </td>

    `;


    return tr;

}


/* ============================================================
   PRODUCT IMAGE
============================================================ */

function getProductImage(product) {

    const image =
        product.image ??
        product.image_url ??
        product.photo ??
        "";


    if (image) {

        return `
            <img
                src="${escapeAttribute(image)}"
                alt=""
                loading="lazy"
            >
        `;

    }


    return "📦";

}


/* ============================================================
   PAGINATION
============================================================ */

function getPaginatedProducts() {

    const start =
        (
            ProductState.currentPage -
            1
        ) *
        ProductState.perPage;


    const end =
        start +
        ProductState.perPage;


    return ProductState
        .filteredProducts
        .slice(start, end);

}


function updatePagination() {

    const total =
        ProductState.filteredProducts.length;


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                total /
                ProductState.perPage
            )
        );


    if (
        ProductState.currentPage >
        totalPages
    ) {

        ProductState.currentPage =
            totalPages;

    }


    const currentPageElement =
        getElement(
            "currentPage"
        );


    const totalPagesElement =
        getElement(
            "totalPages"
        );


    const previousButton =
        getElement(
            "previousPage"
        );


    const nextButton =
        getElement(
            "nextPage"
        );


    if (currentPageElement) {

        currentPageElement.textContent =
            ProductState.currentPage;

    }


    if (totalPagesElement) {

        totalPagesElement.textContent =
            totalPages;

    }


    if (previousButton) {

        previousButton.disabled =
            ProductState.currentPage <= 1;

    }


    if (nextButton) {

        nextButton.disabled =
            ProductState.currentPage >= totalPages;

    }


    const paginationInfo =
        getElement(
            "paginationInfo"
        );


    if (paginationInfo) {

        if (total === 0) {

            paginationInfo.textContent =
                "No products";

        } else {

            const start =
                (
                    ProductState.currentPage -
                    1
                ) *
                ProductState.perPage +
                1;


            const end =
                Math.min(
                    ProductState.currentPage *
                    ProductState.perPage,
                    total
                );


            paginationInfo.textContent =
                `Showing ${start}-${end} of ${total}`;

        }

    }

}


/* ============================================================
   NEXT PAGE
============================================================ */

function nextPage() {

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                ProductState.filteredProducts.length /
                ProductState.perPage
            )
        );


    if (
        ProductState.currentPage <
        totalPages
    ) {

        ProductState.currentPage++;

        renderProducts();

    }

}


/* ============================================================
   PREVIOUS PAGE
============================================================ */

function previousPage() {

    if (
        ProductState.currentPage >
        1
    ) {

        ProductState.currentPage--;

        renderProducts();

    }

}


/* ============================================================
   PRODUCT FORM
============================================================ */

function getProductFormData() {

    const form =
        getElement(
            "productForm"
        );


    if (!form) {

        throw new Error(
            "Product form was not found."
        );

    }


    const formData =
        new FormData(form);


    const data =
        Object.fromEntries(
            formData.entries()
        );


    /*
     * Convert numeric values.
     */
    [
        "price",
        "cost_price",
        "selling_price",
        "stock",
        "quantity",
        "minimum_stock",
        "min_stock",
        "reorder_level",
        "category_id"
    ].forEach(
        field => {

            if (
                data[field] !== undefined &&
                data[field] !== ""
            ) {

                const value =
                    Number(
                        data[field]
                    );


                if (!Number.isNaN(value)) {
                    data[field] = value;
                }

            }

        }
    );


    return data;

}


/* ============================================================
   SUBMIT PRODUCT FORM
============================================================ */

async function handleProductSubmit(event) {

    event.preventDefault();


    const form =
        event.currentTarget;


    const submitButton =
        form.querySelector(
            "[type='submit']"
        );


    try {

        const data =
            getProductFormData();


        if (submitButton) {

            submitButton.disabled = true;

            submitButton.dataset.originalText =
                submitButton.textContent;

            submitButton.textContent =
                ProductState.currentProductId
                    ? "Updating..."
                    : "Saving...";

        }


        if (
            ProductState.currentProductId
        ) {

            await updateProduct(
                ProductState.currentProductId,
                data
            );


            showToast(
                "Product updated successfully.",
                "success"
            );

        } else {

            await createProduct(
                data
            );


            showToast(
                "Product created successfully.",
                "success"
            );

        }


        ProductState.currentProductId =
            null;


        closeProductModal();


        form.reset();


    } catch (error) {

        console.error(
            "Product save error:",
            error
        );


        showToast(
            error.message ||
            "Unable to save product.",
            "error"
        );


    } finally {

        if (submitButton) {

            submitButton.disabled =
                false;

            submitButton.textContent =
                submitButton.dataset.originalText ||
                "Save Product";

        }

    }

}


/* ============================================================
   OPEN CREATE PRODUCT
============================================================ */

function openCreateProduct() {

    ProductState.currentProductId =
        null;


    const form =
        getElement(
            "productForm"
        );


    if (form) {
        form.reset();
    }


    setProductModalTitle(
        "Add Product"
    );


    openProductModal();

}


/* ============================================================
   OPEN EDIT PRODUCT
============================================================ */

async function openEditProduct(productId) {

    try {

        ProductState.currentProductId =
            productId;


        openProductModal();


        setProductModalTitle(
            "Edit Product"
        );


        setProductFormLoading(
            true
        );


        const product =
            await getProduct(
                productId
            );


        populateProductForm(
            product
        );


    } catch (error) {

        console.error(
            "Unable to load product:",
            error
        );


        showToast(
            error.message ||
            "Unable to load product.",
            "error"
        );


        closeProductModal();


    } finally {

        setProductFormLoading(
            false
        );

    }

}


/* ============================================================
   POPULATE PRODUCT FORM
============================================================ */

function populateProductForm(product) {

    const form =
        getElement(
            "productForm"
        );


    if (!form || !product) {
        return;
    }


    const values = {

        name:
            product.name ??
            product.product_name,

        product_name:
            product.product_name ??
            product.name,

        sku:
            product.sku ??
            product.product_code,

        product_code:
            product.product_code ??
            product.sku,

        barcode:
            product.barcode,

        category_id:
            product.category_id,

        description:
            product.description,

        cost_price:
            product.cost_price,

        selling_price:
            product.selling_price ??
            product.price,

        price:
            product.price ??
            product.selling_price,

        stock:
            product.stock ??
            product.quantity ??
            product.stock_quantity,

        quantity:
            product.quantity ??
            product.stock ??
            product.stock_quantity,

        minimum_stock:
            product.minimum_stock ??
            product.min_stock ??
            product.reorder_level,

        min_stock:
            product.min_stock ??
            product.minimum_stock ??
            product.reorder_level,

        reorder_level:
            product.reorder_level ??
            product.minimum_stock ??
            product.min_stock

    };


    Object.entries(values)
        .forEach(
            ([name, value]) => {

                const field =
                    form.elements[name];


                if (
                    field &&
                    value !== undefined &&
                    value !== null
                ) {

                    field.value =
                        value;

                }

            }
        );

}


/* ============================================================
   VIEW PRODUCT
============================================================ */

async function openViewProduct(productId) {

    try {

        const product =
            await getProduct(
                productId
            );


        showProductDetails(
            product
        );


    } catch (error) {

        console.error(
            "Unable to load product:",
            error
        );


        showToast(
            error.message ||
            "Unable to load product.",
            "error"
        );

    }

}


/* ============================================================
   PRODUCT DETAILS
============================================================ */

function showProductDetails(product) {

    const modal =
        getElement(
            "productDetailsModal"
        );


    if (!modal) {

        /*
         * If no details modal exists,
         * use the edit screen instead.
         */
        openEditProduct(
            product.id ??
            product.product_id
        );

        return;

    }


    const fields = {

        productDetailsName:
            product.name ??
            product.product_name ??
            "—",

        productDetailsSku:
            product.sku ??
            product.product_code ??
            "—",

        productDetailsCategory:
            product.category_name ??
            "—",

        productDetailsPrice:
            formatCurrency(
                product.price ??
                product.selling_price
            ),

        productDetailsStock:
            formatNumber(
                product.stock ??
                product.quantity ??
                product.stock_quantity ??
                0
            ),

        productDetailsStatus:
            getStatusLabel(
                getProductStatus(product)
            ),

        productDetailsDescription:
            product.description ??
            "No description available."

    };


    Object.entries(fields)
        .forEach(
            ([id, value]) => {

                const element =
                    getElement(id);


                if (element) {
                    element.textContent =
                        value;
                }

            }
        );


    modal.classList.add("active");

}


/* ============================================================
   MODAL
============================================================ */

function openProductModal() {

    const modal =
        getElement(
            "productModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add("active");


    document.body.classList.add(
        "modal-open"
    );

}


function closeProductModal() {

    const modal =
        getElement(
            "productModal"
        );


    if (modal) {
        modal.classList.remove("active");
    }


    document.body.classList.remove(
        "modal-open"
    );

}


function closeProductDetailsModal() {

    const modal =
        getElement(
            "productDetailsModal"
        );


    if (modal) {
        modal.classList.remove("active");
    }

}


function setProductModalTitle(title) {

    const element =
        getElement(
            "productModalTitle"
        );


    if (element) {
        element.textContent =
            title;
    }

}


function setProductFormLoading(isLoading) {

    const form =
        getElement(
            "productForm"
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
   STATISTICS
============================================================ */

function updateProductStatistics() {

    const products =
        ProductState.products;


    const total =
        products.length;


    const active =
        products.filter(
            product =>
                getProductStatus(product) ===
                "active"
        ).length;


    const lowStock =
        products.filter(
            product =>
                getProductStatus(product) ===
                "low_stock"
        ).length;


    const outOfStock =
        products.filter(
            product =>
                getProductStatus(product) ===
                "out_of_stock"
        ).length;


    setText(
        "totalProducts",
        formatNumber(total)
    );


    setText(
        "activeProducts",
        formatNumber(active)
    );


    setText(
        "lowStockProducts",
        formatNumber(lowStock)
    );


    setText(
        "outOfStockProducts",
        formatNumber(outOfStock)
    );

}


/* ============================================================
   CATEGORIES
============================================================ */

async function loadProductCategories() {

    const categoryApi =
        "../backend/api/categories.php";


    try {

        const response =
            await productRequest(
                categoryApi
            );


        ProductState.categories =
            normalizeProducts(response);


        populateCategorySelects();


    } catch (error) {

        console.error(
            "Unable to load categories:",
            error
        );

    }

}


function populateCategorySelects() {

    const selects =
        document.querySelectorAll(
            "[data-product-category]"
        );


    selects.forEach(
        select => {

            /*
             * Keep existing placeholder.
             */
            const firstOption =
                select.querySelector(
                    "option"
                );


            select.innerHTML = "";


            if (firstOption) {

                select.appendChild(
                    firstOption
                );

            }


            ProductState.categories
                .forEach(
                    category => {

                        const option =
                            document.createElement(
                                "option"
                            );


                        option.value =
                            category.id ??
                            category.category_id;


                        option.textContent =
                            category.name ??
                            category.category_name;


                        select.appendChild(
                            option
                        );

                    }
                );

        }
    );

}


/* ============================================================
   EVENT HANDLERS
============================================================ */

function initializeProductEvents() {

    /*
     * Product form.
     */
    const form =
        getElement(
            "productForm"
        );


    if (form) {

        form.addEventListener(
            "submit",
            handleProductSubmit
        );

    }


    /*
     * Add product buttons.
     */
    $$(
        "[data-action='add-product'], #addProductButton"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                openCreateProduct
            );

        }
    );


    /*
     * Search.
     */
    const search =
        getElement(
            "productSearch"
        );


    if (search) {

        search.addEventListener(
            "input",
            function () {

                ProductState.search =
                    this.value;

                ProductState.currentPage =
                    1;

                applyProductFilters();

            }
        );

    }


    /*
     * Category filter.
     */
    const category =
        getElement(
            "categoryFilter"
        );


    if (category) {

        category.addEventListener(
            "change",
            function () {

                ProductState.category =
                    this.value;

                ProductState.currentPage =
                    1;

                applyProductFilters();

            }
        );

    }


    /*
     * Status filter.
     */
    const status =
        getElement(
            "statusFilter"
        );


    if (status) {

        status.addEventListener(
            "change",
            function () {

                ProductState.status =
                    this.value;

                ProductState.currentPage =
                    1;

                applyProductFilters();

            }
        );

    }


    /*
     * Per-page selection.
     */
    const perPage =
        getElement(
            "perPage"
        );


    if (perPage) {

        perPage.addEventListener(
            "change",
            function () {

                ProductState.perPage =
                    Number(this.value) || 10;

                ProductState.currentPage =
                    1;

                renderProducts();

            }
        );

    }


    /*
     * Previous page.
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


    /*
     * Next page.
     */
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
            "productsTableBody"
        );


    if (table) {

        table.addEventListener(
            "click",
            handleProductTableAction
        );

    }


    /*
     * Close product modal.
     */
    $$(
        "[data-close-product-modal]"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                closeProductModal
            );

        }
    );


    /*
     * Close details modal.
     */
    $$(
        "[data-close-product-details]"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                closeProductDetailsModal
            );

        }
    );


    /*
     * Close modal when clicking outside.
     */
    $$(".modal").forEach(
        modal => {

            modal.addEventListener(
                "click",
                function (event) {

                    if (
                        event.target ===
                        modal
                    ) {

                        modal.classList.remove(
                            "active"
                        );

                        document.body.classList.remove(
                            "modal-open"
                        );

                    }

                }
            );

        }
    );


    /*
     * Escape key closes modals.
     */
    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key !== "Escape") {
                return;
            }


            closeProductModal();

            closeProductDetailsModal();

        }
    );

}


/* ============================================================
   TABLE ACTION HANDLER
============================================================ */

async function handleProductTableAction(event) {

    const button =
        event.target.closest(
            "button[data-id]"
        );


    if (!button) {
        return;
    }


    const productId =
        button.dataset.id;


    if (!productId) {
        return;
    }


    if (
        button.classList.contains(
            "edit-product"
        )
    ) {

        await openEditProduct(
            productId
        );

        return;

    }


    if (
        button.classList.contains(
            "view-product"
        )
    ) {

        await openViewProduct(
            productId
        );

        return;

    }


    if (
        button.classList.contains(
            "delete-product"
        )
    ) {

        await deleteProduct(
            productId
        );

    }

}


/* ============================================================
   SORT HANDLER
============================================================ */

function sortProducts(field) {

    if (
        ProductState.sortBy ===
        field
    ) {

        ProductState.sortDirection =
            ProductState.sortDirection ===
            "asc"
                ? "desc"
                : "asc";

    } else {

        ProductState.sortBy =
            field;

        ProductState.sortDirection =
            "asc";

    }


    applyProductFilters();

}


/* ============================================================
   TABLE HEADER SORT
============================================================ */

function initializeSorting() {

    $$(
        "[data-sort-product]"
    ).forEach(
        header => {

            header.addEventListener(
                "click",
                function () {

                    sortProducts(
                        this.dataset.sortProduct
                    );

                }
            );

        }
    );

}


/* ============================================================
   LOADING UI
============================================================ */

function setLoading(isLoading) {

    ProductState.isLoading =
        isLoading;


    document.body.classList.toggle(
        "products-loading",
        isLoading
    );


    const refreshButton =
        getElement(
            "refreshProductsButton"
        );


    if (refreshButton) {

        refreshButton.disabled =
            isLoading;

    }

}


function showTableLoading() {

    const tbody =
        getElement(
            "productsTableBody"
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
                    Loading products...
                </p>

            </td>

        </tr>

    `;

}


/* ============================================================
   ERROR UI
============================================================ */

function showProductError(message) {

    const tbody =
        getElement(
            "productsTableBody"
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
                    Unable to load products
                </h3>

                <p>
                    ${escapeHTML(message)}
                </p>

                <button
                    type="button"
                    class="btn btn-primary"
                    onclick="loadProducts()"
                >
                    Try Again
                </button>

            </td>

        </tr>

    `;

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
            aria-label="Close"
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


    close.addEventListener(
        "click",
        function () {

            removeToast(
                toast
            );

        }
    );


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


    if (Number.isNaN(number)) {
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
        Number.isNaN(number) ||
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "—";

    }


    /*
     * Change currency here if required.
     *
     * Example:
     * currency: "USD"
     */
    return new Intl.NumberFormat(
        undefined,
        {
            style: "currency",

            currency: "USD",

            minimumFractionDigits: 2
        }
    ).format(number);

}


/* ============================================================
   STATUS HELPERS
============================================================ */

function getStatusLabel(status) {

    switch (status) {

        case "active":
            return "Active";

        case "inactive":
            return "Inactive";

        case "low_stock":
            return "Low Stock";

        case "out_of_stock":
            return "Out of Stock";

        default:
            return "Unknown";

    }

}


function getStatusClass(status) {

    switch (status) {

        case "active":
            return "status-active";

        case "inactive":
            return "status-inactive";

        case "low_stock":
            return "status-warning";

        case "out_of_stock":
            return "status-danger";

        default:
            return "status-neutral";

    }

}


function getStockClass(product) {

    const status =
        getProductStatus(
            product
        );


    if (
        status === "out_of_stock"
    ) {

        return "stock-danger";

    }


    if (
        status === "low_stock"
    ) {

        return "stock-warning";

    }


    return "stock-normal";

}


/* ============================================================
   DOM TEXT HELPER
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
   INITIALIZATION
============================================================ */

async function initializeProducts() {

    initializeProductEvents();

    initializeSorting();


    /*
     * Load categories and products independently.
     * A category API failure should not prevent
     * products from loading.
     */
    await Promise.allSettled([
        loadProductCategories(),
        loadProducts()
    ]);

}


/* ============================================================
   REFRESH BUTTON
============================================================ */

const refreshProductsButton =
    getElement(
        "refreshProductsButton"
    );


if (refreshProductsButton) {

    refreshProductsButton.addEventListener(
        "click",
        function () {

            loadProducts();

        }
    );

}


/* ============================================================
   GLOBAL EXPORTS
============================================================ */

window.ProductOperations = {

    loadProducts,

    getProduct,

    createProduct,

    updateProduct,

    deleteProduct,

    openCreateProduct,

    openEditProduct,

    openViewProduct,

    applyProductFilters,

    sortProducts,

    nextPage,

    previousPage,

    showToast

};


/*
 * Also expose commonly used functions directly.
 * This makes integration with HTML buttons easier.
 */
window.loadProducts =
    loadProducts;

window.openCreateProduct =
    openCreateProduct;

window.openEditProduct =
    openEditProduct;

window.openViewProduct =
    openViewProduct;

window.deleteProduct =
    deleteProduct;


/* ============================================================
   START APPLICATION
============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeProducts
    );

} else {

    initializeProducts();

}
