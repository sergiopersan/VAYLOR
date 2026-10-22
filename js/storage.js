// --------------------------------------------------
// GAMEVAULT — Módulo de Almacenamiento (LocalStorage)
// --------------------------------------------------

export const STORAGE_KEY = "gamevault-library-v1";

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
        genre: "RPG",
        platform: "PC",
        status: "backlog",
        hours: 0,
        rating: 10,
        favorite: false
    }
];

export function normalizeGame(game) {
    return {
        id: Number(game.id),
        name: String(game.name || "Juego sin título").slice(0, 80),
        appId: Number.isInteger(Number(game.appId)) &&
            game.appId !== null && game.appId !== ""
            ? Number(game.appId)
            : null,
        cover: typeof game.cover === "string" &&
            game.cover.length <= 1000
            ? game.cover
            : "",
        genre: String(game.genre || "Otro"),
        platform: String(game.platform || "PC"),
        status: Object.hasOwn(STATUS_LABELS, game.status)
            ? game.status
            : "backlog",
        hours: Math.max(0, Math.min(100000, Number(game.hours) || 0)),
        rating: Math.max(0, Math.min(10, Number(game.rating) || 0)),
        favorite: Boolean(game.favorite),
        addedAt: Number(game.addedAt) || Date.now()
    };
}

export function loadGames() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved !== null) {
            const parsed = JSON.parse(saved);

            if (!Array.isArray(parsed)) {
                throw new Error("El formato de los datos guardados no es válido.");
            }

            return parsed.map(normalizeGame);
        }
    } catch (error) {
        console.error("No se pudo cargar la biblioteca:", error);
    }

    return initialGames.map((game, index) =>
        normalizeGame({
            ...game,
            addedAt: Date.now() - (initialGames.length - index) * 1000
        })
    );
}

export function saveGames(games) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
        return true;
    } catch (error) {
        console.error("No se pudo guardar la biblioteca:", error);
        return false;
    }
}
