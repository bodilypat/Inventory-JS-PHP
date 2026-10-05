/* =========================================================
   INVENTORY MANAGEMENT SYSTEM
   USERS OPERATIONS
   File: frontend/js/users.js
   ========================================================= */

"use strict";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const USERS_CONFIG = {

    API_URL: "../../backend/api/users.php",

    REQUEST_TIMEOUT: 30000,

    PER_PAGE: 25

};


/* =========================================================
   STATE
   ========================================================= */

const usersState = {

    users: [],

    filteredUsers: [],

    currentPage: 1,

    perPage: USERS_CONFIG.PER_PAGE,

    search: "",

    role: "",

    status: "",

    editingUserId: null,

    loading: false

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

document.addEventListener(
    "DOMContentLoaded",
    initializeUsers
);


function initializeUsers() {

    bindEvents();

    loadUsers();

}


/* =========================================================
   EVENT BINDINGS
   ========================================================= */

function bindEvents() {

    const search =
        $("#userSearch");

    const role =
        $("#roleFilter");

    const status =
        $("#statusFilter");

    const addButton =
        $("#addUserButton");

    const refreshButton =
        $("#refreshUsersButton");

    const form =
        $("#userForm");

    const cancelButton =
        $("#cancelUserButton");

    const closeButton =
        $("#closeUserModal");

    const previous =
        $("#previousPage");

    const next =
        $("#nextPage");

    const perPage =
        $("#perPage");


    search?.addEventListener(
        "input",
        debounce(() => {

            usersState.search =
                search.value
                    .trim()
                    .toLowerCase();

            usersState.currentPage = 1;

            applyFilters();

        }, 250)
    );


    role?.addEventListener(
        "change",
        () => {

            usersState.role =
                role.value;

            usersState.currentPage = 1;

            applyFilters();

        }
    );


    status?.addEventListener(
        "change",
        () => {

            usersState.status =
                status.value;

            usersState.currentPage = 1;

            applyFilters();

        }
    );


    addButton?.addEventListener(
        "click",
        () => openUserModal()
    );


    refreshButton?.addEventListener(
        "click",
        () => loadUsers()
    );


    form?.addEventListener(
        "submit",
        handleUserSubmit
    );


    cancelButton?.addEventListener(
        "click",
        closeUserModal
    );


    closeButton?.addEventListener(
        "click",
        closeUserModal
    );


    previous?.addEventListener(
        "click",
        previousPage
    );


    next?.addEventListener(
        "click",
        nextPage
    );


    perPage?.addEventListener(
        "change",
        () => {

            usersState.perPage =
                Number(perPage.value) || 25;

            usersState.currentPage = 1;

            renderUsers();

        }
    );


    document.addEventListener(
        "click",
        handleDocumentClick
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeUserModal();

                closeDeleteModal();

            }

        }
    );

}


/* =========================================================
   LOAD USERS
   ========================================================= */

async function loadUsers() {

    if (usersState.loading) {
        return;
    }


    usersState.loading = true;

    setLoadingState(true);


    try {

        const response =
            await fetchWithTimeout(
                USERS_CONFIG.API_URL,
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
                "Unable to load users."
            );

        }


        const data =
            payload.data ?? payload;


        usersState.users =
            normalizeUsers(data);


        usersState.currentPage = 1;

        applyFilters();

        updateStatistics();


    } catch (error) {

        console.error(
            "Users loading error:",
            error
        );


        usersState.users = [];

        usersState.filteredUsers = [];


        renderUsersError(
            error.message ||
            "Unable to load users."
        );


        updateStatistics();


        showToast(
            error.message ||
            "Unable to load users.",
            "error"
        );


    } finally {

        usersState.loading = false;

        setLoadingState(false);

    }

}


/* =========================================================
   NORMALIZE USERS
   ========================================================= */

function normalizeUsers(data) {

    if (Array.isArray(data)) {
        return data;
    }


    if (Array.isArray(data.users)) {
        return data.users;
    }


    if (Array.isArray(data.rows)) {
        return data.rows;
    }


    if (Array.isArray(data.records)) {
        return data.records;
    }


    if (Array.isArray(data.items)) {
        return data.items;
    }


    return [];

}


/* =========================================================
   FILTER USERS
   ========================================================= */

