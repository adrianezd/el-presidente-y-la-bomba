'use strict';

/* =========================================================================
   El presidente y la bomba — juego de fiesta en dos salas
   El grupo se reparte en dos salas. El equipo azul protege al presidente;
   el rojo quiere que el bombardero acabe en la misma sala que él. Se
   juega por rondas cronometradas, cada vez más cortas: al final de cada
   una, los líderes de las salas intercambian rehenes. Cuando acaba la
   última ronda, si el presidente y el bombardero están juntos, gana el
   rojo; si no, el azul. El apostador (gris) gana si acierta quién gana.

   Con código de sala, cada uno puede enseñar su color o su carta desde su
   móvil manteniendo pulsado. Un único motor para los dos modos.
   ========================================================================= */

const MIN_PLAYERS = 6;
const MAX_PLAYERS = 20;
const TIMER_STEP = 15;
const SETTINGS_KEY = 'presidente-bomba-settings-v1';

const ROLES = {
  presi: { team: 'azul', name: 'Presidente', emoji: '👔', goal: 'Que el bombardero NO acabe en tu sala.' },
  bomba: { team: 'rojo', name: 'Bombardero', emoji: '💣', goal: 'Acaba en la misma sala que el presidente.' },
  azul: { team: 'azul', name: 'Equipo azul', emoji: '🔵', goal: 'Protege al presidente: que el bombardero no acabe en su sala.' },
  rojo: { team: 'rojo', name: 'Equipo rojo', emoji: '🔴', goal: 'Ayuda al bombardero a acabar en la sala del presidente.' },
  espiaA: { team: 'azul', show: 'rojo', name: 'Espía azul', emoji: '🕶️', goal: 'Eres del azul, pero si enseñas tu color sale ROJO. Engaña al rojo.' },
  espiaR: { team: 'rojo', show: 'azul', name: 'Espía roja', emoji: '🕶️', goal: 'Eres del rojo, pero si enseñas tu color sale AZUL. Engaña al azul.' },
  apostador: { team: 'gris', name: 'Apostador', emoji: '🎲', goal: 'No eres de nadie. Antes del final apuestas qué equipo gana: si aciertas, ganas tú.' }
};
const TEAM = { azul: { name: 'Azul', emoji: '🔵' }, rojo: { name: 'Rojo', emoji: '🔴' }, gris: { name: 'Gris', emoji: '⚪' } };
const ROOM = ['Sala A', 'Sala B'];

// rondas: minutos y rehenes que cambia cada sala
const plan = (n) => (n <= 10 ? { mins: [3, 2, 1], hostages: [1, 1, 1] } : { mins: [5, 4, 3, 2, 1], hostages: [2, 2, 1, 1, 1] });

let settings = { playerCount: 8, spies: true };

function loadSettings() {
  const p = Kit.load(SETTINGS_KEY, {}) || {};
  if (typeof p.playerCount === 'number') settings.playerCount = Kit.clamp(Math.round(p.playerCount), MIN_PLAYERS, MAX_PLAYERS);
  if (typeof p.spies === 'boolean') settings.spies = p.spies;
}
function saveSettings() { Kit.save(SETTINGS_KEY, salaBackup ? Object.assign({}, settings, salaBackup) : settings); }

/* ---------------------------------- Motor ----------------------------------- */
// Fases: reveal → round → swap → round … → final → end

function newGame(n, cfg, local) {
  const roles = ['presi', 'bomba'];
  if (n % 2 === 1) roles.push('apostador');
  if (cfg.spies && n >= 8) roles.push('espiaA', 'espiaR');
  while (roles.length < n) roles.push(roles.filter((r) => ROLES[r].team === 'azul').length <= roles.filter((r) => ROLES[r].team === 'rojo').length ? 'azul' : 'rojo');
  const order = Kit.shuffled(Array.from({ length: n }, (_, i) => i));
  const room = [];
  order.forEach((i, k) => { room[i] = k % 2; });
  const p = plan(n);
  return {
    cfg: { local: Boolean(local) },
    r: Kit.shuffled(roles), room, mins: p.mins, hostages: p.hostages,
    round: 0, phase: 'reveal', ready: {}, bets: {}, winner: null
  };
}

