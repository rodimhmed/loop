#!/usr/bin/env python3
"""Build a nested folder/file catalogue for the static GitHub Pages site."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
PDF_ROOT = ROOT / "pdf"
OUTPUT = ROOT / "library.json.js"

def build_node(directory: Path, relative: Path = Path(".")):
    folders = []
    files = []
    for child in sorted(directory.iterdir(), key=lambda p: (not p.is_dir(), p.name.casefold())):
        rel = (relative / child.name).as_posix()
        if child.is_dir():
            folders.append(build_node(child, relative / child.name))
        elif child.is_file() and child.suffix.lower() == ".pdf":
            files.append({
                "name": child.stem.replace("_", " ").replace("-", " "),
                "subject": directory.name if directory != PDF_ROOT else "محاضرة",
                "url": "pdf/" + (relative / child.name).as_posix()
            })
    return {
        "name": "المحاضرات" if relative == Path(".") else directory.name,
        "path": "" if relative == Path(".") else relative.as_posix(),
        "folders": folders,
        "files": files
    }

if not PDF_ROOT.exists():
    raise SystemExit("لم يتم العثور على مجلد pdf")
tree = build_node(PDF_ROOT)
OUTPUT.write_text("window.LIBRARY_TREE = " + json.dumps(tree, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
print(f"تم إنشاء {OUTPUT.name}")
print("تم فحص المجلد pdf ومجلداته الفرعية.")
