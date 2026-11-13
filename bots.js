// Bots com personalidade: elenco, rostos (SVG desenhados em código) e estilos de jogo sobre o Stockfish
import { toCp } from './engine.js';

export const GROUPS = ['Novo no Xadrez', 'Iniciante', 'Intermediário', 'Avançado', 'Mestre'];

/* ---------- rostos ---------- */
const sh = (c, k) => { // escurece/clareia #rrggbb
  const n = parseInt(c.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + k * (k > 0 ? 255 - v : v))));
  return '#' + [f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
};
export function avatarSVG(s) {
  const skin = s.skin, hc = s.hc || '#2b2018', cloth = s.cloth || '#4a7fc1';
  const L = [];
  L.push(`<rect width="100" height="100" fill="${s.bg || '#3b3935'}"/>`);
  // cabelo de trás
  if (s.hair === 'long') L.push(`<path d="M27 46C22 14 78 14 73 46L76 84L24 84Z" fill="${hc}"/>`);
  if (s.hair === 'bob') L.push(`<path d="M27 48C23 14 77 14 73 48L72 66L28 66Z" fill="${hc}"/>`);
  if (s.hair === 'afro') L.push(`<circle cx="50" cy="38" r="29" fill="${hc}"/>`);
  if (s.hair === 'ponytail') L.push(`<ellipse cx="74" cy="58" rx="7" ry="15" fill="${hc}" transform="rotate(-18 74 58)"/>`);
  if (s.hair === 'bun') L.push(`<circle cx="50" cy="15" r="9" fill="${hc}"/>`);
  if (s.hair === 'hijab') L.push(`<path d="M24 50C20 10 80 10 76 50L80 92L20 92Z" fill="${hc}"/>`);
  // ombros e roupa
  L.push(`<path d="M6 100C6 80 26 72 50 72C74 72 94 80 94 100Z" fill="${cloth}"/>`);
  if (s.collar === 'tie') L.push(`<path d="M40 73L50 86L60 73L56 72L50 80L44 72Z" fill="#fff"/><path d="M47.5 78L52.5 78L54 94L46 94Z" fill="${s.tie || '#c0392b'}"/>`);
  if (s.collar === 'v') L.push(`<path d="M38 73L50 90L62 73Z" fill="${sh(skin, -0.12)}"/>`);
  if (s.collar === 'round') L.push(`<path d="M38 73C42 82 58 82 62 73Z" fill="${sh(skin, -0.12)}"/>`);
  if (s.collar === 'hood') L.push(`<path d="M30 76C36 88 64 88 70 76L66 72C60 80 40 80 34 72Z" fill="${sh(cloth, -0.25)}"/>`);
  if (s.collar === 'scarf') L.push(`<rect x="34" y="70" width="32" height="9" rx="4" fill="${s.scarf || '#e67e22'}"/><rect x="56" y="74" width="8" height="18" rx="3" fill="${s.scarf || '#e67e22'}"/>`);
  if (s.collar === 'lab') L.push(`<path d="M30 74L44 74L50 100L20 100Z" fill="#fff"/><path d="M70 74L56 74L50 100L80 100Z" fill="#fff"/>`);
  // pescoço, orelhas, cabeça
  L.push(`<rect x="43" y="60" width="14" height="18" rx="5" fill="${sh(skin, -0.14)}"/>`);
  L.push(`<circle cx="31.5" cy="48" r="4.2" fill="${skin}"/><circle cx="68.5" cy="48" r="4.2" fill="${skin}"/>`);
  L.push(`<ellipse cx="50" cy="46" rx="19" ry="22" fill="${skin}"/>`);
  if (s.blush) L.push(`<circle cx="38.5" cy="55" r="3.6" fill="#ff7b7b" opacity=".35"/><circle cx="61.5" cy="55" r="3.6" fill="#ff7b7b" opacity=".35"/>`);
  if (s.freckles) L.push(`<g fill="${sh(skin, -0.28)}"><circle cx="42" cy="53" r=".9"/><circle cx="45" cy="55" r=".9"/><circle cx="39.5" cy="55.5" r=".9"/><circle cx="58" cy="53" r=".9"/><circle cx="55" cy="55" r=".9"/><circle cx="60.5" cy="55.5" r=".9"/></g>`);
  // barba
  const bc = s.bc || hc;
  if (s.beard === 'full') L.push(`<path d="M31 50C31 70 40 74 50 74C60 74 69 70 69 50C66 60 58 61 50 61C42 61 34 60 31 50Z" fill="${bc}"/>`);
  if (s.beard === 'stubble') L.push(`<path d="M32 52C33 68 41 72 50 72C59 72 67 68 68 52C65 62 58 63 50 63C42 63 35 62 32 52Z" fill="${bc}" opacity=".4"/>`);
  if (s.beard === 'goatee') L.push(`<path d="M43 64C44 72 56 72 57 64C54 67 46 67 43 64Z" fill="${bc}"/>`);
  if (s.beard === 'stache' || s.beard === 'full') L.push(`<path d="M42 59C44 55 48 56 50 58C52 56 56 55 58 59C55 61 52 60 50 59C48 60 45 61 42 59Z" fill="${bc}"/>`);
  // boca
  const mc = '#7a2e2e';
  const M = { smile: `<path d="M43 62C46 67 54 67 57 62" fill="none" stroke="${mc}" stroke-width="2" stroke-linecap="round"/>`,
    grin: `<path d="M42 61C46 70 54 70 58 61Z" fill="#fff" stroke="${mc}" stroke-width="1.6" stroke-linejoin="round"/>`,
    flat: `<path d="M44 64L56 64" stroke="${mc}" stroke-width="2" stroke-linecap="round"/>`,
    smirk: `<path d="M44 64C48 66 53 65 57 61" fill="none" stroke="${mc}" stroke-width="2" stroke-linecap="round"/>`,
    o: `<ellipse cx="50" cy="64" rx="3" ry="3.6" fill="${mc}"/>`,
    sad: `<path d="M43 66C46 62 54 62 57 66" fill="none" stroke="${mc}" stroke-width="2" stroke-linecap="round"/>` };
  if (!(s.beard === 'full' && s.mouth === 'flat')) L.push(M[s.mouth || 'smile']);
  // olhos
  const eyeY = 47; const E = s.eyes || 'normal';
  const eye = (x) => E === 'happy' ? `<path d="M${x - 4} ${eyeY + 1}Q${x} ${eyeY - 4} ${x + 4} ${eyeY + 1}" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round"/>`
    : E === 'sleepy' ? `<path d="M${x - 4} ${eyeY}L${x + 4} ${eyeY}" stroke="#222" stroke-width="2.2" stroke-linecap="round"/><path d="M${x - 4} ${eyeY - 1}Q${x} ${eyeY - 4} ${x + 4} ${eyeY - 1}" fill="${skin}" opacity=".0"/>`
    : `<ellipse cx="${x}" cy="${eyeY}" rx="4.2" ry="${E === 'wide' ? 5 : 4}" fill="#fff"/><circle cx="${x + (s.look || 0)}" cy="${eyeY + 0.5}" r="2.4" fill="${s.ec || '#2d2d2d'}"/><circle cx="${x + 0.9 + (s.look || 0)}" cy="${eyeY - 0.6}" r=".8" fill="#fff"/>`;
  L.push(eye(41.5));
  if (E === 'wink') L.push(`<path d="M54 ${eyeY + 1}Q58.5 ${eyeY - 4} 63 ${eyeY + 1}" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round"/>`); else L.push(eye(58.5));
  // sobrancelhas
  const bw = '#' + (parseInt(hc.slice(1), 16) ? hc.slice(1) : '222');
  const B = s.brow || 'normal';
  const by = 40;
  const brow = (x, dir) => B === 'angry' ? `<path d="M${x - 5} ${by - dir * 3}L${x + 5} ${by + dir * 1.5}" stroke="#${bw.slice(1)}" stroke-width="2.6" stroke-linecap="round"/>`.replace(/#\#/, '#')
    : B === 'raised' ? `<path d="M${x - 5} ${by - 2}Q${x} ${by - 6} ${x + 5} ${by - 2}" fill="none" stroke="${hc}" stroke-width="2.4" stroke-linecap="round"/>`
    : B === 'sad' ? `<path d="M${x - 5} ${by + dir * 2}L${x + 5} ${by - dir * 2}" stroke="${hc}" stroke-width="2.4" stroke-linecap="round"/>`
    : `<path d="M${x - 5} ${by}Q${x} ${by - 3} ${x + 5} ${by}" fill="none" stroke="${hc}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (B === 'angry') { L.push(`<path d="M36.5 ${by - 3}L46.5 ${by + 1.5}" stroke="${hc}" stroke-width="2.6" stroke-linecap="round"/><path d="M63.5 ${by - 3}L53.5 ${by + 1.5}" stroke="${hc}" stroke-width="2.6" stroke-linecap="round"/>`); }
  else { L.push(brow(41.5, 1)); L.push(brow(58.5, -1)); }
  // óculos
  if (s.glasses) L.push(`<g fill="none" stroke="${s.glasses}" stroke-width="1.8"><circle cx="41.5" cy="47" r="7.2"/><circle cx="58.5" cy="47" r="7.2"/><path d="M48.7 47H51.3"/><path d="M34.3 46L31 44.5M65.7 46L69 44.5"/></g>`);
  // brinco
  if (s.earring) L.push(`<circle cx="31.3" cy="54.5" r="2" fill="#f1c40f"/><circle cx="68.7" cy="54.5" r="2" fill="#f1c40f"/>`);
  // cabelo da frente
  const H = s.hair;
  if (H === 'short') L.push(`<path d="M30.5 42C28 20 72 20 69.5 42C67 33 60 29 50 29C40 29 33 33 30.5 42Z" fill="${hc}"/>`);
  if (H === 'side') L.push(`<path d="M30 43C27 16 74 16 70 40C63 29 44 28 34 36C32 38 31 41 30 43Z" fill="${hc}"/>`);
  if (H === 'bun' || H === 'ponytail') L.push(`<path d="M30.5 42C28 20 72 20 69.5 42C65 33 58 29 50 29C42 29 35 33 30.5 42Z" fill="${hc}"/>`);
  if (H === 'long' || H === 'bob') L.push(`<path d="M30 46C26 17 74 17 70 46C66 33 58 30 50 30C42 30 34 33 30 46Z" fill="${hc}"/>`);
  if (H === 'curly') L.push(`<g fill="${hc}"><circle cx="35" cy="31" r="7"/><circle cx="43" cy="26" r="7.5"/><circle cx="52" cy="25" r="7.5"/><circle cx="61" cy="28" r="7"/><circle cx="66" cy="36" r="5.5"/><circle cx="32" cy="38" r="5.5"/></g>`);
  if (H === 'afro') L.push(`<path d="M31 40C32 26 68 26 69 40C62 33 38 33 31 40Z" fill="${hc}"/>`);
  if (H === 'mohawk') L.push(`<path d="M44 30C44 12 56 12 56 30Z" fill="${hc}"/><path d="M31 40C32 32 40 30 44 30L56 30C60 30 68 32 69 40C62 34 38 34 31 40Z" fill="${hc}" opacity=".85"/>`);
  if (H === 'bald') L.push(`<ellipse cx="42" cy="30" rx="5" ry="2.6" fill="#fff" opacity=".18"/>`);
  if (H === 'hijab') L.push(`<path d="M30 48C28 20 72 20 70 48C66 36 58 31 50 31C42 31 34 36 30 48Z" fill="${hc}"/>`);
  if (H === 'grey') L.push(`<path d="M30.5 40C29 24 71 24 69.5 40C66 32 60 30 50 30C40 30 34 32 30.5 40Z" fill="#cfd2d6"/><path d="M30.5 46C30 40 31 40 32 38L33 48ZM69.5 46C70 40 69 40 68 38L67 48Z" fill="#cfd2d6"/>`);
  // chapéu
  if (s.hat) {
    if (s.hatKind === 'beanie') L.push(`<path d="M29 38C29 14 71 14 71 38Z" fill="${s.hat}"/><rect x="28" y="34" width="44" height="7" rx="3.5" fill="${sh(s.hat, -0.25)}"/>`);
    else if (s.hatKind === 'fedora') L.push(`<ellipse cx="50" cy="31" rx="27" ry="5.5" fill="${s.hat}"/><path d="M34 31C34 12 66 12 66 31Z" fill="${s.hat}"/><rect x="34" y="26" width="32" height="4" fill="${sh(s.hat, -0.35)}"/>`);
    else L.push(`<path d="M29 37C29 17 71 17 71 37Z" fill="${s.hat}"/><path d="M29 36C40 40 60 40 74 33C72 30 60 31 50 31Z" fill="${sh(s.hat, -0.25)}"/>`);
  }
  return `<svg class="bav" viewBox="10 4 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${L.join('')}</svg>`;
}

/* ---------- elenco ---------- */
const S = { claro: '#f5cfa6', medio: '#e0a878', moreno: '#b97a4e', escuro: '#8a5434', negro: '#5e3a24', rosado: '#f6d5c2' };
const mk = (id, name, elo, group, style, desc, greet, av, rep = []) => ({ id, name, elo, group, style, desc, greet, av, rep });
export const BOTS = [
  // Novo no Xadrez
  mk('pedrinho', 'Pedrinho', 250, 0, 'blunder', 'Acabou de aprender como as peças andam. Distraído: esquece peças soltas.', 'Oi! Acho que o cavalo anda em L, né?', { bg: '#42403c', skin: S.claro, hair: 'curly', hc: '#b5532a', cloth: '#f08a3c', eyes: 'wide', mouth: 'o', blush: 1, freckles: 1 }),
  mk('luna', 'Luna', 300, 0, 'queen', 'Adora a dama e já sai com ela no começo.', 'A dama é a melhor peça. Vou usar já!', { bg: '#3b4440', skin: S.rosado, hair: 'long', hc: '#26334d', cloth: '#7fc8e8', eyes: 'happy', mouth: 'smile', blush: 1 }),
  mk('tonho', 'Tonho', 400, 0, 'trader', 'Troca tudo que aparece pela frente.', 'Vamos trocar tudo! Quanto menos peças, melhor.', { bg: '#44403a', skin: S.medio, hair: 'short', hc: '#4a2f1d', cloth: '#6aa84f', eyes: 'normal', mouth: 'grin', beard: 'stubble' }),
  mk('bia', 'Bia', 500, 0, 'attacker', 'Só pensa em atacar, mesmo sem plano.', 'Atacar, atacar, atacar! Sem medo!', { bg: '#483a3a', skin: S.moreno, hair: 'ponytail', hc: '#1d1512', cloth: '#d6455a', eyes: 'wide', brow: 'angry', mouth: 'smirk', earring: 1 }),
  mk('cida', 'Dona Cida', 600, 0, 'defender', 'Joga devagar e protege tudo com carinho.', 'Calma, querido. Vamos jogar com cuidado.', { bg: '#403f43', skin: S.claro, hair: 'grey', hc: '#cfd2d6', cloth: '#b479c4', collar: 'round', glasses: '#8a6d3b', eyes: 'happy', mouth: 'smile', blush: 1 }),
  // Iniciante
  mk('davi', 'Davi', 700, 1, 'attacker', 'Gosta de abrir o jogo com bispo e cavalo atacando.', 'Bora para o ataque! Italiana na veia.', { bg: '#3a4350', skin: S.medio, hair: 'side', hc: '#2b1b12', cloth: '#3a6fb0', eyes: 'normal', mouth: 'grin', brow: 'raised' }, ['Italiana', 'Dois Cavalos']),
  mk('mari', 'Mari', 800, 1, 'solid', 'Metódica: desenvolve as peças e roca cedo.', 'Boa sorte! Vou jogar bem organizada.', { bg: '#3a4a44', skin: S.escuro, hair: 'curly', hc: '#17110d', cloth: '#2f9e8f', eyes: 'happy', mouth: 'smile', earring: 1 }, ['Londres']),
  mk('caio', 'Caio', 900, 1, 'queen', 'Sai com a dama cedo e tenta mate rápido.', 'Dama pra frente! Quero mate em poucos lances.', { bg: '#4a3f36', skin: S.rosado, hair: 'short', hc: '#d0a145', cloth: '#555', collar: 'hood', eyes: 'wink', mouth: 'smirk', freckles: 1 }, ['Escocesa']),
  mk('duda', 'Duda', 1000, 1, 'trader', 'Prefere simplificar: troca peça por peça.', 'Gosto de jogo limpo e poucas peças.', { bg: '#403a4a', skin: S.moreno, hair: 'bob', hc: '#161616', cloth: '#e0b84a', eyes: 'normal', mouth: 'flat', glasses: '#222' }),
  mk('zeh', 'Seu Zé', 1100, 1, 'defender', 'Veterano de praça: fecha o jogo e espera o erro.', 'Na minha época a gente ganhava na paciência.', { bg: '#44413c', skin: S.medio, hair: 'bald', hc: '#bdbdbd', cloth: '#8b6b3e', beard: 'stache', bc: '#bdbdbd', eyes: 'sleepy', mouth: 'smile', hat: '#6b5a3a', hatKind: 'fedora' }, ['Francesa', 'Caro-Kann']),
  // Intermediário
  mk('rafa', 'Rafa', 1200, 2, 'attacker', 'Gambiteiro: sacrifica peão para atacar.', 'Peão de graça? Só se for pra atacar!', { bg: '#3d4150', skin: S.claro, hair: 'mohawk', hc: '#2c2c2c', cloth: '#c0392b', eyes: 'normal', brow: 'angry', mouth: 'grin', beard: 'goatee' }, ['Gambito', 'Evans']),
  mk('lia', 'Lia', 1300, 2, 'solid', 'Clássica: gosta de Ruy Lopez e posições sólidas.', 'Vamos ver quem entende melhor de posição.', { bg: '#3b4a4a', skin: S.rosado, hair: 'bun', hc: '#6a3b24', cloth: '#2c3e50', collar: 'tie', tie: '#2ecc71', glasses: '#b08d57', eyes: 'normal', mouth: 'smile' }, ['Ruy Lopez']),
  mk('thiago', 'Thiago', 1400, 2, 'wild', 'Imprevisível: faz lances estranhos que complicam o jogo.', 'Hoje estou inspirado! Nem eu sei o que vou fazer.', { bg: '#473d4d', skin: S.negro, hair: 'afro', hc: '#0f0b09', cloth: '#9b59b6', eyes: 'wink', mouth: 'grin', earring: 1 }),
  mk('nina', 'Nina', 1500, 2, 'defender', 'Siciliana e contra-ataque: aguenta a pressão e vira o jogo.', 'Pode vir. Eu respondo no contra-ataque.', { bg: '#394650', skin: S.escuro, hair: 'long', hc: '#0f0f12', cloth: '#16a085', eyes: 'normal', brow: 'raised', mouth: 'smirk' }, ['Siciliana']),
  mk('marcos', 'Prof. Marcos', 1600, 2, 'balanced', 'Professor de xadrez: joga o que o livro manda.', 'Bom jogo! Vamos ver os princípios na prática.', { bg: '#3e4448', skin: S.medio, hair: 'side', hc: '#5b5b5b', cloth: '#7f8c8d', collar: 'tie', tie: '#2980b9', glasses: '#333', beard: 'stache', eyes: 'normal', mouth: 'smile' }, ['Italiana', 'Ruy Lopez']),
  // Avançado
  mk('helena', 'Helena', 1700, 3, 'attacker', 'Agressiva e precisa: ataca o rei com Siciliana.', 'Não vou te dar descanso.', { bg: '#4b3b40', skin: S.claro, hair: 'long', hc: '#9b2d20', cloth: '#1c1c1f', eyes: 'normal', brow: 'angry', mouth: 'smirk' }, ['Siciliana', 'Gambito']),
  mk('otavio', 'Otávio', 1800, 3, 'trader', 'Troca para chegar a finais que domina.', 'Vamos para o final. Lá eu sou melhor.', { bg: '#3b4748', skin: S.moreno, hair: 'short', hc: '#1a1411', cloth: '#34495e', collar: 'tie', tie: '#f39c12', beard: 'stubble', eyes: 'normal', mouth: 'flat' }, ['Inglesa', 'Catalã']),
  mk('sofia', 'Sofia', 1900, 3, 'solid', 'Posicional: pequenas vantagens que crescem.', 'Cada lance importa. Vamos?', { bg: '#3c4a47', skin: S.rosado, hair: 'bob', hc: '#2a2a35', cloth: '#6c8ebf', glasses: '#444', eyes: 'normal', mouth: 'smile' }, ['Londres', 'Catalã']),
  mk('bruno', 'Bruno', 2000, 3, 'wild', 'Tático e imprevisível: adora complicações e gambitos.', 'Complicar é a minha arte!', { bg: '#483d3d', skin: S.medio, hair: 'curly', hc: '#3a2616', cloth: '#e74c3c', beard: 'full', eyes: 'wide', mouth: 'grin', hat: '#2c3e50', hatKind: 'beanie' }, ['Evans', 'Gambito']),
  mk('clara', 'Dra. Clara', 2100, 3, 'balanced', 'Doutora em teoria: sempre acha o lance principal.', 'Teoria é a minha praia.', { bg: '#3d4449', skin: S.escuro, hair: 'hijab', hc: '#3d4f7a', cloth: '#ecf0f1', collar: 'lab', glasses: '#222', eyes: 'normal', mouth: 'smile' }, ['Ruy Lopez', 'Índia']),
  // Mestre
  mk('kenji', 'Mestre Kenji', 2200, 4, 'defender', 'Paciente como uma muralha: poucas brechas.', 'A defesa mais forte é a paciência.', { bg: '#3a3f4a', skin: S.claro, hair: 'short', hc: '#101010', cloth: '#2c2c3a', collar: 'v', eyes: 'sleepy', mouth: 'flat' }, ['Berlim', 'Caro-Kann', 'Francesa']),
  mk('aurora', 'Aurora', 2350, 4, 'attacker', 'Ataque implacável com Índia do Rei e Siciliana.', 'Vou atacar o seu rei sem pressa.', { bg: '#4a3a4d', skin: S.moreno, hair: 'ponytail', hc: '#140d12', cloth: '#8e44ad', eyes: 'normal', brow: 'angry', mouth: 'smirk', earring: 1 }, ['Siciliana', 'Índia do Rei']),
  mk('vladimir', 'Vladimir', 2500, 4, 'solid', 'Grande mestre clássico: estratégia profunda.', 'Preparei esta variante há anos.', { bg: '#3b4146', skin: S.rosado, hair: 'grey', hc: '#cfd2d6', cloth: '#1f2a38', collar: 'tie', tie: '#7f8c8d', glasses: '#555', beard: 'stache', bc: '#cfd2d6', eyes: 'normal', mouth: 'flat' }, ['Nimzo', 'Índia da Dama', 'Catalã']),
  mk('elias', 'Elias', 2650, 4, 'balanced', 'Supergrande mestre: quase não erra.', 'Faça o seu melhor. Eu farei o meu.', { bg: '#39434a', skin: S.negro, hair: 'bald', hc: '#222', cloth: '#d4a017', collar: 'round', eyes: 'normal', brow: 'raised', mouth: 'smirk', beard: 'goatee' }),
  mk('ana', 'Mestra Ana', 2800, 4, 'balanced', 'Força máxima do Stockfish com estilo de campeã.', 'Pronta para o desafio final?', { bg: '#3c3a4d', skin: S.medio, hair: 'long', hc: '#ffd36b', cloth: '#111', collar: 'v', eyes: 'normal', brow: 'angry', mouth: 'smile', earring: 1 }),
];
export const botById = (id) => BOTS.find((b) => b.id === id) || null;
export const botsOf = (g) => BOTS.filter((b) => b.group === g);

/* ---------- falas ---------- */
const LINES = {
  blunder: { cap: ['Peguei! Acho que foi bom.', 'Opa, deu certo!'], lost: ['Ué, essa peça era minha?', 'Ih… eu esqueci dela.'], chk: ['Xeque? Isso existe?'], win: ['Ganhei?! Nem acredito!'], lose: ['Perdi… mas aprendi muito!'], draw: ['Empatamos! Legal!'] },
  queen: { cap: ['A dama come tudo!', 'Dama em ação!'], lost: ['Ai, minha peça!'], chk: ['Xeque da dama!'], win: ['A dama sempre vence!'], lose: ['Perdi a dama e o jogo…'], draw: ['Empate. Podia ter sido mate.'] },
  trader: { cap: ['Troca feita!', 'Menos peças, mais fácil.'], lost: ['Tudo bem, é uma troca.'], chk: ['Xeque, mas vamos trocar?'], win: ['Venci no final simples.'], lose: ['Trocamos demais, né?'], draw: ['Sobrou pouco… empate.'] },
  attacker: { cap: ['Ataque!', 'Sem piedade!'], lost: ['Tudo bem, ainda tenho ataque.'], chk: ['Xeque! O rei não tem sossego.'], win: ['Ataque perfeito!'], lose: ['Fui com muita sede ao pote…'], draw: ['Empate? Eu queria atacar mais.'] },
  defender: { cap: ['Só levei o que era meu.'], lost: ['Hum, perdi uma peça. Calma.'], chk: ['Xeque, só para você pensar.'], win: ['Paciência vence.'], lose: ['Boa partida! Você foi melhor.'], draw: ['Empate sólido.'] },
  solid: { cap: ['Captura segura.'], lost: ['Foi uma troca justa.'], chk: ['Um xeque útil.'], win: ['Posição melhor, resultado melhor.'], lose: ['Você me superou na posição.'], draw: ['Empate honesto.'] },
  wild: { cap: ['Haha, pegou de surpresa!', 'Caos controlado!'], lost: ['Faz parte do plano!'], chk: ['Xeque surpresa!'], win: ['Eu disse que ia complicar!'], lose: ['Complicou demais até pra mim.'], draw: ['Empate maluco!'] },
  balanced: { cap: ['Captura.'], lost: ['Boa captura.'], chk: ['Xeque.'], win: ['Bom jogo.'], lose: ['Bem jogado!'], draw: ['Empate justo.'] },
};
export function sayFor(bot, ev) { const L = (LINES[bot.style] || LINES.balanced)[ev] || []; return L.length ? L[Math.floor(Math.random() * L.length)] : ''; }

/* ---------- força e estilo ---------- */
export function engineConfig(elo) {
  if (elo < 1320) {
    const skill = elo < 500 ? 0 : elo < 800 ? 1 : elo < 1000 ? 3 : elo < 1150 ? 5 : 8;
    const depth = elo < 450 ? 1 : elo < 750 ? 2 : elo < 1000 ? 3 : elo < 1150 ? 4 : 5;
    return { opts: { UCI_LimitStrength: 'false', 'Skill Level': skill }, go: { depth }, noise: elo < 450 ? 0.5 : elo < 750 ? 0.34 : elo < 1000 ? 0.22 : elo < 1150 ? 0.14 : 0.08 };
  }
  if (elo >= 2750) return { opts: { UCI_LimitStrength: 'false', 'Skill Level': 20 }, go: { movetime: 900 }, noise: 0 };
  return { opts: { UCI_LimitStrength: 'true', UCI_Elo: Math.min(3190, elo) }, go: { movetime: Math.round(180 + (elo - 1320) * 0.45) }, noise: elo < 1500 ? 0.05 : 0 };
}
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const TOL = { attacker: 70, defender: 55, trader: 65, queen: 120, solid: 45, wild: 170, balanced: 25, blunder: 40 };
function bonus(style, mv, ply) {
  const cap = mv.captured ? 1 : 0, chk = /[+#]/.test(mv.san) ? 1 : 0, castle = /[kq]/.test(mv.flags) ? 1 : 0;
  const capv = mv.captured ? VAL[mv.captured] : 0, pv = VAL[mv.piece];
  const dir = mv.color === 'w' ? 1 : -1; const retreat = (parseInt(mv.to[1], 10) - parseInt(mv.from[1], 10)) * dir < 0 ? 1 : 0;
  switch (style) {
    case 'attacker': return cap * 35 + chk * 55 + (mv.promotion ? 100 : 0) + (mv.piece === 'p' && ply > 10 ? 10 : 0);
    case 'defender': return castle * 50 + retreat * 14 - (cap && capv < pv ? 40 : 0) - chk * 10;
    case 'trader': return cap * 60 + (cap && capv >= pv ? 40 : 0) + (mv.piece === 'q' && mv.captured === 'q' ? 40 : 0);
    case 'queen': return (mv.piece === 'q' && ply < 20 ? 90 : 0) + cap * 10;
    case 'solid': return ((mv.piece === 'n' || mv.piece === 'b') && ply < 14 && ((mv.color === 'w' && mv.from[1] === '1') || (mv.color === 'b' && mv.from[1] === '8')) ? 50 : 0) + castle * 60 + (mv.piece === 'p' && /[de]/.test(mv.from[0]) && ply < 8 ? 30 : 0) - (mv.piece === 'q' && ply < 14 ? 50 : 0);
    case 'wild': return Math.random() * 130;
    default: return 0;
  }
}
// escolhe o lance do bot. C = { Chess, engine, openings }
export async function pickMove(C, fen, ucis, bot, standard) {
  const cfg = engineConfig(bot.elo); const ply = ucis.length;
  // livro de aberturas do personagem
  if (standard && bot.rep.length && ply < 14 && bot.elo >= 600 && Math.random() < (bot.elo >= 1400 ? 0.92 : 0.7)) {
    const nxt = [];
    for (const o of C.openings) {
      if (!bot.rep.some((k) => o.name.includes(k))) continue;
      if (o.ucis.length > ply && ucis.every((u, i) => o.ucis[i] === u)) nxt.push(o.ucis[ply]);
    }
    if (nxt.length) { const u = nxt[Math.floor(Math.random() * nxt.length)]; try { const g = new C.Chess(fen); g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); return u; } catch (e) {} }
  }
  const r = await C.engine.search(fen, Object.assign({ multipv: 5 }, cfg.go));
  const cand = r.lines.map((l) => ({ uci: l.pv[0], cp: toCp(l) })).filter((c) => c.uci);
  if (!cand.length) return r.best;
  if (cand[0].cp >= 9000) return cand[0].uci; // mate à vista
  const noise = cfg.noise * (bot.style === 'blunder' ? 1.5 : 1);
  if (cand.length > 1 && Math.random() < noise) return cand[1 + Math.floor(Math.random() * Math.min(3, cand.length - 1))].uci;
  if (bot.style === 'balanced') return r.best || cand[0].uci;
  const tol = TOL[bot.style] || 40; const best = cand[0].cp;
  const pool = cand.filter((c) => c.cp >= best - tol);
  const g = new C.Chess(fen); let pick = pool[0], ps = -1e9;
  for (const c of pool) {
    let mv; try { mv = g.move({ from: c.uci.slice(0, 2), to: c.uci.slice(2, 4), promotion: c.uci[4] }); g.undo(); } catch (e) { continue; }
    const s = c.cp + bonus(bot.style, mv, ply);
    if (s > ps) { ps = s; pick = c; }
  }
  return pick.uci;
}
