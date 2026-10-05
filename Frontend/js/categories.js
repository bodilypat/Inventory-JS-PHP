/**
 * ============================================================
 * INVENTORY MANAGEMENT SYSTEM
 * Category Operations
 *
 * File:
 * frontend/js/categories.js
 *
 * Expected backend:
 * backend/api/categories.php
 *
 * Supported operations:
 *
 * GET    categories.php
 * GET    categories.php?id=1
 * POST   categories.php
 * PUT    categories.php?id=1
 * DELETE categories.php?id=1
 * ============================================================
 */

"use strict";


/* ============================================================
   CONFIGURATION
============================================================ */

const CATEGORY_API =
    "../../backend/api/categories.php";


/* ============================================================
   STATE
============================================================ */

const CategoryState = {

    categories: [],

    filteredCategories: [],

    currentCategoryId: null,

    currentPage: 1,

    perPage: 10,

    search: "",

    status: "",

    sortBy: "name",

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

async function categoryRequest(
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
     * Automatically convert JavaScript objects
     * into JSON for POST / PUT requests.
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


    /*
     * Support APIs returning:
     *
     * {
     *   success: true,
     *   data: [...]
     * }
     *
     * or direct arrays/objects.
     */
    return data;

}


/* ============================================================
   RESPONSE NORMALIZATION
============================================================ */

function normalizeCategories(response) {

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
            response.categories
        )
    ) {

        return response.categories;

    }


    if (
        Array.isArray(response)
    ) {

        return response;

    }


    return [];

}


/* ============================================================
   LOAD CATEGORIES
============================================================ */

async function loadCategories() {

    setLoading(true);

    showCategoriesLoading();


    try {

        const response =
            await categoryRequest(
                CATEGORY_API
            );


        CategoryState.categories =
            normalizeCategories(
                response
            );


        CategoryState.currentPage =
            1;


        applyCategoryFilters();


        updateCategoryStatistics();


    } catch (error) {

        console.error(
            "Unable to load categories:",
            error
        );


        showCategoryError(
            error.message ||
            "Unable to load categories."
        );


    } finally {

        setLoading(false);

    }

}


/* ============================================================
   GET SINGLE CATEGORY
============================================================ */

async function getCategory(categoryId) {

    if (!categoryId) {

        throw new Error(
            "Category ID is required."
        );

    }


    const url =
        `${CATEGORY_API}?id=${encodeURIComponent(categoryId)}`;


    const response =
        await categoryRequest(
            url
        );


    if (
        response?.data &&
        !Array.isArray(response.data)
    ) {

        return response.data;

    }


    if (
        response?.category &&
        !Array.isArray(response.category)
    ) {

        return response.category;

    }


    return response;

}


/* ============================================================
   CREATE CATEGORY
============================================================ */

async function createCategory(categoryData) {

    const category =
        validateCategory(
            categoryData
        );


    const response =
        await categoryRequest(
            CATEGORY_API,
            {
                method: "POST",

                body: category
            }
        );


    await loadCategories();


    return response;

}


/* ============================================================
   UPDATE CATEGORY
============================================================ */

async function updateCategory(
    categoryId,
    categoryData
) {

    if (!categoryId) {

        throw new Error(
            "Category ID is required."
        );

    }


    const category =
        validateCategory(
            categoryData
        );


    const url =
        `${CATEGORY_API}?id=${encodeURIComponent(categoryId)}`;


    const response =
        await categoryRequest(
            url,
            {
                method: "PUT",

                body: category
            }
        );


    await loadCategories();


    return response;

}


/* ============================================================
   DELETE CATEGORY
============================================================ */

