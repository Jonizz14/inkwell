# Generates sample article PDFs used by the extraction test.
import sys
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle

out = sys.argv[1]
title = ParagraphStyle('t', fontName='Times-Bold', fontSize=22, leading=26, spaceAfter=14)
body = ParagraphStyle('b', fontName='Times-Roman', fontSize=11.5, leading=15, firstLineIndent=18, alignment=4)
paras = [
    "The quiet revolution in how cities manage water began not with grand engineering projects but with sensors the size of a matchbox. Utilities that once discovered leaks only when streets flooded can now pinpoint a dripping joint beneath a busy intersection within hours.",
    "Critics argue that the data deluge has outpaced the institutions meant to use it. Engineers complain of dashboards that nobody reads, while regulators struggle to decide who owns the information gathered from pipes running under private homes.",
    "Yet the economics are hard to ignore. A mid-sized utility loses roughly a fifth of the water it treats before it reaches a single tap. Cutting that figure by even a few percentage points can defer the construction of an entire reservoir, saving taxpayers hundreds of millions.",
] * 8

def on_page(c, doc):
    c.setFont('Times-Roman', 8)
    c.drawString(60, 810, 'THE ECONOMIST  |  SCIENCE & TECHNOLOGY')
    c.drawString(290, 30, str(doc.page))

doc = SimpleDocTemplate(out, pagesize=A4)
story = [Paragraph('Every drop counts: cities learn to listen to their pipes', title)]
for p in paras:
    story += [Paragraph(p, body), Spacer(1, 4)]
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
