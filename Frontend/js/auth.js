/**
 * =========================================================
 * INVENTORY MANAGEMENT SYSTEM
 * Authentication Operations
 *
 * File:
 * frontend/js/auth.js
 *
 * Expected backend endpoints:
 * POST /backend/api/auth/login.php
 * POST /backend/api/auth/logout.php
 * GET  /backend/api/auth/me.php
 *
 * Adjust API_BASE_URL if your PHP backend uses
 * a different directory structure.
 * =========================================================
 */

"use strict";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const AUTH_CONFIG = {

    /*
     * Change this to match your PHP backend.
     *
     * Example:
     * ../../backend/api
     *
     * If frontend and backend are hosted from the same
     * project root, this is usually:
     * ../backend/api
     */
    API_BASE_URL: "../../backend/api",

    LOGIN_ENDPOINT: "/auth/login.php",

    LOGOUT_ENDPOINT: "/auth/logout.php",

    CURRENT_USER_ENDPOINT: "/auth/me.php",

    LOGIN_PAGE: "login.html",

    DASHBOARD_PAGE: "dashboard.html",

    SESSION_KEY: "inventory_auth",

    USER_KEY: "inventory_user",

    TOKEN_KEY: "inventory_token"

};


/* =========================================================
   STORAGE HELPERS
   ========================================================= */

const AuthStorage = {

    setSession(data) {

        try {

            sessionStorage.setItem(
                AUTH_CONFIG.SESSION_KEY,
                "authenticated"
            );

            if (data?.user) {

                sessionStorage.setItem(
                    AUTH_CONFIG.USER_KEY,
                    JSON.stringify(data.user)
                );

            }

            if (data?.token) {

                sessionStorage.setItem(
                    AUTH_CONFIG.TOKEN_KEY,
                    data.token
                );

            }

        } catch (error) {

            console.error(
                "Unable to save authentication session:",
                error
            );

        }

    },


    getUser() {

        try {

            const user =
                sessionStorage.getItem(
                    AUTH_CONFIG.USER_KEY
                );

            return user
                ? JSON.parse(user)
                : null;

        } catch (error) {

            console.error(
                "Unable to read authenticated user:",
                error
            );

            return null;

        }

    },


    getToken() {

        return sessionStorage.getItem(
            AUTH_CONFIG.TOKEN_KEY
        );

    },


    isAuthenticated() {

        return (
            sessionStorage.getItem(
                AUTH_CONFIG.SESSION_KEY
            ) === "authenticated"
        );

    },


    clear() {

        sessionStorage.removeItem(
            AUTH_CONFIG.SESSION_KEY
        );

        sessionStorage.removeItem(
            AUTH_CONFIG.USER_KEY
        );

        sessionStorage.removeItem(
            AUTH_CONFIG.TOKEN_KEY
        );

    }

};


/* =========================================================
   API HELPERS
   ========================================================= */

const AuthAPI = {

    getUrl(endpoint) {

        return (
            AUTH_CONFIG.API_BASE_URL +
            endpoint
        );

    },


    async request(
        endpoint,
        options = {}
    ) {

        const token =
            AuthStorage.getToken();


        const headers = {

            "Content-Type":
                "application/json",

            "Accept":
                "application/json",

            ...(options.headers || {})

        };


        /*
         * Add bearer authentication when a token exists.
         *
         * If your PHP backend uses PHP sessions instead,
         * credentials: "include" allows the session cookie
         * to be sent.
         */
        if (token) {

            headers.Authorization =
                `Bearer ${token}`;

        }


        const response =
            await fetch(
                this.getUrl(endpoint),
                {
                    ...options,
                    headers,
                    credentials: "include"
                }
            );


        let data = null;


        try {

            data =
                await response.json();

        } catch {

            data = null;

        }


        if (!response.ok) {

            const message =
                data?.message ||
                data?.error ||
                `Request failed with status ${response.status}`;

            const error =
                new Error(message);

            error.status =
                response.status;

            error.data =
                data;

            throw error;

        }


        return data;

    }

};


