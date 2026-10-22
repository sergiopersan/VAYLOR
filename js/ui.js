// --------------------------------------------------
// GAMEVAULT — Módulo de Interfaz de Usuario (UI)
// --------------------------------------------------

import { STATUS_LABELS, STATUS_CLASSES } from "./storage.js";

let toastTimer = null;

export function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export function getCoverURL(game) {
    if (game.cover) return game.cover;

    if (game.appId) {
        return `https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/library_600x900.jpg`;
    }

    return "";
}

export function showToast(message) {
    const toastElement = document.querySelector("#toast");
    if (!toastElement) return;

    toastElement.textContent = message;
    toastElement.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toastElement.classList.remove("show");
    }, 2600);
}

export function renderStats(games) {
    const totalEl = document.querySelector("#total-games");
    const playingEl = document.querySelector("#playing-games");
    const completedEl = document.querySelector("#completed-games");
    const hoursEl = document.querySelector("#total-hours");

    if (totalEl) totalEl.textContent = games.length;

    if (playingEl) {
        playingEl.textContent = games.filter(
            game => game.status === "playing"
        ).length;
    }

    if (completedEl) {
        completedEl.textContent = games.filter(
            game => game.status === "completed"
        ).length;
    }

    if (hoursEl) {
        const totalHours = games.reduce(
            (total, game) => total + game.hours,
            0
        );
        hoursEl.textContent = `${totalHours.toLocaleString("es-ES")} h`;
    }
}

export function renderLibraryCard(game) {
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

    const favoriteLabel = game.favorite
        ? "Quitar de favoritos"
        : "Añadir a favoritos";

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
            <button class="card-action"
              data-action="edit" data-id="${game.id}">Editar</button>
            <button class="card-action delete"
              data-action="delete" data-id="${game.id}">Eliminar</button>
          </div>
        </div>
      </article>
    `;
}

export function openAddDialog(form, dialog) {
    form.reset();

    document.querySelector("#game-id").value = "";
    document.querySelector("#game-hours").value = "0";
    document.querySelector("#game-rating").value = "8";
    document.querySelector("#dialog-title").textContent = "Añadir videojuego";

    dialog.showModal();
    document.querySelector("#game-name").focus();
}

export function openEditDialog(id, games, form, dialog) {
    const game = games.find(item => item.id === id);
    if (!game) return;

    form.reset();

    document.querySelector("#game-id").value = String(game.id);
    document.querySelector("#dialog-title").textContent = "Editar videojuego";
    document.querySelector("#game-name").value = game.name;
    document.querySelector("#game-cover").value = game.cover;
    document.querySelector("#game-genre").value = game.genre;
    document.querySelector("#game-platform").value = game.platform;
    document.querySelector("#game-status").value = game.status;
    document.querySelector("#game-hours").value = String(game.hours);
    document.querySelector("#game-rating").value = String(game.rating);

    dialog.showModal();
    document.querySelector("#game-name").focus();
}
