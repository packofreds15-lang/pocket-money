"""Joins src/*.js into public/app.js (one file, no build tools needed)."""
import glob, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
parts = []
for f in sorted(glob.glob(os.path.join(root, "src", "*.js"))):
    parts.append(f"/* ===== {os.path.basename(f)} ===== */\n" + open(f, encoding="utf-8").read())
out = "/* Pocket Money app. Built from src/ by tools/build_site.py: edit the files in src/, not this one. */\n(function(){\n\"use strict\";\n" + "\n".join(parts) + "\n})();\n"
open(os.path.join(root, "public", "app.js"), "w", encoding="utf-8").write(out)
print("app.js", len(out), "bytes")
