// --------------------------------------------------
// VAYLOR — Punto de Entrada Principal (App)
// Coordina biblioteca, catálogo, autenticación, verificación y vista en primer plano
// --------------------------------------------------

"use strict";

import { loadGames, saveGames, normalizeGame, STATUS_LABELS, STATUS_CLASSES } from "./storage.js";
import { escapeHTML, getCoverURL, showToast, renderStats, renderLibraryCard } from "./ui.js";
import { loadGameCatalog, getFilteredCatalogGames, renderCatalogCard, catalogGames } from "./catalog.js";
import { registerUser, loginUser, logoutUser, getCurrentUser, getSession } from "./auth.js";

// --------------------------------------------------
// Referencias al DOM
// --------------------------------------------------

const $ = (selector) => document.querySelector(selector);

const gameGrid = $("#game-grid");
const emptyState = $("#empty-state");
const searchInput = $("#search-input");
const genreFilter = $("#genre-filter");
const sortFilter = $("#sort-filter");

const gameDialog = $("#game-dialog");
const gameForm = $("#game-form");
const btnVerifyCover = $("#btn-verify-cover");
const coverPreviewWrap = $("#cover-preview-wrap");
const coverPreviewImg = $("#cover-preview-img");
const coverPreviewSource = $("#cover-preview-source");

// Modal de Detalle en Primer Plano
const detailDialog = $("#game-detail-dialog");
const closeDetailDialog = $("#close-detail-dialog");
const detailCoverImg = $("#detail-cover-img");
const detailCoverPlaceholder = $("#detail-cover-placeholder");
const detailBadge = $("#detail-badge");
const detailGenre = $("#detail-genre");
const detailPlatform = $("#detail-platform");
const detailTitle = $("#detail-title");
const detailMeta = $("#detail-meta");
const detailRatingDisplay = $("#detail-rating-display");
const detailStatusDisplay = $("#detail-status-display");
const detailHoursCard = $("#detail-hours-card");
const detailHoursDisplay = $("#detail-hours-display");
const ratingSelectedVal = $("#rating-selected-val");
const starRatingButtons = $("#star-rating-buttons");
const btnSaveRating = $("#btn-save-rating");
const detailBtnAddLibrary = $("#detail-btn-add-library");
const detailBtnWishlist = $("#detail-btn-wishlist");
const detailBtnFavorite = $("#detail-btn-favorite");
const detailLibraryControls = $("#detail-library-controls");
const detailStatusSelect = $("#detail-status-select");
const detailBtnEdit = $("#detail-btn-edit");
const detailBtnDelete = $("#detail-btn-delete");

// Modal de Autenticación (en la app, desde el avatar)
const authDialog = $("#auth-dialog");
const avatarBtn = $("#avatar-btn");
const closeAuthDialog = $("#close-auth-dialog");
const authLoggedInView = $("#auth-logged-in-view");
const authGuestView = $("#auth-guest-view");
const tabLogin = $("#tab-login");
const tabRegister = $("#tab-register");
const loginForm = $("#login-form");
const registerForm = $("#register-form");
const logoutBtn = $("#logout-btn");
const userDisplayName = $("#user-display-name");

// Auth Gate (pantalla de acceso inicial)
const authGate = $("#auth-gate");
const appleApp = $(".apple-app");
const agTabLogin = $("#ag-tab-login");
const agTabRegister = $("#ag-tab-register");
const agPanelLogin = $("#ag-panel-login");
const agPanelRegister = $("#ag-panel-register");
const agLoginForm = $("#ag-login-form");
const agRegisterForm = $("#ag-register-form");
const agLoginError = $("#ag-login-error");
const agRegError = $("#ag-reg-error");

let activeView = "all";
let games = [];
let inspectedGame = null;
let selectedRatingValue = 8;

// --------------------------------------------------
// AUTH GATE — Pantalla completa de acceso inicial
// --------------------------------------------------

/**
 * Muestra el auth gate y oculta la app.
 */
function showAuthGate() {
    if (authGate) {
        authGate.removeAttribute("hidden");
        authGate.classList.remove("ag-hiding");
    }
    if (appleApp) appleApp.setAttribute("hidden", "");
}

/**
 * Oculta el auth gate con animación y muestra la app.
 */
function hideAuthGate(callback) {
    if (!authGate) {
        if (appleApp) appleApp.removeAttribute("hidden");
        if (callback) callback();
        return;
    }
    authGate.classList.add("ag-hiding");
    authGate.addEventListener("animationend", () => {
        authGate.setAttribute("hidden", "");
        authGate.classList.remove("ag-hiding");
        if (appleApp) appleApp.removeAttribute("hidden");
        if (callback) callback();
    }, { once: true });
}

/**
 * Muestra el banner de bienvenida en la app durante unos segundos.
 */