function applyFilters() {

    let users =
        [...usersState.users];


    if (usersState.search) {

        const search =
            usersState.search;


        users =
            users.filter(user => {

                return [
                    user.username,
                    user.name,
                    user.full_name,
                    user.email,
                    user.phone,
                    user.role
                ]
                    .some(value =>
                        String(value ?? "")
                            .toLowerCase()
                            .includes(search)
                    );

            });

    }


    if (usersState.role) {

        users =
            users.filter(user =>
                String(
                    user.role ?? ""
                ).toLowerCase() ===
                usersState.role.toLowerCase()
            );

    }


    if (usersState.status) {

        users =
            users.filter(user =>
                normalizeStatus(
                    user.status
                ) ===
                usersState.status
            );

    }


    usersState.filteredUsers =
        users;


    renderUsers();

    updateStatistics();

}


/* =========================================================
   RENDER USERS
   ========================================================= */

function renderUsers() {

    const tbody =
        $("#usersTableBody");


    if (!tbody) {
        return;
    }


    const users =
        getCurrentPageUsers();


    if (!users.length) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="100%"
                    class="table-empty"
                >
                    No users found.
                </td>
            </tr>
        `;

        updatePagination();

        return;

    }


    tbody.innerHTML =
        users.map(
            user => renderUserRow(user)
        ).join("");


    updatePagination();

}


/* =========================================================
   USER ROW
   ========================================================= */

function renderUserRow(user) {

    const id =
        user.id ??
        user.user_id;


    const name =
        user.full_name ??
        user.name ??
        user.username ??
        "—";


    const username =
        user.username ??
        "—";


    const email =
        user.email ??
        "—";


    const role =
        user.role ??
        "—";


    const status =
        normalizeStatus(
            user.status
        );


    const created =
        user.created_at ??
        user.created_date ??
        user.date_created ??
        "—";


    return `
        <tr data-user-id="${escapeHtml(id)}">

            <td>
                <div class="user-cell">

                    <div class="user-avatar">
                        ${getInitials(name)}
                    </div>

                    <div class="user-info">

                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        <small>
                            @${escapeHtml(username)}
                        </small>

                    </div>

                </div>
            </td>

            <td>
                ${escapeHtml(email)}
            </td>

            <td>
                <span class="role-badge">
                    ${escapeHtml(role)}
                </span>
            </td>

            <td>
                ${renderStatusBadge(status)}
            </td>

            <td>
                ${escapeHtml(
                    formatDisplayDate(created)
                )}
            </td>

            <td class="actions-cell">

                <button
                    type="button"
                    class="table-action edit-action"
                    data-action="edit"
                    data-id="${escapeHtml(id)}"
                    title="Edit user"
                    aria-label="Edit user"
                >
                    ✏️
                </button>

                <button
                    type="button"
                    class="table-action status-action"
                    data-action="status"
                    data-id="${escapeHtml(id)}"
                    title="${
                        status === "active"
                            ? "Deactivate user"
                            : "Activate user"
                    }"
                    aria-label="${
                        status === "active"
                            ? "Deactivate user"
                            : "Activate user"
                    }"
                >
                    ${
                        status === "active"
                            ? "⏸"
                            : "▶"
                    }
                </button>

                <button
                    type="button"
                    class="table-action password-action"
                    data-action="password"
                    data-id="${escapeHtml(id)}"
                    title="Change password"
                    aria-label="Change password"
                >
                    🔑
                </button>

                <button
                    type="button"
                    class="table-action delete-action"
                    data-action="delete"
                    data-id="${escapeHtml(id)}"
                    title="Delete user"
                    aria-label="Delete user"
                >
                    🗑️
                </button>

            </td>

        </tr>
    `;

}


/* =========================================================
   DOCUMENT ACTION HANDLER
   ========================================================= */

function handleDocumentClick(event) {

    const actionButton =
        event.target.closest(
            "[data-action]"
        );


    if (!actionButton) {
        return;
    }


    const action =
        actionButton.dataset.action;


    const id =
        actionButton.dataset.id;


    if (!id) {
        return;
    }


    switch (action) {

        case "edit":
            editUser(id);
            break;


        case "status":
            toggleUserStatus(id);
            break;


        case "password":
            openPasswordModal(id);
            break;


        case "delete":
            openDeleteModal(id);
            break;

    }

}


/* =========================================================
   OPEN USER MODAL
   ========================================================= */

function openUserModal(user = null) {

    const modal =
        $("#userModal");


    const form =
        $("#userForm");


    if (!modal || !form) {
        return;
    }


    usersState.editingUserId =
        user
            ? getUserId(user)
            : null;


    form.reset();


    setText(
        "#userModalTitle",
        user
            ? "Edit User"
            : "Add User"
    );


    setText(
        "#userSubmitButton",
        user
            ? "Update User"
            : "Create User"
    );


    setFormValue(
        "#userId",
        user
            ? getUserId(user)
            : ""
    );


    if (user) {

        setFormValue(
            "#fullName",
            user.full_name ??
            user.name ??
            ""
        );


        setFormValue(
            "#username",
            user.username ??
            ""
        );


        setFormValue(
            "#email",
            user.email ??
            ""
        );


        setFormValue(
            "#phone",
            user.phone ??
            ""
        );


        setFormValue(
            "#role",
            user.role ??
            ""
        );


        setFormValue(
            "#userStatus",
            normalizeStatus(
                user.status
            )
        );


        const password =
            $("#password");


        const confirmPassword =
            $("#confirmPassword");


        if (password) {
            password.required = false;
        }

        if (confirmPassword) {
            confirmPassword.required = false;
        }


        const passwordHint =
            $("#passwordHint");


        if (passwordHint) {

            passwordHint.textContent =
                "Leave blank to keep the current password.";

        }

    } else {

        const password =
            $("#password");


        const confirmPassword =
            $("#confirmPassword");


        if (password) {
            password.required = true;
        }

        if (confirmPassword) {
            confirmPassword.required = true;
        }


        const passwordHint =
            $("#passwordHint");


        if (passwordHint) {

            passwordHint.textContent =
                "Use a strong password for the new account.";

        }

    }


    modal.classList.add("show");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "modal-open"
    );


    setTimeout(
        () => {

            const firstInput =
                $("#fullName") ||
                $("#username");


            firstInput?.focus();

        },
        50
    );

}


/* =========================================================
   EDIT USER
   ========================================================= */

function editUser(id) {

    const user =
        findUser(id);


    if (!user) {

        showToast(
            "User not found.",
            "error"
        );

        return;

    }


    openUserModal(user);

}


/* =========================================================
   CLOSE USER MODAL
   ========================================================= */

function closeUserModal() {

    const modal =
        $("#userModal");


    if (!modal) {
        return;
    }


    modal.classList.remove("show");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "modal-open"
    );


    usersState.editingUserId = null;

}


/* =========================================================
   USER FORM SUBMIT
   ========================================================= */

async function handleUserSubmit(event) {

    event.preventDefault();


    const form =
        event.currentTarget;


    if (!form.checkValidity()) {

        form.reportValidity();

        return;

    }


    const formData =
        new FormData(form);


    const password =
        formData.get("password");


    const confirmPassword =
        formData.get(
            "confirm_password"
        ) ??
        formData.get(
            "confirmPassword"
        );


    if (
        password &&
        password !== confirmPassword
    ) {

        showToast(
            "Passwords do not match.",
            "error"
        );

        return;

    }


    const userId =
        usersState.editingUserId;


    const method =
        userId
            ? "PUT"
            : "POST";


    const url =
        userId
            ? `${USERS_CONFIG.API_URL}?id=${encodeURIComponent(userId)}`
            : USERS_CONFIG.API_URL;


    const submitButton =
        $("#userSubmitButton");


    try {

        if (submitButton) {

            submitButton.disabled = true;

            submitButton.dataset.originalText ??=
                submitButton.textContent;

            submitButton.textContent =
                userId
                    ? "Updating..."
                    : "Creating...";

        }


        const body =
            Object.fromEntries(
                formData.entries()
            );


        if (userId) {

            body.id =
                userId;

        }


        const response =
            await fetchWithTimeout(
                url,
                {
                    method,

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body:
                        JSON.stringify(body),

                    credentials: "include"
                }
            );


        const payload =
            await parseJsonResponse(response);


        if (!payload.success) {

            throw new Error(
                payload.message ||
                "Unable to save user."
            );

        }


        closeUserModal();

        await loadUsers();


        showToast(
            userId
                ? "User updated successfully."
                : "User created successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "User save error:",
            error
        );


        showToast(
            error.message ||
            "Unable to save user.",
            "error"
        );


    } finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                submitButton.dataset.originalText ||
                "Save User";

        }

    }

}


/* =========================================================
   TOGGLE USER STATUS
   ========================================================= */

async function toggleUserStatus(id) {

    const user =
        findUser(id);


    if (!user) {

        showToast(
            "User not found.",
            "error"
        );

        return;

    }


    const currentStatus =
        normalizeStatus(
            user.status
        );


    const newStatus =
        currentStatus === "active"
            ? "inactive"
            : "active";


    const action =
        newStatus === "active"
            ? "activate"
            : "deactivate";


    const confirmed =
        window.confirm(
            `Are you sure you want to ${action} this user?`
        );


    if (!confirmed) {
        return;
    }


    try {

        await sendUserAction(
            id,
            "status",
            {
                status: newStatus
            }
        );


        await loadUsers();


        showToast(
            `User ${action}d successfully.`,
            "success"
        );


    } catch (error) {

        showToast(
            error.message ||
            `Unable to ${action} user.`,
            "error"
        );

    }

}


/* =========================================================
   PASSWORD MODAL
   ========================================================= */

function openPasswordModal(id) {

    const user =
        findUser(id);


    if (!user) {

        showToast(
            "User not found.",
            "error"
        );

        return;

    }


    const modal =
        $("#passwordModal");


    const form =
        $("#passwordForm");


    if (!modal || !form) {

        const password =
            window.prompt(
                "Enter the new password:"
            );


        if (password) {
            changePassword(id, password);
        }

        return;

    }


    form.reset();


    setFormValue(
        "#passwordUserId",
        id
    );


    setText(
        "#passwordUserName",
        user.full_name ??
        user.name ??
        user.username ??
        "User"
    );


    modal.classList.add("show");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "modal-open"
    );


    setTimeout(
        () => {
            $("#newPassword")?.focus();
        },
        50
    );


    form.onsubmit =
        async event => {

            event.preventDefault();


            const newPassword =
                $("#newPassword")?.value;


            const confirmPassword =
                $("#newPasswordConfirm")?.value;


            if (!newPassword) {

                showToast(
                    "Enter a new password.",
                    "error"
                );

                return;

            }


            if (
                newPassword !==
                confirmPassword
            ) {

                showToast(
                    "Passwords do not match.",
                    "error"
                );

                return;

            }


            try {

                const button =
                    form.querySelector(
                        "[type='submit']"
                    );


                if (button) {
                    button.disabled = true;
                }


                await sendUserAction(
                    id,
                    "password",
                    {
                        password:
                            newPassword
                    }
                );


                closePasswordModal();


                showToast(
                    "Password changed successfully.",
                    "success"
                );


            } catch (error) {

                showToast(
                    error.message ||
                    "Unable to change password.",
                    "error"
                );


            } finally {

                const button =
                    form.querySelector(
                        "[type='submit']"
                    );


                if (button) {
                    button.disabled = false;
                }

            }

        };

}


/* =========================================================
   CLOSE PASSWORD MODAL
   ========================================================= */

function closePasswordModal() {

    const modal =
        $("#passwordModal");


    if (!modal) {
        return;
    }


    modal.classList.remove("show");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "modal-open"
    );

}


/* =========================================================
   CHANGE PASSWORD
   ========================================================= */

async function changePassword(
    id,
    password
) {

    try {

        await sendUserAction(
            id,
            "password",
            {
                password
            }
        );


        showToast(
            "Password changed successfully.",
            "success"
        );


    } catch (error) {

        showToast(
            error.message ||
            "Unable to change password.",
            "error"
        );

    }

}


/* =========================================================
   DELETE MODAL
   ========================================================= */

let deleteUserId = null;


function openDeleteModal(id) {

    const user =
        findUser(id);


    if (!user) {

        showToast(
            "User not found.",
            "error"
        );

        return;

    }


    const modal =
        $("#deleteUserModal");


    if (!modal) {

        const confirmed =
            window.confirm(
                `Delete user "${
                    user.username ??
                    user.name ??
                    ""
                }"? This action cannot be undone.`
            );


        if (confirmed) {
            deleteUser(id);
        }

        return;

    }


    deleteUserId = id;


    setText(
        "#deleteUserName",
        user.full_name ??
        user.name ??
        user.username ??
        "this user"
    );


    modal.classList.add("show");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "modal-open"
    );


    const confirmButton =
        $("#confirmDeleteUser");


    if (confirmButton) {

        confirmButton.onclick =
            () => {

                if (deleteUserId) {

                    deleteUser(
                        deleteUserId
                    );

                }

            };

    }

}


