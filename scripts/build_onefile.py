#!/usr/bin/env python3
"""Gộp toàn bộ sunbii-world thành 1 file HTML duy nhất — double-click
chạy được mà KHÔNG cần server (module code inline, tài nguyên nặng
tải từ CDN https — CORS được jsDelivr cho phép)."""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent  # sunbii-world/

html = (ROOT / "index.html").read_text(encoding="utf-8")
css = (ROOT / "assets" / "css" / "style.css").read_text(encoding="utf-8") if (ROOT / "assets").exists() else (ROOT / "css" / "style.css").read_text(encoding="utf-8")
engine = (ROOT / "js" / "engine.js").read_text(encoding="utf-8")
app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")

# 1) Inline CSS
html = html.replace(
    '<link rel="stylesheet" href="css/style.css?v=34" />',
    "<style>\n" + css + "\n</style>",
)

# 2) Gộp engine.js + app.js thành 1 module inline
#    - bỏ import THREE/CANNON của engine (app.js đã import — trùng sẽ crash)
#    - bỏ import './engine.js' (đã nối thẳng)
#    - bỏ keyword export (gộp cùng phạm vi)
engine = engine.replace("import * as THREE from 'three';\n", "")
engine = engine.replace("import * as CANNON from 'cannon-es';\n", "")
engine = engine.replace("export class PlayableWorldEngine", "class PlayableWorldEngine")
app = app.replace("import { PlayableWorldEngine } from './engine.js?v=34';\n", "")

assert "</script" not in engine and "</script" not in app, "JS chứa </script> — cần escape"

html = html.replace(
    '<script type="module" src="js/app.js?v=34"></script>',
    "<script type=\"module\">\n" + engine + "\n" + app + "\n</script>",
)

out = ROOT / "SUNBII-WORLD-onefile.html"
out.write_text(html, encoding="utf-8")
print(f"[OK] Đã tạo {out} ({out.stat().st_size // 1024} KB) — double-click để chơi, không cần server")
