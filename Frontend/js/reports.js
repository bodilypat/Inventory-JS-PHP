/* =========================================================
   INVENTORY MANAGEMENT SYSTEM
   REPORTS OPERATIONS
   File: frontend/js/reports.js
   ========================================================= */

"use strict";

/* =========================================================
   CONFIGURATION
   ========================================================= */

const REPORTS_CONFIG = {
    API_URL: "../../backend/api/reports.php",

    DEFAULT_REPORT: "sales",

    DEFAULT_DATE_RANGE: "this_month",

    REQUEST_TIMEOUT: 30000,

    CURRENCY: "USD",

    DATE_FORMAT: "en-US"
};


/* =========================================================
   APPLICATION STATE
   ========================================================= */

const reportsState = {
    reportType: REPORTS_CONFIG.DEFAULT_REPORT,

    dateRange: REPORTS_CONFIG.DEFAULT_DATE_RANGE,

    startDate: "",
    endDate: "",

    search: "",

    page: 1,

    perPage: 25,

    sortField: "",

    sortDirection: "desc",

    loading: false,

    data: null,

    rows: [],

    filteredRows: [],

    totalRows: 0
};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector, parent = document) {
    return parent.querySelector(selector);
}


function $all(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initializeReports();
});


function initializeReports() {

    setDefaultDates();

    bindReportEvents();

    updateDateInputs();

    loadReport();
}


/* =========================================================
   EVENT BINDINGS
   ========================================================= */

function bindReportEvents() {

    const reportType =
        $("#reportType");

    const dateRange =
        $("#dateRange");

    const startDate =
        $("#startDate");

    const endDate =
        $("#endDate");

    const search =
        $("#reportSearch");

    const generate =
        $("#generateReportButton");

    const refresh =
        $("#refreshReportButton");

    const exportButton =
        $("#exportReportButton");

    const printButton =
        $("#printReportButton");

    const previous =
        $("#previousPage");

    const next =
        $("#nextPage");

    const perPage =
        $("#perPage");


    reportType?.addEventListener(
        "change",
        () => {

            reportsState.reportType =
                reportType.value;

            loadReport();

        }
    );


    dateRange?.addEventListener(
        "change",
        () => {

            reportsState.dateRange =
                dateRange.value;

            updateDateInputs();

            if (dateRange.value !== "custom") {
                setDefaultDates();
            }

        }
    );


    startDate?.addEventListener(
        "change",
        () => {

            reportsState.startDate =
                startDate.value;

        }
    );


    endDate?.addEventListener(
        "change",
        () => {

            reportsState.endDate =
                endDate.value;

        }
    );


    generate?.addEventListener(
        "click",
        () => {

            reportsState.page = 1;

            loadReport();

        }
    );


    refresh?.addEventListener(
        "click",
        () => {

            loadReport();

        }
    );


    search?.addEventListener(
        "input",
        debounce(() => {

            reportsState.search =
                search.value.trim().toLowerCase();

            reportsState.page = 1;

            applyFiltersAndRender();

        }, 250)
    );


    exportButton?.addEventListener(
        "click",
        exportReport
    );


    printButton?.addEventListener(
        "click",
        printReport
    );


    previous?.addEventListener(
        "click",
        () => {

            if (reportsState.page > 1) {

                reportsState.page--;

                renderTable();

            }

        }
    );


    next?.addEventListener(
        "click",
        () => {

            const totalPages =
                getTotalPages();

            if (reportsState.page < totalPages) {

                reportsState.page++;

                renderTable();

            }

        }
    );


    perPage?.addEventListener(
        "change",
        () => {

            reportsState.perPage =
                Number(perPage.value) || 25;

            reportsState.page = 1;

            renderTable();

        }
    );


    bindSortingEvents();

    bindQuickDateButtons();

}


/* =========================================================
   QUICK DATE BUTTONS
   ========================================================= */

