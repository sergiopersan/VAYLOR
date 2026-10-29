#!/usr/bin/env python3
"""Verifica las portadas de games.json y corrige las rotas o ausentes buscando el juego en Steam.
Uso:
  python verificar_portadas.py                           # Verifica data/games.json in-place
  python verificar_portadas.py src.json dst.json        # Verifica archivo origen y guarda en destino
  python verificar_portadas.py --title "Elden Ring"     # Verifica y devuelve la carátula de un juego
  python verificar_portadas.py --serve [puerto]         # Inicia micro-servidor HTTP de verificación
Solo usa la librería estándar. Necesita conexión a internet."""

import json
import re
import sys
import os
import difflib
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

CDN = "https://cdn.akamai.steamstatic.com/steam/apps/{}/{}"
VARIANTES = [
    "library_600x900.jpg",
    "library_600x900_2x.jpg",
    "capsule_616x353.jpg",
    "header.jpg"
]
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# Carátulas conocidas para juegos no-Steam o con IDs específicos
KNOWN_COVERS = {
    "minecraft": "https://images.igdb.com/igdb/image/upload/t_cover_big/co8fv5.jpg",
    "the legend of zelda: breath of the wild": "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg",
    "the legend of zelda breath of the wild": "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg",
    "zelda breath of the wild": "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg",
    "call of duty: black ops 6": "https://cdn.akamai.steamstatic.com/steam/apps/1938090/library_600x900.jpg",
    "call of duty black ops 6": "https://cdn.akamai.steamstatic.com/steam/apps/1938090/library_600x900.jpg",
    "yakuza kiwami": "https://cdn.akamai.steamstatic.com/steam/apps/834530/library_600x900.jpg",
    "the elder scrolls iv: oblivion remastered": "https://cdn.akamai.steamstatic.com/steam/apps/22330/library_600x900.jpg",
    "the elder scrolls iv oblivion": "https://cdn.akamai.steamstatic.com/steam/apps/22330/library_600x900.jpg",
    "five nights at freddy's": "https://cdn.akamai.steamstatic.com/steam/apps/319510/header.jpg",
    "five nights at freddys": "https://cdn.akamai.steamstatic.com/steam/apps/319510/header.jpg",
    "f1 25": "https://cdn.akamai.steamstatic.com/steam/apps/2488620/library_600x900.jpg",
    "f1 24": "https://cdn.akamai.steamstatic.com/steam/apps/2488620/library_600x900.jpg"
}

def ok(url):
    """Comprueba si una URL devuelve estado 200 HTTP."""
    if not url or not isinstance(url, str) or not url.startswith("http"):
        return False
    try:
        req = urllib.request.Request(url, headers=UA, method="HEAD")
        with urllib.request.urlopen(req, timeout=12) as r:
            return r.status == 200
    except Exception:
        # Fallback a GET con Range para CDNs que rechacen HEAD
        try:
            headers = dict(UA)
            headers["Range"] = "bytes=0-10"
            req = urllib.request.Request(url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=12) as r:
                return r.status in (200, 206)
        except Exception:
            return False

def buscar_appid(titulo):
    """Busca el AppID de Steam correspondiente a un título dado."""
    if not titulo:
        return None

    norm_title = titulo.lower().strip()
    if norm_title in KNOWN_COVERS:
        # Si ya conocemos una URL directa o un AppID
        match = re.search(r"/apps/(\d+)/", KNOWN_COVERS[norm_title])
        if match:
            return int(match.group(1))

    # Variantes de búsqueda para títulos con subtítulos, marcas o caracteres especiales
    busquedas = [titulo]
    clean = re.sub(r"[\u00ae\u2122\:\-\'\,\.]", " ", titulo).strip()
    if clean and clean != titulo:
        busquedas.append(clean)
    if ":" in titulo:
        busquedas.append(titulo.split(":")[0].strip())
    if " - " in titulo:
        busquedas.append(titulo.split(" - ")[0].strip())

    for q_text in busquedas:
        q = urllib.parse.urlencode({"term": q_text, "cc": "es", "l": "spanish"})
        url = f"https://store.steampowered.com/api/storesearch/?{q}"
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.load(resp)
        except Exception:
            continue

        items = data.get("items", [])
        if not items:
            continue

        mejor, score = None, 0.0
        for it in items:
            s = difflib.SequenceMatcher(None, titulo.lower(), it["name"].lower()).ratio()
            if s > score:
                mejor, score = it["id"], s

        if mejor and score >= 0.55:
            return mejor
        if items:
            # Retornar el primer resultado si la búsqueda fue muy específica
            return items[0]["id"]

    return None

