"""Build static site into docs/ for GitHub Pages deployment."""

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
DOCS = ROOT / "docs"
TEMPLATE = ROOT / "templates" / "index.html"
STATIC = ROOT / "static"


def main():
    if DOCS.exists():
        shutil.rmtree(DOCS)
    DOCS.mkdir(parents=True)

    for item in STATIC.iterdir():
        dest = DOCS / item.name
        if item.is_dir():
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)

    # Render index.html with relative asset paths
    html = TEMPLATE.read_text(encoding="utf-8")
    html = re.sub(
        r"\{\{ url_for\('static', filename='([^']+)'\) \}\}",
        r"\1",
        html,
    )
    (DOCS / "index.html").write_text(html, encoding="utf-8")
    (DOCS / ".nojekyll").touch()
    print(f"Built GitHub Pages site -> {DOCS}/")
    print("Commit docs/ and set GitHub Pages source to /docs folder.")


if __name__ == "__main__":
    main()
