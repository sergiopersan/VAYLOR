// --------------------------------------------------
// GAMEVAULT / VAYLOR — Módulo de Interfaz de Usuario (UI)
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
    if (game.cover && typeof game.cover === "string" && game.cover.trim()) {
        return game.cover.trim();
    }

    if (game.appId) {
        return `https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/library_600x900.jpg`;
    }

    return "";
}

export function showToast(message, duration = 3000) {
    const toastElement = document.querySelector("#toast");
    if (!toastElement) return;

    toastElement.textContent = message;
    toastElement.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toastElement.classList.remove("show");
    }, duration);
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
            (total, game) => total + (Number(game.hours) || 0),
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
      onerror="this.hidden=true; if(this.nextElementSibling) this.nextElementSibling.hidden=false;">
     <div class="cover-placeholder" hidden aria-hidden="true">🎮</div>`
        : `<div class="cover-placeholder" aria-label="Sin portada">🎮</div>`;

    const favoriteLabel = game.favorite
        ? "Quitar de favoritos"
        : "Añadir a favoritos";

    return `
      <article class="game-card" data-id="${game.id}">
        <div class="cover-wrap">
          ${coverMarkup}

          <span class="status-badge ${STATUS_CLASSES[game.status] || 'status-backlog'}">
            ${escapeHTML(STATUS_LABELS[game.status] || 'Pendiente')}
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
            <span class="game-rating">★ ${Number(game.rating || 0).toLocaleString("es-ES")}</span>
          </div>

          <div class="game-meta" style="margin-top: 7px">
            <span>${Number(game.hours || 0).toLocaleString("es-ES")} h jugadas</span>
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