def verificar_caratula(titulo, cover_actual=""):
    """
    Verifica o busca la mejor carátula para un juego.
    Devuelve dict con {'ok': bool, 'cover': str, 'appId': int|None, 'status': str}
    """
    title_key = (titulo or "").lower().strip()
    clean_title_key = re.sub(r"[\u00ae\u2122\:\-\'\,\.]", " ", title_key).strip()

    # 1. Comprobar catálogo de carátulas conocidas
    for k in (title_key, clean_title_key):
        if k in KNOWN_COVERS:
            known_url = KNOWN_COVERS[k]
            m = re.search(r"/apps/(\d+)/", known_url)
            return {
                "ok": True,
                "title": titulo,
                "cover": known_url,
                "appId": int(m.group(1)) if m else None,
                "status": "conocida"
            }

    # 2. Si la carátula actual es válida, comprobarla
    if cover_actual and ok(cover_actual):
        m = re.search(r"/apps/(\d+)/", cover_actual)
        return {
            "ok": True,
            "title": titulo,
            "cover": cover_actual,
            "appId": int(m.group(1)) if m else None,
            "status": "ok"
        }

    # 3. Si la carátula actual tenía un Steam ID, intentar variantes de ese ID
    if cover_actual:
        m = re.search(r"/apps/(\d+)/", cover_actual)
        if m:
            steam_id = m.group(1)
            for v in VARIANTES:
                u = CDN.format(steam_id, v)
                if ok(u):
                    return {
                        "ok": True,
                        "title": titulo,
                        "cover": u,
                        "appId": int(steam_id),
                        "status": "ok_variante"
                    }

    # 4. Buscar en Steam por título
    appid = buscar_appid(titulo)
    if appid:
        for v in VARIANTES:
            u = CDN.format(appid, v)
            if ok(u):
                return {
                    "ok": True,
                    "title": titulo,
                    "cover": u,
                    "appId": appid,
                    "status": "corregida"
                }

    return {
        "ok": False,
        "title": titulo,
        "cover": cover_actual or "",
        "appId": None,
        "status": "SIN_PORTADA"
    }

def procesar(g):
    """Procesa un objeto juego de games.json de forma segura."""
    title = g.get("title") or g.get("name") or ""
    current_cover = g.get("cover") or ""
    game_id = g.get("id") or title

    res = verificar_caratula(title, current_cover)
    if res["ok"] and res["cover"]:
        g["cover"] = res["cover"]
        if res.get("appId") and not g.get("appId"):
            g["appId"] = res["appId"]
        return game_id, res["status"], res.get("appId")
    else:
        return game_id, "SIN_PORTADA", None