const all = (g) => g.r.map((_, i) => i);
const roleOf = (g, i) => g.r[i];

function result(g) {
  const pr = g.r.indexOf('presi');
  const bo = g.r.indexOf('bomba');
  return g.room[pr] === g.room[bo] ? 'rojo' : 'azul';
}

function act(g, i, a, host) {
  const n = g.r.length;
  switch (a.t) {
    case 'ready':
      if (g.phase !== 'reveal' || !(i >= 0 && i < n)) return null;
      g.ready[i] = true;
      return {};
    case 'go':
      // empieza la ronda siguiente
      if (!host || (g.phase !== 'reveal' && g.phase !== 'swap')) return null;
      g.round += 1;
      g.phase = 'round';
      return { timer: g.mins[g.round - 1] * 60 };
    case 'stop':
      if (!host || g.phase !== 'round') return null;
      g.phase = g.round >= g.mins.length ? 'final' : 'swap';
      return { timer: null };
    case 'room': {
      // «me han cambiado de sala»: en un móvil se dice de quién (by)
      const who = host && a.by != null ? a.by : i;
      if (!(who >= 0 && who < n) || !['round', 'swap', 'final', 'reveal'].includes(g.phase)) return null;
      if (a.room !== 0 && a.room !== 1) return null;
      g.room[who] = a.room;
      return {};
    }
    case 'bet': {
      const who = host && a.by != null ? a.by : i;
      if (g.phase !== 'final' || roleOf(g, who) !== 'apostador' || !['azul', 'rojo'].includes(a.team)) return null;
      g.bets[who] = a.team;
      return {};
    }
    case 'boom':
      if (!host || g.phase !== 'final') return null;
      g.winner = result(g);
      g.phase = 'end';
      return { timer: null };
    default:
      return null;
  }
}

function privateTurn(g) {
  if (g.phase === 'reveal' && g.cfg.local) return { key: 'reveal', order: all(g), done: () => true, lastLabel: 'Listo, ¡a las salas!' };
  if (g.phase === 'reveal') return { key: 'reveal', order: all(g), done: (gg, k) => Boolean(gg.ready[k]) };
  return null;
}
function advance() { return null; } // el anfitrión da paso a la primera ronda

/* ------------------------------ Lo que se pinta ------------------------------ */

const esc = Kit.esc;
const actAttr = (a) => `data-act="${esc(JSON.stringify(a))}"`;
const hostBtn = (a, label, cls) => `<button type="button" class="btn ${cls || 'btn-primary'} btn-large" ${actAttr(a)}>${label}</button>`;
const waitHost = (ctx, text) => `<p class="setup-hint sala-center">⏳ ${esc(text || `Esperando a ${ctx.hostName}`)}</p>`;

function roleCard(g, i) {
  const R = ROLES[roleOf(g, i)];
  return {
    label: `Equipo ${TEAM[R.team].name.toLowerCase()} · empiezas en la ${ROOM[g.room[i]]}`, emoji: R.emoji, content: R.name,
    extra: esc(R.goal), alert: R.team === 'rojo', impostor: R.team === 'rojo'
  };
}

// lo que se ve al enseñar: el color (los espías enseñan el contrario) o la carta entera
let showing = null;
function showData(kind) {
  if (!showing) return null;
  const R = ROLES[roleOf(showing.g, showing.me)];
  const color = R.show || R.team;
  if (kind === 'color') return { cls: `is-${color}`, html: `<span class="show-emoji">${TEAM[color].emoji}</span><strong>${TEAM[color].name}</strong>` };
  return { cls: `is-${R.team}`, html: `<span class="show-emoji">${R.emoji}</span><strong>${R.name}</strong><small>Equipo ${TEAM[R.team].name.toLowerCase()}</small>` };
}

