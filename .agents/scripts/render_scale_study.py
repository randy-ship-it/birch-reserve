from pathlib import Path
import fitz

source = Path("attached_assets/ScaleHealth_PostCheckout_Conversion_Study_Aug2026_1787348493742.pdf")
output = Path(".agents/outputs/scale-conversion-study")
output.mkdir(parents=True, exist_ok=True)

document = fitz.open(source)
print(f"pages={document.page_count}")
print(f"metadata={document.metadata}")

for page_number, page in enumerate(document):
    pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    page_path = output / f"page-{page_number + 1}.png"
    pixmap.save(page_path)
    print(f"rendered={page_path}")

text_path = output / "extracted-text.txt"
text_path.write_text(
    "\n\n".join(
        f"--- PAGE {page_number + 1} ---\n{page.get_text()}"
        for page_number, page in enumerate(document)
    ),
    encoding="utf-8",
)
print(f"text={text_path}")