/* =========================================================
   AUTHENTICATION SERVICE
   ========================================================= */

const Auth = {


    /**
     * Login user.
     *
     * @param {string} username
     * @param {string} password
     * @returns {Promise<Object>}
     */
    async login(
        username,
        password
    ) {

        username =
            String(username || "").trim();

        password =
            String(password || "");


        if (!username) {

            throw new Error(
                "Username or email is required."
            );

        }


        if (!password) {

            throw new Error(
                "Password is required."
            );

        }


        const data =
            await AuthAPI.request(
                AUTH_CONFIG.LOGIN_ENDPOINT,
                {
                    method: "POST",

                    body: JSON.stringify({

                        username,
                        password

                    })
                }
            );


        /*
         * Expected response example:
         *
         * {
         *     "success": true,
         *     "token": "...",
         *     "user": {
         *         "id": 1,
         *         "name": "Admin",
         *         "email": "...",
         *         "role": "admin"
         *     }
         * }
         */

        if (
            data &&
            data.success === false
        ) {

            throw new Error(
                data.message ||
                "Invalid username or password."
            );

        }


        AuthStorage.setSession(data || {});


        return data;

    },


    /**
     * Logout current user.
     */
    async logout() {

        try {

            /*
             * Notify the PHP backend first.
             */
            await AuthAPI.request(
                AUTH_CONFIG.LOGOUT_ENDPOINT,
                {
                    method: "POST"
                }
            );

        } catch (error) {

            /*
             * Local authentication state is still cleared
             * even if the backend request fails.
             */
            console.warn(
                "Backend logout request failed:",
                error
            );

        } finally {

            AuthStorage.clear();

        }

    },


    /**
     * Get current authenticated user.
     */
    async currentUser() {

        const data =
            await AuthAPI.request(
                AUTH_CONFIG.CURRENT_USER_ENDPOINT,
                {
                    method: "GET"
                }
            );


        if (
            data &&
            data.user
        ) {

            sessionStorage.setItem(
                AUTH_CONFIG.USER_KEY,
                JSON.stringify(data.user)
            );

            return data.user;

        }


        return null;

    },


    /**
     * Check authentication against local state.
     */
    isAuthenticated() {

        return AuthStorage.isAuthenticated();

    },


    /**
     * Verify authentication with backend.
     */
    async verifySession() {

        if (
            !AuthStorage.isAuthenticated()
        ) {

            return false;

        }


        try {

            const user =
                await this.currentUser();


            if (!user) {

                AuthStorage.clear();

                return false;

            }


            return true;

        } catch (error) {

            /*
             * A 401/403 response means the server session
             * is no longer valid.
             */
            if (
                error.status === 401 ||
                error.status === 403
            ) {

                AuthStorage.clear();

                return false;

            }


            /*
             * For network/server errors, don't immediately
             * destroy a valid local session.
             */
            console.warn(
                "Could not verify authentication:",
                error
            );

            return AuthStorage.isAuthenticated();

        }

    },


    /**
     * Require authentication before displaying
     * a protected page.
     */
    async requireAuth() {

        const valid =
            await this.verifySession();


        if (!valid) {

            this.redirectToLogin();

            return false;

        }


        return true;

    },


    /**
     * Redirect authenticated users away from login page.
     */
    async redirectAuthenticatedUser() {

        if (
            !AuthStorage.isAuthenticated()
        ) {

            return false;

        }


        const valid =
            await this.verifySession();


        if (valid) {

            window.location.href =
                AUTH_CONFIG.DASHBOARD_PAGE;

            return true;

        }


        return false;

    },


    /**
     * Redirect to login page.
     */
    redirectToLogin() {

        const currentPage =
            window.location.pathname +
            window.location.search;


        const separator =
            AUTH_CONFIG.LOGIN_PAGE.includes("?")
                ? "&"
                : "?";


        /*
         * Avoid redirecting repeatedly when already
         * on the login page.
         */
        if (
            window.location.pathname.endsWith(
                AUTH_CONFIG.LOGIN_PAGE
            )
        ) {

            return;

        }


        window.location.href =
            `${AUTH_CONFIG.LOGIN_PAGE}` +
            `${separator}redirect=${encodeURIComponent(currentPage)}`;

    },


    /**
     * Redirect after successful login.
     *
     * Uses the redirect query parameter if it exists.
     */
    redirectAfterLogin() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        const redirect =
            params.get("redirect");


        /*
         * Only allow local relative redirects.
         * This prevents an external URL from being used
         * as an open redirect.
         */
        if (
            redirect &&
            redirect.startsWith("/") &&
            !redirect.startsWith("//")
        ) {

            window.location.href =
                redirect;

            return;

        }


        window.location.href =
            AUTH_CONFIG.DASHBOARD_PAGE;

    },


    /**
     * Get logged-in user from local session.
     */
    getUser() {

        return AuthStorage.getUser();

    },


    /**
     * Get user's role.
     */
    getRole() {

        const user =
            this.getUser();

        return user?.role || null;

    },


    /**
     * Check whether the logged-in user has one
     * of the supplied roles.
     *
     * @param {string|string[]} roles
     */
    hasRole(roles) {

        const role =
            this.getRole();


        if (!role) {

            return false;

        }


        if (!Array.isArray(roles)) {

            roles = [roles];

        }


        return roles
            .map(
                value =>
                    String(value).toLowerCase()
            )
            .includes(
                String(role).toLowerCase()
            );

    },


    /**
     * Check admin access.
     */
    isAdmin() {

        return this.hasRole("admin");

    },


    /**
     * Check manager/admin access.
     */
    isManager() {

        return this.hasRole([
            "admin",
            "manager"
        ]);

    }

};