function showButtons() {
  return '<div class="show-row"><button type="button" class="show-btn" data-show="color">🎨 Enseñar color<small>Mantén pulsado</small></button>' +
    '<button type="button" class="show-btn" data-show="card">🃏 Enseñar carta<small>Mantén pulsado</small></button></div>';
}

function roomSwitch(g, i, names, by) {
  const cur = g.room[i];
  return `<div class="room-switch">${[0, 1].map((k) => `<button type="button" class="room-pill${cur === k ? ' is-on' : ''}" ${cur === k ? 'disabled' : actAttr(Object.assign({ t: 'room', room: k }, by ? { by: i } : {}))}>${ROOM[k]}</button>`).join('')}</div>`;
}

function roomsHtml(g, names, withRoles) {
  return '<div class="two-rooms">' + [0, 1].map((k) => `<div class="room-col"><p class="room-col-title">${ROOM[k]}</p><ul>` +
    all(g).filter((i) => g.room[i] === k).map((i) => {
      const R = ROLES[roleOf(g, i)];
      return `<li class="${withRoles ? `is-${R.team}` : ''}">${withRoles ? `${R.emoji} ` : ''}${esc(names[i])}${withRoles && (R.team !== 'azul' && R.team !== 'rojo' || R.show || i === g.r.indexOf('presi') || i === g.r.indexOf('bomba')) ? `<small>${R.name}</small>` : ''}</li>`;
    }).join('') + '</ul></div>').join('') + '</div>';
}

// en un móvil: lista para corregir la sala de cada uno
function roomEditor(g, names) {
  return '<details class="fold"><summary>🔁 Cambiar a alguien de sala</summary><div class="room-edit">' +
    all(g).map((i) => `<div class="room-edit-row"><span>${esc(names[i])}</span>${roomSwitch(g, i, names, true)}</div>`).join('') + '</div></details>';
}

