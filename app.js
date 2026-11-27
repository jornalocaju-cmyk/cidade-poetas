"use strict";
/* Bela Cruz: cidade dos poetas — app de leitura (sem dependências). */

const AUTORES = [
  {
    id: "damasceno",
    nome: "João Damasceno Vasconcelos",
    datas: "Bela Cruz, 1924 – 1990",
    resumo: "Poeta da fé, da saudade e da memória de sua terra, de 1956 a 1985.",
    bio: [
      "Nasceu em Bela Cruz, em 13 de agosto de 1924, filho de José Florêncio de Vasconcelos e de Dona Idalina Maria da Silveira.",
      "Foi Chefe da Estação Postal Telefônica, dirigiu o Correio de Bela Cruz, representou o distrito na Câmara Municipal de Acaraú e exerceu a função de Secretário da Prefeitura. Mais tarde, em Fortaleza, trabalhou na Receita Federal.",
      "Este acervo reúne os cinco livros seus de que se obteve exemplar: Retalhos de Sonhos (1956), A Sonhar e a Cantar (1968), Mário Domingues Louzada (1971, biografia em prosa), Cinza e Fagulhas (1972) e Fragmentos e Poeira (1985).",
    ],
    fonte: "Fontes: Prefácio de Vicente Freitas Liot e quarta capa de João Damasceno Vasconcelos — Obras Compiladas (ABCCEL).",
  },
  {
    id: "nicodemos",
    nome: "Nicodemos Araújo",
    datas: "Bela Cruz, 1905 – Acaraú, 1999",
    resumo: "Vereador, jornalista d’O Acaraú e poeta de nove livros publicados entre 1946 e 1996.",
    bio: [
      "Nasceu em Bela Cruz, a 10 de março de 1905, filho de João Lopes de Araújo e de Francisca Eucária da Silveira (a página “Dados sobre Nicodemos Araújo”, de Sinfonia do Coração, dá à mãe o nome de Francisca Silveira Lopes).",
      "Foi vereador por Bela Cruz na Câmara de Acaraú (1928–1930 e 1936–1937) e redator-chefe do jornal O Acaraú. Faleceu em Acaraú a 23 de junho de 1999 e foi sepultado em Bela Cruz.",
      "Este acervo reúne os nove livros de poesia de que se pôde obter o texto, de Vozes da Alma (1946) a Versos Diversos (1996). Não reúne toda a sua obra em verso: Harmonia Interior (1935), Pela Glória do Altar (1953), Falas do Coração (1955) e Folhas do Outono (1970) não foram localizados.",
    ],
    fonte: "Fontes: Notas de edição e Nota sobre esta edição de Nicodemos Araújo — Obra Poética (ABCCEL), que citam a nota biográfica da 2.ª edição de Minha Prece (2000).",
  },
  {
    id: "plauto",
    nome: "José Plauto Araújo",
    datas: "Ceará, 1958",
    resumo: "Sete livros de poesia entre 1999 e 2011: fé, desejo, morte e a terra natal.",
    bio: [
      "Poeta de Bela Cruz, José Plauto Araújo nasceu no Ceará em 1958.",
      "Entre 1999 e 2011 publicou sete livros de poesia pela editora Visões do Ulai, de São Luís. Seus versos falam de fé, de desejo, da morte e da terra natal, com a Matriz, o rio Acaraú e as histórias dos mais velhos.",
    ],
    fonte: "Fonte: quarta capa de José Plauto Araújo — Obra Poética (ABCCEL).",
  },
];
const POR_ID = Object.fromEntries(AUTORES.map(a => [a.id, a]));

const cache = {};
let indice = null;

const $app = document.getElementById("app");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const semNota = s => s.replace(/⟦\d+⟧/g, "");
const norm = s => semNota(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ": " + r.status);
  return r.json();
}
const carregaIndice = async () => indice || (indice = await json("dados/indice.json"));
const carregaAutor = async id => cache[id] || (cache[id] = await json(`dados/${id}.json`));