/* =========================================================
   LOGIN PAGE HANDLER
   ========================================================= */

function initializeLoginPage() {

    const loginForm =
        document.getElementById("loginForm");


    if (!loginForm) {

        return;

    }


    /*
     * If the user is already authenticated,
     * send them to the dashboard.
     */
    Auth.redirectAuthenticatedUser();


    const usernameInput =
        document.getElementById("username") ||
        document.getElementById("email");


    const passwordInput =
        document.getElementById("password");


    const submitButton =
        loginForm.querySelector(
            '[type="submit"]'
        );


    const errorContainer =
        document.getElementById("loginError") ||
        document.getElementById("authError");


    const rememberInput =
        document.getElementById("rememberMe");


    function showError(message) {

        if (errorContainer) {

            errorContainer.textContent =
                message;

            errorContainer.hidden =
                false;

        } else {

            console.error(
                message
            );

        }

    }


    function clearError() {

        if (errorContainer) {

            errorContainer.textContent =
                "";

            errorContainer.hidden =
                true;

        }

    }


    function setLoading(loading) {

        if (!submitButton) {

            return;

        }


        submitButton.disabled =
            loading;


        if (loading) {

            submitButton.dataset.originalText =
                submitButton.textContent;

            submitButton.textContent =
                "Signing in...";

        } else {

            submitButton.textContent =
                submitButton.dataset.originalText ||
                "Sign In";

        }

    }


    loginForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            clearError();


            const username =
                usernameInput?.value.trim();


            const password =
                passwordInput?.value || "";


            if (!username) {

                showError(
                    "Please enter your username or email."
                );

                usernameInput?.focus();

                return;

            }


            if (!password) {

                showError(
                    "Please enter your password."
                );

                passwordInput?.focus();

                return;

            }


            setLoading(true);


            try {

                const result =
                    await Auth.login(
                        username,
                        password
                    );


                /*
                 * Optional remember-me behavior.
                 *
                 * Authentication credentials should ideally
                 * remain managed by secure server cookies.
                 */
                if (rememberInput) {

                    localStorage.setItem(
                        "inventory_remember",
                        rememberInput.checked
                            ? "1"
                            : "0"
                    );

                }


                /*
                 * Allow backend responses to override the
                 * standard redirect when desired.
                 */
                if (
                    result?.redirect &&
                    typeof result.redirect === "string" &&
                    result.redirect.startsWith("/") &&
                    !result.redirect.startsWith("//")
                ) {

                    window.location.href =
                        result.redirect;

                    return;

                }


                Auth.redirectAfterLogin();

            } catch (error) {

                console.error(
                    "Login failed:",
                    error
                );


                let message =
                    "Unable to sign in. Please try again.";


                if (
                    error.status === 401 ||
                    error.status === 403
                ) {

                    message =
                        "Invalid username or password.";

                } else if (
                    error.message
                ) {

                    message =
                        error.message;

                }


                showError(message);

            } finally {

                setLoading(false);

            }

        }
    );

}


