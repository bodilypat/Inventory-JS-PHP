/**
 * ============================================================
 * INVENTORY MANAGEMENT SYSTEM
 * Application Core
 *
 * File:
 * frontend/js/app.js
 *
 * Responsibilities:
 * - Application initialization
 * - Authentication/session handling
 * - Protected page handling
 * - Navigation
 * - Sidebar/mobile menu
 * - Active navigation state
 * - Logout
 * - Global API helper
 * - Global notifications
 * - Common utility functions
 * ============================================================
 */

"use strict";
/* APPLICATION CONFIGURATION */
const APP_CONFIG = {
    name: "Inventory Management System",
    version: "1.0.0",
    /*
     * Adjust this path if your PHP backend is located elsewhere.
     */
    apiBaseUrl: "../backend/api/",
    /*
     * Pages available to the application.
     */
    pages: {
        login: "login.html",
        dashboard: "dashboard.html",
        products: "products.html",
        categories: "categories.html",
        inventory: "inventory.html",
        purchases: "purchases.html",
        sales: "sales.html",
        suppliers: "suppliers.html",
        customers: "customers.html",
        reports: "reports.html",
        users: "users.html"
    },
    /*
     * Session endpoint.
     */
    authEndpoint: "auth.php",
    /*
     * Automatically verify the session when a protected
     * page is opened.
     */
    verifySession: true,
    /*
     * Redirect destination after successful login.
     */
    defaultPage: "dashboard.html"
};
/* APPLICATION STATE */
const AppState = {
    initialized: false,
    authenticated: false,
    user: null,
    loading: false,
    currentPage: null,
    sidebarOpen: false
};
/* DOM HELPERS */
function $(selector, parent = document) {
    return parent.querySelector(selector);
}
function $$(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
}
function getPageName() {
    const path = window.location.pathname;
    const file = path.split("/").pop();
    return file || "index.html";
}
/* HTML ESCAPING */
function escapeHTML(value) {
    const element = document.createElement("div");
    element.textContent =
        value === null ||
        value === undefined
            ? ""
            : String(value);
    return element.innerHTML;
}
/* API HELPER */
async function apiRequest(
    endpoint,
    options = {}
) {
    const {
        method = "GET",
        body = null,
        headers = {},
        signal
    } = options;
    const requestHeaders = {
        "Accept":
            "application/json",
        ...headers
    };
    const requestOptions = {
        method,
        headers:
            requestHeaders,
        credentials:
            "include",
            signal
    };
    if (body !== null) {
        if (
            body instanceof FormData
        ) {
            requestOptions.body = body;
        } else if (
            typeof body === "string"
        ) {
            requestOptions.body = body;
            requestHeaders["Content-Type"] = "application/json";
        } else {
            requestOptions.body = JSON.stringify(body);
            requestHeaders["Content-Type"] = "application/json";
        }
    }
    const response =
        await fetch(
            APP_CONFIG.apiBaseUrl +
            endpoint,
            requestOptions
        );
    let data = null;
    try {
        data = await response.json();

    } catch (error) {
        throw new Error("The server returned an invalid response.");
    }
    if (!response.ok) {
        throw new Error(data?.message || `Request failed with status ${response.status}.`);
    }
    if (
        data && data.success === false
    ) {
        throw new Error(data.message || "The requested operation failed.");
    }
    return data;
}