/* ---------- favoritos ---------- */
const FAV = "bc-favoritos";
const favs = () => { try { return JSON.parse(localStorage.getItem(FAV)) || []; } catch { return []; } };
const ehFav = k => favs().includes(k);
function alternaFav(k) {
  const f = favs(); const i = f.indexOf(k);
  i >= 0 ? f.splice(i, 1) : f.unshift(k);
  localStorage.setItem(FAV, JSON.stringify(f));
  return i < 0;
}

/* ---------- tamanho da letra ---------- */
const TAM = "bc-tamanho";
function aplicaTam(v) { document.documentElement.style.setProperty("--tam", v + "rem"); }
aplicaTam(parseFloat(localStorage.getItem(TAM)) || 1.1);

/* ---------- títulos ---------- */
function tituloPeca(p, i) {
  if (p.title) return semNota(p.title);
  if (p.kind === "abertura") return "Abertura do livro";
  return "[sem título]";
}
const tituloIdx = e => e[3] || (e[4] ? "[sem título]" : "Abertura do livro");

/* ---------- render do texto ---------- */
function juntaLinhas(a, b) {
  if (/-$/.test(a) && /^-/.test(b)) return a + b.slice(1);           // tornar-/-se
  if (/[a-zà-ÿ]-$/i.test(a) && /^[a-zà-ÿ]/.test(b)) return a.slice(0, -1) + b; // hifenização
  return a + " " + b;
}

function blocos(linhas) {
  const out = [];
  let cur = null, anteriorJ = false;
  for (const l of linhas) {
    const t = l.t;
    if (/^(⋄|\*\s*\*\s*\*|\+\+\+)$/.test(t.trim())) {
      out.push({ tipo: "vinheta", t }); cur = null; anteriorJ = false; continue;
    }
    if (anteriorJ && cur && !l.p && !l.g) {
      cur.ultima.t = juntaLinhas(cur.ultima.t, t);      // continuação de parágrafo
    } else {
      const prosa = !!l.j || !!(cur && cur.prosa && l.p);
      if (!cur || l.g || cur.prosa !== prosa) { cur = { tipo: "estrofe", linhas: [], prosa }; out.push(cur); }
      cur.ultima = { t, i: l.i, s: l.s, r: l.r };
      cur.linhas.push(cur.ultima);
    }
    anteriorJ = !!l.j;
  }
  return out;
}

function comNotas(t, base) {
  return esc(t).replace(/⟦(\d+)⟧/g, (_, n) => `<sup><a href="javascript:void 0" data-ir="${base}-n${n}" id="${base}-r${n}" aria-label="nota ${n}">${n}</a></sup>`);
}

function htmlTexto(p, base) {
  let temProsa = false;
  const partes = blocos(p.lines).map(b => {
    if (b.tipo === "vinheta") return `<p class="vinheta" aria-hidden="true">${esc(b.t)}</p>`;
    const cls = l => ["i", "s", "r"].filter(k => l[k]).join(" ");
    if (b.prosa) {
      temProsa = true;
      return b.linhas.map(l => `<p class="prosa ${cls(l)}">${comNotas(l.t, base)}</p>`).join("");
    }
    return `<div class="estrofe">${b.linhas.map(l => `<div class="v ${cls(l)}">${comNotas(l.t, base)}</div>`).join("")}</div>`;
  }).join("");
  return `<div class="poema-corpo${temProsa ? " tem-prosa" : ""}">${partes}</div>`;
}

function htmlNotas(p, base) {
  if (!p.notes || !Object.keys(p.notes).length) return "";
  const itens = Object.entries(p.notes).map(([n, t]) =>
    `<li value="${n}" id="${base}-n${n}">${esc(t)} <a href="javascript:void 0" data-ir="${base}-r${n}" aria-label="voltar ao texto">↩</a></li>`).join("");
  return `<details class="notas"><summary>Notas da edição (${Object.keys(p.notes).length})</summary><ol>${itens}</ol></details>`;
}

/* ---------- telas ---------- */
function titulo(t) { document.title = t ? `${t} · Bela Cruz: cidade dos poetas` : "Bela Cruz: cidade dos poetas"; }

