# pipeline/ocr.py

import pytesseract
from pathlib import Path
from pdf2image import convert_from_path
from PIL import Image

from core.config import TESSERACT_PATH, POPPLER_PATH

# Tell pytesseract where the Tesseract executable is
pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH


def is_scanned_pdf(file_path: Path, sample_pages: int = 3) -> bool:
    """
    Detect whether a PDF is scanned (image-based) or text-based.

    Tries to extract text from the first few pages using PyMuPDF.
    If the total extracted text is below a threshold, the PDF is
    considered scanned and OCR will be needed.

    Args:
        file_path    : Path to the PDF file
        sample_pages : Number of pages to sample for text detection

    Returns:
        True if the PDF appears to be scanned, False if it is text-based.
    """
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(str(file_path))
        total_text = ""

        for i in range(min(sample_pages, len(doc))):
            total_text += doc[i].get_text()

        doc.close()

        # If fewer than 50 characters extracted from sample pages,
        # it is almost certainly a scanned PDF
        return len(total_text.strip()) < 50

    except Exception as e:
        print(f"⚠️  Could not detect PDF type: {e}. Assuming scanned.")
        return True


def ocr_pdf(file_path: Path) -> list[dict]:
    """
    Perform OCR on a scanned PDF and return extracted text as page dicts.

    Process:
        1. Convert each PDF page to a high-resolution image using pdf2image
        2. Run Tesseract OCR on each image to extract text
        3. Return a list of page dicts matching the format that
           pipeline/ingestion.py's load_document() returns

    Args:
        file_path : Path to the scanned PDF file

    Returns:
        List of page dicts, each containing:
            - content : Extracted text string for that page
            - page    : Page number (1-indexed)
            - source  : Absolute file path as string

    Raises:
        RuntimeError if OCR fails entirely.
    """
    print(f"🔍 OCR detected — converting '{file_path.name}' pages to images...")

    try:
        images = convert_from_path(
            str(file_path),
            dpi=300,                        # High DPI for better OCR accuracy
            poppler_path=POPPLER_PATH,
        )
    except Exception as e:
        raise RuntimeError(
            f"❌ Failed to convert PDF to images. "
            f"Make sure Poppler is installed correctly.\n"
            f"Error: {e}"
        )

    print(f"🖼️  Converted {len(images)} page(s) to images. Running OCR...")

    pages = []

    for i, image in enumerate(images):
        page_number = i + 1

        try:
            # Run Tesseract OCR on the image
            text = pytesseract.image_to_string(
                image,
                lang="eng",
                config="--psm 6",   # Assume uniform block of text per page
            )

            text = text.strip()

            if text:
                pages.append({
                    "content": text,
                    "page":    page_number,
                    "source":  str(file_path),
                })
                print(f"  ✅ Page {page_number}: {len(text)} characters extracted.")
            else:
                print(f"  ⚠️  Page {page_number}: No text extracted (blank or unreadable image).")

        except Exception as e:
            print(f"  ❌ Page {page_number}: OCR failed — {e}")
            continue

    if not pages:
        raise RuntimeError(
            f"❌ OCR produced no text from '{file_path.name}'. "
            f"The document may be too low quality or in an unsupported language."
        )

    print(f"✅ OCR complete — {len(pages)} page(s) successfully extracted.")
    return pages