/*AUTHENTICATION */
async function checkAuthentication() {
    try {
        const response = await apiRequest(`${APP_CONFIG.authEndpoint}?action=session`);
        const authenticated =
            Boolean(
                response.authenticated ??
                response.data?.authenticated ??
                response.logged_in ??
                response.data?.logged_in
            );
        AppState.authenticated = authenticated;
        if (authenticated) {
            AppState.user = response.user || response.data?.user || null;
            updateUserInterface();
        }
        return authenticated;
    } catch (error) {
        /*
         * A failed session request does not necessarily mean
         * that the user is logged out. Avoid destroying the UI
         * state here; protected pages will handle redirection.
         */
        console.warn("Authentication check failed:", error.message);
        return false;
    }
}
/* PAGE PROTECTION */
async function protectPage() {
    const currentPage = getPageName();
    AppState.currentPage = currentPage;
    /*
     * Login page should remain accessible without a session.
     */
    if (
        currentPage === APP_CONFIG.pages.login
    ) {
        return true;
    }
    if (!APP_CONFIG.verifySession) {
        return true;
    }
    const authenticated = await checkAuthentication();
    if (!authenticated) {
        redirectToLogin();
        return false;
    }
    return true;
}
/* LOGIN REDIRECTION */
function redirectToLogin() {
    const loginPage = APP_CONFIG.pages.login;
    if (
        getPageName() !== loginPage
    ) {
        const currentUrl = window.location.href;
        const separator =
            loginPage.includes("?")
                ? "&"
                : "?";
        window.location.href =
            `${loginPage}${separator}redirect=${encodeURIComponent(
                currentUrl
            )}`;
    }
}
/* DASHBOARD REDIRECTION */
function redirectToDashboard() {
    window.location.href = APP_CONFIG.defaultPage;
}
/* NAVIGATION */
function navigateTo(page) {
    if (!page) {
        return;
    }
    const target = APP_CONFIG.pages[page] || page;
    window.location.href = target;
}
/* ACTIVE NAVIGATION */
function updateActiveNavigation() {
    const currentPage = getPageName();
    const navigationItems =
        $$(
            "[data-page], " +
            "[data-nav], " +
            "a[href]"
        );
    navigationItems.forEach(item => {
        let target = item.dataset.page || item.dataset.nav;
        if (!target) {
            const href = item.getAttribute("href");
            if (!href) {
                return;
            }
            target =
                href.split("/").pop()
                    .split("?")[0]
                    .split("#")[0];
        }
        const configuredPage = APP_CONFIG.pages[target] || target;
        const isActive = configuredPage === currentPage;
        item.classList.toggle("active",isActive);
        if (isActive) {
            item.setAttribute("aria-current","page");
        } else {
            item.removeAttribute("aria-current");
        }
    });
}
/* SIDEBAR */
function initSidebar() {
    const sidebar =
        $(
            "[data-sidebar], " +
            ".sidebar, " +
            "#sidebar"
        );
    const overlay =
        $(
            "[data-sidebar-overlay], " +
            ".sidebar-overlay, " +
            "#sidebarOverlay"
        );
    const openButton =
        $(
            "[data-sidebar-open], " +
            "#sidebarOpen, " +
            ".sidebar-toggle"
        );
    const closeButton =
        $(
            "[data-sidebar-close], " +
            "#sidebarClose"
        );
    function openSidebar() {
        AppState.sidebarOpen = true;
        document.body.classList.add("sidebar-open");
        sidebar?.classList.add("open");
        overlay?.classList.add("active");
        openButton?.setAttribute("aria-expanded","true");
    }
    function closeSidebar() {
        AppState.sidebarOpen = false;
        document.body.classList.remove("sidebar-open");
        sidebar?.classList.remove("open");
        overlay?.classList.remove("active");
        openButton?.setAttribute("aria-expanded", "false");
    }
    openButton?.addEventListener("click",openSidebar);
    closeButton?.addEventListener("click",closeSidebar);
    overlay?.addEventListener("click",closeSidebar);
    /*
     * Close sidebar after navigating on mobile.
     */
    $$(".sidebar a, .sidebar-nav a")
        .forEach(link => {
            link.addEventListener("click",closeSidebar);
        });
    /*
     * Close sidebar with Escape.
     */
    document.addEventListener(
        "keydown",
        event => {
            if (event.key === "Escape" && AppState.sidebarOpen) {
                closeSidebar();
            }
        }
    );
}
/* MOBILE MENU */
function initMobileMenu() {
    const menuButton =
        $(
            "[data-mobile-menu], " +
            "#mobileMenuButton"
        );
    const menu =
        $(
            "[data-mobile-menu-panel], " +
            "#mobileMenu"
        );
    if (!menuButton || !menu) {return;}
    menuButton.addEventListener(
        "click",
        () => {
            const isOpen = menu.classList.toggle("open");
            menuButton.setAttribute("aria-expanded",String(isOpen));
        }
    );
}
/* USER INTERFACE */
function updateUserInterface() {
    if (!AppState.user) {
        return;
    }
    const user = AppState.user;
    const userName = user.name || user.username || user.full_name ||"User";
    const userEmail = user.email || "";
    $$(
        "[data-user-name], " +
        ".current-user-name, " +
        "#currentUserName"
    ).forEach(element => {
        element.textContent = userName;
    });
    $$(
        "[data-user-email], " +
        ".current-user-email, " +
        "#currentUserEmail"
    ).forEach(element => {
        element.textContent = userEmail;
    });
    $$(
        "[data-user-role], " +
        ".current-user-role, " +
        "#currentUserRole"
    ).forEach(element => {
        element.textContent = user.role || user.user_role || "";
    });
    $$(
        "[data-user-avatar], " +
        ".current-user-avatar, " +
        "#currentUserAvatar"
    ).forEach(element => {
        const initials =getInitials(userName);
        if (element.tagName === "IMG") {
            if (user.avatar) {
                element.src = user.avatar;
                element.alt = userName;
            } else {
                element.style.display = "none";
            }
        } else {
            element.textContent = initials;
        }
    });
}
/* USER INITIALS */
function getInitials(name) {
    if (!name) {return "U";}
    const parts =
        String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);
    if (parts.length === 1) {
        return parts[0]
            .substring(0, 2)
            .toUpperCase();
    }
    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}
