// --------------------------------------------------
// GAMEVAULT / VAYLOR — Módulo de Almacenamiento (LocalStorage)
// --------------------------------------------------

import { getUserStorageKey } from "./auth.js";

export const LEGACY_STORAGE_KEY = "gamevault-library-v1";

export const STATUS_LABELS = {
    backlog: "Pendiente",
    playing: "Jugando",
    completed: "Completados",
    wishlist: "Lista de deseos"
};

export const STATUS_CLASSES = {
    backlog: "status-backlog",
    playing: "status-playing",
    completed: "status-completed",
    wishlist: "status-wishlist"
};

export const initialGames = [
    {
        id: 1,
        name: "Elden Ring",
        appId: 1245620,
        cover: "https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_600x900.jpg",
        genre: "RPG",
        platform: "PC",
        status: "playing",
        hours: 68,
        rating: 9.5,
        favorite: true
    },
    {
        id: 2,
        name: "Cyberpunk 2077",
        appId: 1091500,
        cover: "https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_600x900.jpg",
        genre: "RPG",
        platform: "PC",
        status: "playing",
        hours: 42,
        rating: 9,
        favorite: true
    },
    {
        id: 3,
        name: "Red Dead Redemption 2",
        appId: 1174180,
        cover: "https://cdn.akamai.steamstatic.com/steam/apps/1174180/library_600x900.jpg",
        genre: "Aventura",
        platform: "PC",
        status: "completed",
        hours: 95,
        rating: 10,
        favorite: true
    },
    {
        id: 4,
        name: "Hades",
        appId: 1145360,
        cover: "https://cdn.akamai.steamstatic.com/steam/apps/1145360/library_600x900.jpg",
        genre: "Roguelike",
        platform: "PC",
        status: "completed",
        hours: 35,
        rating: 9,
        favorite: false
    },
    {
        id: 5,
        name: "The Witcher 3",
        appId: 292030,
        cover: "https://cdn.akamai.steamstatic.com/steam/apps/292030/library_600x900.jpg",
        genre: "RPG",
        platform: "PC",
        status: "backlog",
        hours: 12,
        rating: 9.5,
        favorite: false
    },
    {
        id: 6,
        name: "Hollow Knight",
        appId: 367520,
        cover: "https://cdn.akamai.steamstatic.com/steam/apps/367520/library_600x900.jpg",
        genre: "Aventura",
        platform: "PC",
        status: "completed",
        hours: 28,
        rating: 9,
        favorite: false
    },
    {
        id: 7,
        name: "Stardew Valley",
        appId: 413150,
        cover: "https://cdn.akamai.steamstatic.com/steam/apps/413150/library_600x900.jpg",
        genre: "Simulación",
        platform: "PC",
        status: "playing",
        hours: 54,
        rating: 8.5,
        favorite: true
    },
    {
        id: 8,
        name: "Grand Theft Auto V",
        appId: 271590,
        cover: "https://cdn.akamai.steamstatic.com/steam/apps/271590/library_600x900.jpg",
        genre: "Acción",
        platform: "PC",
        status: "completed",
        hours: 120,
        rating: 9.5,
        favorite: true
    },
    {
        id: 9,
        name: "Portal 2",
        appId: 620,
        cover: "https://cdn.akamai.steamstatic.com/steam/apps/620/library_600x900.jpg",
        genre: "Aventura",
        platform: "PC",
        status: "completed",
        hours: 15,
        rating: 10,
        favorite: false
    },
    {
        id: 10,
        name: "Baldur's Gate 3",
        appId: 1086940,
        cover: "https://cdn.akamai.steamstatic.com/steam/apps/1086940/library_600x900.jpg",
        genre: "RPG",
        platform: "PC",
        status: "backlog",
        hours: 0,
        rating: 10,
        favorite: false
    }
];

export function normalizeGame(game) {
    const rawCover = typeof game.cover === "string" ? game.cover.trim() : "";
    const appId = Number.isInteger(Number(game.appId)) && game.appId !== null && game.appId !== ""
        ? Number(game.appId)
        : null;

    // Si no tiene cover explícito pero tiene appId de Steam, construirlo
    const cover = rawCover || (appId ? `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg` : "");

    return {
        id: Number(game.id) || Date.now(),
        name: String(game.name || game.title || "Juego sin título").slice(0, 80),
        appId,
        cover: cover.slice(0, 1000),
        genre: String(game.genre || "Otro"),
        platform: String(game.platform || "PC"),
        status: Object.hasOwn(STATUS_LABELS, game.status) ? game.status : "backlog",
        hours: Math.max(0, Math.min(100000, Number(game.hours) || 0)),
        rating: Math.max(0, Math.min(10, Number(game.rating) || 0)),
        favorite: Boolean(game.favorite),
        addedAt: Number(game.addedAt) || Date.now()
    };
}

export function loadGames() {
    try {
        const key = getUserStorageKey();
        let saved = localStorage.getItem(key);

        // Migración transparente si existía data en LEGACY_STORAGE_KEY
        if (saved === null && key === "vaylor-library-v1-guest") {
            const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacy !== null) {
                saved = legacy;
                localStorage.setItem(key, legacy);
            }
        }

        if (saved !== null) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                return parsed.map(normalizeGame);
            }
        }
    } catch (error) {
        console.error("No se pudo cargar la biblioteca:", error);
    }

    return [];
}

export function saveGames(games) {
    try {
        const key = getUserStorageKey();
        localStorage.setItem(key, JSON.stringify(games));
        return true;
    } catch (error) {
        console.error("No se pudo guardar la biblioteca:", error);
        return false;
    }
}