function bindQuickDateButtons() {

    $all("[data-report-range]").forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const range =
                    button.dataset.reportRange;

                const dateRange =
                    $("#dateRange");

                if (dateRange) {
                    dateRange.value = range;
                }

                reportsState.dateRange = range;

                setDefaultDates();

                updateDateInputs();

                reportsState.page = 1;

                loadReport();

            }
        );

    });

}


/* =========================================================
   SORTING
   ========================================================= */

function bindSortingEvents() {

    $all("[data-report-sort]").forEach(header => {

        header.addEventListener(
            "click",
            () => {

                const field =
                    header.dataset.reportSort;

                if (!field) {
                    return;
                }

                if (
                    reportsState.sortField === field
                ) {

                    reportsState.sortDirection =
                        reportsState.sortDirection === "asc"
                            ? "desc"
                            : "asc";

                } else {

                    reportsState.sortField = field;

                    reportsState.sortDirection = "desc";

                }

                sortRows();

                renderTable();

                updateSortIndicators();

            }
        );

    });

}


/* =========================================================
   DEFAULT DATE HANDLING
   ========================================================= */

function setDefaultDates() {

    const today =
        new Date();

    let start;
    let end;


    switch (reportsState.dateRange) {

        case "today":

            start = new Date(today);

            end = new Date(today);

            break;


        case "yesterday":

            start = new Date(today);

            start.setDate(
                start.getDate() - 1
            );

            end = new Date(start);

            break;


        case "this_week": {

            const day =
                today.getDay();

            const mondayOffset =
                day === 0 ? 6 : day - 1;

            start = new Date(today);

            start.setDate(
                today.getDate() - mondayOffset
            );

            end = new Date(today);

            break;
        }


        case "last_week": {

            const day =
                today.getDay();

            const mondayOffset =
                day === 0 ? 6 : day - 1;

            end = new Date(today);

            end.setDate(
                today.getDate() - mondayOffset - 1
            );

            start = new Date(end);

            start.setDate(
                end.getDate() - 6
            );

            break;
        }


        case "this_month":

            start = new Date(
                today.getFullYear(),
                today.getMonth(),
                1
            );

            end = new Date(today);

            break;


        case "last_month":

            start = new Date(
                today.getFullYear(),
                today.getMonth() - 1,
                1
            );

            end = new Date(
                today.getFullYear(),
                today.getMonth(),
                0
            );

            break;


        case "this_year":

            start = new Date(
                today.getFullYear(),
                0,
                1
            );

            end = new Date(today);

            break;


        case "last_year":

            start = new Date(
                today.getFullYear() - 1,
                0,
                1
            );

            end = new Date(
                today.getFullYear() - 1,
                11,
                31
            );

            break;


        case "custom":

            return;


        default:

            start = new Date(
                today.getFullYear(),
                today.getMonth(),
                1
            );

            end = new Date(today);

    }


    reportsState.startDate =
        formatDateInput(start);

    reportsState.endDate =
        formatDateInput(end);

}


/* =========================================================
   UPDATE DATE INPUTS
   ========================================================= */

function updateDateInputs() {

    const startDate =
        $("#startDate");

    const endDate =
        $("#endDate");

    if (!startDate || !endDate) {
        return;
    }


    startDate.value =
        reportsState.startDate;

    endDate.value =
        reportsState.endDate;


    const custom =
        reportsState.dateRange === "custom";


    startDate.disabled =
        !custom;

    endDate.disabled =
        !custom;


    startDate.removeAttribute("aria-disabled");
    endDate.removeAttribute("aria-disabled");

}


/* =========================================================
   LOAD REPORT
   ========================================================= */

