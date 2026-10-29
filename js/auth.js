
// --------------------------------------------------
// VAYLOR — Módulo de Autenticación
// Gestión de usuarios, sesiones y perfiles
// --------------------------------------------------

"use strict";

const USERS_KEY = "vaylor-users-v1";
const SESSION_KEY = "vaylor-session-v1";

// --------------------------------------------------
// Helpers internos
// --------------------------------------------------

function loadUsers() {
    try {
        const raw = localStorage.getItem(USERS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveUsers(users) {
    try {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {
        console.error("Error guardando usuarios:", e);
    }
}

// Genera un id de usuario único
function createUserId() {
    return "u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

// Hash seguro con fallback
async function hashPassword(password) {
    if (typeof crypto !== "undefined" && crypto.subtle) {
        try {
            const data = new TextEncoder().encode(password + "vaylor-salt-v1");
            const buffer = await crypto.subtle.digest("SHA-256", data);
            return Array.from(new Uint8Array(buffer))
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
        } catch {
            // Continúa con fallback si falla subtle crypto
        }
    }
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        hash = ((hash << 5) - hash) + password.charCodeAt(i);
        hash |= 0;
    }
    return "fallback_" + Math.abs(hash).toString(16);
}

// --------------------------------------------------
// API pública
// --------------------------------------------------

/**
 * Registra un nuevo usuario.
 * @returns {Promise<{ok:boolean, error?:string, user?:object}>}
 */
export async function registerUser({ username, email, password }) {
    username = (username || "").trim();
    email = (email || "").trim().toLowerCase();

    if (!username || username.length < 2)
        return { ok: false, error: "El nombre debe tener al menos 2 caracteres." };

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return { ok: false, error: "Introduce un correo electrónico válido." };

    if (!password || password.length < 6)
        return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };

    const users = loadUsers();

    const emailExists = Object.values(users).some(u => u.email === email);
    if (emailExists)
        return { ok: false, error: "Ya existe una cuenta con ese correo electrónico." };

    const id = createUserId();
    const passwordHash = await hashPassword(password);

    const user = {
        id,
        username,
        email,
        passwordHash,
        avatar: null,
        createdAt: Date.now()
    };

    users[id] = user;
    saveUsers(users);

    startSession(user);
    return { ok: true, user };
}

/**
 * Inicia sesión con email + contraseña.
 * @returns {Promise<{ok:boolean, error?:string, user?:object}>}
 */
export async function loginUser({ email, password }) {
    email = (email || "").trim().toLowerCase();

    const users = loadUsers();
    const user = Object.values(users).find(u => u.email === email);

    if (!user)
        return { ok: false, error: "No encontramos ninguna cuenta con ese correo." };

    const hash = await hashPassword(password);
    if (hash !== user.passwordHash)
        return { ok: false, error: "Contraseña incorrecta." };

    startSession(user);
    return { ok: true, user };
}

/**
 * Cierra la sesión actual.
 */
export function logoutUser() {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (e) {
        console.error("Error al cerrar sesión:", e);
    }
}

/**
 * Devuelve el usuario de la sesión activa o null.
 */
export function getSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const session = JSON.parse(raw);

        // Verificar que el usuario aún existe
        const users = loadUsers();
        if (!users[session.userId]) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return session;
    } catch {
        return null;
    }
}

/**
 * Devuelve los datos completos del usuario activo.
 */
export function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    const users = loadUsers();
    return users[session.userId] ?? null;
}

// --------------------------------------------------
// Internas de sesión
// --------------------------------------------------

function startSession(user) {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            userId: user.id,
            startedAt: Date.now()
        }));
    } catch (e) {
        console.error("Error al iniciar sesión:", e);
    }
}

// --------------------------------------------------
// Clave de almacenamiento por usuario (para storage.js)
// --------------------------------------------------

/**
 * Devuelve la clave de localStorage que corresponde
 * a la biblioteca del usuario activo.
 */
export function getUserStorageKey() {
    const session = getSession();
    return session
        ? `vaylor-library-v1-${session.userId}`
        : "vaylor-library-v1-guest";
}