async function deleteCategory(categoryId) {

    if (!categoryId) {

        throw new Error(
            "Category ID is required."
        );

    }


    /*
     * Ask for confirmation before deleting.
     */
    const confirmed =
        window.confirm(
            "Are you sure you want to delete this category?"
        );


    if (!confirmed) {
        return false;
    }


    const url =
        `${CATEGORY_API}?id=${encodeURIComponent(categoryId)}`;


    try {

        setLoading(true);


        await categoryRequest(
            url,
            {
                method: "DELETE"
            }
        );


        await loadCategories();


        showToast(
            "Category deleted successfully.",
            "success"
        );


        return true;


    } catch (error) {

        console.error(
            "Unable to delete category:",
            error
        );


        showToast(
            error.message ||
            "Unable to delete category.",
            "error"
        );


        return false;


    } finally {

        setLoading(false);

    }

}


/* ============================================================
   VALIDATE CATEGORY
============================================================ */

function validateCategory(data) {

    if (
        !data ||
        typeof data !== "object"
    ) {

        throw new Error(
            "Invalid category data."
        );

    }


    const name =
        String(
            data.name ??
            data.category_name ??
            ""
        ).trim();


    if (!name) {

        throw new Error(
            "Category name is required."
        );

    }


    if (name.length > 150) {

        throw new Error(
            "Category name cannot exceed 150 characters."
        );

    }


    const description =
        String(
            data.description ?? ""
        ).trim();


    const status =
        data.status
            ? String(data.status)
                .toLowerCase()
            : "active";


    if (
        ![
            "active",
            "inactive"
        ].includes(status)
    ) {

        throw new Error(
            "Invalid category status."
        );

    }


    return {

        ...data,

        name,

        description,

        status

    };

}


/* ============================================================
   FILTER CATEGORIES
============================================================ */