async function loadReport() {

    if (reportsState.loading) {
        return;
    }


    reportsState.loading = true;

    setLoadingState(true);


    try {

        validateDateRange();


        const params =
            new URLSearchParams({

                report:
                    reportsState.reportType,

                start_date:
                    reportsState.startDate,

                end_date:
                    reportsState.endDate,

                page:
                    String(reportsState.page),

                per_page:
                    String(reportsState.perPage)

            });


        const response =
            await fetchWithTimeout(
                `${REPORTS_CONFIG.API_URL}?${params.toString()}`,
                {
                    method: "GET",

                    headers: {
                        "Accept":
                            "application/json"
                    },

                    credentials: "include"
                }
            );


        const payload =
            await parseJsonResponse(response);


        if (!payload.success) {

            throw new Error(
                payload.message ||
                "Unable to load report."
            );

        }


        reportsState.data =
            payload.data || payload;


        reportsState.rows =
            normalizeRows(
                reportsState.data
            );


        reportsState.totalRows =
            Number(
                payload.total ??
                reportsState.rows.length
            );


        reportsState.page =
            Number(
                payload.page ??
                reportsState.page
            );


        applyFiltersAndRender();

        showToast(
            "Report loaded successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "Report loading error:",
            error
        );


        reportsState.data = null;

        reportsState.rows = [];

        reportsState.filteredRows = [];

        reportsState.totalRows = 0;


        renderSummary({});

        renderTableError(
            error.message ||
            "Unable to load report."
        );


        showToast(
            error.message ||
            "Unable to load report.",
            "error"
        );


    } finally {

        reportsState.loading = false;

        setLoadingState(false);

    }

}


/* =========================================================
   VALIDATE DATES
   ========================================================= */

function validateDateRange() {

    if (
        !reportsState.startDate ||
        !reportsState.endDate
    ) {

        setDefaultDates();

    }


    if (
        reportsState.startDate >
        reportsState.endDate
    ) {

        throw new Error(
            "Start date cannot be after end date."
        );

    }

}


/* =========================================================
   FETCH WITH TIMEOUT
   ========================================================= */

async function fetchWithTimeout(
    url,
    options = {}
) {

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () => controller.abort(),
            REPORTS_CONFIG.REQUEST_TIMEOUT
        );


    try {

        return await fetch(
            url,
            {
                ...options,
                signal: controller.signal
            }
        );

    } catch (error) {

        if (error.name === "AbortError") {

            throw new Error(
                "The report request timed out."
            );

        }

        throw error;

    } finally {

        clearTimeout(timeout);

    }

}


/* =========================================================
   PARSE RESPONSE
   ========================================================= */

async function parseJsonResponse(response) {

    let payload;


    try {

        payload =
            await response.json();

    } catch {

        throw new Error(
            "The server returned an invalid response."
        );

    }


    if (!response.ok) {

        throw new Error(
            payload.message ||
            `Server error (${response.status}).`
        );

    }


    return payload;

}


/* =========================================================
   NORMALIZE REPORT ROWS
   ========================================================= */

function normalizeRows(data) {

    if (Array.isArray(data)) {
        return data;
    }


    if (
        Array.isArray(data?.rows)
    ) {

        return data.rows;

    }


    if (
        Array.isArray(data?.records)
    ) {

        return data.records;

    }


    if (
        Array.isArray(data?.items)
    ) {

        return data.items;

    }


    if (
        Array.isArray(data?.results)
    ) {

        return data.results;

    }


    return [];

}


/* =========================================================
   FILTERING
   ========================================================= */

function applyFiltersAndRender() {

    let rows =
        [...reportsState.rows];


    if (reportsState.search) {

        const search =
            reportsState.search;


        rows =
            rows.filter(row => {

                return Object.values(row)
                    .some(value =>
                        String(
                            value ?? ""
                        )
                        .toLowerCase()
                        .includes(search)
                    );

            });

    }


    reportsState.filteredRows =
        rows;


    sortRows();

    renderSummary(
        getSummaryData()
    );

    renderTable();

}


/* =========================================================
   SORT ROWS
   ========================================================= */

