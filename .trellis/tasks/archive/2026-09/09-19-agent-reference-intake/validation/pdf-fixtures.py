"""Generate small genuine PDFs for native PDF.js browser regression (no user files)."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter
from PIL import Image

folder = Path('/tmp/reference-intake-pdf-fixtures')
folder.mkdir(exist_ok=True)
pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
for name in ['chinese', 'scan', 'mixed']:
    c = canvas.Canvas(str(folder / f'{name}.pdf'))
    if name != 'scan':
        c.setFont('STSong-Light', 16)
        c.drawString(60, 740, '第一幕：小雨在旧车站重逢。')
        c.showPage()
    if name != 'chinese':
        c.drawImage(ImageReader(Image.new('RGB', (80, 60), '#405060')), 60, 640, width=160, height=120)
        c.showPage()
    c.save()
writer = PdfWriter()
writer.append(PdfReader(folder / 'chinese.pdf'))
writer.encrypt('fixture-password')
writer.write(folder / 'password.pdf')
(folder / 'corrupt.pdf').write_bytes(b'%PDF-1.7\ncorrupt fixture')
