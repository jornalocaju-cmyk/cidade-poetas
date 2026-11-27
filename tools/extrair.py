#!/usr/bin/env python3
"""Extrai poemas e textos dos PDFs das edições da ABCCEL para data/*.json.

Uso: python3 tools/extrair.py <pdf> <id-do-autor> <saida.json>

O script lê a composição tipográfica de cada página (fonte, corpo, posição)
para separar títulos, versos, dedicatórias, notas de rodapé, cabeçalhos e
números de página. Não altera o texto dos poemas.
"""
import json
import re
import sys

import pymupdf

ROMAN = re.compile(r"^[ivxlcdm]+$", re.I)
SUP = 1   # flag de sobrescrito
ITAL = 2
BOLD = 16


def page_lines(page):
    """Agrupa os spans da página em linhas visuais (mesma linha de base)."""
    spans = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                if not s["text"]:
                    continue
                x0, y0, x1, y1 = s["bbox"]
                spans.append(dict(
                    t=s["text"], x0=x0, x1=x1, y0=y0, y1=y1,
                    size=round(s["size"], 1), font=s["font"],
                    sup=bool(s["flags"] & SUP) or s["size"] <= 7.05 and s["text"].strip().isdigit(),
                    it="Italic" in s["font"], bold="Bold" in s["font"],
                ))
    # linhas: agrupa por centro vertical; sobrescritos aderem à linha que sobrepõem
    normal = [s for s in spans if not s["sup"]]
    normal.sort(key=lambda s: ((s["y0"] + s["y1"]) / 2, s["x0"]))
    lines = []
    for s in normal:
        cy = (s["y0"] + s["y1"]) / 2
        for ln in lines:
            if abs(ln["cy"] - cy) < 2.5:
                ln["spans"].append(s)
                break
        else:
            lines.append(dict(cy=cy, spans=[s]))
    for s in spans:
        if not s["sup"]:
            continue
        cy = (s["y0"] + s["y1"]) / 2
        best = None
        for ln in lines:
            ys = [p["y0"] for p in ln["spans"]] + [p["y1"] for p in ln["spans"]]
            if min(ys) - 3 <= cy <= max(ys) + 1:
                d = abs(ln["cy"] - cy)
                if best is None or d < best[0]:
                    best = (d, ln)
        if best:
            best[1]["spans"].append(s)
        else:
            lines.append(dict(cy=cy, spans=[s]))
    out = []
    for ln in lines:
        sp = sorted(ln["spans"], key=lambda s: s["x0"])
        text = ""
        last = None
        for s in sp:
            t = s["t"]
            if s["sup"] and t.strip().isdigit():
                t = "⟦" + t.strip() + "⟧"
            if last is not None and s["x0"] - last["x1"] > 1.2 and not text.endswith(" ") and not t.startswith(" "):
                text += " "
            text += t
            last = s
        main = [s for s in sp if not s["sup"] and s["t"].strip()]
        if not main:
            main = sp
        out.append(dict(
            text=re.sub(r"\s+", " ", text).strip(),
            x0=min(s["x0"] for s in sp), x1=max(s["x1"] for s in sp),
            y0=min(s["y0"] for s in main), y1=max(s["y1"] for s in main),
            size=max(s["size"] for s in main),
            bold=all(s["bold"] for s in main),
            it=all(s["it"] for s in main),
            first_sup=sp[0]["sup"],
            first_small_digit=sp[0]["size"] <= 7.05 and sp[0]["t"].strip().isdigit(),
        ))
    out.sort(key=lambda l: (l["y0"], l["x0"]))
    return [l for l in out if l["text"]]


STOP = re.compile(r"^(notas de edição|índice de primeiros versos|bibliografia do autor)$", re.I)
SKIP_FRONT = re.compile(r"^(sumário|apresentação|prefácio|nota sobre esta edição)$", re.I)