function hoje() {
  const d = new Date();
  return d.getFullYear() * 1000 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
}

async function telaInicio() {
  titulo("");
  const idx = await carregaIndice();
  const candidatos = idx.filter(e => e[3] && e[5] >= 4 && e[5] <= 24);
  const e = candidatos[(hoje() * 2654435761 % 2 ** 32) % candidatos.length];
  const contagem = id => idx.filter(x => x[0] === id && x[3]).length;
  $app.innerHTML = `
    <section class="capa">
      <p class="sobretitulo">Bela Cruz · Ceará</p>
      <h1>Bela Cruz<small>cidade dos poetas</small></h1>
      <p>A obra de três poetas belacruzenses, reunida em edições organizadas pela Academia Belacruzense de Cultura, Ciências, Estudos e Letras.</p>
    </section>
    <h2>Os poetas</h2>
    <div class="cartoes tres">
      ${AUTORES.map(a => `
        <a class="cartao" href="#/autor/${a.id}">
          <h3>${esc(a.nome)}</h3>
          <div class="datas">${esc(a.datas)}</div>
          <p>${esc(a.resumo)}</p>
          <p class="miudo">${contagem(a.id)} textos</p>
        </a>`).join("")}
    </div>
    <h2>Poema do dia</h2>
    <a class="cartao do-dia" href="#/poema/${e[0]}/${e[1]}/${e[2]}">
      <h3>${esc(e[3])}</h3>
      <p class="verso">${esc(e[4])}…</p>
      <p class="miudo">${esc(POR_ID[e[0]].nome)}</p>
    </a>
    <h2>Por que “cidade dos poetas”?</h2>
    <p>Na apresentação das <em>Obras Compiladas</em> de João Damasceno Vasconcelos, a ABCCEL explica o título que a cidade recebeu.</p>
    <p><a class="botao" href="#/texto/damasceno/0">Ler “Bela Cruz: a cidade dos poetas”</a></p>`;
}

async function telaAutor(id) {
  const a = POR_ID[id]; if (!a) return telaErro();
  titulo(a.nome);
  const d = await carregaAutor(id);
  $app.innerHTML = `
    <div class="trilha"><a href="#/">Início</a></div>
    <p class="sobretitulo">${esc(a.datas)}</p>
    <h1>${esc(a.nome)}</h1>
    <div class="bio">${a.bio.map(p => `<p>${esc(p)}</p>`).join("")}<p class="fonte">${esc(a.fonte)}</p></div>
    <h2>Livros</h2>
    <ul class="lista">
      ${d.books.map((b, i) => `<li><a href="#/livro/${id}/${i}"><span class="tit">${esc(b.title)}<span class="prim">${esc(b.info.filter(x => !/^(Versos|Poesias|Poema|Trovas)$/.test(x)).join(" · "))}</span></span><span class="lado">${b.year || ""}</span></a></li>`).join("")}
    </ul>
    ${d.front.length ? `<h2>Sobre a edição</h2><ul class="lista">${d.front.map((p, i) => `<li><a href="#/texto/${id}/${i}"><span class="tit">${esc(semNota(p.title))}${p.kind ? `<span class="prim">${esc(p.kind)}</span>` : ""}</span></a></li>`).join("")}</ul>` : ""}`;
}

async function telaLivro(id, bi) {
  const a = POR_ID[id]; const d = await carregaAutor(id); const b = d.books[bi];
  if (!b) return telaErro();
  titulo(b.title);
  let secao = null;
  const itens = b.pieces.map((p, i) => {
    let h = "";
    if (p.section && p.section !== secao) { secao = p.section; h += `</ul><p class="secao">${esc(secao)}</p><ul class="lista">`; }
    const prim = p.lines.find(l => !l.i && !l.s);
    return h + `<li><a href="#/poema/${id}/${bi}/${i}"><span class="tit">${esc(tituloPeca(p, i))}${prim ? `<span class="prim">${esc(semNota(prim.t)).slice(0, 80)}</span>` : ""}</span><span class="lado">p. ${esc(p.page)}</span></a></li>`;
  }).join("");
  $app.innerHTML = `
    <div class="trilha"><a href="#/">Início</a> › <a href="#/autor/${id}">${esc(a.nome)}</a></div>
    <p class="sobretitulo">${b.year || ""}</p>
    <h1>${esc(b.title)}</h1>
    <p class="miudo">${b.info.map(esc).join("<br>")}</p>
    <ul class="lista">${itens}</ul>
    <p class="fonte">Os números de página remetem à edição da ABCCEL.</p>`;
}