function render(ctx) {
  const { g, me, host, names } = ctx;
  const n = g.r.length;
  const inGame = me >= 0 && me < n;
  if (inGame && !ctx.local) showing = { g, me };
  const R = inGame ? ROLES[roleOf(g, me)] : null;
  const spectator = '<p class="screen-help">👀 Has entrado con la partida empezada: mira y espera a la siguiente.</p>';
  const roundLabel = `Ronda ${g.round} de ${g.mins.length}`;
  const hostages = g.hostages[Math.max(0, g.round - 1)];
  const myRoom = inGame ? `<p class="my-room">Estás en la <strong>${ROOM[g.room[me]]}</strong></p>` : '';

  switch (g.phase) {
    case 'reveal':
      if (ctx.local && inGame) return `<h2 class="reveal-player">${esc(names[me])}</h2>${ctx.card}<p class="screen-help">Recuerda tu sala: <strong>${ROOM[g.room[me]]}</strong>.</p>`;
      if (ctx.local) {
        return '<h2 class="screen-title">🚪 Id a vuestras salas</h2><p class="screen-help">Cada grupo a su sala, sin oír lo que se dice en la otra. El móvil se queda con quien lleve el tiempo.</p>' +
          roomsHtml(g, names, false) + hostBtn({ t: 'go' }, 'Empezar la ronda 1 ⏱️');
      }
      return (inGame ? `<h2 class="reveal-player">${esc(names[me])}</h2><p class="reveal-warning">🤫 Que nadie más mire tu pantalla</p>${ctx.card}${myRoom}` +
          (g.ready[me] ? '<p class="screen-help">✅ Listo. Id cada uno a vuestra sala.</p>' : `<button type="button" class="btn btn-secondary btn-large" ${actAttr({ t: 'ready' })}>Ya lo vi</button>`) : spectator) +
        `<p class="sala-count">Listos <strong>${all(g).filter((k) => g.ready[k]).length}</strong> de ${n}</p>` +
        (host ? hostBtn({ t: 'go' }, 'Empezar la ronda 1 ⏱️') : '');
    case 'round':
      return `<h2 class="screen-title">⏱️ ${roundLabel}</h2>` +
        `<p class="screen-help">Cada sala elige a su líder. Hablad, enseñad color o carta a quien queráis… o no. Al acabar, cada líder manda <strong>${hostages} rehén${hostages > 1 ? 'es' : ''}</strong> a la otra sala.</p>` +
        myRoom + (inGame && !ctx.local ? showButtons() : '') + ctx.timer +
        (inGame && !ctx.local ? `<details class="fold"><summary>🃏 Mi carta</summary>${ctx.card}</details>` : '') +
        (ctx.local ? roomsHtml(g, names, false) : '') +
        (host ? hostBtn({ t: 'stop' }, 'Fin de la ronda 🔔') : waitHost(ctx, `${ctx.hostName} cerrará la ronda`));
    case 'swap':
      return `<h2 class="screen-title">🔁 Intercambio de rehenes</h2>` +
        `<p class="screen-help">Cada líder elige <strong>${hostages} rehén${hostages > 1 ? 'es' : ''}</strong> de su sala y se cruzan a la vez. ${ctx.local ? 'Marcad aquí quién cambia de sala.' : 'Si te toca cambiar, márcalo aquí.'}</p>` +
        (inGame && !ctx.local ? myRoom + roomSwitch(g, me, names, false) : '') +
        roomsHtml(g, names, false) + (ctx.local ? roomEditor(g, names) : '') +
        (host ? hostBtn({ t: 'go' }, `Empezar la ronda ${g.round + 1} ⏱️`) : waitHost(ctx));
    case 'final': {
      const gamblers = all(g).filter((k) => roleOf(g, k) === 'apostador');
      let bet = '';
      if (inGame && R.team === 'gris') {
        bet = `<p class="screen-help">🎲 ¿Quién gana? ${g.bets[me] ? `Has apostado por el <strong>${TEAM[g.bets[me]].name.toLowerCase()}</strong>.` : ''}</p><div class="room-switch">` +
          ['azul', 'rojo'].map((t) => `<button type="button" class="room-pill is-${t}${g.bets[me] === t ? ' is-on' : ''}" ${actAttr({ t: 'bet', team: t })}>${TEAM[t].emoji} ${TEAM[t].name}</button>`).join('') + '</div>';
      } else if (ctx.local && gamblers.length) {
        bet = gamblers.map((k) => `<p class="screen-help">🎲 ${esc(names[k])}, ¿quién gana?</p><div class="room-switch">` +
          ['azul', 'rojo'].map((t) => `<button type="button" class="room-pill is-${t}${g.bets[k] === t ? ' is-on' : ''}" ${actAttr({ t: 'bet', team: t, by: k })}>${TEAM[t].emoji} ${TEAM[t].name}</button>`).join('') + '</div>').join('');
      }
      return '<h2 class="screen-title">💣 Se acabó el tiempo</h2>' +
        `<p class="screen-help">Comprobad que cada uno está en su sala${gamblers.length ? ' y que el apostador ha elegido' : ''}. Luego, a ver si explota.</p>` +
        (inGame && !ctx.local ? myRoom + roomSwitch(g, me, names, false) : '') + bet +
        roomsHtml(g, names, false) + (ctx.local ? roomEditor(g, names) : '') +
        (host ? hostBtn({ t: 'boom' }, 'Revelar 💥') : waitHost(ctx, `${ctx.hostName} revelará el final`));
    }
    case 'end': {
      const red = g.winner === 'rojo';
      const gamblers = all(g).filter((k) => roleOf(g, k) === 'apostador');
      const bets = gamblers.map((k) => `🎲 ${esc(names[k])} ${g.bets[k] === g.winner ? 'acertó y también gana' : g.bets[k] ? 'falló su apuesta' : 'no apostó'}.`).join(' ');
      return `<div class="verdict ${red ? 'is-lose boom' : 'is-win'}"><span class="verdict-emoji" aria-hidden="true">${red ? '💥' : '🎉'}</span>` +
        `<h2 class="verdict-title">${red ? '¡BOOM! Gana el rojo' : '¡El presidente se salva! Gana el azul'}</h2>` +
        `<p class="verdict-text">${red ? 'El bombardero acabó en la misma sala que el presidente.' : 'El bombardero estaba en la otra sala.'} ${bets}</p></div>` +
        roomsHtml(g, names, true) +
        (host ? '<div class="results-actions"><button type="button" class="btn btn-primary btn-large" data-sala="again">Otra partida ▶</button>' +
          '<button type="button" class="btn btn-secondary btn-large" data-sala="lobby">Cambiar ajustes</button></div>'
          : waitHost(ctx, `Esperando a que ${ctx.hostName} empiece otra partida`));
    }
    default:
      return '';
  }
}