function sortRows() {

    const field =
        reportsState.sortField;


    if (!field) {
        return;
    }


    const direction =
        reportsState.sortDirection === "asc"
            ? 1
            : -1;


    reportsState.filteredRows.sort(
        (a, b) => {

            const first =
                a?.[field];

            const second =
                b?.[field];


            const firstNumber =
                Number(first);

            const secondNumber =
                Number(second);


            if (
                Number.isFinite(firstNumber) &&
                Number.isFinite(secondNumber) &&
                first !== "" &&
                second !== null
            ) {

                return (
                    firstNumber -
                    secondNumber
                ) * direction;

            }


            return String(
                first ?? ""
            ).localeCompare(
                String(second ?? ""),
                undefined,
                {
                    numeric: true,
                    sensitivity: "base"
                }
            ) * direction;

        }
    );

}


/* =========================================================
   SUMMARY DATA
   ========================================================= */

function getSummaryData() {

    const source =
        reportsState.data || {};


    return {

        totalSales:
            source.total_sales ??
            source.summary?.total_sales ??
            calculateSum(
                reportsState.rows,
                [
                    "total_sales",
                    "sales_total",
                    "amount",
                    "total"
                ]
            ),

        totalPurchases:
            source.total_purchases ??
            source.summary?.total_purchases ??
            calculateSum(
                reportsState.rows,
                [
                    "total_purchases",
                    "purchases_total",
                    "purchase_amount"
                ]
            ),

        totalProfit:
            source.total_profit ??
            source.summary?.total_profit ??
            calculateSum(
                reportsState.rows,
                [
                    "total_profit",
                    "profit",
                    "net_profit"
                ]
            ),

        totalItems:
            source.total_items ??
            source.summary?.total_items ??
            source.items_count ??
            reportsState.rows.length,

        totalQuantity:
            source.total_quantity ??
            source.summary?.total_quantity ??
            calculateSum(
                reportsState.rows,
                [
                    "quantity",
                    "total_quantity"
                ]
            ),

        totalReceivable:
            source.total_receivable ??
            source.summary?.total_receivable ??
            0,

        totalPayable:
            source.total_payable ??
            source.summary?.total_payable ??
            0

    };

}


/* =========================================================
   CALCULATE SUM
   ========================================================= */

function calculateSum(
    rows,
    fields
) {

    return rows.reduce(
        (sum, row) => {

            for (const field of fields) {

                if (
                    row[field] !== undefined &&
                    row[field] !== null &&
                    row[field] !== ""
                ) {

                    const value =
                        Number(row[field]);

                    if (Number.isFinite(value)) {
                        return sum + value;
                    }

                    break;
                }

            }

            return sum;

        },
        0
    );

}


/* =========================================================
   RENDER SUMMARY
   ========================================================= */

function renderSummary(summary) {

    setText(
        "#totalSales",
        formatCurrency(
            summary.totalSales || 0
        )
    );


    setText(
        "#totalPurchases",
        formatCurrency(
            summary.totalPurchases || 0
        )
    );


    setText(
        "#totalProfit",
        formatCurrency(
            summary.totalProfit || 0
        )
    );


    setText(
        "#totalItems",
        formatNumber(
            summary.totalItems || 0
        )
    );


    setText(
        "#totalQuantity",
        formatNumber(
            summary.totalQuantity || 0
        )
    );


    setText(
        "#totalReceivable",
        formatCurrency(
            summary.totalReceivable || 0
        )
    );


    setText(
        "#totalPayable",
        formatCurrency(
            summary.totalPayable || 0
        )
    );


    const profitElement =
        $("#totalProfit");


    if (profitElement) {

        profitElement.classList.remove(
            "positive",
            "negative"
        );


        if (
            Number(summary.totalProfit) > 0
        ) {

            profitElement.classList.add(
                "positive"
            );

        } else if (
            Number(summary.totalProfit) < 0
        ) {

            profitElement.classList.add(
                "negative"
            );

        }

    }

}


/* =========================================================
   RENDER TABLE
   ========================================================= */