function showWelcomeBanner(username, isNew = false) {
    // Eliminar si ya existe
    const existing = $("#welcome-banner");
    if (existing) existing.remove();

    const banner = document.createElement("div");
    banner.id = "welcome-banner";
    banner.setAttribute("role", "status");
    banner.innerHTML = `
        <div class="wb-text">
            <h2>👋 ¡Bienvenido/a, ${escapeHTML(username)}!</h2>
            <p>${isNew
                ? "Tu cuenta está lista. Empieza añadiendo tus primeros juegos."
                : "Bienvenido de nuevo a tu biblioteca."
            }</p>
        </div>
        <div class="wb-actions">
            ${isNew ? `<button class="secondary-button" id="wb-add-btn">＋ Añadir primer juego</button>` : ""}
            <button id="welcome-close" aria-label="Cerrar bienvenida" title="Cerrar">✕</button>
        </div>
    `;

    // Insertar al inicio del main (después del view-hero) si existe, si no al inicio del main
    const heroSection = $(".view-hero");
    const mainEl = $(".apple-main");
    if (heroSection && mainEl) {
        heroSection.insertAdjacentElement("afterend", banner);
    } else if (mainEl) {
        mainEl.prepend(banner);
    }

    const closeBtn = banner.querySelector("#welcome-close");
    if (closeBtn) closeBtn.addEventListener("click", () => {
        banner.style.animation = "agFadeOut 0.3s var(--ease-apple) both";
        banner.addEventListener("animationend", () => banner.remove(), { once: true });
    });

    const addBtn = banner.querySelector("#wb-add-btn");
    if (addBtn) addBtn.addEventListener("click", () => {
        banner.remove();
        openAddDialog();
    });

    // Auto-ocultar tras 8 s
    setTimeout(() => {
        if (banner.isConnected) {
            banner.style.animation = "agFadeOut 0.5s var(--ease-apple) both";
            banner.addEventListener("animationend", () => banner.remove(), { once: true });
        }
    }, 8000);
}

/** Mostrar error en el auth gate */
function showAuthGateError(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.removeAttribute("hidden");
    // Reiniciar animación de shake
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
}

function clearAuthGateErrors() {
    [agLoginError, agRegError].forEach(el => {
        if (el) { el.textContent = ""; el.setAttribute("hidden", ""); }
    });
}

// ── Tabs del auth gate ──────────────────────────────────────────────────

function switchAgTab(tab) {
    if (!agTabLogin || !agTabRegister || !agPanelLogin || !agPanelRegister) return;
    const isLogin = tab === "login";
    agTabLogin.classList.toggle("active", isLogin);
    agTabRegister.classList.toggle("active", !isLogin);
    agTabLogin.setAttribute("aria-selected", isLogin ? "true" : "false");
    agTabRegister.setAttribute("aria-selected", isLogin ? "false" : "true");
    if (isLogin) {
        agPanelLogin.removeAttribute("hidden");
        agPanelRegister.setAttribute("hidden", "");
    } else {
        agPanelRegister.removeAttribute("hidden");
        agPanelLogin.setAttribute("hidden", "");
    }
    clearAuthGateErrors();
}

if (agTabLogin) agTabLogin.addEventListener("click", () => switchAgTab("login"));
if (agTabRegister) agTabRegister.addEventListener("click", () => switchAgTab("register"));

// ── Toggle mostrar/ocultar contraseña ──────────────────────────────────

document.querySelectorAll(".ag-eye-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (!input) return;
        input.type = input.type === "password" ? "text" : "password";
        btn.textContent = input.type === "password" ? "👁" : "🙈";
    });
});

// ── Formulario Login del auth gate ─────────────────────────────────────

if (agLoginForm) {
    agLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearAuthGateErrors();
        const submit = agLoginForm.querySelector(".ag-submit-btn");
        const btnText = agLoginForm.querySelector(".ag-btn-text");
        const btnSpinner = agLoginForm.querySelector(".ag-btn-spinner");

        submit.disabled = true;
        if (btnText) btnText.textContent = "Entrando...";
        if (btnSpinner) btnSpinner.removeAttribute("hidden");

        const email = document.getElementById("ag-login-email")?.value.trim() || "";
        const password = document.getElementById("ag-login-password")?.value || "";

        const res = await loginUser({ email, password });

        if (res.ok) {
            games = loadGames();
            updateAuthUI();
            hideAuthGate(() => {
                renderGames();
                showWelcomeBanner(res.user.username, false);
            });
        } else {
            showAuthGateError("ag-login-error", res.error || "Error al iniciar sesión.");
            submit.disabled = false;
            if (btnText) btnText.textContent = "Iniciar sesión";
            if (btnSpinner) btnSpinner.setAttribute("hidden", "");
        }
    });
}

// ── Formulario Registro del auth gate ──────────────────────────────────

if (agRegisterForm) {
    agRegisterForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearAuthGateErrors();
        const submit = agRegisterForm.querySelector(".ag-submit-btn");
        const btnText = agRegisterForm.querySelector(".ag-btn-text");
        const btnSpinner = agRegisterForm.querySelector(".ag-btn-spinner");

        submit.disabled = true;
        if (btnText) btnText.textContent = "Creando cuenta...";
        if (btnSpinner) btnSpinner.removeAttribute("hidden");

        const username = document.getElementById("ag-reg-username")?.value.trim() || "";
        const email = document.getElementById("ag-reg-email")?.value.trim() || "";
        const password = document.getElementById("ag-reg-password")?.value || "";

        const res = await registerUser({ username, email, password });

        if (res.ok) {
            games = loadGames(); // nueva cuenta → biblioteca vacía
            updateAuthUI();
            hideAuthGate(() => {
                renderGames();
                showWelcomeBanner(res.user.username, true);
            });
        } else {
            showAuthGateError("ag-reg-error", res.error || "Error al crear la cuenta.");
            submit.disabled = false;
            if (btnText) btnText.textContent = "Crear mi cuenta";
            if (btnSpinner) btnSpinner.setAttribute("hidden", "");
        }
    });
}

