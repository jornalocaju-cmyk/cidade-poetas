#!/usr/bin/env python3
"""Monta os arquivos de dados do app (dados/*.json) a partir de data/*.json.

Uso: python3 tools/montar.py
"""
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Títulos e anos dos livros, como constam na folha de rosto de cada volume.
LIVROS = {
    "nicodemos": [
        ("Vozes da Alma", 1946), ("Minha Prece", 1947), ("Cantos do Entardecer", 1979),
        ("Luzes do Ocaso", 1985), ("Sinfonia do Coração", 1990), ("Operários para a Messe", 1992),
        ("Cantos e Desencantos", 1993), ("Sementes da Mente", 1995), ("Versos Diversos", 1996),
    ],
    "plauto": [
        ("O Caminho do Peregrinar", 1999), ("Vozes Mélicas", 2000), ("Luta Interior", 2001),
        ("Visões Célticas", 2002), ("O Animal", 2007), ("Olhos do Tempo", 2009),
        ("Almas Sonâmbulas", 2011),
    ],
    "damasceno": [
        ("Retalhos de Sonhos", 1956), ("A Sonhar e a Cantar", 1968),
        ("Mário Domingues Louzada", 1971), ("Cinza e Fagulhas", 1972),
        ("Fragmentos e Poeira", 1985), ("Apêndice: documentos", None),
    ],
}

SECOES = {"CANTOS DA TERRA": "Cantos da Terra", "CANTOS DA FÉ": "Cantos da Fé",
          "CANTOS DA NATUREZA": "Cantos da Natureza", "CANTOS DA VIDA": "Cantos da Vida"}


def limpa_titulo(t):
    return re.sub(r"\s+", " ", t).strip()


def corrige(aid, d):
    if aid == "plauto":
        livro = d["books"][0]
        novas = []
        for p in livro["pieces"]:
            if p["title"] == "Prefácio" and len(p["lines"]) > 200:
                k = next(i for i, l in enumerate(p["lines"]) if l["t"] == "⋄")
                pref = dict(p, lines=p["lines"][:k])
                poema = dict(p, title="O Caminho do Peregrinar",
                             lines=[dict(l) for l in p["lines"][k + 1:]])
                poema["lines"][0].pop("g", None)
                notas = p.get("notes", {})
                for x, alvo in ((pref, pref), (poema, poema)):
                    ns = {n for l in alvo["lines"] for n in re.findall(r"⟦(\d+)⟧", l["t"])}
                    if ns:
                        alvo["notes"] = {n: notas[n] for n in sorted(ns, key=int) if n in notas}
                    else:
                        alvo.pop("notes", None)
                poema["sub"] = "Poema em partes sem título, separadas por vinheta, como no original."
                novas += [pref, poema]
            else:
                novas.append(p)
        livro["pieces"] = novas
    if aid == "damasceno":
        for p in d["front"]:
            if p["title"] == "em quatorze versos":
                p["title"] = "João Damasceno Vasconcelos: o poeta que guardou Bela Cruz em quatorze versos"
                p["kind"] = "Prefácio"
            elif p["title"].startswith("Bela Cruz: a cidade"):
                p["kind"] = "Apresentação"
    return d


def main():
    os.makedirs(os.path.join(RAIZ, "dados"), exist_ok=True)
    indice = []
    for aid, livros in LIVROS.items():
        d = corrige(aid, json.load(open(os.path.join(RAIZ, "data", aid + ".json"))))
        assert len(d["books"]) == len(livros), (aid, [b["title"] for b in d["books"]])
        for bi, (b, (nome, ano)) in enumerate(zip(d["books"], livros)):
            b["title"] = nome
            b["year"] = ano
            abriu = False
            for pi, p in enumerate(b["pieces"]):
                p["title"] = limpa_titulo(p["title"])
                if p.get("section"):
                    p["section"] = SECOES.get(p["section"], p["section"])
                if p["title"]:
                    abriu = True
                elif not abriu:
                    p["kind"] = "abertura"
                primeiro = next((l["t"] for l in p["lines"] if not l.get("i") and not l.get("s")), "")
                indice.append([aid, bi, pi, re.sub(r"⟦\d+⟧", "", p["title"]),
                               re.sub(r"⟦\d+⟧", "", primeiro)[:90], len(p["lines"])])
        out = os.path.join(RAIZ, "dados", aid + ".json")
        json.dump(d, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
        print(aid, os.path.getsize(out) // 1024, "KB")
    json.dump(indice, open(os.path.join(RAIZ, "dados", "indice.json"), "w"),
              ensure_ascii=False, separators=(",", ":"))
    print("índice:", len(indice), "textos")


if __name__ == "__main__":
    main()