function renderTable() {

    const tbody =
        $("#reportsTableBody");


    if (!tbody) {
        return;
    }


    const rows =
        getPaginatedRows();


    if (!rows.length) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="100%"
                    class="table-empty"
                >
                    No report records found for the selected filters.
                </td>
            </tr>
        `;

        updatePagination();

        return;

    }


    tbody.innerHTML =
        rows.map(
            (row, index) =>
                renderReportRow(
                    row,
                    index
                )
        ).join("");


    updatePagination();

}


/* =========================================================
   RENDER REPORT ROW
   ========================================================= */

function renderReportRow(
    row,
    index
) {

    const reportType =
        reportsState.reportType;


    switch (reportType) {

        case "sales":
            return renderSalesRow(row, index);


        case "purchases":
            return renderPurchaseRow(row, index);


        case "inventory":
            return renderInventoryRow(row, index);


        case "products":
            return renderProductRow(row, index);


        case "customers":
            return renderCustomerRow(row, index);


        case "suppliers":
            return renderSupplierRow(row, index);


        case "profit":
            return renderProfitRow(row, index);


        default:
            return renderGenericRow(row, index);

    }

}


/* =========================================================
   SALES ROW
   ========================================================= */

function renderSalesRow(row) {

    return `
        <tr>
            <td>
                ${escapeHtml(
                    row.invoice_number ??
                    row.invoice_no ??
                    row.reference ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.date ??
                    row.sale_date ??
                    row.created_at ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.customer_name ??
                    row.customer ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.payment_method ??
                    row.payment_type ??
                    "—"
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.subtotal ??
                    row.sub_total ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.tax ??
                    row.tax_amount ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.discount ??
                    row.discount_amount ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.total ??
                    row.total_amount ??
                    row.grand_total ??
                    0
                )}
            </td>
        </tr>
    `;

}


/* =========================================================
   PURCHASE ROW
   ========================================================= */

function renderPurchaseRow(row) {

    return `
        <tr>
            <td>
                ${escapeHtml(
                    row.purchase_number ??
                    row.purchase_no ??
                    row.reference ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.date ??
                    row.purchase_date ??
                    row.created_at ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.supplier_name ??
                    row.supplier ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.payment_method ??
                    row.payment_type ??
                    "—"
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.subtotal ??
                    row.sub_total ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.tax ??
                    row.tax_amount ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.discount ??
                    row.discount_amount ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.total ??
                    row.total_amount ??
                    row.grand_total ??
                    0
                )}
            </td>
        </tr>
    `;

}


/* =========================================================
   INVENTORY ROW
   ========================================================= */

function renderInventoryRow(row) {

    return `
        <tr>
            <td>
                ${escapeHtml(
                    row.sku ??
                    row.product_code ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.product_name ??
                    row.name ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.category_name ??
                    row.category ??
                    "—"
                )}
            </td>

            <td>
                ${formatNumber(
                    row.quantity ??
                    row.stock ??
                    row.current_stock ??
                    0
                )}
            </td>

            <td>
                ${formatNumber(
                    row.minimum_stock ??
                    row.reorder_level ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.unit_cost ??
                    row.cost_price ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.stock_value ??
                    row.inventory_value ??
                    0
                )}
            </td>

            <td>
                ${renderStockStatus(row)}
            </td>
        </tr>
    `;

}


/* =========================================================
   PRODUCT ROW
   ========================================================= */

function renderProductRow(row) {

    return `
        <tr>
            <td>
                ${escapeHtml(
                    row.sku ??
                    row.product_code ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.product_name ??
                    row.name ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.category_name ??
                    row.category ??
                    "—"
                )}
            </td>

            <td>
                ${formatNumber(
                    row.quantity ??
                    row.stock ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.purchase_price ??
                    row.cost_price ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.selling_price ??
                    row.price ??
                    0
                )}
            </td>

            <td>
                ${renderStatus(
                    row.status
                )}
            </td>
        </tr>
    `;

}


/* =========================================================
   CUSTOMER ROW
   ========================================================= */

function renderCustomerRow(row) {

    return `
        <tr>
            <td>
                ${escapeHtml(
                    row.customer_code ??
                    row.code ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.customer_name ??
                    row.name ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.email ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.phone ??
                    row.mobile ??
                    "—"
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.total_sales ??
                    row.sales_total ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.total_receivable ??
                    row.receivable ??
                    0
                )}
            </td>

            <td>
                ${renderStatus(
                    row.status
                )}
            </td>
        </tr>
    `;

}


/* =========================================================
   SUPPLIER ROW
   ========================================================= */

function renderSupplierRow(row) {

    return `
        <tr>
            <td>
                ${escapeHtml(
                    row.supplier_code ??
                    row.code ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.supplier_name ??
                    row.name ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.email ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.phone ??
                    "—"
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.total_purchases ??
                    row.purchases_total ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.total_payable ??
                    row.payable ??
                    0
                )}
            </td>

            <td>
                ${renderStatus(
                    row.status
                )}
            </td>
        </tr>
    `;

}


/* =========================================================
   PROFIT ROW
   ========================================================= */

function renderProfitRow(row) {

    return `
        <tr>
            <td>
                ${escapeHtml(
                    row.date ??
                    row.transaction_date ??
                    "—"
                )}
            </td>

            <td>
                ${escapeHtml(
                    row.reference ??
                    row.invoice_number ??
                    row.transaction ??
                    "—"
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.sales ??
                    row.sales_amount ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.cost ??
                    row.cost_of_goods ??
                    row.purchase_cost ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.expenses ??
                    row.expense ??
                    0
                )}
            </td>

            <td class="money-cell">
                ${formatCurrency(
                    row.profit ??
                    row.net_profit ??
                    0
                )}
            </td>
        </tr>
    `;

}


/* =========================================================
   GENERIC ROW
   ========================================================= */

function renderGenericRow(row) {

    const values =
        Object.values(row);


    return `
        <tr>
            ${values.map(
                value => `
                    <td>
                        ${escapeHtml(
                            value ?? "—"
                        )}
                    </td>
                `
            ).join("")}
        </tr>
    `;

}


/* =========================================================
   STOCK STATUS
   ========================================================= */

function renderStockStatus(row) {

    const quantity =
        Number(
            row.quantity ??
            row.stock ??
            row.current_stock ??
            0
        );


    const minimum =
        Number(
            row.minimum_stock ??
            row.reorder_level ??
            0
        );


    if (quantity <= 0) {

        return `
            <span class="status-badge danger">
                Out of Stock
            </span>
        `;

    }


    if (
        minimum > 0 &&
        quantity <= minimum
    ) {

        return `
            <span class="status-badge warning">
                Low Stock
            </span>
        `;

    }


    return `
        <span class="status-badge success">
            In Stock
        </span>
    `;

}


/* =========================================================
   GENERAL STATUS
   ========================================================= */

function renderStatus(status) {

    const normalized =
        String(
            status ?? "active"
        ).toLowerCase();


    let className =
        "success";


    if (
        [
            "inactive",
            "disabled",
            "cancelled",
            "canceled"
        ].includes(normalized)
    ) {

        className = "danger";

    } else if (
        [
            "pending",
            "draft",
            "hold"
        ].includes(normalized)
    ) {

        className = "warning";

    }


    return `
        <span class="status-badge ${className}">
            ${escapeHtml(
                status ?? "Active"
            )}
        </span>
    `;

}


/* =========================================================
   PAGINATION
   ========================================================= */

function getPaginatedRows() {

    const start =
        (
            reportsState.page - 1
        ) * reportsState.perPage;


    return reportsState.filteredRows.slice(
        start,
        start + reportsState.perPage
    );

}


function getTotalPages() {

    return Math.max(
        1,
        Math.ceil(
            reportsState.filteredRows.length /
            reportsState.perPage
        )
    );

}


function updatePagination() {

    const totalPages =
        getTotalPages();


    if (
        reportsState.page >
        totalPages
    ) {

        reportsState.page =
            totalPages;

    }


    setText(
        "#currentPage",
        String(
            reportsState.page
        )
    );


    setText(
        "#totalPages",
        String(totalPages)
    );


    const previous =
        $("#previousPage");

    const next =
        $("#nextPage");


    if (previous) {

        previous.disabled =
            reportsState.page <= 1;

    }


    if (next) {

        next.disabled =
            reportsState.page >= totalPages;

    }


    const total =
        reportsState.filteredRows.length;


    const start =
        total === 0
            ? 0
            : (
                (reportsState.page - 1) *
                reportsState.perPage
            ) + 1;


    const end =
        Math.min(
            reportsState.page *
            reportsState.perPage,
            total
        );


    setText(
        "#paginationInfo",
        total
            ? `Showing ${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(total)} records`
            : "No records found"
    );


    setText(
        "#reportRecordCount",
        formatNumber(total)
    );

}


/* =========================================================
   SORT INDICATORS
   ========================================================= */

function updateSortIndicators() {

    $all("[data-report-sort]").forEach(
        header => {

            const icon =
                header.querySelector(
                    ".sort-icon"
                );


            const field =
                header.dataset.reportSort;


            if (!icon) {
                return;
            }


            if (
                field !==
                reportsState.sortField
            ) {

                icon.textContent = "↕";

                return;

            }


            icon.textContent =
                reportsState.sortDirection === "asc"
                    ? "↑"
                    : "↓";

        }
    );

}


/* =========================================================
   LOADING STATE
   ========================================================= */

function setLoadingState(isLoading) {

    const button =
        $("#generateReportButton");

    const refresh =
        $("#refreshReportButton");


    if (button) {

        button.disabled =
            isLoading;

        button.dataset.originalText ??=
            button.textContent.trim();


        button.textContent =
            isLoading
                ? "Generating..."
                : button.dataset.originalText;

    }


    if (refresh) {

        refresh.disabled =
            isLoading;

    }


    const tbody =
        $("#reportsTableBody");


    if (
        isLoading &&
        tbody
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="100%"
                    class="table-loading"
                >
                    Loading report...
                </td>
            </tr>
        `;

    }

}