def resolver_rutas_por_defecto():
    """Calcula rutas absolutas de origen y destino para data/games.json."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Posibles ubicaciones de games.json
    candidatos = [
        os.path.join(script_dir, "games.json"),
        os.path.join(script_dir, "data", "games.json"),
        os.path.join(os.getcwd(), "data", "games.json"),
        os.path.join(os.getcwd(), "games.json")
    ]
    for c in candidatos:
        if os.path.exists(c):
            return c, c
    # Por defecto
    default_path = os.path.join(script_dir, "games.json")
    return default_path, default_path

def iniciar_servidor_http(port=5502):
    """Inicia un micro-servidor HTTP local para verificación en vivo."""
    from http.server import HTTPServer, BaseHTTPRequestHandler

    class VerifyHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path in ("/verify", "/api/verify-cover"):
                params = urllib.parse.parse_qs(parsed.query)
                title = params.get("title", [""])[0]
                cover = params.get("cover", [""])[0]

                if not title:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": False, "error": "Parámetro 'title' requerido"}).encode("utf-8"))
                    return

                res = verificar_caratula(title, cover)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
            else:
                self.send_response(404)
                self.end_headers()

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

    server = HTTPServer(("127.0.0.1", port), VerifyHandler)
    print(f"Servidor de verificación activo en http://127.0.0.1:{port}/api/verify-cover?title=...")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()

def main():
    args = sys.argv[1:]

    # Modo: microservidor HTTP
    if "--serve" in args:
        port = 5502
        idx = args.index("--serve")
        if len(args) > idx + 1 and args[idx + 1].isdigit():
            port = int(args[idx + 1])
        iniciar_servidor_http(port)
        return

    # Modo: verificar un solo juego por título
    if "--title" in args:
        idx = args.index("--title")
        if len(args) > idx + 1:
            title = args[idx + 1]
            res = verificar_caratula(title)
            print(json.dumps(res, ensure_ascii=False, indent=2))
            return
        else:
            print(json.dumps({"ok": False, "error": "Debes especificar un título tras --title"}))
            return

    # Modo: verificar objeto de juego pasado por JSON
    if "--game" in args:
        idx = args.index("--game")
        if len(args) > idx + 1:
            try:
                g = json.loads(args[idx + 1])
                t = g.get("title") or g.get("name") or ""
                c = g.get("cover") or ""
                res = verificar_caratula(t, c)
                print(json.dumps(res, ensure_ascii=False, indent=2))
                return
            except Exception as e:
                print(json.dumps({"ok": False, "error": str(e)}))
                return

    # Modo: procesamiento de archivo games.json
    if len(args) >= 2:
        src, dst = args[0], args[1]
    elif len(args) == 1:
        src = args[0]
        dst = args[0]
    else:
        src, dst = resolver_rutas_por_defecto()

    if not os.path.exists(src):
        print(f"Error: No se encontró el archivo origen '{src}'.")
        sys.exit(1)

    print(f"Verificando portadas desde: {src}")
    with open(src, encoding="utf8") as f:
        data = json.load(f)

    games = data.get("games", [])
    if not isinstance(games, list):
        print("Error: El JSON no contiene una lista 'games'.")
        sys.exit(1)

    with ThreadPoolExecutor(16) as ex:
        res = list(ex.map(procesar, games))

    # Detectar IDs repetidos en Steam
    cnt = {}
    for g in games:
        cover = g.get("cover") or ""
        m = re.search(r"/apps/(\d+)/", cover)
        if m:
            cnt.setdefault(m.group(1), []).append(g.get("id") or g.get("title"))

    # Guardar archivo actualizado
    with open(dst, "w", encoding="utf8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    total_ok = sum(r[1] in ("ok", "ok_variante", "conocida") for r in res)
    total_corregidas = sum(r[1] == "corregida" for r in res)
    sin_portada = [r[0] for r in res if r[1] == "SIN_PORTADA"]
    repetidas = {k: v for k, v in cnt.items() if len(v) > 1}

    print("=========================================")
    print(f"Verificación finalizada con éxito:")
    print(f"  OK: {total_ok} | Corregidas: {total_corregidas}")
    if total_corregidas > 0:
        for r in res:
            if r[1] == "corregida":
                print(f"    - {r[0]} -> Steam AppID {r[2]}")
    print(f"  Sin portada: {len(sin_portada)}")
    if sin_portada:
        print("    Juegos sin portada:", sin_portada)
    print(f"  Portadas repetidas: {len(repetidas)}")
    if repetidas:
        print("    IDs repetidos:", repetidas)
    print(f"Guardado en: {dst}")
    print("=========================================")

if __name__ == "__main__":
    main()