def extract(pdf_path):
    doc = pymupdf.open(pdf_path)
    W = doc[0].rect.width
    H = doc[0].rect.height
    books = []
    front = []            # textos de abertura do volume (prefácio, nota etc.)
    cur_book = None
    cur_piece = None
    cur_section = None
    notes = {}            # (livro, n) -> texto
    stopped = False
    last_note = None
    started = False
    # largura da mancha de texto (para distinguir prosa justificada de verso)
    widths = []
    for pg in doc:
        for l in page_lines(pg):
            if l["size"] >= 9.9 and 50 < l["y0"] < H - 45:
                widths.append(l["x1"] - l["x0"])
    widths.sort()
    textwidth = widths[int(len(widths) * 0.985)]

    def new_piece(title, page):
        nonlocal cur_piece
        cur_piece = dict(title=title, section=cur_section, page=page, lines=[])
        target = cur_book["pieces"] if cur_book else front
        target.append(cur_piece)

    for pno in range(doc.page_count):
        if stopped:
            break
        page = doc[pno]
        label = page.get_label() or str(pno + 1)
        lines = page_lines(page)
        body = [l for l in lines if 35 < l["y0"] < H - 40 and l["size"] >= 8.9 and not l["first_small_digit"]]
        right = max([l["x1"] for l in body] or [W - 45])
        left = min([l["x0"] for l in body] or [45])
        prev_y = None
        in_notes = False
        for li, l in enumerate(lines):
            t = l["text"]
            # cabeçalho corrido e número de página
            if l["y0"] < 50 and l["size"] <= 8.6 and not l["first_small_digit"]:
                continue
            if t.startswith("Capa da edição original"):
                continue
            if (t.isdigit() or ROMAN.match(t)) and (l["y0"] > H - 45 or (
                    l["y0"] > H * 0.8 and l is max(lines, key=lambda m: m["y0"]))):
                continue
            # notas de rodapé
            if l["first_small_digit"] and l["size"] <= 8.7 and l["y0"] > H * 0.45:
                m = re.match(r"⟦(\d+)⟧\s*(.*)", t)
                if m:
                    key = (len(books), int(m.group(1)))
                    notes[key] = m.group(2)
                    last_note = key
                    in_notes = True
                    continue
            if in_notes and l["size"] <= 8.7:
                if last_note:
                    notes[last_note] += " " + t
                continue
            # título de livro / grande divisão
            if l["size"] >= 15 and pno > 3:
                if STOP.match(t):
                    stopped = True
                    break
                if SKIP_FRONT.match(t):
                    cur_book = None
                    new_piece(t.capitalize() if t.isupper() else t, label)
                    cur_section = None
                    prev_y = l["y1"]
                    continue
                if cur_book and cur_book.get("_title_page") == pno:
                    cur_book["title"] += " " + t
                    continue
                cur_book = dict(title=t, info=[], pieces=[], _title_page=pno, page=label)
                books.append(cur_book)
                cur_piece = None
                cur_section = None
                started = True
                continue
            if cur_book and cur_book.get("_title_page") == pno:
                cur_book["info"].append(t)
                continue
            # títulos de abertura do volume (Nicodemos: negrito 10,9)
            if cur_book is None and l["bold"] and 10.8 <= l["size"] < 15 and pno > 3:
                new_piece(t.capitalize() if t.isupper() else t, label)
                started = True
                prev_y = l["y1"]
                continue
            # subdivisão dentro do livro (ex.: PERSPECTIVAS E CLARÕES)
            if 10.8 <= l["size"] < 15 and not l["it"] and cur_book:
                if l["bold"] and STOP.match(t):
                    stopped = True
                    break
                nxt = [m for m in lines[li + 1:] if m["size"] >= 8.9 and m["y0"] < H - 45]
                if nxt and not nxt[0]["bold"]:
                    # título de texto de abertura (Palavras ao Leitor, Apresentação…)
                    new_piece(t, label)
                    prev_y = l["y1"]
                    continue
                cur_section = t
                cur_piece = None
                prev_y = l["y1"]
                continue
            # título de peça
            if l["bold"] and 8.9 <= l["size"] <= 10.6 and not l["it"]:
                centered = abs(((l["x0"] + l["x1"]) / 2) - (left + right) / 2) < 40
                if centered or (cur_piece is None):
                    if (cur_piece is not None and not cur_piece["lines"] and prev_y is not None
                            and l["y0"] - prev_y < 8):
                        cur_piece["title"] += " " + t
                    else:
                        new_piece(t, label)
                    prev_y = l["y1"]
                    continue
            if cur_piece is None:
                if cur_book is None and not started:
                    prev_y = l["y1"]
                    continue
                new_piece("", label)
            gap = prev_y is not None and (l["y0"] - prev_y) > l["size"] * 0.75
            pos = "l"
            mid = (l["x0"] + l["x1"]) / 2
            if l["x0"] > (left + right) / 2 + 10 and l["x1"] > right - 6:
                pos = "r"
            ln = dict(t=t)
            if gap and cur_piece["lines"]:
                ln["g"] = 1
            if l["it"]:
                ln["i"] = 1
            if l["size"] < 9.6:
                ln["s"] = 1
            if pos == "r":
                ln["r"] = 1
            # linha que vai até a margem direita (prosa justificada): continua na seguinte
            if l["x1"] >= right - 4 and (l["x1"] - l["x0"]) > textwidth * 0.9:
                ln["j"] = 1
            if l["x0"] > left + 8 and l["x0"] < left + 22:
                ln["p"] = 1   # recuo de parágrafo
            cur_piece["lines"].append(ln)
            prev_y = l["y1"]
        # fim da página: a quebra de página não é quebra de estrofe por si só
    return books, front, notes


def finalize(books, front, notes):
    def fix(piece, bi):
        nums = set()
        for ln in piece["lines"]:
            for m in re.finditer(r"⟦(\d+)⟧", ln["t"]):
                nums.add(int(m.group(1)))
        for m in re.finditer(r"⟦(\d+)⟧", piece["title"]):
            nums.add(int(m.group(1)))
        piece["notes"] = {str(n): notes.get((bi, n), "") for n in sorted(nums)}
        if not piece["notes"]:
            del piece["notes"]
        piece.pop("section", None) if piece.get("section") is None else None
        return piece

    for bi, b in enumerate(books, start=1):
        b.pop("_title_page", None)
        b["pieces"] = [fix(p, bi) for p in b["pieces"] if p["lines"] or p["title"]]
    def keep(p):
        txt = " ".join(l["t"] for l in p["lines"])
        if re.search(r"\s[xvi\d]+$", p["title"]) or p["title"].lower() == "sumário":
            return False
        return bool(p["lines"]) and "[Texto" not in txt
    front = [fix(p, 0) for p in front if keep(p)]
    return books, front


if __name__ == "__main__":
    pdf, aid, out = sys.argv[1:4]
    books, front, notes = extract(pdf)
    books, front = finalize(books, front, notes)
    json.dump(dict(id=aid, front=front, books=books), open(out, "w"), ensure_ascii=False, indent=0)
    for b in books:
        print(f"{b['title']!r:45} {len(b['pieces']):4} peças  {b['info']}")
    print("abertura:", [p["title"] for p in front])