/* =========================================================
   TABLE ERROR
   ========================================================= */

function renderTableError(message) {

    const tbody =
        $("#reportsTableBody");


    if (!tbody) {
        return;
    }


    tbody.innerHTML = `
        <tr>
            <td
                colspan="100%"
                class="table-error"
            >
                ${escapeHtml(message)}
            </td>
        </tr>
    `;


    updatePagination();

}


/* =========================================================
   EXPORT REPORT
   ========================================================= */

function exportReport() {

    const rows =
        reportsState.filteredRows;


    if (!rows.length) {

        showToast(
            "There is no report data to export.",
            "warning"
        );

        return;

    }


    const columns =
        getExportColumns(rows);


    const csvRows = [];


    csvRows.push(
        columns.map(
            column =>
                csvEscape(
                    column.label
                )
        ).join(",")
    );


    rows.forEach(row => {

        csvRows.push(
            columns.map(
                column =>
                    csvEscape(
                        row[column.key]
                    )
            ).join(",")
        );

    });


    const csv =
        "\uFEFF" +
        csvRows.join("\r\n");


    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download =
        `${reportsState.reportType}-report-${reportsState.startDate}-to-${reportsState.endDate}.csv`;


    document.body.appendChild(link);

    link.click();

    link.remove();


    URL.revokeObjectURL(url);


    showToast(
        "Report exported successfully.",
        "success"
    );

}


