# Bela Cruz: cidade dos poetas

App web (funciona no celular e sem internet) para ler a obra de três poetas de Bela Cruz, Ceará:

- **João Damasceno Vasconcelos** (1924–1990) — 5 livros, 1956–1985
- **Nicodemos Araújo** (1905–1999) — 9 livros, 1946–1996
- **José Plauto Araújo** (1958) — 7 livros, 1999–2011

Os textos vêm dos volumes preparados pela Academia Belacruzense de Cultura, Ciências,
Estudos e Letras (ABCCEL), com a ortografia de cada época e as notas de edição.

## Recursos

- Navegação por poeta → livro → poema, com as notas de edição de cada texto
- Busca por título, primeiro verso ou texto completo (sem diferença de acentos)
- Poema do dia, favoritos e ajuste do tamanho da letra
- Instalável como aplicativo (PWA) e leitura offline

## Publicar no GitHub Pages

Em **Settings → Pages**, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.
O app fica em `https://<usuário>.github.io/cidade-poetas/`.

## Atualizar os textos

Os dados em `dados/` são gerados a partir dos PDFs:

```bash
pip install pymupdf
python3 tools/extrair.py "Nicodemos Araujo - Obra Poetica.pdf" nicodemos data/nicodemos.json
python3 tools/extrair.py "Plauto Araujo Obra Poetica.pdf" plauto data/plauto.json
python3 tools/extrair.py "Joao Damasceno Vasconcelos - Obras Compiladas.pdf" damasceno data/damasceno.json
python3 tools/montar.py
```

`tools/extrair.py` separa títulos, versos, dedicatórias e notas pela diagramação do PDF;
`tools/montar.py` aplica os títulos dos livros e gera `dados/*.json`.
Depois de atualizar os dados, mude `VERSAO` em `sw.js` para que os aparelhos baixem a versão nova.

## Direitos

Os direitos sobre os textos pertencem aos autores e a seus herdeiros.
