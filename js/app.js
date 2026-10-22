// --------------------------------------------------
// GAMEVAULT — Punto de entrada principal
// Importa y coordina todos los módulos del proyecto
// --------------------------------------------------

"use strict";

import { loadGames, saveGames, normalizeGame, STATUS_LABELS, STATUS_CLASSES } from "./storage.js";
import { escapeHTML, getCoverURL, showToast, renderStats } from "./ui.js";
import { loadGameCatalog, getFilteredCatalogGames, renderCatalogCard, catalogGames } from "./catalog.js";

// --------------------------------------------------
// Referencias al DOM
// --------------------------------------------------

const $ = (selector) => document.querySelector(selector);

const gameGrid    = $("#game-grid");
const emptyState  = $("#empty-state");
const searchInput = $("#search-input");
const genreFilter = $("#genre-filter");
const sortFilter  = $("#sort-filter");
const dialog      = $("#game-dialog");
const form        = $("#game-form");

let activeView = "all";

// --------------------------------------------------
// Estado de la biblioteca
// --------------------------------------------------

let games = loadGames();

// --------------------------------------------------
// Filtrado de la biblioteca
// --------------------------------------------------

function getFilteredGames() {
    const query = searchInput.value.trim().toLocaleLowerCase("es");
    const genre = genreFilter.value;

    let filtered = games.filter((game) => {
        const matchesSearch = game.name.toLocaleLowerCase("es").includes(query);
        const matchesGenre  = genre === "all" || game.genre === genre;

        let matchesView = true;
        if (activeView === "playing")   matchesView = game.status === "playing";
        else if (activeView === "completed") matchesView = game.status === "completed";
        else if (activeView === "wishlist")  matchesView = game.status === "wishlist";
        else if (activeView === "favorites") matchesView = game.favorite;

        return matchesSearch && matchesGenre && matchesView;
    });

    switch (sortFilter.value) {
        case "rating": filtered.sort((a, b) => b.rating - a.rating); break;
        case "hours":  filtered.sort((a, b) => b.hours  - a.hours);  break;
        case "recent": filtered.sort((a, b) => b.addedAt - a.addedAt); break;
        default:       filtered.sort((a, b) => a.name.localeCompare(b.name, "es"));
    }

    return filtered;
}

// --------------------------------------------------
// Renderizado de la cuadrícula
// --------------------------------------------------

function renderLibraryCardInline(game) {
    const cover = getCoverURL(game);

    const coverMarkup = cover
        ? `<img class="game-cover"
      src="${escapeHTML(cover)}"
      alt="Portada de ${escapeHTML(game.name)}"
      loading="lazy"
      referrerpolicy="no-referrer"
      data-cover-image
      onerror="this.hidden=true; this.nextElementSibling.hidden=false">
     <div class="cover-placeholder" hidden aria-hidden="true">G</div>`
        : `<div class="cover-placeholder" aria-label="Sin portada">G</div>`;

    const favoriteLabel = game.favorite ? "Quitar de favoritos" : "Añadir a favoritos";

    return `
      <article class="game-card" data-id="${game.id}">
        <div class="cover-wrap">
          ${coverMarkup}

          <span class="status-badge ${STATUS_CLASSES[game.status]}">
            ${escapeHTML(STATUS_LABELS[game.status])}
          </span>

          <button
            class="favorite-button ${game.favorite ? "is-favorite" : ""}"
            data-action="favorite"
            data-id="${game.id}"
            aria-label="${favoriteLabel}"
            aria-pressed="${game.favorite}"
            title="${favoriteLabel}"
          >${game.favorite ? "♥" : "♡"}</button>
        </div>

        <div class="game-info">
          <div class="game-genre">${escapeHTML(game.genre)}</div>
          <h3 class="game-title" title="${escapeHTML(game.name)}">
            ${escapeHTML(game.name)}
          </h3>

          <div class="game-meta">
            <span>${escapeHTML(game.platform)}</span>
            <span class="game-rating">★ ${game.rating.toLocaleString("es-ES")}</span>
          </div>

          <div class="game-meta" style="margin-top: 7px">
            <span>${game.hours.toLocaleString("es-ES")} h jugadas</span>
          </div>

          <div class="card-actions">
            <button class="card-action" data-action="edit" data-id="${game.id}">Editar</button>
            <button class="card-action delete" data-action="delete" data-id="${game.id}">Eliminar</button>
          </div>
        </div>
      </article>
    `;
}

