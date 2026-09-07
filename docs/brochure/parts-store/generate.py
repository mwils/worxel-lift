"""Generate the counter card, Letter proof, and raster previews.
Dependencies: reportlab qrcode pymupdf opencv-python-headless
Run: python generate.py
"""
from pathlib import Path
from io import BytesIO
import qrcode
import fitz
import cv2
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parent
FONT_DIR = Path("/System/Library/Fonts/Supplemental")
for name, file in [("Body", "Arial.ttf"), ("Bold", "Arial Bold.ttf"), ("Display", "Arial Black.ttf")]:
    pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / file)))
INK = "#1a1714"
RED = "#c8261d"
SOFT = "#605849"
CREAM = "#f4eedf"
URL = "https://lift.worxel.com/?utm_source=parts-store&utm_medium=print&utm_campaign=counter-card&utm_content=qr"
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=4)
qr.add_data(URL)
qr.make(fit=True)
matrix = qr.get_matrix()
qr.make_image(fill_color="black", back_color="white").save(ROOT / "qr-parts-store.png")

def rect(c, x, y, w, h, color):
    c.setFillColor(HexColor(color))
    c.rect(x, y, w, h, fill=1, stroke=0)

def text(c, x, y, value, size=11, font="Body", color=INK):
    c.setFillColor(HexColor(color))
    c.setFont(font, size)
    c.drawString(x, y, value)

def para(c, value, x, top, width=244, size=11, leading=15, color=INK, font="Body"):
    lines = []
    for segment in value.split("<br/>"):
        line = ""
        for word in segment.split():
            candidate = (line + " " + word).strip()
            if pdfmetrics.stringWidth(candidate, font, size) > width and line:
                lines.append(line)
                line = word
            else:
                line = candidate
        lines.append(line)
    for i, line in enumerate(lines):
        text(c, x, top-size-i*leading, line, size, font, color)
    return top-len(lines)*leading

def qr_at(c, x, y, size=90):
    rect(c, x, y, size, size, "#ffffff")
    unit = size / len(matrix)
    c.setFillColor(HexColor("#000000"))
    for row, values in enumerate(matrix):
        for col, dark in enumerate(values):
            if dark:
                c.rect(x+col*unit, y+size-(row+1)*unit, unit, unit, fill=1, stroke=0)

def front(c):
    text(c, 22, 613, "OWN A SMALL REPAIR SHOP?", 10, "Bold", RED)
    text(c, 22, 566, "LIFT", 36, "Display")
    rect(c, 22, 549, 244, 2, INK)
    for y, line, color in [(509, "LESS", INK), (470, "PHONE TAG.", INK), (426, "MORE", RED), (387, "WRENCH TIME.", RED)]:
        text(c, 22, y, line, 29, "Display", color)
    para(c, "Shop management from your phone.<br/>Built for independent 1–3 bay shops.", 22, 366, size=11.5, leading=16)
    for top, title, body in [
        (309, "SEND ESTIMATES", "Customers review and approve by link."),
        (258, "HANDLE STATUS TEXTS", "Let AI answer routine job-status checks."),
        (207, "TEXT PAYMENT LINKS", "Customers can pay from their phone."),
    ]:
        text(c, 22, top, title, 11, "Bold")
        para(c, body, 22, top-8, size=10.5, leading=14, color=SOFT)
    rect(c, 18, 18, 252, 143, CREAM)
    text(c, 28, 140, "14 DAYS FREE · THEN $79/MONTH", 10, "Bold", RED)
    qr_at(c, 26, 36, 88)
    text(c, 125, 106, "SEE HOW", 15, "Display")
    text(c, 125, 87, "LIFT WORKS", 15, "Display")
    para(c, "Scan to explore.<br/>No signup needed to look.", 125, 76, width=130, size=9.5, leading=13)
    text(c, 125, 34, "lift.worxel.com", 11, "Bold")

def back(c):
    text(c, 22, 610, "LIFT / A JOB FROM START TO PAID", 9, "Bold", RED)
    para(c, "You fix the car.<br/>Keep work moving.", 22, 586, size=21, leading=26, font="Display")
    top=503
    for number, title, body in [
        ("01", "Write the repair order", "Add the vehicle, photos, parts, and labor from your phone."),
        ("02", "Get the go-ahead", "Review your estimate message, then send a link for the customer to approve."),
        ("03", "Keep customers updated", "AI can answer routine status texts using the repair order. Turn auto-replies off in Settings."),
        ("04", "Send a payment link", "Text a payment link when the job is ready. Customers can pay online."),
    ]:
        text(c,22,top,number,11,"Bold",RED)
        text(c,46,top,title,12,"Bold")
        bottom=para(c,body,46,top-9,width=220,size=10.5,leading=14)
        top=bottom-25
    rect(c,18,164,252,75,INK)
    text(c,28,216,"$79 / MONTH",20,"Display","#ffffff")
    text(c,28,197,"14-day free trial. No credit card required.",10,"Body","#ffffff")
    text(c,28,181,"Card processing fees apply to online payments.",8.5,"Body","#ffffff")
    text(c,22,139,"QUESTIONS BEFORE YOU TRY IT?",10,"Bold",RED)
    text(c,22,119,"Talk to Matthew, the person building Lift.",10)
    text(c,22,101,"Call or text: 864-310-0337",12,"Bold")
    text(c,22,84,"lift@worxel.com",11)
    rect(c,22,67,244,1,INK)
    text(c,22,47,"Take this card back to the shop.",11,"Bold")
    text(c,22,30,"Explore Lift: lift.worxel.com",11)

buf=BytesIO()
c=canvas.Canvas(buf,pagesize=(288,648))
c.setTitle("Lift — Parts-store counter card")
c.setAuthor("Lift / Worxel")
for draw in [front,back]:
    draw(c)
    c.showPage()
c.save()
pdf=buf.getvalue()
(ROOT/"lift-parts-store-print.pdf").write_bytes(pdf)
doc=fitz.open(stream=pdf,filetype="pdf")
for i,name in enumerate(["front","back"]):
    page=doc[i]
    pix=page.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
    pix.save(ROOT/f"proof-{name}.png")
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines",[]):
            for span in line["spans"]:
                x0,y0,x1,y1=span["bbox"]
                assert 17 <= x0 < x1 <= 271 and 17 <= y0 < y1 <= 631, span["text"]
# Two cards per Letter sheet, mirrored positions are identical for duplex.
letter=fitz.open()
for i in range(2):
    page=letter.new_page(width=612,height=792)
    for x in [18,306]:
        page.show_pdf_page(fitz.Rect(x,72,x+288,720),doc,i)
    for x in [18,306,594]:
        for y,dy in [(72,-8),(720,8)]:
            page.draw_line(fitz.Point(x,y+2*(1 if dy>0 else -1)),fitz.Point(x,y+dy),color=(.5,.5,.5),width=.4)
letter.save(ROOT/"lift-parts-store-letter-2up.pdf")
img=cv2.imread(str(ROOT/"proof-front.png"))
decoded,_,_=cv2.QRCodeDetector().detectAndDecode(img)
assert decoded == URL, f"QR decode failed: {decoded}"
assert len(doc)==2 and all(p.rect.width==288 and p.rect.height==648 for p in doc)
print("Generated 4 × 9 inch, two-page PDF; two-up Letter PDF; front/back proofs.")
print("Verified page dimensions, safe text bounds, and QR decoded from the rendered front.")