// --------------------------------------------------
// Verificación de Carátulas mediante verificar_portadas.py
// --------------------------------------------------

/**
 * Consulta la API local respaldada por verificar_portadas.py
 * Si el servidor local no está disponible, realiza fallback inteligente.
 */
async function verifyGameCover(title, currentCover = "") {
    if (!title || !title.trim()) return null;

    try {
        const query = new URLSearchParams({
            title: title.trim(),
            cover: currentCover.trim()
        });
        const res = await fetch(`/api/verify-cover?${query.toString()}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.ok && data.cover) {
                return data;
            }
        }
    } catch {
        // Servidor no disponible o modo estático
    }

    // Fallback de carátulas conocidas en modo cliente si no responde el endpoint
    const knownFallbacks = {
        "minecraft": "https://images.igdb.com/igdb/image/upload/t_cover_big/co8fv5.jpg",
        "the legend of zelda: breath of the wild": "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg",
        "zelda breath of the wild": "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg",
        "elden ring": "https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_600x900.jpg",
        "cyberpunk 2077": "https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_600x900.jpg",
        "hollow knight": "https://cdn.akamai.steamstatic.com/steam/apps/367520/library_600x900.jpg",
        "hades": "https://cdn.akamai.steamstatic.com/steam/apps/1145360/library_600x900.jpg",
        "portal 2": "https://cdn.akamai.steamstatic.com/steam/apps/620/library_600x900.jpg",
        "the witcher 3": "https://cdn.akamai.steamstatic.com/steam/apps/292030/library_600x900.jpg",
        "five nights at freddy's": "https://cdn.akamai.steamstatic.com/steam/apps/319510/header.jpg"
    };

    const key = title.trim().toLowerCase();
    if (knownFallbacks[key]) {
        return {
            ok: true,
            title,
            cover: knownFallbacks[key],
            status: "conocida_cliente"
        };
    }

    return null;
}

// Botón manual "Verificar con Steam" en el diálogo
if (btnVerifyCover) {
    btnVerifyCover.addEventListener("click", async () => {
        const titleInput = $("#game-name");
        const coverInput = $("#game-cover");
        const title = titleInput.value.trim();

        if (!title) {
            showToast("Introduce primero el nombre del juego para verificar su carátula.");
            titleInput.focus();
            return;
        }

        const originalText = btnVerifyCover.innerHTML;
        btnVerifyCover.disabled = true;
        btnVerifyCover.innerHTML = "<span>⏳</span> Verificando...";

        try {
            const verified = await verifyGameCover(title, coverInput.value);
            if (verified && verified.cover) {
                coverInput.value = verified.cover;
                coverPreviewImg.src = verified.cover;
                coverPreviewSource.textContent = verified.status === "ok"
                    ? "Carátula confirmada como válida"
                    : `Verificada vía Steam (verificar_portadas.py)`;
                coverPreviewWrap.hidden = false;
                showToast(`¡Carátula verificada para "${title}"!`);
            } else {
                showToast(`No encontramos carátula automática para "${title}". Puedes ingresar una URL manual.`);
            }
        } catch (e) {
            console.error("Error al verificar portada:", e);
            showToast("Error al conectar con el verificador de portadas.");
        } finally {
            btnVerifyCover.disabled = false;
            btnVerifyCover.innerHTML = originalText;
        }
    });
}

// Previsualización reactiva de carátula al escribir URL
$("#game-cover").addEventListener("input", (e) => {
    const val = e.target.value.trim();
    if (val && (val.startsWith("http://") || val.startsWith("https://"))) {
        coverPreviewImg.src = val;
        coverPreviewSource.textContent = "URL manual proporcionada";
        coverPreviewWrap.hidden = false;
    } else {
        coverPreviewWrap.hidden = true;
    }
});

// --------------------------------------------------
// Filtrado de la biblioteca
// --------------------------------------------------

function getFilteredGames() {
    const query = searchInput.value.trim().toLocaleLowerCase("es");
    const genre = genreFilter.value;

    let filtered = games.filter((game) => {
        const matchesSearch = game.name.toLocaleLowerCase("es").includes(query);
        const matchesGenre = genre === "all" || game.genre === genre;

        let matchesView = true;
        if (activeView === "playing") matchesView = game.status === "playing";
        else if (activeView === "completed") matchesView = game.status === "completed";
        else if (activeView === "wishlist") matchesView = game.status === "wishlist";
        else if (activeView === "favorites") matchesView = game.favorite;

        return matchesSearch && matchesGenre && matchesView;
    });

    switch (sortFilter.value) {
        case "rating": filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
        case "hours": filtered.sort((a, b) => (b.hours || 0) - (a.hours || 0)); break;
        case "recent": filtered.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)); break;
        default: filtered.sort((a, b) => a.name.localeCompare(b.name, "es"));
    }

    return filtered;
}

// --------------------------------------------------
// Renderizado de la cuadrícula
// --------------------------------------------------

function renderGames() {
    if (activeView === "catalog") {
        const filtered = getFilteredCatalogGames(
            searchInput.value,
            genreFilter.value,
            sortFilter.value
        );

        $("#visible-count").textContent = filtered.length;
        gameGrid.innerHTML = filtered.map(g => renderCatalogCard(g, games)).join("");

        emptyState.hidden = filtered.length !== 0;
        gameGrid.hidden = filtered.length === 0;

        if (filtered.length === 0) {
            emptyState.querySelector("h3").textContent = "No encontramos juegos en el catálogo";
            emptyState.querySelector("p").textContent = "Prueba con otra búsqueda o selecciona otro género.";
            const btn = emptyState.querySelector("#empty-add");
            if (btn) btn.hidden = true;
        }

        renderStats(games);
        return;
    }

    const filtered = getFilteredGames();

    $("#visible-count").textContent = filtered.length;
    gameGrid.innerHTML = filtered.map(renderLibraryCard).join("");

    emptyState.hidden = filtered.length !== 0;
    gameGrid.hidden = filtered.length === 0;

    if (filtered.length === 0) {
        emptyState.querySelector("h3").textContent = "No encontramos juegos";
        emptyState.querySelector("p").textContent = "Prueba otra búsqueda o añade un nuevo videojuego.";
        const btn = emptyState.querySelector("#empty-add");
        if (btn) btn.hidden = false;
    }

    renderStats(games);
}

// --------------------------------------------------
// Navegación entre vistas y Animaciones de Pestañas
// --------------------------------------------------

const viewTitles = {
    all: "Mi biblioteca",
    catalog: "Catálogo de juegos",
    playing: "Jugando ahora",
    completed: "Juegos completados",
    wishlist: "Lista de deseos",
    favorites: "Juegos favoritos"
};

function triggerTabAnimation() {
    gameGrid.classList.remove("tab-animating");
    void gameGrid.offsetWidth; // Forzar reflow para reiniciar la animación
    gameGrid.classList.add("tab-animating");
}

function setView(view) {
    if (!Object.hasOwn(viewTitles, view)) return;

    activeView = view;

    // Actualizar botones de pestañas superiores y móviles
    document.querySelectorAll(".nav-link, .mobile-nav-btn").forEach((btn) => {
        const isActive = btn.dataset.view === view;
        btn.classList.toggle("active", isActive);
        if (isActive) {
            btn.setAttribute("aria-current", "page");
        } else {
            btn.removeAttribute("aria-current");
        }
    });

    const sectionTitleEl = $("#section-title");
    if (sectionTitleEl) {
        sectionTitleEl.textContent = viewTitles[view];
    }

    const openAddBtn = $("#open-add");
    if (openAddBtn) {
        openAddBtn.hidden = view === "catalog";
    }

    triggerTabAnimation();
    renderGames();
}

document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
});

// --------------------------------------------------
// Sincronización de Chips de Género estilo Apple
// --------------------------------------------------

const genreChipsContainer = $("#genre-chips-container");
if (genreChipsContainer) {
    genreChipsContainer.addEventListener("click", (e) => {
        const chip = e.target.closest(".genre-chip");
        if (!chip) return;

        const genre = chip.dataset.genre;
        genreChipsContainer.querySelectorAll(".genre-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");

        genreFilter.value = genre;
        triggerTabAnimation();
        renderGames();
    });
}

// --------------------------------------------------
// Modal: añadir y editar juegos
// --------------------------------------------------

function openAddDialog() {
    gameForm.reset();
    $("#game-id").value = "";
    $("#game-hours").value = "0";
    $("#game-rating").value = "8";
    $("#dialog-title").textContent = "Añadir videojuego";
    coverPreviewWrap.hidden = true;
    gameDialog.showModal();
    $("#game-name").focus();
}

function openEditDialog(id) {
    const game = games.find(item => item.id === id);
    if (!game) return;

    $("#game-id").value = game.id;
    $("#game-name").value = game.name;
    $("#game-cover").value = game.cover || "";
    $("#game-genre").value = game.genre;
    $("#game-platform").value = game.platform;
    $("#game-status").value = game.status;
    $("#game-hours").value = game.hours;
    $("#game-rating").value = game.rating;
    $("#dialog-title").textContent = "Editar videojuego";

    if (game.cover) {
        coverPreviewImg.src = game.cover;
        coverPreviewSource.textContent = "Carátula actual del juego";
        coverPreviewWrap.hidden = false;
    } else {
        coverPreviewWrap.hidden = true;
    }

    gameDialog.showModal();
    $("#game-name").focus();
}

$("#open-add").addEventListener("click", openAddDialog);
$("#empty-add").addEventListener("click", openAddDialog);
$("#close-dialog").addEventListener("click", () => gameDialog.close());
$("#cancel-dialog").addEventListener("click", () => gameDialog.close());

// Envío del formulario de juego: verifica carátula si falta
gameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!gameForm.reportValidity()) return;

    const idValue = $("#game-id").value;
    const existing = idValue ? games.find(g => g.id === Number(idValue)) : null;

    const name = $("#game-name").value.trim();
    let cover = $("#game-cover").value.trim();
    let detectedAppId = existing ? existing.appId : null;

    if (!name) {
        showToast("Introduce el nombre del videojuego.");
        return;
    }

    // --------------------------------------------------
    // SI NO TIENE CARÁTULA: VERIFICARLA CON verificar_portadas.py
    // --------------------------------------------------
    if (!cover) {
        showToast(`Verificando carátula para "${name}" con verificar_portadas.py...`);
        try {
            const verified = await verifyGameCover(name);
            if (verified && verified.cover) {
                cover = verified.cover;
                detectedAppId = verified.appId || detectedAppId;
                showToast(`✓ Carátula encontrada y verificada.`);
            } else {
                showToast(`No se halló carátula en Steam. Se guardará con placeholder.`);
            }
        } catch (e) {
            console.warn("Fallo en verificación de portada:", e);
        }
    } else {
        try {
            const url = new URL(cover);
            if (url.protocol !== "https:" && url.protocol !== "http:") {
                showToast("La URL de la portada debe ser HTTP o HTTPS.");
                return;
            }
        } catch {
            showToast("Introduce una URL de portada válida.");
            return;
        }
    }

    const game = normalizeGame({
        id: existing ? existing.id : Date.now(),
        name,
        appId: detectedAppId,
        cover,
        genre: $("#game-genre").value,
        platform: $("#game-platform").value,
        status: $("#game-status").value,
        hours: $("#game-hours").value,
        rating: $("#game-rating").value,
        favorite: existing ? existing.favorite : false,
        addedAt: existing ? existing.addedAt : Date.now()
    });

    if (existing) {
        games = games.map(item => item.id === existing.id ? game : item);
    } else {
        games.push(game);
    }

    saveGames(games);
    gameDialog.close();
    renderGames();
    showToast(existing ? "Videojuego actualizado correctamente." : `"${name}" añadido a tu biblioteca.`);
});

// --------------------------------------------------
// TARJETA EN PRIMER PLANO (DETALLES Y ACCIONES)
// --------------------------------------------------

function renderRatingButtons(activeScore) {
    starRatingButtons.innerHTML = "";
    for (let i = 1; i <= 10; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `star-btn ${i <= activeScore ? "active" : ""}`;
        btn.textContent = i;
        btn.title = `Valorar con ${i} sobre 10`;
        btn.addEventListener("click", () => {
            selectedRatingValue = i;
            ratingSelectedVal.textContent = `${i} / 10`;
            document.querySelectorAll(".star-btn").forEach((b, idx) => {
                b.classList.toggle("active", idx + 1 <= i);
            });
        });
        starRatingButtons.appendChild(btn);
    }
}

function openGameDetail(gameIdOrTitle, isCatalog = false) {
    let game = null;
    let inLibrary = null;

    if (isCatalog) {
        game = catalogGames.find(item => String(item.id || item.title) === String(gameIdOrTitle));
        if (game) {
            const title = String(game.title || game.name || "").trim();
            inLibrary = games.find(g => g.name.toLocaleLowerCase("es") === title.toLocaleLowerCase("es"));
        }
    } else {
        game = games.find(item => item.id === Number(gameIdOrTitle));
        inLibrary = game;
    }

    if (!game) return;
    inspectedGame = { raw: game, inLibrary, isCatalog };

    const title = String(game.name || game.title || "Videojuego");
    const cover = getCoverURL(game) || game.cover || "";
    const genre = Array.isArray(game.genres) ? game.genres.join(", ") : (game.genre || "Otro");
    const platform = Array.isArray(game.platforms) ? game.platforms.join(", ") : (game.platform || "PC");
    const developer = game.developer || "Desarrollador";
    const releaseYear = game.releaseDate ? String(game.releaseDate).slice(0, 4) : "";
    const metaText = [developer, releaseYear].filter(Boolean).join(" • ");

    // Rellenar cabecera e info
    detailTitle.textContent = title;
    detailGenre.textContent = genre;
    detailPlatform.textContent = Array.isArray(game.platforms) ? game.platforms[0] : (game.platform || "PC");
    detailMeta.textContent = metaText || "Detalles del videojuego";
    detailBadge.textContent = Array.isArray(game.platforms) ? game.platforms[0] : (game.platform || "PC");

    // Portada
    if (cover) {
        detailCoverImg.src = cover;
        detailCoverImg.alt = `Portada de ${title}`;
        detailCoverImg.hidden = false;
        detailCoverPlaceholder.hidden = true;
    } else {
        detailCoverImg.hidden = true;
        detailCoverPlaceholder.hidden = false;
    }

    // Métricas clave
    const currentRating = inLibrary ? Number(inLibrary.rating || 0) : (Number(game.rating) || 0);
    detailRatingDisplay.textContent = currentRating ? `★ ${currentRating.toLocaleString("es-ES")}` : "★ Sin nota";

    if (inLibrary) {
        detailStatusDisplay.textContent = STATUS_LABELS[inLibrary.status] || "En biblioteca";
        detailStatusDisplay.style.color = inLibrary.status === "completed" ? "var(--blue)" :
                                          inLibrary.status === "playing" ? "var(--green)" :
                                          inLibrary.status === "wishlist" ? "var(--orange)" : "var(--purple)";
        detailHoursDisplay.textContent = `${Number(inLibrary.hours || 0).toLocaleString("es-ES")} h jugadas`;
        detailHoursCard.hidden = false;
        detailLibraryControls.hidden = false;
        detailStatusSelect.value = inLibrary.status;
    } else {
        detailStatusDisplay.textContent = "No añadido";
        detailStatusDisplay.style.color = "var(--muted)";
        detailHoursCard.hidden = true;
        detailLibraryControls.hidden = true;
    }

    // Botones de acción principales
    if (inLibrary) {
        detailBtnAddLibrary.innerHTML = `<span class="btn-icon">✓</span> En tu biblioteca`;
        detailBtnAddLibrary.classList.add("in-library");
    } else {
        detailBtnAddLibrary.innerHTML = `<span class="btn-icon">＋</span> Añadir a mi biblioteca`;
        detailBtnAddLibrary.classList.remove("in-library");
    }

    // Lista de deseos
    const isWishlist = inLibrary && inLibrary.status === "wishlist";
    if (isWishlist) {
        detailBtnWishlist.innerHTML = `<span class="btn-icon">♥</span> En lista de deseos`;
        detailBtnWishlist.classList.add("in-wishlist");
    } else {
        detailBtnWishlist.innerHTML = `<span class="btn-icon">♡</span> Lista de deseos`;
        detailBtnWishlist.classList.remove("in-wishlist");
    }

    // Favorito
    const isFav = inLibrary && Boolean(inLibrary.favorite);
    detailBtnFavorite.classList.toggle("is-favorite", isFav);
    detailBtnFavorite.textContent = isFav ? "♥" : "♡";
    detailBtnFavorite.setAttribute("aria-pressed", isFav);

    // Selector interactivo de valoración (1 a 10)
    selectedRatingValue = currentRating > 0 ? Math.round(currentRating) : 8;
    ratingSelectedVal.textContent = `${selectedRatingValue} / 10`;
    renderRatingButtons(selectedRatingValue);

    // Abrir tarjeta en primer plano con backdrop blur
    detailDialog.showModal();
}

// Cerrar detalle al hacer clic en ✕ o fuera de la tarjeta (en el backdrop)
closeDetailDialog.addEventListener("click", () => detailDialog.close());

detailDialog.addEventListener("click", (event) => {
    const rect = detailDialog.getBoundingClientRect();
    const isInDialog = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
    );
    if (!isInDialog) {
        detailDialog.close();
    }
});

// Guardar valoración interactiva
btnSaveRating.addEventListener("click", () => {
    if (!inspectedGame) return;
    const { raw, inLibrary, isCatalog } = inspectedGame;
    const title = String(raw.name || raw.title || "Juego").trim();

    if (inLibrary) {
        inLibrary.rating = selectedRatingValue;
        saveGames(games);
        renderGames();
        detailRatingDisplay.textContent = `★ ${selectedRatingValue.toLocaleString("es-ES")}`;
        showToast(`Valoración guardada: ${selectedRatingValue} ★ para "${title}".`);
    } else {
        const newGame = normalizeGame({
            id: Date.now(),
            name: title,
            appId: raw.appId ?? null,
            cover: raw.cover || "",
            genre: Array.isArray(raw.genres) ? (raw.genres[0] || "Otro") : (raw.genre || "Otro"),
            platform: Array.isArray(raw.platforms) ? (raw.platforms.join(", ") || "PC") : (raw.platform || "PC"),
            status: "backlog",
            hours: 0,
            rating: selectedRatingValue,
            favorite: false,
            addedAt: Date.now()
        });
        games.push(newGame);
        saveGames(games);
        renderGames();
        openGameDetail(newGame.id, false);
        showToast(`"${title}" añadido a tu biblioteca con ${selectedRatingValue} ★.`);
    }
});

// Acción: Añadir a biblioteca desde el modal de detalle
detailBtnAddLibrary.addEventListener("click", () => {
    if (!inspectedGame) return;
    const { raw, inLibrary } = inspectedGame;
    const title = String(raw.name || raw.title || "Juego").trim();

    if (inLibrary) {
        showToast(`"${title}" ya está en tu colección.`);
        return;
    }

    const newGame = normalizeGame({
        id: Date.now(),
        name: title,
        appId: raw.appId ?? null,
        cover: raw.cover || "",
        genre: Array.isArray(raw.genres) ? (raw.genres[0] || "Otro") : (raw.genre || "Otro"),
        platform: Array.isArray(raw.platforms) ? (raw.platforms.join(", ") || "PC") : (raw.platform || "PC"),
        status: "backlog",
        hours: 0,
        rating: typeof raw.rating === "number" ? raw.rating : 8,
        favorite: false,
        addedAt: Date.now()
    });

    games.push(newGame);
    saveGames(games);
    renderGames();
    openGameDetail(newGame.id, false);
    showToast(`"${title}" añadido a tu biblioteca.`);
});

// Acción: Lista de deseos desde el modal de detalle
detailBtnWishlist.addEventListener("click", () => {
    if (!inspectedGame) return;
    const { raw, inLibrary } = inspectedGame;
    const title = String(raw.name || raw.title || "Juego").trim();

    if (inLibrary) {
        const newStatus = inLibrary.status === "wishlist" ? "backlog" : "wishlist";
        inLibrary.status = newStatus;
        saveGames(games);
        renderGames();
        openGameDetail(inLibrary.id, false);
        showToast(newStatus === "wishlist"
            ? `"${title}" añadido a tu lista de deseos.`
            : `"${title}" movido a pendientes.`
        );
    } else {
        const newGame = normalizeGame({
            id: Date.now(),
            name: title,
            appId: raw.appId ?? null,
            cover: raw.cover || "",
            genre: Array.isArray(raw.genres) ? (raw.genres[0] || "Otro") : (raw.genre || "Otro"),
            platform: Array.isArray(raw.platforms) ? (raw.platforms.join(", ") || "PC") : (raw.platform || "PC"),
            status: "wishlist",
            hours: 0,
            rating: typeof raw.rating === "number" ? raw.rating : 0,
            favorite: false,
            addedAt: Date.now()
        });
        games.push(newGame);
        saveGames(games);
        renderGames();
        openGameDetail(newGame.id, false);
        showToast(`"${title}" guardado en tu lista de deseos.`);
    }
});

// Acción: Marcar favorito desde el modal de detalle
detailBtnFavorite.addEventListener("click", () => {
    if (!inspectedGame) return;
    const { raw, inLibrary } = inspectedGame;
    const title = String(raw.name || raw.title || "Juego").trim();

    if (inLibrary) {
        inLibrary.favorite = !inLibrary.favorite;
        saveGames(games);
        renderGames();
        openGameDetail(inLibrary.id, false);
        showToast(inLibrary.favorite ? "Añadido a favoritos." : "Eliminado de favoritos.");
    } else {
        const newGame = normalizeGame({
            id: Date.now(),
            name: title,
            appId: raw.appId ?? null,
            cover: raw.cover || "",
            genre: Array.isArray(raw.genres) ? (raw.genres[0] || "Otro") : (raw.genre || "Otro"),
            platform: Array.isArray(raw.platforms) ? (raw.platforms.join(", ") || "PC") : (raw.platform || "PC"),
            status: "backlog",
            hours: 0,
            rating: typeof raw.rating === "number" ? raw.rating : 8,
            favorite: true,
            addedAt: Date.now()
        });
        games.push(newGame);
        saveGames(games);
        renderGames();
        openGameDetail(newGame.id, false);
        showToast(`"${title}" añadido y marcado como favorito.`);
    }
});

// Selector de estado en biblioteca
detailStatusSelect.addEventListener("change", (e) => {
    if (!inspectedGame || !inspectedGame.inLibrary) return;
    const inLibrary = inspectedGame.inLibrary;
    inLibrary.status = e.target.value;
    saveGames(games);
    renderGames();
    openGameDetail(inLibrary.id, false);
    showToast(`Estado actualizado a "${STATUS_LABELS[inLibrary.status]}".`);
});

// Botón editar desde detalle
detailBtnEdit.addEventListener("click", () => {
    if (!inspectedGame || !inspectedGame.inLibrary) return;
    const id = inspectedGame.inLibrary.id;
    detailDialog.close();
    openEditDialog(id);
});

// Botón eliminar desde detalle
detailBtnDelete.addEventListener("click", () => {
    if (!inspectedGame || !inspectedGame.inLibrary) return;
    const id = inspectedGame.inLibrary.id;
    const title = inspectedGame.inLibrary.name;
    if (!window.confirm(`¿Quieres eliminar "${title}" de tu biblioteca?`)) return;
    games = games.filter(item => item.id !== id);
    saveGames(games);
    renderGames();
    detailDialog.close();
    showToast(`"${title}" eliminado de tu biblioteca.`);
});

// --------------------------------------------------
// Delegación de eventos de la cuadrícula
// --------------------------------------------------

gameGrid.addEventListener("click", (event) => {
    // 1. Acciones directas de botones
    const catalogBtn = event.target.closest("button[data-action='add-from-catalog']");
    if (catalogBtn) {
        event.stopPropagation();
        const catalogId = catalogBtn.dataset.catalogId;
        const catalogItem = catalogGames.find(item => String(item.id || item.title) === catalogId);
        if (!catalogItem) return;

        const name = String(catalogItem.title || catalogItem.name || "").trim();
        if (!name) return;

        const alreadyExists = games.some(
            item => item.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es")
        );

        if (alreadyExists) {
            showToast("Ese juego ya está en tu biblioteca.");
            return;
        }

        const newGame = normalizeGame({
            id: Date.now(),
            name,
            appId: catalogItem.appId ?? null,
            cover: catalogItem.cover || "",
            genre: Array.isArray(catalogItem.genres) ? (catalogItem.genres[0] || "Otro") : (catalogItem.genre || "Otro"),
            platform: Array.isArray(catalogItem.platforms) ? (catalogItem.platforms.join(", ") || "PC") : (catalogItem.platform || "PC"),
            status: "backlog",
            hours: 0,
            rating: typeof catalogItem.rating === "number" ? catalogItem.rating : 0,
            favorite: false,
            addedAt: Date.now()
        });

        games.push(newGame);
        saveGames(games);
        renderGames();
        showToast(`${name} añadido a tu biblioteca.`);
        return;
    }

    const button = event.target.closest("button[data-action]");
    if (button) {
        event.stopPropagation();
        const id = Number(button.dataset.id);
        const action = button.dataset.action;
        const game = games.find(item => item.id === id);
        if (!game) return;

        if (action === "favorite") {
            games = games.map(item =>
                item.id === id ? { ...item, favorite: !item.favorite } : item
            );
            saveGames(games);
            renderGames();
            const updated = games.find(item => item.id === id);
            showToast(updated.favorite ? "Añadido a favoritos." : "Eliminado de favoritos.");
            return;
        }

        if (action === "edit") {
            openEditDialog(id);
            return;
        }

        if (action === "delete") {
            if (!window.confirm(`¿Quieres eliminar "${game.name}" de tu biblioteca?`)) return;
            games = games.filter(item => item.id !== id);
            saveGames(games);
            renderGames();
            showToast("Videojuego eliminado.");
            return;
        }
    }

    // 2. Clic en cualquier otra parte de la tarjeta: Abrir en primer plano
    const card = event.target.closest(".game-card");
    if (card) {
        if (card.dataset.id) {
            openGameDetail(Number(card.dataset.id), false);
        } else if (card.dataset.catalogId) {
            openGameDetail(card.dataset.catalogId, true);
        }
    }
});

// --------------------------------------------------
// Autenticación y Perfil de Usuario
// --------------------------------------------------

function updateAuthUI() {
    const user = getCurrentUser();
    if (user) {
        userDisplayName.textContent = user.username;
        $("#profile-username").textContent = user.username;
        $("#profile-email").textContent = user.email;
        $("#profile-avatar").textContent = user.username.charAt(0).toUpperCase();
        authLoggedInView.hidden = false;
        authGuestView.hidden = true;
    } else {
        userDisplayName.textContent = "Biblioteca local";
        authLoggedInView.hidden = true;
        authGuestView.hidden = false;
    }
}

avatarBtn.addEventListener("click", () => {
    updateAuthUI();
    authDialog.showModal();
});

closeAuthDialog.addEventListener("click", () => authDialog.close());
$("#cancel-login").addEventListener("click", () => authDialog.close());
$("#cancel-register").addEventListener("click", () => authDialog.close());

tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    loginForm.hidden = false;
    registerForm.hidden = true;
});

tabRegister.addEventListener("click", () => {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    registerForm.hidden = false;
    loginForm.hidden = true;
});

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#login-email").value.trim();
    const password = $("#login-password").value;

    const res = await loginUser({ email, password });
    if (res.ok) {
        games = loadGames();
        renderGames();
        updateAuthUI();
        authDialog.close();
        loginForm.reset();
        showToast(`¡Bienvenido de nuevo, ${res.user.username}!`);
    } else {
        showToast(res.error || "Error al iniciar sesión.");
    }
});

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("#reg-username").value.trim();
    const email = $("#reg-email").value.trim();
    const password = $("#reg-password").value;

    const res = await registerUser({ username, email, password });
    if (res.ok) {
        games = loadGames();
        renderGames();
        updateAuthUI();
        authDialog.close();
        registerForm.reset();
        showToast(`¡Cuenta creada con éxito! Bienvenido/a, ${res.user.username}.`);
    } else {
        showToast(res.error || "Error al crear la cuenta.");
    }
});

logoutBtn.addEventListener("click", () => {
    logoutUser();
    games = [];
    renderGames();
    updateAuthUI();
    authDialog.close();
    showAuthGate();
    showToast("Sesión cerrada. Vuelve cuando quieras. 👋");
});

// --------------------------------------------------
// Búsqueda, filtros y accesibilidad de teclado
// --------------------------------------------------

searchInput.addEventListener("input", renderGames);
genreFilter.addEventListener("change", renderGames);
sortFilter.addEventListener("change", renderGames);

document.addEventListener("keydown", (event) => {
    const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);

    if (event.key === "/" && !isTyping && !gameDialog.open && !authDialog.open && !detailDialog.open) {
        event.preventDefault();
        searchInput.focus();
    }

    if (event.key === "Escape") {
        if (detailDialog.open) detailDialog.close();
        if (gameDialog.open) gameDialog.close();
        if (authDialog.open) authDialog.close();
    }
});

// --------------------------------------------------
// Bottom nav móvil: sincronizar con setView
// --------------------------------------------------

document.querySelectorAll(".mobile-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        setView(btn.dataset.view);
        document.querySelectorAll(".mobile-nav-btn").forEach(b =>
            b.classList.toggle("active", b.dataset.view === btn.dataset.view)
        );
    });
});

// --------------------------------------------------
// Gestor de Modo Oscuro / Claro (Apple Theme Manager)
// --------------------------------------------------

const themeToggleBtn = $("#theme-toggle");

function initTheme() {
    const savedTheme = localStorage.getItem("vaylor-theme");
    const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");

    setTheme(initialTheme, false);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
            const newTheme = currentTheme === "dark" ? "light" : "dark";
            setTheme(newTheme, true);
        });
    }

    if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
            if (!localStorage.getItem("vaylor-theme")) {
                setTheme(e.matches ? "dark" : "light", false);
            }
        });
    }
}

function setTheme(theme, notify = false) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("vaylor-theme", theme);

    if (themeToggleBtn) {
        themeToggleBtn.setAttribute(
            "title",
            theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
        );
        themeToggleBtn.setAttribute(
            "aria-label",
            theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
        );
    }

    if (notify) {
        showToast(theme === "dark" ? "Modo oscuro activado 🌙" : "Modo claro activado ☀️", 1800);
    }
}

// --------------------------------------------------
// Inicialización
// --------------------------------------------------

$("#current-year").textContent = new Date().getFullYear();
initTheme();

// ── Comprobación de sesión: Auth Gate o App directamente ────────────────
const activeSession = getSession();
if (activeSession) {
    // Hay sesión activa → mostrar la app directamente
    games = loadGames();
    updateAuthUI();
    if (authGate) authGate.setAttribute("hidden", "");
    if (appleApp) appleApp.removeAttribute("hidden");
    // Carga el catálogo externo y renderiza la vista inicial
    loadGameCatalog().then(() => {
        renderGames();
    });
} else {
    // Sin sesión → mostrar Auth Gate, ocultar app
    showAuthGate();
    // Precargar el catálogo en segundo plano para que esté listo cuando el usuario entre
    loadGameCatalog();
}