/* =========================================================
   EXPORT COLUMNS
   ========================================================= */

function getExportColumns(rows) {

    const keys =
        new Set();


    rows.forEach(row => {

        Object.keys(row)
            .forEach(key =>
                keys.add(key)
            );

    });


    return Array.from(keys).map(
        key => ({
            key,
            label: humanizeKey(key)
        })
    );

}


/* =========================================================
   PRINT REPORT
   ========================================================= */

function printReport() {

    if (
        !reportsState.filteredRows.length
    ) {

        showToast(
            "There is no report data to print.",
            "warning"
        );

        return;

    }


    const printWindow =
        window.open(
            "",
            "_blank",
            "width=1200,height=800"
        );


    if (!printWindow) {

        showToast(
            "Please allow pop-ups to print the report.",
            "warning"
        );

        return;

    }


    const title =
        `${humanizeKey(reportsState.reportType)} Report`;


    const columns =
        getExportColumns(
            reportsState.filteredRows
        );


    const rowsHtml =
        reportsState.filteredRows
            .map(row => {

                return `
                    <tr>
                        ${columns.map(
                            column => `
                                <td>
                                    ${escapeHtml(
                                        row[column.key] ?? ""
                                    )}
                                </td>
                            `
                        ).join("")}
                    </tr>
                `;

            })
            .join("");


    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHtml(title)}</title>

            <style>
                body {
                    font-family:
                        Arial,
                        Helvetica,
                        sans-serif;

                    color: #111827;
                    padding: 30px;
                }

                h1 {
                    margin: 0 0 8px;
                    font-size: 22px;
                }

                .period {
                    color: #6b7280;
                    margin-bottom: 24px;
                    font-size: 13px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                }

                th,
                td {
                    padding: 8px;
                    border: 1px solid #d1d5db;
                    text-align: left;
                }

                th {
                    background: #f3f4f6;
                    font-weight: 700;
                }

                @media print {
                    body {
                        padding: 10px;
                    }
                }
            </style>
        </head>

        <body>

            <h1>
                ${escapeHtml(title)}
            </h1>

            <div class="period">
                Period:
                ${escapeHtml(
                    reportsState.startDate
                )}
                —
                ${escapeHtml(
                    reportsState.endDate
                )}
            </div>

            <table>

                <thead>
                    <tr>
                        ${columns.map(
                            column => `
                                <th>
                                    ${escapeHtml(
                                        column.label
                                    )}
                                </th>
                            `
                        ).join("")}
                    </tr>
                </thead>

                <tbody>
                    ${rowsHtml}
                </tbody>

            </table>

        </body>
        </html>
    `);


    printWindow.document.close();


    printWindow.focus();


    setTimeout(
        () => {

            printWindow.print();

        },
        250
    );

}


/* =========================================================
   FORMATTERS
   ========================================================= */

function formatCurrency(value) {

    const number =
        Number(value) || 0;


    return new Intl.NumberFormat(
        REPORTS_CONFIG.DATE_FORMAT,
        {
            style: "currency",
            currency: REPORTS_CONFIG.CURRENCY,

            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(number);

}


function formatNumber(value) {

    const number =
        Number(value) || 0;


    return new Intl.NumberFormat(
        REPORTS_CONFIG.DATE_FORMAT
    ).format(number);

}


function formatDateInput(date) {

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


/* =========================================================
   HTML HELPERS
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function csvEscape(value) {

    const string =
        String(value ?? "");


    if (
        /[",\r\n]/.test(string)
    ) {

        return `"${string.replaceAll(
            '"',
            '""'
        )}"`;

    }


    return string;

}


function humanizeKey(key) {

    return String(key)
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

}


function setText(
    selector,
    value
) {

    const element =
        $(selector);


    if (element) {
        element.textContent = value;
    }

}


/* =========================================================
   DEBOUNCE
   ========================================================= */

function debounce(
    callback,
    delay
) {

    let timeout;


    return (...args) => {

        clearTimeout(timeout);


        timeout =
            setTimeout(
                () => callback(...args),
                delay
            );

    };

}


/* =========================================================
   TOAST NOTIFICATIONS
   ========================================================= */

function showToast(
    message,
    type = "info"
) {

    const container =
        $("#toastContainer");


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


    container.appendChild(toast);


    setTimeout(
        () => {

            toast.style.opacity = "0";

            toast.style.transform =
                "translateY(10px)";


            setTimeout(
                () => toast.remove(),
                200
            );

        },
        3500
    );

}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.InventoryReports = {

    load: loadReport,

    refresh: loadReport,

    export: exportReport,

    print: printReport,

    getState: () => ({
        ...reportsState
    })

};
