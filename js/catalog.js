// --------------------------------------------------
// GAMEVAULT — Módulo de Catálogo Externo
// --------------------------------------------------

import { escapeHTML } from "./ui.js";

export let catalogGames = [];

export async function loadGameCatalog() {
    try {
        const response = await fetch("./data/games.json");

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data.games)) {
            throw new Error("El JSON debe contener una lista llamada games.");
        }

        catalogGames = data.games;
        return catalogGames;
    } catch (error) {
        console.error("No se pudo cargar el catálogo:", error);
        return [];
    }
}

export function getFilteredCatalogGames(query, genre, sortOrder) {
    const q = (query || "").trim().toLocaleLowerCase("es");

    const filtered = catalogGames.filter((game) => {
        const title = String(game.title || game.name || "");
        const matchesSearch = !q || title.toLocaleLowerCase("es").includes(q);

        const gameGenres = Array.isArray(game.genres)
            ? game.genres
            : [game.genre || "Otro"];

        const matchesGenre = genre === "all" ||
            gameGenres.some(g => g.toLocaleLowerCase("es") === genre.toLocaleLowerCase("es"));

        return matchesSearch && matchesGenre;
    });

    switch (sortOrder) {
        case "rating":
            filtered.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
            break;

        case "recent":
            filtered.sort((a, b) => String(b.releaseDate || "").localeCompare(String(a.releaseDate || "")));
            break;

        default:
            filtered.sort((a, b) =>
                String(a.title || a.name || "").localeCompare(String(b.title || b.name || ""), "es")
            );
    }

    return filtered;
}

export function renderCatalogCard(game, libraryGames) {
    const title = String(game.title || game.name || "Juego");
    const cover = game.cover || "";

    const coverMarkup = cover
        ? `<img class="game-cover"
      src="${escapeHTML(cover)}"
      alt="Portada de ${escapeHTML(title)}"
      loading="lazy"
      referrerpolicy="no-referrer"
      data-cover-image
      onerror="this.hidden=true; this.nextElementSibling.hidden=false">
     <div class="cover-placeholder" hidden aria-hidden="true">🎮</div>`
        : `<div class="cover-placeholder" aria-label="Sin portada">🎮</div>`;

    const genreText = Array.isArray(game.genres)
        ? game.genres.join(", ")
        : (game.genre || "Otro");

    const platformBadge = Array.isArray(game.platforms)
        ? game.platforms[0]
        : (game.platform || "PC");

    const platformFull = Array.isArray(game.platforms)
        ? game.platforms.join(", ")
        : (game.platform || "PC");

    const alreadyInLibrary = libraryGames.some(
        item => item.name.trim().toLocaleLowerCase("es") === title.trim().toLocaleLowerCase("es")
    );

    return `
      <article class="game-card" data-catalog-id="${escapeHTML(game.id || title)}">
        <div class="cover-wrap">
          ${coverMarkup}

          <span class="status-badge status-backlog">
            ${escapeHTML(platformBadge)}
          </span>
        </div>

        <div class="game-info">
          <div class="game-genre">${escapeHTML(genreText)}</div>
          <h3 class="game-title" title="${escapeHTML(title)}">
            ${escapeHTML(title)}
          </h3>

          <div class="game-meta">
            <span title="${escapeHTML(platformFull)}">${escapeHTML(game.developer || platformFull)}</span>
            <span class="game-rating">★ ${game.rating ? game.rating : "—"}</span>
          </div>

          <div class="card-actions" style="margin-top: 10px;">
            <button
              class="card-action"
              data-action="add-from-catalog"
              data-catalog-id="${escapeHTML(game.id || title)}"
              ${alreadyInLibrary ? "disabled" : ""}
              style="${alreadyInLibrary
                ? "opacity:0.55;cursor:default;background:#24232d;color:#999;border-color:#333;"
                : "background:#8b5cf6;color:white;border-color:#a78bfa;font-weight:700;cursor:pointer;"}"
            >${alreadyInLibrary ? "✓ En biblioteca" : "＋ Añadir a biblioteca"}</button>
          </div>
        </div>
      </article>
    `;
}