/* =========================================================
   CLOSE DELETE MODAL
   ========================================================= */

function closeDeleteModal() {

    const modal =
        $("#deleteUserModal");


    if (!modal) {
        return;
    }


    modal.classList.remove("show");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "modal-open"
    );


    deleteUserId = null;

}


/* =========================================================
   DELETE USER
   ========================================================= */

async function deleteUser(id) {

    try {

        const response =
            await fetchWithTimeout(
                `${USERS_CONFIG.API_URL}?id=${encodeURIComponent(id)}`,
                {
                    method: "DELETE",

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
                "Unable to delete user."
            );

        }


        closeDeleteModal();


        await loadUsers();


        showToast(
            "User deleted successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "User deletion error:",
            error
        );


        showToast(
            error.message ||
            "Unable to delete user.",
            "error"
        );

    }

}


/* =========================================================
   GENERIC USER ACTION
   ========================================================= */

async function sendUserAction(
    id,
    action,
    data = {}
) {

    const response =
        await fetchWithTimeout(
            `${USERS_CONFIG.API_URL}?id=${encodeURIComponent(id)}&action=${encodeURIComponent(action)}`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"
                },

                body:
                    JSON.stringify(data),

                credentials: "include"
            }
        );


    const payload =
        await parseJsonResponse(response);


    if (!payload.success) {

        throw new Error(
            payload.message ||
            "The requested action failed."
        );

    }


    return payload;

}