const engine = {
  act, advance, privateTurn, render,
  card: (g, i) => (i >= 0 && i < g.r.length ? roleCard(g, i) : null),
  title: (g) => (g.phase === 'reveal' ? 'Reparto de cartas' : g.phase === 'end' ? 'Final' : g.round ? `Ronda ${g.round} de ${g.mins.length}` : ''),
  phaseKey: (g) => `${g.phase}-${g.round}`,
  fx: (g) => (g.phase === 'end' ? (g.winner === 'azul' ? 'win' : 'lose') : null)
};

/* ----------------------- Enseñar color o carta (sala) ------------------------ */

function bindShow() {
  const overlay = document.createElement('div');
  overlay.className = 'show-overlay';
  overlay.hidden = true;
  document.body.appendChild(overlay);
  let on = false;
  const down = (e) => {
    const b = e.target.closest && e.target.closest('[data-show]');
    if (!b) return;
    const d = showData(b.dataset.show);
    if (!d) return;
    if (e.cancelable) e.preventDefault();
    on = true;
    overlay.className = `show-overlay ${d.cls}`;
    overlay.innerHTML = d.html;
    overlay.hidden = false;
    Kit.buzz(20);
  };
  const up = () => { if (!on) return; on = false; overlay.hidden = true; overlay.innerHTML = ''; };
  document.addEventListener('pointerdown', down);
  document.addEventListener('touchstart', down, { passive: false });
  ['pointerup', 'pointercancel', 'touchend', 'touchcancel'].forEach((t) => document.addEventListener(t, up));
  document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-show]')) e.preventDefault(); });
}

/* ------------------------------- Ajustes (DOM) ------------------------------- */

const el = {};
let game = null;

function cacheDom() {
  ['player-count-value', 'btn-player-minus', 'btn-player-plus', 'names-grid', 'btn-shuffle-names', 'role-summary',
    'opt-spies', 'opt-sound', 'opt-vibrate', 'btn-start-game', 'game-bar-title', 'btn-exit', 'play-root', 'plan-summary'
  ].forEach((id) => { el[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id); });
}

function renderSetup() {
  const n = settings.playerCount;
  el.playerCountValue.textContent = String(n);
  el.btnPlayerMinus.disabled = n <= MIN_PLAYERS;
  el.btnPlayerPlus.disabled = n >= MAX_PLAYERS;
  Kit.renderNameInputs(el.namesGrid, n);
  el.optSpies.checked = settings.spies;
  const spies = settings.spies && n >= 8;
  const gray = n % 2 === 1 ? 1 : 0;
  const per = (n - gray) / 2;
  el.roleSummary.textContent = `🔵 ${per} con 👔 presidente${spies ? ' y 🕶️ espía' : ''} · 🔴 ${per} con 💣 bombardero${spies ? ' y 🕶️ espía' : ''}${gray ? ' · 🎲 apostador' : ''}`;
  const p = plan(n);
  el.planSummary.textContent = `${p.mins.length} rondas de ${p.mins.join(', ')} minutos · rehenes por ronda ${p.hostages.join(', ')}`;
}