function renderGames() {
    if (activeView === "catalog") {
        const filtered = getFilteredCatalogGames(
            searchInput.value,
            genreFilter.value,
            sortFilter.value
        );

        $("#visible-count").textContent = filtered.length;
        gameGrid.innerHTML = filtered.map(g => renderCatalogCard(g, games)).join("");

        emptyState.hidden  = filtered.length !== 0;
        gameGrid.hidden    = filtered.length === 0;

        if (filtered.length === 0) {
            emptyState.querySelector("h3").textContent = "No encontramos juegos en el catálogo";
            emptyState.querySelector("p").textContent  = "Prueba con otra búsqueda o selecciona otro género.";
            const btn = emptyState.querySelector("#empty-add");
            if (btn) btn.hidden = true;
        }

        renderStats(games);
        return;
    }

    const filtered = getFilteredGames();

    $("#visible-count").textContent = filtered.length;
    gameGrid.innerHTML = filtered.map(renderLibraryCardInline).join("");

    emptyState.hidden = filtered.length !== 0;
    gameGrid.hidden   = filtered.length === 0;

    if (filtered.length === 0) {
        emptyState.querySelector("h3").textContent = "No encontramos juegos";
        emptyState.querySelector("p").textContent  = "Prueba otra búsqueda o añade un nuevo videojuego.";
        const btn = emptyState.querySelector("#empty-add");
        if (btn) btn.hidden = false;
    }

    renderStats(games);
}

// --------------------------------------------------
// Navegación entre vistas
// --------------------------------------------------

const viewTitles = {
    all:       "Mi biblioteca",
    catalog:   "Juegos",
    playing:   "Jugando",
    completed: "Completados",
    wishlist:  "Lista de deseos",
    favorites: "Favoritos"
};

function setView(view) {
    if (!Object.hasOwn(viewTitles, view)) return;

    activeView = view;

    document.querySelectorAll(".nav-link").forEach((btn) => {
        const isActive = btn.dataset.view === view;
        btn.classList.toggle("active", isActive);
        isActive
            ? btn.setAttribute("aria-current", "page")
            : btn.removeAttribute("aria-current");
    });

    $("#breadcrumb-title").textContent = viewTitles[view];

    const sectionTitle = view === "all"
        ? "Todos los juegos"
        : (view === "catalog" ? "Catálogo de juegos" : viewTitles[view]);

    $("#section-title").firstChild.textContent = sectionTitle + " ";

    const openAddBtn = $("#open-add");
    if (openAddBtn) openAddBtn.hidden = view === "catalog";

    renderGames();
}

document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
});

// --------------------------------------------------
// Modal: añadir y editar
// --------------------------------------------------

function openAddDialog() {
    form.reset();
    $("#game-id").value    = "";
    $("#game-hours").value = "0";
    $("#game-rating").value = "8";
    $("#dialog-title").textContent = "Añadir videojuego";
    dialog.showModal();
    $("#game-name").focus();
}

function openEditDialog(id) {
    const game = games.find(item => item.id === id);
    if (!game) return;

    $("#game-id").value       = game.id;
    $("#game-name").value     = game.name;
    $("#game-cover").value    = game.cover || "";
    $("#game-genre").value    = game.genre;
    $("#game-platform").value = game.platform;
    $("#game-status").value   = game.status;
    $("#game-hours").value    = game.hours;
    $("#game-rating").value   = game.rating;
    $("#dialog-title").textContent = "Editar videojuego";

    dialog.showModal();
    $("#game-name").focus();
}

$("#open-add").addEventListener("click", openAddDialog);
$("#empty-add").addEventListener("click", openAddDialog);
$("#close-dialog").addEventListener("click", () => dialog.close());
$("#cancel-dialog").addEventListener("click", () => dialog.close());