/* =========================================================
   PAGINATION
   ========================================================= */

function getCurrentPageUsers() {

    const start =
        (
            usersState.currentPage - 1
        ) *
        usersState.perPage;


    return usersState.filteredUsers.slice(
        start,
        start + usersState.perPage
    );

}


function getTotalPages() {

    return Math.max(
        1,
        Math.ceil(
            usersState.filteredUsers.length /
            usersState.perPage
        )
    );

}


function previousPage() {

    if (
        usersState.currentPage <= 1
    ) {
        return;
    }


    usersState.currentPage--;

    renderUsers();

}


function nextPage() {

    const totalPages =
        getTotalPages();


    if (
        usersState.currentPage >=
        totalPages
    ) {
        return;
    }


    usersState.currentPage++;

    renderUsers();

}


function updatePagination() {

    const totalPages =
        getTotalPages();


    const current =
        $("#currentPage");


    const total =
        $("#totalPages");


    const previous =
        $("#previousPage");


    const next =
        $("#nextPage");


    if (current) {

        current.textContent =
            usersState.currentPage;

    }


    if (total) {

        total.textContent =
            totalPages;

    }


    if (previous) {

        previous.disabled =
            usersState.currentPage <= 1;

    }


    if (next) {

        next.disabled =
            usersState.currentPage >=
            totalPages;

    }


    const totalUsers =
        usersState.filteredUsers.length;


    const start =
        totalUsers === 0
            ? 0
            : (
                (
                    usersState.currentPage - 1
                ) *
                usersState.perPage
            ) + 1;


    const end =
        Math.min(
            usersState.currentPage *
            usersState.perPage,
            totalUsers
        );


    setText(
        "#paginationInfo",
        totalUsers
            ? `Showing ${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(totalUsers)} users`
            : "No users found"
    );


    setText(
        "#userCount",
        formatNumber(totalUsers)
    );

}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics() {

    const users =
        usersState.users;


    const total =
        users.length;


    const active =
        users.filter(
            user =>
                normalizeStatus(
                    user.status
                ) === "active"
        ).length;


    const inactive =
        total - active;


    const administrators =
        users.filter(
            user =>
                String(
                    user.role ?? ""
                ).toLowerCase() ===
                "admin"
        ).length;


    setText(
        "#totalUsers",
        formatNumber(total)
    );


    setText(
        "#activeUsers",
        formatNumber(active)
    );


    setText(
        "#inactiveUsers",
        formatNumber(inactive)
    );


    setText(
        "#adminUsers",
        formatNumber(administrators)
    );

}