/* =========================================================
   LOGOUT HANDLERS
   ========================================================= */

function initializeLogoutButtons() {

    const logoutButtons =
        document.querySelectorAll(
            "[data-action='logout'], #logoutButton, .logout-button"
        );


    logoutButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();


                    if (
                        button.disabled
                    ) {

                        return;

                    }


                    const originalText =
                        button.textContent;


                    button.disabled =
                        true;

                    button.textContent =
                        "Signing out...";


                    try {

                        await Auth.logout();

                    } finally {

                        window.location.href =
                            AUTH_CONFIG.LOGIN_PAGE;

                        button.disabled =
                            false;

                        button.textContent =
                            originalText;

                    }

                }
            );

        }
    );

}


/* =========================================================
   PASSWORD VISIBILITY
   ========================================================= */

function initializePasswordToggle() {

    const toggles =
        document.querySelectorAll(
            "[data-password-toggle]"
        );


    toggles.forEach(
        toggle => {

            toggle.addEventListener(
                "click",
                () => {

                    const targetId =
                        toggle.getAttribute(
                            "data-password-toggle"
                        );


                    const input =
                        document.getElementById(
                            targetId
                        );


                    if (!input) {

                        return;

                    }


                    const isPassword =
                        input.type === "password";


                    input.type =
                        isPassword
                            ? "text"
                            : "password";


                    toggle.setAttribute(
                        "aria-label",
                        isPassword
                            ? "Hide password"
                            : "Show password"
                    );


                    toggle.setAttribute(
                        "aria-pressed",
                        String(isPassword)
                    );

                }
            );

        }
    );

}


/* =========================================================
   PROTECTED PAGE INITIALIZATION
   ========================================================= */

async function initializeProtectedPage() {

    /*
     * Do not run authentication checks on the login page.
     */
    if (
        window.location.pathname.endsWith(
            AUTH_CONFIG.LOGIN_PAGE
        )
    ) {

        return;

    }


    /*
     * Only enforce authentication when the page explicitly
     * requests it.
     *
     * Add:
     *
     * <body data-auth-required>
     *
     * to protected pages.
     */
    if (
        document.body.hasAttribute(
            "data-auth-required"
        )
    ) {

        await Auth.requireAuth();

    }

}


/* =========================================================
   DISPLAY CURRENT USER
   ========================================================= */

function initializeUserDisplay() {

    const user =
        Auth.getUser();


    if (!user) {

        return;

    }


    document
        .querySelectorAll(
            "[data-user-name]"
        )
        .forEach(
            element => {

                element.textContent =
                    user.name ||
                    user.full_name ||
                    user.username ||
                    "User";

            }
        );


    document
        .querySelectorAll(
            "[data-user-email]"
        )
        .forEach(
            element => {

                element.textContent =
                    user.email || "";

            }
        );


    document
        .querySelectorAll(
            "[data-user-role]"
        )
        .forEach(
            element => {

                element.textContent =
                    user.role || "";

            }
        );


    document
        .querySelectorAll(
            "[data-user-avatar]"
        )
        .forEach(
            element => {

                const name =
                    user.name ||
                    user.full_name ||
                    user.username ||
                    "U";


                const initials =
                    name
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map(
                            part =>
                                part
                                    .charAt(0)
                                    .toUpperCase()
                        )
                        .join("");


                element.textContent =
                    initials || "U";

            }
        );

}