function applyCategoryFilters() {

    let categories =
        [
            ...CategoryState.categories
        ];


    /*
     * Search
     */
    const search =
        CategoryState.search
            .toLowerCase()
            .trim();


    if (search) {

        categories =
            categories.filter(
                category => {

                    const searchable = [

                        category.name,

                        category.category_name,

                        category.description

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
     * Status
     */
    if (
        CategoryState.status
    ) {

        categories =
            categories.filter(
                category => {

                    return getCategoryStatus(
                        category
                    ) ===
                    CategoryState.status;

                }
            );

    }


    /*
     * Sort
     */
    categories.sort(
        compareCategories
    );


    CategoryState.filteredCategories =
        categories;


    renderCategories();

}


/* ============================================================
   SORT CATEGORIES
============================================================ */

function compareCategories(
    a,
    b
) {

    let valueA =
        getCategorySortValue(
            a,
            CategoryState.sortBy
        );


    let valueB =
        getCategorySortValue(
            b,
            CategoryState.sortBy
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

        return CategoryState.sortDirection ===
            "asc"
            ? -1
            : 1;

    }


    if (valueA > valueB) {

        return CategoryState.sortDirection ===
            "asc"
            ? 1
            : -1;

    }


    return 0;

}


function getCategorySortValue(
    category,
    field
) {

    switch (field) {

        case "products":

            return Number(
                category.product_count ??
                category.products_count ??
                category.total_products ??
                0
            );


        case "status":

            return getCategoryStatus(
                category
            );


        case "name":

        default:

            return (
                category.name ??
                category.category_name ??
                ""
            );

    }

}


/* ============================================================
   CATEGORY STATUS
============================================================ */

function getCategoryStatus(
    category
) {

    const status =
        String(
            category.status ??
            "active"
        ).toLowerCase();


    if (
        status === "inactive"
    ) {

        return "inactive";

    }


    return "active";

}


function getStatusLabel(status) {

    switch (status) {

        case "active":
            return "Active";

        case "inactive":
            return "Inactive";

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

        default:
            return "status-neutral";

    }

}


/* ============================================================
   RENDER CATEGORIES
============================================================ */

function renderCategories() {

    const tbody =
        getElement(
            "categoriesTableBody"
        );


    if (!tbody) {
        return;
    }


    const categories =
        getPaginatedCategories();


    tbody.innerHTML = "";


    if (
        CategoryState.filteredCategories
            .length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="100"
                    class="table-empty-state"
                >

                    <div class="categories-empty">

                        <div class="empty-icon">
                            🗂️
                        </div>

                        <h3>
                            No categories found
                        </h3>

                        <p>
                            There are no categories
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


    categories.forEach(
        category => {

            tbody.appendChild(
                createCategoryRow(
                    category
                )
            );

        }
    );


    updatePagination();

}


/* ============================================================
   CREATE TABLE ROW
============================================================ */

function createCategoryRow(
    category
) {

    const tr =
        document.createElement(
            "tr"
        );


    const id =
        category.id ??
        category.category_id;


    const name =
        escapeHTML(
            category.name ??
            category.category_name ??
            "Unnamed Category"
        );


    const description =
        escapeHTML(
            category.description ??
            "—"
        );


    const productCount =
        Number(
            category.product_count ??
            category.products_count ??
            category.total_products ??
            0
        );


    const status =
        getCategoryStatus(
            category
        );


    tr.innerHTML = `

        <td>

            <div class="category-name-cell">

                <div class="category-icon">
                    🗂️
                </div>

                <div>

                    <strong>
                        ${name}
                    </strong>

                    <small>
                        ID: ${escapeHTML(id)}
                    </small>

                </div>

            </div>

        </td>


        <td>

            <span class="category-description">
                ${description}
            </span>

        </td>


        <td>

            <span class="product-count">
                ${formatNumber(productCount)}
            </span>

        </td>


        <td>

            <span
                class="status-badge
                ${getStatusClass(status)}"
            >
                ${getStatusLabel(status)}
            </span>

        </td>


        <td>

            <div class="category-actions">

                <button
                    type="button"
                    class="action-button view-category"
                    data-id="${escapeAttribute(id)}"
                    title="View category"
                >
                    👁️
                </button>


                <button
                    type="button"
                    class="action-button edit-category"
                    data-id="${escapeAttribute(id)}"
                    title="Edit category"
                >
                    ✏️
                </button>


                <button
                    type="button"
                    class="action-button delete-category"
                    data-id="${escapeAttribute(id)}"
                    title="Delete category"
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

function getPaginatedCategories() {

    const start =
        (
            CategoryState.currentPage -
            1
        ) *
        CategoryState.perPage;


    const end =
        start +
        CategoryState.perPage;


    return CategoryState
        .filteredCategories
        .slice(
            start,
            end
        );

}


function updatePagination() {

    const total =
        CategoryState
            .filteredCategories
            .length;


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                total /
                CategoryState.perPage
            )
        );


    if (
        CategoryState.currentPage >
        totalPages
    ) {

        CategoryState.currentPage =
            totalPages;

    }


    setText(
        "currentPage",
        CategoryState.currentPage
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
            CategoryState.currentPage <= 1;

    }


    if (nextButton) {

        nextButton.disabled =
            CategoryState.currentPage >=
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
            "No categories";

        return;

    }


    const start =
        (
            CategoryState.currentPage -
            1
        ) *
        CategoryState.perPage +
        1;


    const end =
        Math.min(
            CategoryState.currentPage *
            CategoryState.perPage,
            total
        );


    info.textContent =
        `Showing ${start}-${end} of ${total}`;

}


/* ============================================================
   PAGINATION CONTROLS
============================================================ */

function nextPage() {

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                CategoryState
                    .filteredCategories
                    .length /
                CategoryState.perPage
            )
        );


    if (
        CategoryState.currentPage <
        totalPages
    ) {

        CategoryState.currentPage++;

        renderCategories();

    }

}


function previousPage() {

    if (
        CategoryState.currentPage >
        1
    ) {

        CategoryState.currentPage--;

        renderCategories();

    }

}


/* ============================================================
   CATEGORY FORM
============================================================ */

function getCategoryFormData() {

    const form =
        getElement(
            "categoryForm"
        );


    if (!form) {

        throw new Error(
            "Category form was not found."
        );

    }


    const formData =
        new FormData(form);


    const data =
        Object.fromEntries(
            formData.entries()
        );


    return data;

}


/* ============================================================
   SUBMIT CATEGORY FORM
============================================================ */

async function handleCategorySubmit(
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
            getCategoryFormData();


        if (submitButton) {

            submitButton.disabled =
                true;


            submitButton.dataset.originalText =
                submitButton.textContent;


            submitButton.textContent =
                CategoryState.currentCategoryId
                    ? "Updating..."
                    : "Saving...";

        }


        if (
            CategoryState.currentCategoryId
        ) {

            await updateCategory(
                CategoryState.currentCategoryId,
                data
            );


            showToast(
                "Category updated successfully.",
                "success"
            );

        } else {

            await createCategory(
                data
            );


            showToast(
                "Category created successfully.",
                "success"
            );

        }


        CategoryState.currentCategoryId =
            null;


        form.reset();


        closeCategoryModal();


    } catch (error) {

        console.error(
            "Category save error:",
            error
        );


        showToast(
            error.message ||
            "Unable to save category.",
            "error"
        );


    } finally {

        if (submitButton) {

            submitButton.disabled =
                false;


            submitButton.textContent =
                submitButton.dataset.originalText ||
                "Save Category";

        }

    }

}


/* ============================================================
   CREATE CATEGORY MODAL
============================================================ */

function openCreateCategory() {

    CategoryState.currentCategoryId =
        null;


    const form =
        getElement(
            "categoryForm"
        );


    if (form) {
        form.reset();
    }


    setCategoryModalTitle(
        "Add Category"
    );


    openCategoryModal();

}


/* ============================================================
   EDIT CATEGORY
============================================================ */

async function openEditCategory(
    categoryId
) {

    try {

        CategoryState.currentCategoryId =
            categoryId;


        setCategoryModalTitle(
            "Edit Category"
        );


        openCategoryModal();


        setCategoryFormLoading(
            true
        );


        const category =
            await getCategory(
                categoryId
            );


        populateCategoryForm(
            category
        );


    } catch (error) {

        console.error(
            "Unable to load category:",
            error
        );


        showToast(
            error.message ||
            "Unable to load category.",
            "error"
        );


        closeCategoryModal();


    } finally {

        setCategoryFormLoading(
            false
        );

    }

}


/* ============================================================
   POPULATE CATEGORY FORM
============================================================ */

function populateCategoryForm(
    category
) {

    const form =
        getElement(
            "categoryForm"
        );


    if (
        !form ||
        !category
    ) {
        return;
    }


    const name =
        category.name ??
        category.category_name ??
        "";


    const description =
        category.description ??
        "";


    const status =
        getCategoryStatus(
            category
        );


    const nameField =
        form.elements.name ??
        form.elements.category_name;


    if (nameField) {

        nameField.value =
            name;

    }


    const descriptionField =
        form.elements.description;


    if (descriptionField) {

        descriptionField.value =
            description;

    }


    const statusField =
        form.elements.status;


    if (statusField) {

        statusField.value =
            status;

    }

}


/* ============================================================
   VIEW CATEGORY
============================================================ */

async function openViewCategory(
    categoryId
) {

    try {

        const category =
            await getCategory(
                categoryId
            );


        showCategoryDetails(
            category
        );


    } catch (error) {

        console.error(
            "Unable to load category:",
            error
        );


        showToast(
            error.message ||
            "Unable to load category.",
            "error"
        );

    }

}


/* ============================================================
   CATEGORY DETAILS
============================================================ */

function showCategoryDetails(
    category
) {

    const modal =
        getElement(
            "categoryDetailsModal"
        );


    /*
     * If the page does not provide a details modal,
     * fall back to the edit screen.
     */
    if (!modal) {

        const id =
            category.id ??
            category.category_id;


        openEditCategory(
            id
        );


        return;

    }


    setText(
        "categoryDetailsName",
        category.name ??
        category.category_name ??
        "—"
    );


    setText(
        "categoryDetailsDescription",
        category.description ??
        "No description available."
    );


    setText(
        "categoryDetailsProducts",
        formatNumber(
            category.product_count ??
            category.products_count ??
            category.total_products ??
            0
        )
    );


    setText(
        "categoryDetailsStatus",
        getStatusLabel(
            getCategoryStatus(
                category
            )
        )
    );


    modal.classList.add(
        "active"
    );


    document.body.classList.add(
        "modal-open"
    );

}


/* ============================================================
   MODAL FUNCTIONS
============================================================ */

function openCategoryModal() {

    const modal =
        getElement(
            "categoryModal"
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


function closeCategoryModal() {

    const modal =
        getElement(
            "categoryModal"
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


function closeCategoryDetailsModal() {

    const modal =
        getElement(
            "categoryDetailsModal"
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


function setCategoryModalTitle(
    title
) {

    const element =
        getElement(
            "categoryModalTitle"
        );


    if (element) {

        element.textContent =
            title;

    }

}


function setCategoryFormLoading(
    isLoading
) {

    const form =
        getElement(
            "categoryForm"
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

function updateCategoryStatistics() {

    const categories =
        CategoryState.categories;


    const total =
        categories.length;


    const active =
        categories.filter(
            category =>
                getCategoryStatus(
                    category
                ) === "active"
        ).length;


    const inactive =
        categories.filter(
            category =>
                getCategoryStatus(
                    category
                ) === "inactive"
        ).length;


    const products =
        categories.reduce(
            (
                totalProducts,
                category
            ) => {

                return totalProducts +
                    Number(
                        category.product_count ??
                        category.products_count ??
                        category.total_products ??
                        0
                    );

            },
            0
        );


    setText(
        "totalCategories",
        formatNumber(total)
    );


    setText(
        "activeCategories",
        formatNumber(active)
    );


    setText(
        "inactiveCategories",
        formatNumber(inactive)
    );


    setText(
        "categoryProductCount",
        formatNumber(products)
    );

}


/* ============================================================
   EVENT INITIALIZATION
============================================================ */

function initializeCategoryEvents() {

    /*
     * Category form.
     */
    const form =
        getElement(
            "categoryForm"
        );


    if (form) {

        form.addEventListener(
            "submit",
            handleCategorySubmit
        );

    }


    /*
     * Add category buttons.
     */
    $$(
        "[data-action='add-category'], #addCategoryButton"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                openCreateCategory
            );

        }
    );


    /*
     * Search.
     */
    const search =
        getElement(
            "categorySearch"
        );


    if (search) {

        search.addEventListener(
            "input",
            function () {

                CategoryState.search =
                    this.value;


                CategoryState.currentPage =
                    1;


                applyCategoryFilters();

            }
        );

    }


    /*
     * Status filter.
     */
    const status =
        getElement(
            "categoryStatusFilter"
        );


    if (status) {

        status.addEventListener(
            "change",
            function () {

                CategoryState.status =
                    this.value;


                CategoryState.currentPage =
                    1;


                applyCategoryFilters();

            }
        );

    }


    /*
     * Pagination page size.
     */
    const perPage =
        getElement(
            "perPage"
        );


    if (perPage) {

        perPage.addEventListener(
            "change",
            function () {

                CategoryState.perPage =
                    Number(
                        this.value
                    ) || 10;


                CategoryState.currentPage =
                    1;


                renderCategories();

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
            "categoriesTableBody"
        );


    if (table) {

        table.addEventListener(
            "click",
            handleCategoryTableAction
        );

    }


    /*
     * Close category modal.
     */
    $$(
        "[data-close-category-modal]"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                closeCategoryModal
            );

        }
    );


    /*
     * Close details modal.
     */
    $$(
        "[data-close-category-details]"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                closeCategoryDetailsModal
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


            closeCategoryModal();

            closeCategoryDetailsModal();

        }
    );

}


/* ============================================================
   TABLE ACTION HANDLER
============================================================ */

async function handleCategoryTableAction(
    event
) {

    const button =
        event.target.closest(
            "button[data-id]"
        );


    if (!button) {
        return;
    }


    const categoryId =
        button.dataset.id;


    if (!categoryId) {
        return;
    }


    if (
        button.classList.contains(
            "view-category"
        )
    ) {

        await openViewCategory(
            categoryId
        );


        return;

    }


    if (
        button.classList.contains(
            "edit-category"
        )
    ) {

        await openEditCategory(
            categoryId
        );


        return;

    }


    if (
        button.classList.contains(
            "delete-category"
        )
    ) {

        await deleteCategory(
            categoryId
        );

    }

}


/* ============================================================
   SORTING INITIALIZATION
============================================================ */

function initializeCategorySorting() {

    $$(
        "[data-sort-category]"
    ).forEach(
        header => {

            header.addEventListener(
                "click",
                function () {

                    sortCategories(
                        this.dataset.sortCategory
                    );

                }
            );

        }
    );

}


function sortCategories(field) {

    if (
        CategoryState.sortBy ===
        field
    ) {

        CategoryState.sortDirection =
            CategoryState.sortDirection ===
            "asc"
                ? "desc"
                : "asc";

    } else {

        CategoryState.sortBy =
            field;

        CategoryState.sortDirection =
            "asc";

    }


    applyCategoryFilters();

}


/* ============================================================
   LOADING UI
============================================================ */

function setLoading(
    isLoading
) {

    CategoryState.isLoading =
        isLoading;


    document.body.classList.toggle(
        "categories-loading",
        isLoading
    );


    const refreshButton =
        getElement(
            "refreshCategoriesButton"
        );


    if (refreshButton) {

        refreshButton.disabled =
            isLoading;

    }

}


function showCategoriesLoading() {

    const tbody =
        getElement(
            "categoriesTableBody"
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
                    Loading categories...
                </p>

            </td>

        </tr>

    `;

}


/* ============================================================
   ERROR UI
============================================================ */

function showCategoryError(
    message
) {

    const tbody =
        getElement(
            "categoriesTableBody"
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
                    Unable to load categories
                </h3>

                <p>
                    ${escapeHTML(message)}
                </p>

                <button
                    type="button"
                    class="btn btn-primary"
                    id="retryCategoriesButton"
                >
                    Try Again
                </button>

            </td>

        </tr>

    `;


    const retry =
        getElement(
            "retryCategoriesButton"
        );


    if (retry) {

        retry.addEventListener(
            "click",
            loadCategories
        );

    }

}


/* ============================================================
   TOAST
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


    const closeButton =
        toast.querySelector(
            ".toast-close"
        );


    if (closeButton) {

        closeButton.addEventListener(
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
        Number.isNaN(number)
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
   SECURITY / HTML ESCAPING
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
   REFRESH BUTTON
============================================================ */

function initializeRefreshButton() {

    const button =
        getElement(
            "refreshCategoriesButton"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        loadCategories
    );

}


/* ============================================================
   GLOBAL API
============================================================ */

window.CategoryOperations = {

    loadCategories,

    getCategory,

    createCategory,

    updateCategory,

    deleteCategory,

    openCreateCategory,

    openEditCategory,

    openViewCategory,

    applyCategoryFilters,

    sortCategories,

    nextPage,

    previousPage,

    showToast

};


/*
 * Global functions for HTML onclick handlers,
 * if required.
 */

window.loadCategories =
    loadCategories;

window.openCreateCategory =
    openCreateCategory;

window.openEditCategory =
    openEditCategory;

window.openViewCategory =
    openViewCategory;

window.deleteCategory =
    deleteCategory;


/* ============================================================
   INITIALIZATION
============================================================ */

async function initializeCategories() {

    initializeCategoryEvents();

    initializeCategorySorting();

    initializeRefreshButton();

    await loadCategories();

}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeCategories
    );

} else {

    initializeCategories();

}