function htmlLeitura(p, base, cabecalho) {
  return `<article class="poema">
      ${cabecalho}
      ${p.sub ? `<p class="subnota">${esc(p.sub)}</p>` : ""}
      ${htmlTexto(p, base)}
      ${htmlNotas(p, base)}
    </article>`;
}

function barraAcoes(chave, tituloTxt, autor) {
  return `<div class="acoes">
      ${chave ? `<button id="fav" aria-pressed="${ehFav(chave)}">♥ Favorito</button>` : ""}
      <button id="menor" aria-label="Diminuir letra">A−</button>
      <button id="maior" aria-label="Aumentar letra">A+</button>
      <button id="compartilhar">Compartilhar</button>
    </div>`;
}

function ligaAcoes(chave, tituloTxt, autor) {
  const fav = document.getElementById("fav");
  if (fav) fav.onclick = () => fav.setAttribute("aria-pressed", alternaFav(chave));
  const muda = dv => {
    const v = Math.min(1.7, Math.max(.9, (parseFloat(localStorage.getItem(TAM)) || 1.1) + dv));
    localStorage.setItem(TAM, v); aplicaTam(v);
  };
  document.getElementById("menor").onclick = () => muda(-.1);
  document.getElementById("maior").onclick = () => muda(.1);
  document.getElementById("compartilhar").onclick = async () => {
    const dados = { title: `${tituloTxt} — ${autor}`, text: `“${tituloTxt}”, de ${autor}`, url: location.href };
    try {
      if (navigator.share) await navigator.share(dados);
      else { await navigator.clipboard.writeText(location.href); alert("Link copiado."); }
    } catch { /* cancelado */ }
  };
}

async function telaPoema(id, bi, pi) {
  const a = POR_ID[id]; const d = await carregaAutor(id); const b = d.books[bi]; const p = b && b.pieces[pi];
  if (!p) return telaErro();
  const t = tituloPeca(p, pi);
  titulo(t);
  const ant = pi > 0 ? pi - 1 : null, prox = pi < b.pieces.length - 1 ? pi + 1 : null;
  const chave = `${id}/${bi}/${pi}`;
  $app.innerHTML = `
    <div class="trilha"><a href="#/autor/${id}">${esc(a.nome)}</a> › <a href="#/livro/${id}/${bi}">${esc(b.title)}</a>${p.section ? ` › ${esc(p.section)}` : ""}</div>
    ${htmlLeitura(p, "p", `<h1>${comNotas(p.title || t, "p")}</h1>`)}
    ${barraAcoes(chave)}
    <nav class="navegar">
      ${ant !== null ? `<a href="#/poema/${id}/${bi}/${ant}">← ${esc(tituloPeca(b.pieces[ant], ant))}</a>` : "<span></span>"}
      ${prox !== null ? `<a class="prox" href="#/poema/${id}/${bi}/${prox}">${esc(tituloPeca(b.pieces[prox], prox))} →</a>` : ""}
    </nav>
    <p class="fonte">${esc(a.nome)}, <em>${esc(b.title)}</em>${b.year ? ` (${b.year})` : ""}. Texto da edição da ABCCEL, p. ${esc(p.page)}.</p>`;
  ligaAcoes(chave, t, a.nome);
}

async function telaTexto(id, i) {
  const a = POR_ID[id]; const d = await carregaAutor(id); const p = d.front[i];
  if (!p) return telaErro();
  titulo(semNota(p.title));
  $app.innerHTML = `
    <div class="trilha"><a href="#/autor/${id}">${esc(a.nome)}</a> › Sobre a edição</div>
    ${htmlLeitura(p, "t", `${p.kind ? `<p class="sobretitulo" style="text-align:center">${esc(p.kind)}</p>` : ""}<h1>${comNotas(p.title, "t")}</h1>`)}
    ${barraAcoes(null)}`;
  ligaAcoes(null, semNota(p.title), a.nome);
}