/* LOGOUT */
async function logout() {
    try {
        await apiRequest(
            `${APP_CONFIG.authEndpoint}?action=logout`,
            {
                method: "POST"
            }
        );
    } catch (error) {
        console.warn("Logout request failed:", error.message);
    } finally {
        AppState.authenticated = false;
        AppState.user = null;
        /*
         * Remove client-side authentication information.
         * The PHP session remains the authoritative source.
         */
        try {
            sessionStorae.clear();
        } catch (error) {
            console.warn("Unable to clear session storage.");
        }
        try {
            localStorage.removeItem("inventory_user");
            localStorage.removeItem("inventory_auth");
        } catch (error) {
            console.warn("Unable to clear local storage.");
        }
        redirectToLogin();
    }
}
/* LOGOUT EVENT BINDING */
function initLogout() {
    $$(
        "[data-action='logout'], " +
        "#logoutButton, " +
        ".logout-button"
    ).forEach(button => {
        button.addEventListener(
            "click",
            async event => {
                event.preventDefault();
                const confirmed = await confirmAction("Are you sure you want to log out?");
                if (confirmed) {
                    await logout();
                }
            }
        );
    });
}
/* CONFIRMATION */
function confirmAction(
    message,
    options = {}
) {
    /*
     * Use the browser's native confirmation dialog when
     * no custom confirmation component exists.
     */
    const dialog =
        $(
            "[data-confirm-dialog], " +
            "#confirmDialog"
        );

    if (!dialog) {
        return Promise.resolve(window.confirm(message));
    }
    return new Promise(resolve => {
        const text =
            $(
                "[data-confirm-message], " +
                ".confirm-message",
                dialog
            );
        const confirmButton =
            $(
                "[data-confirm-yes], " +
                ".confirm-yes",
                dialog
            );
        const cancelButton =
            $(
                "[data-confirm-no], " +
                ".confirm-no",
                dialog
            );
        if (text) {
            text.textContent = message;
        }
        dialog.hidden = false;
        dialog.classList.add("open");
        function close(result) {
            dialog.hidden =true;
            dialog.classList.remove("open");
            confirmButton?.removeEventListener("click",confirmHandler);
            cancelButton?.removeEventListener("click", cancelHandler);
            resolve(result);
        }
        function confirmHandler() {
            close(true);
        }
        function cancelHandler() {
            close(false);
        }
        confirmButton?.addEventListener("click", confirmHandler);
        cancelButton?.addEventListener("click", cancelHandler);
    });
}
/* GLOBAL LOADING INDICATOR */
function setGlobalLoading(
    loading,
    message = "Loading..."
) {
    let loader =
        $(
            "#globalLoader, " +
            "[data-global-loader]"
        );
    if (!loader) {
        loader = document.createElement("div");
        loader.id = "globalLoader";
        loader.className = "global-loader";
        loader.innerHTML = `
            <div class="global-loader-content">
                <span class="global-loader-spinner"></span>
                <span class="global-loader-message"></span>
            </div>
        `;
        document.body.appendChild(loader);
    }
    const messageElement = $(".global-loader-message",loader);
    if (messageElement) {
        messageElement.textContent = message;
    }
    loader.classList.toggle("active",loading);
    loader.hidden = !loading;
    AppState.loading = loading;
}
/* NOTIFICATIONS */
function showNotification(
    message,
    type = "info",
    duration = 3500
) {
    let container = $("#appNotificationContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "appNotificationContainer";
        container.className = "app-notification-container";
        container.setAttribute("aria-live","polite");
        document.body.appendChild(container);
    }
    const notification = document.createElement("div");
    notification.className = `app-notification ${type}`;
    notification.setAttribute("role","status");
    notification.innerHTML = `
        <span class="app-notification-message">
            ${escapeHTML(message)}
        </span>
        <button
            type="button"
            class="app-notification-close"
            aria-label="Close notification"
        >
            ×
        </button>
    `;
    container.appendChild(notification);
    const closeButton = $(".app-notification-close", notification);
    let timer;
    function remove() {
        clearTimeout(timer);
        notification.classList.add("removing");
        window.setTimeout(() => notification.remove(), 200);
    }
    closeButton?.addEventListener(
        "click", 
        remove
    );
    timer = window.setTimeout(remove,duration);
    return notification;
}
/* ERROR HANDLING */
function handleError(
    error,
    fallbackMessage = "Something went wrong."
) {
    console.error(error);
    const message =
        error?.message ||
        fallbackMessage;
    showNotification(
        message,
        "error"
    );
    return message;
}
/* FORM SERIALIZATION*/
function serializeForm(form) {
    if (!form) {
        return {};
    }
    const formData =new FormData(form);
    const data = {};

    formData.forEach(
        (value, key) => {

            if (Object.prototype.hasOwnProperty.call(data,key)) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(value);
            } else {
                data[key] = value;
            }
        }
    );
    return data;
}
/* DATE FORMATTING */
function formatDate(
    value,
    options = {}
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
        return "—";
    }
    return new Intl.DateTimeFormat(
        options.locale ||
        "en-US",
        {
            year:
                options.year ||
                "numeric",
            month:
                options.month ||
                "short",
            day:
                options.day ||
                "numeric"
        }
    ).format(date);
}
/* CURRENCY FORMATTING */
function formatCurrency(
    value,
    currency = "USD"
) {
    const amount = Number(value);
    if (
        !Number.isFinite(amount)
    ) {
        return new Intl.NumberFormat(
            "en-US",
            {
                style: "currency",
                currency
            }
        ).format(0);
    }
    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency
        }
    ).format(amount);
}
/* NUMBER FORMATTING */
function formatNumber(
    value,
    decimals = 0
) {
    const number =
        Number(value);
    if (
        !Number.isFinite(number)
    ) {
        return "0";
    }
    return new Intl.NumberFormat(
        "en-US",
        {
            minimumFractionDigits:
                decimals,
            maximumFractionDigits:
                decimals
        }
    ).format(number);
}
/* DEBOUNCE */
function debounce(
    callback,
    delay = 300
) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer =
            window.setTimeout(
                () => {
                    callback.apply(
                        this,
                        args
                    );
                },
                delay
            );
    };
}
/* THROTTLE */
function throttle(
    callback,
    delay = 300
) {
    let lastCall = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastCall < delay) {
            return;
        }
        lastCall = now;
        callback.apply(
            this,
            args
        );
    };
}
/* URL QUERY PARAMETERS */
function getQueryParam(
    name
) {
    const params =
        new URLSearchParams(
            window.location.search
        );
    return params.get(name);
}
/* SAFE LOCAL STORAGE */
function storageGet(
    key
) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}
function storageSet(key,value) {
    try {
        localStorage.setItem(key,value);
        return true;
    } catch (error) {
        return false;
    }
}
function storageRemove(
    key
) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        return false;
    }
}
/* CLICK OUTSIDE HANDLER */
function onClickOutside(
    element,
    callback
) {
    if (!element) {
        return;
    }
    function handler(event) {
        if (
            !element.contains(
                event.target
            )
        ) {
            callback(event);
        }
    }
    document.addEventListener(
        "click",
        handler
    );
    return () => {
        document.removeEventListener(
            "click",
            handler
        );
    };
}
/* GLOBAL LINK HANDLER */
function initNavigation() {
    $$(
        "[data-page], " +
        "[data-nav]"
    ).forEach(element => {
        element.addEventListener(
            "click",
            event => {
                const page =
                    element.dataset.page ||
                    element.dataset.nav;
                if (
                    !page ||
                    !APP_CONFIG.pages[page]
                ) {
                    return;
                }
                event.preventDefault();
                navigateTo(
                    page
                );
            }
        );
    });
    updateActiveNavigation();
}
/* PREVENT DOUBLE FORM SUBMISSION */
function preventDoubleSubmit() {
    $$(
        "form[data-prevent-double-submit]"
    ).forEach(form => {
        form.addEventListener(
            "submit",
            () => {
                const submitButtons =
                    $$(
                        "button[type='submit'], " +
                        "input[type='submit']",
                        form
                    );
                submitButtons.forEach(
                    button => {
                        button.disabled = true;
                        button.dataset
                            .originalText = button.textContent;
                    }
                );
                /*
                 * Re-enable the buttons if browser validation
                 * prevents the submit event from completing.
                 */
                window.setTimeout(
                    () => {
                        submitButtons.forEach(
                            button => {
                                button.disabled =
                                    false;
                            }
                        );
                    },
                    5000
                );
            }
        );
    });
}
/* ONLINE / OFFLINE STATUS */
function initConnectionStatus() {
    function updateStatus() {
        const online =navigator.onLine;
        document.body.classList.toggle("offline",!online);
        const indicator = $("[data-connection-status]");
        if (!indicator) {
            return;
        }
        indicator.textContent =
            online
                ? "Online"
                : "Offline";
        indicator.classList.toggle(
            "online",
            online
        );
        indicator.classList.toggle(
            "offline",
            !online
        );
    }
    window.addEventListener(
        "online",
        () => {
            updateStatus();
            showNotification(
                "Connection restored.",
                "success"
            );
        }
    );
    window.addEventListener(
        "offline",
        () => {
            updateStatus();
            showNotification(
                "You are offline. Some operations may be unavailable.",
                "warning"
            );
        }
    );
    updateStatus();
}
/* ACCESSIBILITY */
function initAccessibility() {
    /*
     * Add keyboard support to elements that behave like
     * buttons but are represented by non-button elements.
     */
    $$(
        "[role='button']:not(button)"
    ).forEach(element => {
        element.setAttribute("tabindex","0");
        element.addEventListener(
            "keydown",
            event => {
                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {
                    event.preventDefault();
                    element.click();
                }
            }
        );
    });
}
/* PAGE TITLE */
function updatePageTitle() {
    const currentPage = getPageName();
    const pageNames = {
        "dashboard.html":
            "Dashboard",
        "products.html":
            "Products",
        "categories.html":
            "Categories",
        "inventory.html":
            "Inventory",
        "purchases.html":
            "Purchases",
        "sales.html":
            "Sales",
        "suppliers.html":
            "Suppliers",
        "customers.html":
            "Customers",
        "reports.html":
            "Reports",
        "users.html":
            "Users",
        "login.html":
            "Login"
    };
    const pageName =
        pageNames[currentPage];
    if (pageName) {
        document.title =
            `${pageName} | ${APP_CONFIG.name}`;
    }
}
/* GLOBAL WINDOW ERROR HANDLER */
function initGlobalErrorHandling() {
    window.addEventListener(
        "error",
        event => {
            console.error(
                "Application error:",
                event.error ||
                event.message
            );
        }
    );
    window.addEventListener(
        "unhandledrejection",
        event => {
            console.error(
                "Unhandled promise rejection:",
                event.reason
            );
        }
    );
}
/* APPLICATION INITIALIZATION */
async function initApplication() {
    if (AppState.initialized) {
        return;
    }
    AppState.initialized = true;
    updatePageTitle();
    initSidebar();
    initMobileMenu();
    initNavigation();
    initLogout();
    initConnectionStatus();
    initAccessibility();
    preventDoubleSubmit();
    initGlobalErrorHandling();
    /*
     * Do not block the login page with an authentication check.
     */
    const currentPage = getPageName();
    if (currentPage !== APP_CONFIG.pages.login) {
        await protectPage();
    } else {
        /*
         * If the user is already authenticated and visits
         * login.html, redirect them to the dashboard.
         */
        const authenticated = await checkAuthentication();
        if (authenticated) {
            const redirect =
                getQueryParam(
                    "redirect"
                );
            if (
                redirect &&
                isSafeRedirect(redirect)
            ) {
                window.location.href = redirect;
            } else {
                redirectToDashboard();
            }
        }
    }
}
/* SAFE REDIRECT VALIDATION */
function isSafeRedirect(
    url
) {
    try {
        const target =
            new URL(url, window.location.origin);
        /*
         * Only allow redirects within the current origin.
         */
        return (target.origin === window.location.origin);
    } catch (error) {
        return false;
    }
}
/* DOCUMENT READY */
if (
    document.readyState === "loading"
) {
    document.addEventListener("DOMContentLoaded", initApplication);
} else {
    initApplication();
}
/* PUBLIC APPLICATION API */
window.InventoryApp = {
    config:
        APP_CONFIG,
    state:
        AppState,
    $,
    $$,
    apiRequest,
    checkAuthentication,
    protectPage,
    logout,
    navigateTo,
    redirectToLogin,
    redirectToDashboard,
    showNotification,
    handleError,
    confirmAction,
    setGlobalLoading,
    escapeHTML,
    serializeForm,
    formatDate,
    formatCurrency,
    formatNumber,
    debounce,
    throttle,
    getQueryParam,
    storageGet,
    storageSet,
    storageRemove,
    getInitials,
    refreshNavigation:
    updateActiveNavigation
};