form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const idValue  = $("#game-id").value;
    const existing = idValue ? games.find(g => g.id === Number(idValue)) : null;

    const name  = $("#game-name").value.trim();
    const cover = $("#game-cover").value.trim();

    if (!name) { showToast("Introduce el nombre del videojuego."); return; }

    if (cover) {
        try {
            const url = new URL(cover);
            if (url.protocol !== "https:" && url.protocol !== "http:") {
                showToast("La URL de la portada debe ser HTTP o HTTPS."); return;
            }
        } catch {
            showToast("Introduce una URL de portada válida."); return;
        }
    }

    const game = normalizeGame({
        id:       existing ? existing.id : Date.now(),
        name,
        appId:    existing ? existing.appId : null,
        cover,
        genre:    $("#game-genre").value,
        platform: $("#game-platform").value,
        status:   $("#game-status").value,
        hours:    $("#game-hours").value,
        rating:   $("#game-rating").value,
        favorite: existing ? existing.favorite : false,
        addedAt:  existing ? existing.addedAt  : Date.now()
    });

    if (existing) {
        games = games.map(item => item.id === existing.id ? game : item);
    } else {
        games.push(game);
    }

    saveGames(games);
    dialog.close();
    renderGames();
    showToast(existing ? "Videojuego actualizado correctamente." : "Videojuego añadido a tu biblioteca.");
});

// --------------------------------------------------
// Acciones de las tarjetas (delegación de eventos)
// --------------------------------------------------

gameGrid.addEventListener("click", (event) => {
    // Añadir desde catálogo
    const catalogBtn = event.target.closest("button[data-action='add-from-catalog']");
    if (catalogBtn) {
        const catalogId   = catalogBtn.dataset.catalogId;
        const catalogItem = catalogGames.find(item => String(item.id || item.title) === catalogId);
        if (!catalogItem) return;

        const name = String(catalogItem.title || catalogItem.name || "").trim();
        if (!name) return;

        const alreadyExists = games.some(
            item => item.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es")
        );

        if (alreadyExists) { showToast("Ese juego ya está en tu biblioteca."); return; }

        const newGame = normalizeGame({
            id:       Date.now(),
            name,
            appId:    catalogItem.appId ?? null,
            cover:    catalogItem.cover || "",
            genre:    Array.isArray(catalogItem.genres) ? (catalogItem.genres[0] || "Otro") : (catalogItem.genre || "Otro"),
            platform: Array.isArray(catalogItem.platforms) ? (catalogItem.platforms.join(", ") || "PC") : (catalogItem.platform || "PC"),
            status:   "backlog",
            hours:    0,
            rating:   typeof catalogItem.rating === "number" ? catalogItem.rating : 0,
            favorite: false,
            addedAt:  Date.now()
        });

        games.push(newGame);
        saveGames(games);
        renderGames();
        showToast(`${name} añadido a tu biblioteca.`);
        return;
    }

    // Acciones de tarjeta de biblioteca
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id     = Number(button.dataset.id);
    const action = button.dataset.action;
    const game   = games.find(item => item.id === id);
    if (!game) return;

    if (action === "favorite") {
        games = games.map(item =>
            item.id === id ? { ...item, favorite: !item.favorite } : item
        );
        saveGames(games);
        renderGames();
        const updated = games.find(item => item.id === id);
        showToast(updated.favorite ? "Añadido a favoritos." : "Eliminado de favoritos.");
    }

    if (action === "edit")   openEditDialog(id);

    if (action === "delete") {
        if (!window.confirm(`¿Quieres eliminar "${game.name}" de tu biblioteca?`)) return;
        games = games.filter(item => item.id !== id);
        saveGames(games);
        renderGames();
        showToast("Videojuego eliminado.");
    }
});

// --------------------------------------------------
// Búsqueda, filtros y accesibilidad de teclado
// --------------------------------------------------

searchInput.addEventListener("input",  renderGames);
genreFilter.addEventListener("change", renderGames);
sortFilter.addEventListener("change",  renderGames);

document.addEventListener("keydown", (event) => {
    const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);

    if (event.key === "/" && !isTyping && !dialog.open) {
        event.preventDefault();
        searchInput.focus();
    }

    if (event.key === "Escape" && dialog.open) {
        dialog.close();
    }
});

// --------------------------------------------------
// Inicialización
// --------------------------------------------------

$("#current-year").textContent = new Date().getFullYear();

// Carga el catálogo externo y renderiza la vista inicial
loadGameCatalog().then(() => {
    renderGames();
});
