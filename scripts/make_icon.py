#!/usr/bin/env python3
"""App icon — ink plate, a stack of cream paper pages, serif "365", ink ribbon.

Matches the reader UI: monochrome ink (#0d0d0d / #111), Iowan Old Style serif.
Writes:
  build/icon.png       1024, macOS Big Sur grid (824 plate, 100 margin, shadow)
Run: python3 scripts/make_icon.py
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SS = 4  # supersampling factor
SERIF = "/System/Library/Fonts/Supplemental/Iowan Old Style.ttc"
INK = (17, 17, 17, 255)
PAPER = (245, 242, 235, 255)
PAPER_BACK = (214, 209, 198, 255)
RULE = (17, 17, 17, 255)
TEXT_LINE = (200, 194, 182, 255)


def gradient(w, h, top, bottom):
    g = Image.new("RGBA", (1, h))
    for y in range(h):
        t = y / (h - 1)
        g.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,))
    return g.resize((w, h))


def rounded_mask(w, h, r):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    return m


def shadow(size, box, r, blur, alpha, dy):
    s = Image.new("RGBA", size, (0, 0, 0, 0))
    x0, y0, x1, y1 = box
    ImageDraw.Draw(s).rounded_rectangle([x0, y0 + dy, x1, y1 + dy], radius=r, fill=(0, 0, 0, alpha))
    return s.filter(ImageFilter.GaussianBlur(blur))


def artwork(S):
    """Pages + type on a transparent S×S canvas (S = plate size, supersampled)."""
    u = S / 824  # design units are on the 824 plate
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    pw, ph, pr = 470 * u, 560 * u, 26 * u
    px0 = (S - pw) / 2
    py0 = (S - ph) / 2 - 6 * u
    page = [px0, py0, px0 + pw, py0 + ph]

    # back page, rotated a few degrees: a stack of articles
    back = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    back.alpha_composite(shadow((S, S), page, pr, 18 * u, 120, 10 * u))
    ImageDraw.Draw(back).rounded_rectangle(page, radius=pr, fill=PAPER_BACK)
    back = back.rotate(-6, resample=Image.BICUBIC, center=(S / 2, S / 2 + 40 * u))
    img.alpha_composite(back)

    # front page
    img.alpha_composite(shadow((S, S), page, pr, 26 * u, 150, 14 * u))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(page, radius=pr, fill=PAPER)

    # ribbon bookmark hanging from the top edge
    rx0, rw, rh, notch = px0 + pw - 86 * u, 38 * u, 108 * u, 18 * u
    d.polygon([(rx0, py0), (rx0 + rw, py0), (rx0 + rw, py0 + rh),
               (rx0 + rw / 2, py0 + rh - notch), (rx0, py0 + rh)], fill=INK)

    # "365" in the reader's serif
    font = ImageFont.truetype(SERIF, int(168 * u), index=1)
    cx = S / 2
    ty = py0 + 262 * u
    d.text((cx, ty), "365", font=font, fill=INK, anchor="ms")

    # thin rule + paragraph lines
    ry = ty + 44 * u
    d.rectangle([cx - 34 * u, ry, cx + 34 * u, ry + 4 * u], fill=RULE)
    lx0, lx1 = px0 + 78 * u, px0 + pw - 78 * u
    ly = ry + 56 * u
    for i, frac in enumerate([1.0, 1.0, 1.0, 0.62]):
        y = ly + i * 40 * u
        d.rounded_rectangle([lx0, y, lx0 + (lx1 - lx0) * frac, y + 14 * u], radius=7 * u, fill=TEXT_LINE)
    return img


def plate(S, r):
    p = gradient(S, S, (40, 40, 40), (8, 8, 8))
    p.putalpha(rounded_mask(S, S, r))
    # faint top highlight on the rim
    hl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(hl).rounded_rectangle([0, 0, S - 1, S - 1], radius=r, outline=(255, 255, 255, 34), width=max(2, S // 400))
    fade = gradient(S, S, (255, 255, 255), (0, 0, 0)).convert("L")
    hl.putalpha(Image.composite(hl.getchannel("A"), Image.new("L", (S, S), 0), fade))
    p.alpha_composite(hl)
    return p


def mac_icon():
    C, P, M, R = 1024 * SS, 824 * SS, 100 * SS, 185 * SS
    out = Image.new("RGBA", (C, C), (0, 0, 0, 0))
    out.alpha_composite(shadow((C, C), [M, M, M + P, M + P], R, 14 * SS, 90, 10 * SS))
    pl = plate(P, R)
    art = artwork(P)
    art.putalpha(Image.composite(art.getchannel("A"), Image.new("L", (P, P), 0), rounded_mask(P, P, R)))
    pl.alpha_composite(art)
    out.alpha_composite(pl, (M, M))
    return out.resize((1024, 1024), Image.LANCZOS)


def web_icon(size):
    # full bleed; artwork shrunk so it sits inside the maskable safe zone
    C = size * SS
    out = gradient(C, C, (40, 40, 40), (8, 8, 8))
    a = int(C * 0.92)
    art = artwork(a)
    out.alpha_composite(art, ((C - a) // 2, (C - a) // 2))
    return out.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    mac_icon().save("build/icon.png")
    print("Done.")