/* =========================================================
   ROLE-BASED UI
   ========================================================= */

function initializeRoleBasedUI() {

    const user =
        Auth.getUser();


    if (!user) {

        return;

    }


    document
        .querySelectorAll(
            "[data-roles]"
        )
        .forEach(
            element => {

                const roles =
                    element
                        .getAttribute(
                            "data-roles"
                        )
                        .split(",")
                        .map(
                            role =>
                                role.trim()
                        );


                if (
                    !Auth.hasRole(roles)
                ) {

                    element.remove();

                }

            }
        );


    document
        .querySelectorAll(
            "[data-hide-for-roles]"
        )
        .forEach(
            element => {

                const roles =
                    element
                        .getAttribute(
                            "data-hide-for-roles"
                        )
                        .split(",")
                        .map(
                            role =>
                                role.trim()
                        );


                if (
                    Auth.hasRole(roles)
                ) {

                    element.remove();

                }

            }
        );

}


/* =========================================================
   AUTHENTICATION EVENT
   ========================================================= */

function dispatchAuthEvent(
    eventName,
    detail = {}
) {

    document.dispatchEvent(
        new CustomEvent(
            eventName,
            {
                detail
            }
        )
    );

}


/* =========================================================
   PUBLIC AUTH EVENT HELPERS
   ========================================================= */

function onAuthChange(callback) {

    if (
        typeof callback !== "function"
    ) {

        return () => {};

    }


    const handler =
        event => {

            callback(
                event.detail
            );

        };


    document.addEventListener(
        "authchange",
        handler
    );


    return () => {

        document.removeEventListener(
            "authchange",
            handler
        );

    };

}


/* =========================================================
   AUTO LOGOUT ON 401
   ========================================================= */

function initializeGlobalFetchProtection() {

    /*
     * Prevent installing the wrapper more than once.
     */
    if (
        window.__inventoryAuthFetchInstalled
    ) {

        return;

    }


    window.__inventoryAuthFetchInstalled =
        true;


    const originalFetch =
        window.fetch;


    window.fetch =
        async function (
            input,
            init = {}
        ) {

            const response =
                await originalFetch(
                    input,
                    init
                );


            if (
                response.status === 401
            ) {

                /*
                 * Do not redirect while already on login.
                 */
                const isLoginPage =
                    window.location.pathname.endsWith(
                        AUTH_CONFIG.LOGIN_PAGE
                    );


                if (!isLoginPage) {

                    AuthStorage.clear();

                    dispatchAuthEvent(
                        "authchange",
                        {
                            authenticated:
                                false,
                            reason:
                                "unauthorized"
                        }
                    );


                    Auth.redirectToLogin();

                }

            }


            return response;

        };

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        initializeLoginPage();

        initializeLogoutButtons();

        initializePasswordToggle();

        initializeUserDisplay();

        initializeRoleBasedUI();

        initializeGlobalFetchProtection();

        await initializeProtectedPage();

    }
);


/* =========================================================
   GLOBAL API
   ========================================================= */

window.InventoryAuth = Auth;

window.AuthStorage = AuthStorage;

window.AuthAPI = AuthAPI;


/* =========================================================
   USAGE EXAMPLES
   =========================================================

   LOGIN PAGE:

   <form id="loginForm">

       <input
           id="username"
           type="text"
           required
       >

       <input
           id="password"
           type="password"
           required
       >

       <button type="submit">
           Sign In
       </button>

       <div id="loginError" hidden></div>

   </form>


   PROTECTED PAGE:

   <body data-auth-required>


   USER DISPLAY:

   <span data-user-name></span>
   <span data-user-email></span>
   <span data-user-role></span>
   <span data-user-avatar></span>


   LOGOUT:

   <button data-action="logout">
       Logout
   </button>


   ROLE RESTRICTION:

   <button data-roles="admin,manager">
       Add Product
   </button>


   HIDE FOR SPECIFIC ROLES:

   <button data-hide-for-roles="staff">
       Delete Product
   </button>

   ========================================================= */