let buscaTimer = null;
async function telaBusca(q0) {
  titulo("Busca");
  $app.innerHTML = `
    <h1>Buscar</h1>
    <form class="busca" role="search" onsubmit="return false">
      <input id="q" type="search" placeholder="Título, verso ou palavra…" autocomplete="off" value="${esc(q0 || "")}" aria-label="Buscar">
      <div class="filtros">
        <label><input type="checkbox" id="integral" checked> no texto completo</label>
      </div>
    </form>
    <div id="res"></div>`;
  const $q = document.getElementById("q"), $i = document.getElementById("integral");
  const roda = () => { clearTimeout(buscaTimer); buscaTimer = setTimeout(() => buscar($q.value, $i.checked), 220); };
  $q.oninput = roda; $i.onchange = roda;
  $q.focus();
  if (q0) buscar(q0, true);
}

async function buscar(q, integral) {
  const $res = document.getElementById("res");
  history.replaceState(null, "", "#/busca" + (q ? "?q=" + encodeURIComponent(q) : ""));
  const nq = norm(q.trim());
  if (nq.length < 2) { $res.innerHTML = ""; return; }
  $res.innerHTML = `<p class="vazio">Buscando…</p>`;
  const idx = await carregaIndice();
  const achados = [];
  const marca = (txt) => {
    const n = norm(txt); const k = n.indexOf(nq);
    if (k < 0) return esc(txt);
    // normalização preserva o comprimento para letras latinas acentuadas compostas
    return esc(txt.slice(0, k)) + "<mark>" + esc(txt.slice(k, k + q.trim().length)) + "</mark>" + esc(txt.slice(k + q.trim().length));
  };
  if (integral) await Promise.all(AUTORES.map(a => carregaAutor(a.id)));
  for (const e of idx) {
    const tit = tituloIdx(e);
    if (norm(e[3]).includes(nq)) { achados.push({ e, peso: 0, trecho: e[4] }); continue; }
    if (integral) {
      const p = cache[e[0]].books[e[1]].pieces[e[2]];
      const l = p.lines.find(l => norm(l.t).includes(nq));
      if (l) achados.push({ e, peso: 1, trecho: semNota(l.t) });
    } else if (norm(e[4]).includes(nq)) achados.push({ e, peso: 1, trecho: e[4] });
  }
  achados.sort((x, y) => x.peso - y.peso);
  if (!achados.length) { $res.innerHTML = `<p class="vazio">Nada encontrado para “${esc(q)}”.</p>`; return; }
  const lim = achados.slice(0, 200);
  $res.innerHTML = `<p class="miudo">${achados.length} resultado${achados.length > 1 ? "s" : ""}${achados.length > 200 ? " (mostrando 200)" : ""}</p>
    <ul class="lista">${lim.map(({ e, trecho }) => `<li><a href="#/poema/${e[0]}/${e[1]}/${e[2]}"><span class="tit">${marca(tituloIdx(e))}<span class="prim">${marca(trecho)}</span></span><span class="lado">${esc(POR_ID[e[0]].nome.split(" ")[0])}</span></a></li>`).join("")}</ul>`;
}

async function telaFavoritos() {
  titulo("Favoritos");
  const f = favs();
  if (!f.length) {
    $app.innerHTML = `<h1>Favoritos</h1><p class="vazio">Você ainda não marcou nenhum poema. Toque em ♥ Favorito ao ler um poema para guardá-lo aqui.</p>`;
    return;
  }
  const idx = await carregaIndice();
  const mapa = new Map(idx.map(e => [`${e[0]}/${e[1]}/${e[2]}`, e]));
  $app.innerHTML = `<h1>Favoritos</h1><ul class="lista">${f.filter(k => mapa.has(k)).map(k => {
    const e = mapa.get(k);
    return `<li><a href="#/poema/${k}"><span class="tit">${esc(tituloIdx(e))}<span class="prim">${esc(e[4])}</span></span><span class="lado">${esc(POR_ID[e[0]].nome.split(" ")[0])}</span></a></li>`;
  }).join("")}</ul>`;
}