function startLocalGame() {
  game = newGame(settings.playerCount, settings, true);
  Kit.keepAwake(true);
  Kit.showScreen('play');
  Mesa.start({
    root: el.playRoot, titleEl: el.gameBarTitle, engine, game, names: Kit.playerNames(settings.playerCount),
    timerStep: TIMER_STEP, holdPrompt: 'Mantén pulsado para ver tu carta', onAgain: startLocalGame, onSetup: backToSetup
  });
}

function backToSetup() {
  Mesa.stop();
  game = null;
  Kit.keepAwake(false);
  renderSetup();
  Kit.showScreen('setup');
}

/* --------------------------- Con código de sala ------------------------------ */

let salaBackup = null;

function salaHosting(on, players) {
  if (on) {
    if (!salaBackup) salaBackup = { playerCount: settings.playerCount };
    settings.playerCount = Kit.clamp(players, MIN_PLAYERS, MAX_PLAYERS);
  } else if (salaBackup) {
    settings.playerCount = salaBackup.playerCount;
    salaBackup = null;
  }
  renderSetup();
}

Sala.configure({
  id: 'bomba',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  timerStep: TIMER_STEP,
  holdPrompt: 'Mantén pulsado para ver tu carta',
  who: { one: 'bombardero', many: 'bombarderos', One: 'Bombardero', Many: 'Bombarderos', the: 'el bombardero', The: 'El bombardero' },
  hosting: salaHosting,
  custom: {
    start: (n) => newGame(n, settings, false),
    act: Mesa.autoAct(engine),
    render,
    card: engine.card,
    phaseKey: engine.phaseKey,
    phaseFx: (g, me) => {
      if (g.phase !== 'end') return null;
      if (!(me >= 0 && me < g.r.length)) return null;
      const t = ROLES[roleOf(g, me)].team;
      const won = t === 'gris' ? g.bets[me] === g.winner : t === g.winner;
      return won ? 'win' : 'lose';
    }
  }
});

/* --------------------------------- Eventos ----------------------------------- */

function bindEvents() {
  const change = (d) => { settings.playerCount = Kit.clamp(settings.playerCount + d, MIN_PLAYERS, MAX_PLAYERS); saveSettings(); renderSetup(); };
  el.btnPlayerMinus.addEventListener('click', () => change(-1));
  el.btnPlayerPlus.addEventListener('click', () => change(1));
  el.btnShuffleNames.addEventListener('click', () => { Kit.shuffleNames(el.namesGrid, settings.playerCount); Kit.toast('Orden mezclado 🔀'); });
  el.optSpies.addEventListener('change', () => { settings.spies = el.optSpies.checked; saveSettings(); renderSetup(); });
  Kit.bindPrefToggle(el.optSound, 'sound');
  Kit.bindPrefToggle(el.optVibrate, 'vibrate');
  el.btnStartGame.addEventListener('click', () => {
    saveSettings();
    try { history.pushState({ inGame: true }, ''); } catch (err) { /* sin historial */ }
    startLocalGame();
  });
  el.btnExit.addEventListener('click', () => {
    if (!game || window.confirm('¿Salir de la partida? Se perderá la partida en curso.')) backToSetup();
  });
  window.addEventListener('popstate', () => {
    if (!game) return;
    if (window.confirm('¿Salir de la partida? Se perderá la partida en curso.')) backToSetup();
    else { try { history.pushState({ inGame: true }, ''); } catch (err) { /* sin historial */ } }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  loadSettings();
  bindEvents();
  bindShow();
  renderSetup();
  Kit.showScreen('setup');
});
