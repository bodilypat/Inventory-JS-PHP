/**
 * ============================================================
 * INVENTORY MANAGEMENT SYSTEM
 * Dashboard Operations
 *
 * File:
 * frontend/js/dashboard.js
 *
 * Purpose:
 * - Load dashboard statistics
 * - Load recent sales
 * - Load recent purchases
 * - Load low-stock products
 * - Load sales chart data
 * - Handle dashboard refresh
 * - Handle API errors
 *
 * Expected backend:
 * /backend/api/dashboard.php
 * ============================================================
 */

"use strict";

const Dashboard = (() => {

    /* ========================================================
       CONFIGURATION
       ======================================================== */

    const CONFIG = {
        API_URL: "../backend/api/dashboard.php",

        endpoints: {
            summary: "?action=summary",
            sales: "?action=sales",
            lowStock: "?action=low_stock",
            recentSales: "?action=recent_sales",
            recentPurchases: "?action=recent_purchases"
        },

        currency: "USD",

        dateLocale: "en-US",

        refreshInterval: 5 * 60 * 1000
    };


    /* ========================================================
       STATE
       ======================================================== */

    const state = {
        summary: null,
        sales: [],
        lowStock: [],
        recentSales: [],
        recentPurchases: [],
        loading: false,
        refreshTimer: null
    };


    /* ========================================================
       DOM HELPERS
       ======================================================== */

    const selectors = {

        totalProducts: [
            "#totalProducts",
            "[data-dashboard='total-products']"
        ],

        totalCategories: [
            "#totalCategories",
            "[data-dashboard='total-categories']"
        ],

        totalStock: [
            "#totalStock",
            "[data-dashboard='total-stock']"
        ],

        lowStock: [
            "#lowStock",
            "[data-dashboard='low-stock']"
        ],

        totalSales: [
            "#totalSales",
            "[data-dashboard='total-sales']"
        ],

        totalPurchases: [
            "#totalPurchases",
            "[data-dashboard='total-purchases']"
        ],

        customers: [
            "#totalCustomers",
            "[data-dashboard='total-customers']"
        ],

        suppliers: [
            "#totalSuppliers",
            "[data-dashboard='total-suppliers']"
        ],

        salesChart: [
            "#salesChart",
            "[data-dashboard='sales-chart']"
        ],

        lowStockTable: [
            "#lowStockTable",
            "[data-dashboard='low-stock-table']"
        ],

        recentSalesTable: [
            "#recentSalesTable",
            "[data-dashboard='recent-sales']"
        ],

        recentPurchasesTable: [
            "#recentPurchasesTable",
            "[data-dashboard='recent-purchases']"
        ],

        refreshButton: [
            "#refreshDashboard",
            "[data-action='refresh-dashboard']"
        ],

        lastUpdated: [
            "#lastUpdated",
            "[data-dashboard='last-updated']"
        ]
    };


    function getElement(selectorList) {

        for (const selector of selectorList) {

            const element = document.querySelector(selector);

            if (element) {
                return element;
            }
        }

        return null;
    }


    /* ========================================================
       API
       ======================================================== */

    async function request(endpoint, options = {}) {

        const response = await fetch(
            `${CONFIG.API_URL}${endpoint}`,
            {
                method: options.method || "GET",

                headers: {
                    "Accept": "application/json",

                    ...(options.body
                        ? {
                            "Content-Type":
                                "application/json"
                        }
                        : {})
                },

                credentials: "include",

                ...options
            }
        );

        let data;

        try {

            data = await response.json();

        } catch (error) {

            throw new Error(
                "Invalid response received from server."
            );
        }


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to load dashboard data."
            );
        }


        if (data.success === false) {

            throw new Error(
                data.message ||
                "Dashboard request failed."
            );
        }


        return data;
    }


    /* ========================================================
       FORMATTERS
       ======================================================== */

    function formatNumber(value) {

        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "0";
        }

        return new Intl.NumberFormat(
            CONFIG.dateLocale
        ).format(number);
    }


    function formatCurrency(value) {

        const number = Number(value);

        if (!Number.isFinite(number)) {
            return new Intl.NumberFormat(
                CONFIG.dateLocale,
                {
                    style: "currency",
                    currency: CONFIG.currency
                }
            ).format(0);
        }

        return new Intl.NumberFormat(
            CONFIG.dateLocale,
            {
                style: "currency",
                currency: CONFIG.currency
            }
        ).format(number);
    }


    function formatDate(date) {

        if (!date) {
            return "—";
        }

        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return "—";
        }

        return new Intl.DateTimeFormat(
            CONFIG.dateLocale,
            {
                year: "numeric",
                month: "short",
                day: "numeric"
            }
        ).format(parsed);
    }


    function formatDateTime(date) {

        if (!date) {
            return "—";
        }

        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return "—";
        }

        return new Intl.DateTimeFormat(
            CONFIG.dateLocale,
            {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
            }
        ).format(parsed);
    }


    function escapeHTML(value) {

        const div = document.createElement("div");

        div.textContent =
            value === null ||
            value === undefined
                ? ""
                : String(value);

        return div.innerHTML;
    }


    /* ========================================================
       SUMMARY
       ======================================================== */

    function renderSummary(summary) {

        if (!summary) {
            return;
        }


        setText(
            selectors.totalProducts,
            summary.total_products
        );

        setText(
            selectors.totalCategories,
            summary.total_categories
        );

        setText(
            selectors.totalStock,
            formatNumber(summary.total_stock)
        );

        setText(
            selectors.lowStock,
            summary.low_stock
        );

        setText(
            selectors.totalSales,
            formatCurrency(summary.total_sales)
        );

        setText(
            selectors.totalPurchases,
            formatCurrency(summary.total_purchases)
        );

        setText(
            selectors.customers,
            summary.total_customers
        );

        setText(
            selectors.suppliers,
            summary.total_suppliers
        );
    }


    function setText(selectorList, value) {

        const element =
            getElement(selectorList);

        if (!element) {
            return;
        }

        element.textContent =
            value === null ||
            value === undefined
                ? "0"
                : value;
    }


    /* ========================================================
       LOW STOCK
       ======================================================== */

    function renderLowStock(products) {

        const container =
            getElement(selectors.lowStockTable);

        if (!container) {
            return;
        }


        if (!Array.isArray(products) ||
            products.length === 0) {

            container.innerHTML = `
                <div class="dashboard-empty">
                    <div class="dashboard-empty-icon">
                        ✓
                    </div>

                    <h3>Stock levels are healthy</h3>

                    <p>
                        No products are currently below
                        their minimum stock level.
                    </p>
                </div>
            `;

            return;
        }


        /*
         * Supports both:
         * - <tbody>
         * - normal container
         */

        const isTableBody =
            container.tagName === "TBODY";


        const rows = products.map(product => {

            const stock =
                Number(product.stock ?? 0);

            const minimum =
                Number(
                    product.minimum_stock ??
                    product.min_stock ??
                    0
                );

            let statusClass = "warning";

            if (stock <= 0) {
                statusClass = "danger";
            }


            return `
                <tr>
                    <td>
                        ${escapeHTML(
                            product.name ||
                            product.product_name ||
                            "Unnamed product"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            product.sku || "—"
                        )}
                    </td>

                    <td>
                        <span class="stock-value ${statusClass}">
                            ${formatNumber(stock)}
                        </span>
                    </td>

                    <td>
                        ${formatNumber(minimum)}
                    </td>

                    <td>
                        <span class="category-status ${statusClass}">
                            ${
                                stock <= 0
                                    ? "Out of stock"
                                    : "Low stock"
                            }
                        </span>
                    </td>
                </tr>
            `;
        }).join("");


        if (isTableBody) {

            container.innerHTML = rows;

        } else {

            container.innerHTML = `
                <div class="dashboard-table-wrapper">
                    <table class="dashboard-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>SKU</th>
                                <th>Stock</th>
                                <th>Minimum</th>
                                <th>Status</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `;
        }
    }


    /* ========================================================
       RECENT SALES
       ======================================================== */

    function renderRecentSales(sales) {

        const container =
            getElement(selectors.recentSalesTable);

        if (!container) {
            return;
        }


        if (!Array.isArray(sales) ||
            sales.length === 0) {

            renderEmptyTable(
                container,
                "No sales transactions found."
            );

            return;
        }


        const rows = sales.map(sale => {

            const amount =
                sale.total ??
                sale.amount ??
                0;


            return `
                <tr>

                    <td>
                        ${escapeHTML(
                            sale.invoice_number ||
                            sale.invoice_no ||
                            sale.reference ||
                            "—"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            sale.customer_name ||
                            sale.customer ||
                            "Walk-in customer"
                        )}
                    </td>

                    <td>
                        ${formatCurrency(amount)}
                    </td>

                    <td>
                        ${formatDateTime(
                            sale.created_at ||
                            sale.sale_date
                        )}
                    </td>

                    <td>
                        <span class="transaction-status ${
                            getStatusClass(
                                sale.status
                            )
                        }">
                            ${escapeHTML(
                                sale.status ||
                                "Completed"
                            )}
                        </span>
                    </td>

                </tr>
            `;
        }).join("");


        setTableRows(
            container,
            rows,
            [
                "Invoice",
                "Customer",
                "Amount",
                "Date",
                "Status"
            ]
        );
    }


    /* ========================================================
       RECENT PURCHASES
       ======================================================== */

    function renderRecentPurchases(purchases) {

        const container =
            getElement(selectors.recentPurchasesTable);

        if (!container) {
            return;
        }


        if (!Array.isArray(purchases) ||
            purchases.length === 0) {

            renderEmptyTable(
                container,
                "No purchase transactions found."
            );

            return;
        }


        const rows = purchases.map(purchase => {

            const amount =
                purchase.total ??
                purchase.amount ??
                0;


            return `
                <tr>

                    <td>
                        ${escapeHTML(
                            purchase.purchase_number ||
                            purchase.invoice_number ||
                            purchase.reference ||
                            "—"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            purchase.supplier_name ||
                            purchase.supplier ||
                            "—"
                        )}
                    </td>

                    <td>
                        ${formatCurrency(amount)}
                    </td>

                    <td>
                        ${formatDateTime(
                            purchase.created_at ||
                            purchase.purchase_date
                        )}
                    </td>

                    <td>
                        <span class="transaction-status ${
                            getStatusClass(
                                purchase.status
                            )
                        }">
                            ${escapeHTML(
                                purchase.status ||
                                "Completed"
                            )}
                        </span>
                    </td>

                </tr>
            `;
        }).join("");


        setTableRows(
            container,
            rows,
            [
                "Purchase",
                "Supplier",
                "Amount",
                "Date",
                "Status"
            ]
        );
    }


    /* ========================================================
       TABLE HELPERS
       ======================================================== */

    function setTableRows(
        container,
        rows,
        headers
    ) {

        if (container.tagName === "TBODY") {

            container.innerHTML = rows;

            return;
        }


        container.innerHTML = `
            <div class="dashboard-table-wrapper">

                <table class="dashboard-table">

                    <thead>
                        <tr>
                            ${headers.map(
                                header =>
                                    `<th>${header}</th>`
                            ).join("")}
                        </tr>
                    </thead>

                    <tbody>
                        ${rows}
                    </tbody>

                </table>

            </div>
        `;
    }


    function renderEmptyTable(
        container,
        message
    ) {

        if (container.tagName === "TBODY") {

            const columnCount =
                container.closest("table")
                    ?.querySelectorAll(
                        "thead th"
                    ).length || 1;

            container.innerHTML = `
                <tr>
                    <td colspan="${columnCount}">
                        <div class="dashboard-empty">
                            ${escapeHTML(message)}
                        </div>
                    </td>
                </tr>
            `;

            return;
        }


        container.innerHTML = `
            <div class="dashboard-empty">
                ${escapeHTML(message)}
            </div>
        `;
    }


    function getStatusClass(status) {

        const normalized =
            String(status || "")
                .toLowerCase();


        if (
            normalized.includes("cancel") ||
            normalized.includes("failed") ||
            normalized.includes("reject")
        ) {

            return "danger";
        }


        if (
            normalized.includes("pending") ||
            normalized.includes("draft")
        ) {

            return "warning";
        }


        return "success";
    }


    /* ========================================================
       SALES CHART
       ======================================================== */

    function renderSalesChart(data) {

        const canvas =
            getElement(selectors.salesChart);

        if (!canvas) {
            return;
        }


        if (
            typeof Chart === "undefined"
        ) {

            console.warn(
                "Chart.js is not loaded."
            );

            return;
        }


        const labels =
            data.map(item =>
                item.label ||
                item.date ||
                item.month ||
                ""
            );


        const values =
            data.map(item =>
                Number(
                    item.total ??
                    item.amount ??
                    item.sales ??
                    0
                )
            );


        if (canvas._dashboardChart) {

            canvas._dashboardChart.destroy();

        }


        canvas._dashboardChart =
            new Chart(
                canvas.getContext("2d"),
                {
                    type: "line",

                    data: {

                        labels,

                        datasets: [
                            {
                                label: "Sales",

                                data: values,

                                borderColor:
                                    "#2563eb",

                                backgroundColor:
                                    "rgba(37, 99, 235, 0.10)",

                                borderWidth: 2,

                                fill: true,

                                tension: 0.35,

                                pointRadius: 3,

                                pointHoverRadius: 5,

                                pointBackgroundColor:
                                    "#2563eb",

                                pointBorderColor:
                                    "#ffffff",

                                pointBorderWidth: 2
                            }
                        ]
                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio: false,

                        interaction: {
                            intersect: false,
                            mode: "index"
                        },

                        plugins: {

                            legend: {
                                display: false
                            },

                            tooltip: {

                                callbacks: {

                                    label: context => {

                                        return (
                                            " Sales: " +
                                            formatCurrency(
                                                context.raw
                                            )
                                        );
                                    }
                                }
                            }
                        },

                        scales: {

                            x: {

                                grid: {
                                    display: false
                                },

                                ticks: {
                                    color: "#94a3b8",
                                    font: {
                                        size: 10
                                    }
                                }
                            },

                            y: {

                                beginAtZero: true,

                                grid: {
                                    color:
                                        "#f1f5f9"
                                },

                                ticks: {

                                    color:
                                        "#94a3b8",

                                    font: {
                                        size: 10
                                    },

                                    callback: value =>
                                        formatCurrency(
                                            value
                                        )
                                }
                            }
                        }
                    }
                }
            );
    }


    /* ========================================================
       LOAD SUMMARY
       ======================================================== */

    async function loadSummary() {

        const result =
            await request(
                CONFIG.endpoints.summary
            );


        state.summary =
            result.data ||
            result.summary ||
            result;


        renderSummary(
            state.summary
        );
    }


    /* ========================================================
       LOAD SALES
       ======================================================== */

    async function loadSales() {

        const result =
            await request(
                CONFIG.endpoints.sales
            );


        state.sales =
            result.data ||
            result.sales ||
            [];


        renderSalesChart(
            state.sales
        );
    }


    /* ========================================================
       LOAD LOW STOCK
       ======================================================== */

    async function loadLowStock() {

        const result =
            await request(
                CONFIG.endpoints.lowStock
            );


        state.lowStock =
            result.data ||
            result.products ||
            result.low_stock ||
            [];


        renderLowStock(
            state.lowStock
        );
    }


    /* ========================================================
       LOAD RECENT SALES
       ======================================================== */

    async function loadRecentSales() {

        const result =
            await request(
                CONFIG.endpoints.recentSales
            );


        state.recentSales =
            result.data ||
            result.sales ||
            [];


        renderRecentSales(
            state.recentSales
        );
    }


    /* ========================================================
       LOAD RECENT PURCHASES
       ======================================================== */

    async function loadRecentPurchases() {

        const result =
            await request(
                CONFIG.endpoints.recentPurchases
            );


        state.recentPurchases =
            result.data ||
            result.purchases ||
            [];


        renderRecentPurchases(
            state.recentPurchases
        );
    }


    /* ========================================================
       LOAD DASHBOARD
       ======================================================== */

    async function loadDashboard() {

        if (state.loading) {
            return;
        }


        state.loading = true;

        setLoadingState(true);


        try {

            await Promise.all([
                loadSummary(),
                loadSales(),
                loadLowStock(),
                loadRecentSales(),
                loadRecentPurchases()
            ]);


            updateLastUpdated();

            showDashboardMessage(
                "Dashboard updated successfully.",
                "success"
            );

        } catch (error) {

            console.error(
                "Dashboard error:",
                error
            );


            showDashboardMessage(
                error.message ||
                "Unable to load dashboard data.",
                "error"
            );

        } finally {

            state.loading = false;

            setLoadingState(false);

        }
    }


    /* ========================================================
       LOADING STATE
       ======================================================== */

    function setLoadingState(isLoading) {

        const button =
            getElement(
                selectors.refreshButton
            );


        if (!button) {
            return;
        }


        button.disabled =
            isLoading;


        if (isLoading) {

            button.dataset.originalText =
                button.textContent;

            button.innerHTML =
                `<span class="dashboard-spinner"></span> Loading...`;

        } else {

            button.textContent =
                button.dataset.originalText ||
                "Refresh";

        }
    }


    /* ========================================================
       LAST UPDATED
       ======================================================== */

    function updateLastUpdated() {

        const element =
            getElement(
                selectors.lastUpdated
            );


        if (!element) {
            return;
        }


        element.textContent =
            `Last updated: ${new Intl.DateTimeFormat(
                CONFIG.dateLocale,
                {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit"
                }
            ).format(new Date())}`;
    }


    /* ========================================================
       NOTIFICATIONS
       ======================================================== */

    function showDashboardMessage(
        message,
        type = "info"
    ) {

        let container =
            document.querySelector(
                "#dashboardToastContainer"
            );


        if (!container) {

            container =
                document.createElement("div");

            container.id =
                "dashboardToastContainer";

            container.className =
                "dashboard-toast-container";

            document.body.appendChild(
                container
            );
        }


        const toast =
            document.createElement("div");

        toast.className =
            `dashboard-toast ${type}`;

        toast.setAttribute(
            "role",
            "status"
        );

        toast.textContent =
            message;


        container.appendChild(
            toast
        );


        window.setTimeout(() => {

            toast.classList.add(
                "is-removing"
            );


            window.setTimeout(() => {

                toast.remove();

            }, 200);

        }, 3500);
    }


    /* ========================================================
       REFRESH
       ======================================================== */

    function refresh() {

        return loadDashboard();

    }


    /* ========================================================
       AUTO REFRESH
       ======================================================== */

    function startAutoRefresh() {

        stopAutoRefresh();


        state.refreshTimer =
            window.setInterval(
                () => {

                    if (
                        document.visibilityState ===
                        "visible"
                    ) {

                        loadDashboard();

                    }

                },
                CONFIG.refreshInterval
            );
    }


    function stopAutoRefresh() {

        if (state.refreshTimer) {

            window.clearInterval(
                state.refreshTimer
            );

            state.refreshTimer = null;

        }
    }


    /* ========================================================
       EVENT HANDLERS
       ======================================================== */

    function bindEvents() {

        const refreshButton =
            getElement(
                selectors.refreshButton
            );


        if (refreshButton) {

            refreshButton.addEventListener(
                "click",
                refresh
            );

        }


        /*
         * Refresh when browser tab becomes visible.
         */

        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState ===
                    "visible"
                ) {

                    loadDashboard();

                }

            }
        );
    }


    /* ========================================================
       INITIALIZATION
       ======================================================== */

    async function init() {

        bindEvents();

        await loadDashboard();

        startAutoRefresh();
    }


    /* ========================================================
       PUBLIC API
       ======================================================== */

    return {

        init,

        refresh,

        loadSummary,

        loadSales,

        loadLowStock,

        loadRecentSales,

        loadRecentPurchases,

        getState: () => ({
            ...state
        }),

        config: CONFIG
    };

})();


/* ============================================================
   INITIALIZE DASHBOARD
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        Dashboard.init();

    }
);


/* ============================================================
   GLOBAL ACCESS
   ============================================================ */

window.InventoryDashboard =
    Dashboard;