function telaSobre() {
  titulo("Sobre");
  $app.innerHTML = `
    <h1>Sobre o app</h1>
    <p><strong>Bela Cruz: cidade dos poetas</strong> reúne, para leitura no celular ou no computador, a obra de três poetas de Bela Cruz (CE): João Damasceno Vasconcelos, Nicodemos Araújo e José Plauto Araújo.</p>
    <h2>De onde vêm os textos</h2>
    <p>Os textos foram extraídos dos volumes preparados pela Academia Belacruzense de Cultura, Ciências, Estudos e Letras (ABCCEL): <em>João Damasceno Vasconcelos — Obras Compiladas</em>, <em>Nicodemos Araújo — Obra Poética</em> e <em>José Plauto Araújo — Obra Poética</em>. A ortografia de cada época, as emendas e as notas de edição são as desses volumes. Cada poeta tem uma “Nota sobre esta edição” que explica os critérios adotados:</p>
    <ul>${AUTORES.map(a => `<li><a href="#/autor/${a.id}">${esc(a.nome)}</a></li>`).join("")}</ul>
    <p>Nos textos de Nicodemos Araújo, a própria edição avisa que o texto vem de redigitações que não puderam ainda ser conferidas com os livros impressos.</p>
    <h2>Limites desta versão</h2>
    <p>A separação dos poemas foi feita automaticamente a partir da diagramação dos PDFs e conferida com os sumários. Alguns recuos e alinhamentos especiais não são reproduzidos. Se encontrar algum erro, avise a ABCCEL.</p>
    <div class="aviso">Os direitos sobre os textos pertencem aos autores e a seus herdeiros. Este app não substitui as edições impressas.</div>
    <h2>Funciona sem internet</h2>
    <p>Depois de aberto uma vez, o app guarda os textos no aparelho. No celular, use “Adicionar à tela inicial” para instalá-lo como aplicativo.</p>`;
}

function telaErro() {
  titulo("Não encontrado");
  $app.innerHTML = `<h1>Página não encontrada</h1><p><a href="#/">Voltar ao início</a></p>`;
}

/* ---------- rotas ---------- */
async function rota() {
  const h = location.hash.replace(/^#\/?/, "");
  const [caminho, qs] = h.split("?");
  const p = caminho.split("/").filter(Boolean).map(decodeURIComponent);
  try {
    if (!p.length) await telaInicio();
    else if (p[0] === "autor") await telaAutor(p[1]);
    else if (p[0] === "livro") await telaLivro(p[1], +p[2]);
    else if (p[0] === "poema") await telaPoema(p[1], +p[2], +p[3]);
    else if (p[0] === "texto") await telaTexto(p[1], +p[2]);
    else if (p[0] === "busca") await telaBusca(new URLSearchParams(qs || "").get("q"));
    else if (p[0] === "favoritos") await telaFavoritos();
    else if (p[0] === "sobre") telaSobre();
    else telaErro();
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<h1>Não foi possível carregar</h1><p>Verifique a conexão e tente de novo.</p><p class="miudo">${esc(err.message)}</p>`;
  }
  if (!/^#?\/?busca/.test(location.hash)) { window.scrollTo(0, 0); $app.focus({ preventScroll: true }); }
}
window.addEventListener("hashchange", rota);
document.addEventListener("click", ev => {
  const a = ev.target.closest("[data-ir]"); if (!a) return;
  ev.preventDefault();
  const alvo = document.getElementById(a.dataset.ir); if (!alvo) return;
  const det = alvo.closest("details"); if (det) det.open = true;
  alvo.scrollIntoView({ behavior: "smooth", block: "center" });
  alvo.classList.add("destaque"); setTimeout(() => alvo.classList.remove("destaque"), 1600);
});
rota();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