/* =========================================================
   FIND USER
   ========================================================= */

function findUser(id) {

    return usersState.users.find(
        user =>
            String(
                getUserId(user)
            ) === String(id)
    );

}


function getUserId(user) {

    return (
        user?.id ??
        user?.user_id
    );

}


/* =========================================================
   STATUS
   ========================================================= */

function normalizeStatus(status) {

    const value =
        String(
            status ?? "active"
        ).toLowerCase();


    if (
        [
            "1",
            "true",
            "enabled",
            "active"
        ].includes(value)
    ) {

        return "active";

    }


    if (
        [
            "0",
            "false",
            "disabled",
            "inactive"
        ].includes(value)
    ) {

        return "inactive";

    }


    return value;

}


function renderStatusBadge(status) {

    if (status === "active") {

        return `
            <span class="status-badge success">
                Active
            </span>
        `;

    }


    if (status === "inactive") {

        return `
            <span class="status-badge danger">
                Inactive
            </span>
        `;

    }


    return `
        <span class="status-badge warning">
            ${escapeHtml(status)}
        </span>
    `;

}


/* =========================================================
   LOADING STATE
   ========================================================= */

function setLoadingState(
    loading
) {

    const refresh =
        $("#refreshUsersButton");


    const addButton =
        $("#addUserButton");


    if (refresh) {

        refresh.disabled =
            loading;

    }


    if (addButton) {

        addButton.disabled =
            loading;

    }


    const tbody =
        $("#usersTableBody");


    if (
        loading &&
        tbody
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="100%"
                    class="table-loading"
                >
                    Loading users...
                </td>
            </tr>
        `;

    }

}


/* =========================================================
   ERROR STATE
   ========================================================= */

function renderUsersError(
    message
) {

    const tbody =
        $("#usersTableBody");


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
            () =>
                controller.abort(),
            USERS_CONFIG.REQUEST_TIMEOUT
        );


    try {

        return await fetch(
            url,
            {
                ...options,
                signal:
                    controller.signal
            }
        );

    } catch (error) {

        if (
            error.name ===
            "AbortError"
        ) {

            throw new Error(
                "The request timed out."
            );

        }

        throw error;

    } finally {

        clearTimeout(timeout);

    }

}


/* =========================================================
   RESPONSE PARSER
   ========================================================= */

async function parseJsonResponse(
    response
) {

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
   FORM HELPERS
   ========================================================= */

function setFormValue(
    selector,
    value
) {

    const element =
        $(selector);


    if (element) {

        element.value =
            value ?? "";

    }

}


/* =========================================================
   TEXT HELPERS
   ========================================================= */

function setText(
    selector,
    value
) {

    const element =
        $(selector);


    if (element) {

        element.textContent =
            value;

    }

}


/* =========================================================
   INITIALS
   ========================================================= */

function getInitials(
    name
) {

    const parts =
        String(name ?? "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!parts.length) {
        return "U";
    }


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


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDisplayDate(
    value
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

        return String(value);

    }


    return new Intl.DateTimeFormat(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    ).format(date);

}


/* =========================================================
   NUMBER FORMAT
   ========================================================= */

function formatNumber(
    value
) {

    return new Intl.NumberFormat(
        "en-US"
    ).format(
        Number(value) || 0
    );

}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHtml(
    value
) {

    return String(value ?? "")
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

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
                () =>
                    callback(...args),
                delay
            );

    };

}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
    message,
    type = "info"
) {

    let container =
        $("#toastContainer");


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


    requestAnimationFrame(
        () => {

            toast.classList.add(
                "visible"
            );

        }
    );


    setTimeout(
        () => {

            toast.classList.remove(
                "visible"
            );


            setTimeout(
                () =>
                    toast.remove(),
                200
            );

        },
        3500
    );

}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.InventoryUsers = {

    load:
        loadUsers,

    refresh:
        loadUsers,

    add:
        () =>
            openUserModal(),

    edit:
        editUser,

    delete:
        deleteUser,

    toggleStatus:
        toggleUserStatus,

    changePassword:
        changePassword,

    getState:
        () => ({
            ...usersState
        })

};
