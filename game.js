/* ====================
   CONFIGURAÇÃO GERAL
==================== */
const CONFIG = {
  handSize: 5,
  pointsToWin: 7,
  deckPerElement: 10,
  allow2PFaceUp: true,

  avatars: {
    player: { emoji: "🦝", name: "Você", img: "assets/guaxinim1.png" },
    enemy:  { emoji: "🦝", name: "Inimigo", img: "assets/guaxinim2.png" }
  },

  colors: { agua:"#3fa7ff", fogo:"#ff6b6b", neve:"#9ae6ff" },

  cardSkins: {
    agua: "assets/cards/agua.jpg",
    fogo: "assets/cards/fogo.jpg",
    neve: "assets/cards/neve.png"
  },

  useCardImages: true
};

/* ====================
       MULTIPLAYER
==================== */
let lastSeenRoundSig = "";
let roomId = null;
let myRole  = "p1";
function roomRef(id){ return db.ref("rooms/" + id); }
function randomCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
function opponentRole(){ return myRole === "p1" ? "p2" : "p1"; }

/* ====================
       ELEMENTOS
==================== */
const ELEMENTS = ["agua","fogo","neve"];
const ICON = { agua:"💧", fogo:"🔥", neve:"❄️" };

function createDeck(){
  const deck=[]; let id=1;
  for (const el of ELEMENTS) {
    for (let p=1;p<=CONFIG.deckPerElement;p++) {
      deck.push({ id:id++, element:el, power:p });
    }
  }
  return shuffle(deck);
}

function shuffle(a){
  for (let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function elementWins(a,b){
  if (a===b) return 0;
  if ((a==="agua" && b==="fogo") || (a==="fogo" && b==="neve") || (a==="neve" && b==="agua")) return 1;
  return -1;
}

function compareCards(c1,c2){
  const ew=elementWins(c1.element,c2.element);
  if (ew!==0) return ew;
  return Math.sign(c1.power - c2.power);
}

/* ====================
       ESTADO/UI
==================== */
const state = {
  mode:"cpu",
  deck:[],
  discard:[],
  p1:{ name:CONFIG.avatars.player.name, hand:[], score:0 },
  p2:{ name:CONFIG.avatars.enemy.name,  hand:[], score:0 },
  lastPlay:{ p1:null, p2:null, result:null },
  locked:false
};

const $ = s=>document.querySelector(s);
const enemyHandEl=$("#enemy-hand"), playerHandEl=$("#player-hand");
const enemyScoreEl=$("#enemy-score"), playerScoreEl=$("#player-score");
const roundResultEl=$("#round-result"), p1PlayEl=$("#p1-play"), p2PlayEl=$("#p2-play");
const modeSel=$("#mode"), btnRestart=$("#btn-restart");
const nameInput = ()=> ( $("#nick")?.value || "" ).trim();
const bannerEl = document.getElementById("banner");
const finalOverlay = document.getElementById("final-overlay");
const finalTitle   = document.getElementById("final-title");
const finalScore   = document.getElementById("final-score");
const btnFinalRestart = document.getElementById("btn-final-restart");
const btnFinalMenu    = document.getElementById("btn-final-menu");
/* ====================
   HELPERS E RENDER
==================== */
function showFinalOverlay({ youWon }) {
  if (!finalOverlay) return;
  finalTitle.textContent = youWon ? "Você venceu a partida!" : "Você perdeu a partida!";
  finalScore.textContent = ""; // sem placar para evitar undefined
  finalOverlay.classList.remove("hidden");
  state.locked = true;
}
function hideFinalOverlay(){
  if (!finalOverlay) return;
  finalOverlay.classList.add("hidden");
}
function flashBanner(msg, type="info") {
  if (!bannerEl) return;
  bannerEl.textContent = msg;
  bannerEl.className = "banner " + type;
  bannerEl.classList.add("show");
  setTimeout(() => bannerEl.classList.remove("show"), 1300);
}

/* Avatares (nomes/ícones – imagens já no HTML) */
(function(){
  $("#player-name").textContent = CONFIG.avatars.player.name;
  $("#enemy-name").textContent  = CONFIG.avatars.enemy.name;
})();

/* ====================
         RENDER
==================== */
function renderScores(){
  enemyScoreEl.innerHTML=""; playerScoreEl.innerHTML="";
  for (let i=0;i<CONFIG.pointsToWin;i++){
    const d1=document.createElement("div"), d2=document.createElement("div");
    d1.className="dot"+(i<state.p2.score?" on":"");
    d2.className="dot"+(i<state.p1.score?" on":"");
    enemyScoreEl.appendChild(d1); playerScoreEl.appendChild(d2);
  }
}

function cardHtml(card,idx,owner){
  const color=CONFIG.colors[card.element];
  if (CONFIG.useCardImages && CONFIG.cardSkins?.[card.element]){
    const bg=CONFIG.cardSkins[card.element];
    return `<div class="card" data-idx="${idx}" data-owner="${owner}" style="border-color:${color}90">
      <div class="card-face" style="background-image:url('${bg}')"></div>
      <div class="badge-num">★ ${String(card.power).padStart(2,"0")}</div>
      <div class="badge-el" style="border-color:${color}80">${card.element.toUpperCase()}</div>
    </div>`;
  }
  return `<div class="card" data-idx="${idx}" data-owner="${owner}" style="border-color:${color}80">
    <div class="el" style="color:${color}">${ICON[card.element]}</div>
    <div class="pts">${card.element.toUpperCase()} • ${String(card.power).padStart(2,"0")}</div>
  </div>`;
}

function renderHands(){
  const online = !!roomId;

  // Oponente: online e CPU => sempre oculto
  if (online || state.mode==="cpu"){
    enemyHandEl.innerHTML = state.p2.hand.map(()=>`
      <div class="card disabled"><div class="el">🂠</div><div class="pts">Oculta</div></div>
    `).join("");
  } else {
    // 2P local: mostrar cartas do p2 (ou feche via CONFIG.allow2PFaceUp=false)
    enemyHandEl.innerHTML = state.p2.hand.map((c,i)=>cardHtml(c,i,"p2")).join("");
  }

  // Jogador local (sempre visível)
  playerHandEl.innerHTML = state.p1.hand.map((c,i)=>cardHtml(c,i,"p1")).join("");

  if (state.locked){
    playerHandEl.querySelectorAll(".card").forEach(c=>c.classList.add("disabled"));
    if (state.mode==="2p" && !online && !CONFIG.allow2PFaceUp){
      enemyHandEl.querySelectorAll(".card").forEach(c=>c.classList.add("disabled"));
    }
  }
}

function renderCenter(){
  const a = state.lastPlay.p1, b = state.lastPlay.p2;

  p1PlayEl.textContent = a ? `${ICON[a.element]} ${a.power}` : "—";
  p2PlayEl.textContent = b ? `${ICON[b.element]} ${b.power}` : "—";

  if (state.lastPlay.result === 1) {
    roundResultEl.textContent = "Você venceu o round!";
    roundResultEl.style.color = "var(--win)";
  } else if (state.lastPlay.result === -1) {
    roundResultEl.textContent = "Você perdeu o round!";
    roundResultEl.style.color = "var(--lose)";
  } else if (state.lastPlay.result === 0) {
    roundResultEl.textContent = "Empate! Cartas descartadas.";
    roundResultEl.style.color = "var(--draw)";
  } else {
    roundResultEl.textContent = "Escolha uma carta…";
    roundResultEl.style.color = "var(--text)";
  }
}

/* ====================
   MULTIPLAYER (RTDB)
==================== */
function updateTurnIndicator(moves){
  if (!roomId) return;

  const myPlayed  = !!(moves && moves[myRole]);
  const oppPlayed = !!(moves && moves[opponentRole()]);

  if (!myPlayed){
    roundResultEl.textContent = "Sua vez!";
    roundResultEl.style.color = "var(--win)";
    state.locked = false;
  } else if (myPlayed && !oppPlayed){
    roundResultEl.textContent = "Aguardando oponente…";
    roundResultEl.style.color = "var(--muted)";
    state.locked = true;
  } else {
    state.locked = true; // ambos jogaram — host resolverá
  }
  renderHands();
}

function listenRoom(){
  roomRef(roomId).on("value", snap=>{
    const data = snap.val(); 
    if (!data) return;

    // --- CONVIDADO: aplica estado publicado pelo host (fazendo SWAP p1<->p2) ---
    if (data.state && myRole === "p2"){
      let hostState;
      try {
        hostState = (typeof data.state === "string") ? JSON.parse(data.state) : data.state;
      } catch (e) {
        console.warn("Falha ao parsear state do host:", e);
        hostState = null;
      }

      if (hostState){
        const lp = hostState.lastPlay;

        // Resultado do host (ponto de vista do host: p1=host)
        const hostResult = (lp && typeof lp.result === "number") ? lp.result : null;

        // Inverte o resultado para o convidado (p2)
        const resultForGuest = (hostResult === null) ? null : (hostResult === 0 ? 0 : -hostResult);

        // Monta estado "swapped" (eu, convidado, viro p1 na tela)
        const swapped = {
          mode: "2p",
          deck: [],     // não precisamos do baralho no p2
          discard: [],  // idem
          p1: { // eu (convidado) vejo minha mão como p1
            name: nameInput() || hostState.p2?.name || "Você",
            hand: hostState.p2?.hand || [],
            score: hostState.p2?.score ?? 0,
          },
          p2: { // oponente (host)
            name: hostState.p1?.name || "Oponente",
            hand: hostState.p1?.hand || [],
            score: hostState.p1?.score ?? 0,
          },
          lastPlay: (lp ? {
            p1: lp.p2 || null,                 // espelha as cartas
            p2: lp.p1 || null,
            result: resultForGuest             // resultado já invertido para mim (convidado)
          } : { p1:null, p2:null, result:null }),
          locked: !!hostState.locked
        };

        Object.assign(state, swapped);
        renderScores(); 
        renderHands(); 
        renderCenter();

        // --- Mostrar banner no convidado APENAS quando a rodada estiver realmente resolvida ---
        const id1 = lp?.p1?.id;
        const id2 = lp?.p2?.id;
        const hasBothIds = (typeof id1 === "number") && (typeof id2 === "number");
        const hasFinalResult = (typeof hostResult === "number"); // -1, 0, 1

        if (hasBothIds && hasFinalResult){
          const sig = `${id1}-${id2}-${hostResult}`;
          if (sig !== lastSeenRoundSig){
            if (resultForGuest === 1)       flashBanner("Você ganhou o round!", "win");
            else if (resultForGuest === -1) flashBanner("Você perdeu o round!", "lose");
            else                            flashBanner("Empate!", "draw");
            lastSeenRoundSig = sig;
          }
        }

        // Se a partida terminou no host, o convidado também mostra o modal final
        if (swapped.p1.score >= CONFIG.pointsToWin || swapped.p2.score >= CONFIG.pointsToWin) {
          const youWon = swapped.p1.score > swapped.p2.score; // p1 aqui é o convidado
          showFinalOverlay({ youWon });
        }
      }
    }

    // --- Indicador de vez (host e convidado) ---
    updateTurnIndicator(data.moves || {});

    // --- HOST: resolve quando ambos jogaram ---
    const m = data.moves || {};
    if (myRole === "p1" && m.p1 && m.p2){
      const c1 = state.p1.hand.find(c=>c.id === m.p1.cardId);
      const c2 = state.p2.hand.find(c=>c.id === m.p2.cardId);
      if (c1 && c2){
        resolveRound(c1, c2);                  // host decide o resultado
        roomRef(roomId).update({ moves: {} }); // limpa jogadas
        syncState();                            // publica estado pós-rodada
        updateTurnIndicator({});                // reseta indicador
      }
    }
  });
}
function syncState(){
  if (!roomId) return;
  roomRef(roomId).update({ state: JSON.stringify(state) });
}

async function sendMove(card){
  if (!roomId) return;
  const snap = await roomRef(roomId + "/moves/" + myRole).once("value");
  if (snap.exists()) return; // evita envio duplo
  await roomRef(roomId + "/moves/" + myRole).set({ cardId: card.id, at: Date.now() });
}

/* ====================
        FLUXO
==================== */
function initGame(){
  // define nomes com base no nick e modo
  const nick = nameInput() || "Você";
  const opp  = (roomId ? "Oponente" : (modeSel.value==="cpu" ? "CPU" : "Oponente"));

  state.mode = modeSel.value;        // em remoto a lógica usa roomId; o select é estética
  state.deck = createDeck();
  state.discard = [];
  state.p1.hand=[]; state.p2.hand=[];
  state.p1.score=0; state.p2.score=0;
  state.p1.name = nick;
  state.p2.name = opp;

  state.lastPlay={ p1:null, p2:null, result:null };
  state.locked=false;

  for (let i=0;i<CONFIG.handSize;i++){
    state.p1.hand.push(state.deck.pop());
    state.p2.hand.push(state.deck.pop());
  }

  renderScores(); renderHands(); renderCenter();
  syncState(); // se for host remoto, publica
}

function drawOne(toHand){
  if (state.deck.length===0){
    state.deck = shuffle(state.discard);
    state.discard = [];
  }
  if (state.deck.length>0) toHand.push(state.deck.pop());
}

function cpuPick(){
  const cpu=state.p2.hand;
  if (state.lastPlay.p1){
    const t=state.lastPlay.p1.element;
    const want = (t==="agua"?"neve": t==="neve"?"fogo":"agua");
    const candidates = cpu.filter(c=>c.element===want);
    if (candidates.length){
      let best=candidates[0];
      for (const c of candidates) if (c.power<best.power) best=c;
      return best;
    }
  }
  return cpu[Math.floor(Math.random()*cpu.length)];
}

function resolveRound(c1,c2){
  const r=compareCards(c1,c2);

  // Banner da rodada
  if (r === 1) {
    flashBanner("Você ganhou o round!", "win");
  } else if (r === -1) {
    flashBanner("Você perdeu o round!", "lose");
  } else {
    flashBanner("Empate!", "draw");
  }

  state.lastPlay={ p1:c1, p2:c2, result:r };
  renderCenter();

  // remove das mãos
  state.p1.hand = state.p1.hand.filter(c=>c!==c1);
  state.p2.hand = state.p2.hand.filter(c=>c!==c2);

  // descarte
  state.discard.push(c1,c2);

  if (r===1) state.p1.score++;
  if (r===-1) state.p2.score++;

  renderScores();

  // vitória da partida?
  if (state.p1.score >= CONFIG.pointsToWin || state.p2.score >= CONFIG.pointsToWin) {
    state.locked = true;

    const youWon = state.p1.score > state.p2.score; // p1 é sempre o jogador local

    // Mostra no cliente local
    showFinalOverlay({ youWon });

    // Publica um marcador de final (opcional) — quem escuta é o convidado
    if (roomId && myRole === "p1") {
      roomRef(roomId).update({ finished: { winner: youWon ? "p1" : "p2", p1: state.p1.score, p2: state.p2.score } });
    }
    return;
  }

  // compra uma pra cada
  drawOne(state.p1.hand);
  drawOne(state.p2.hand);

  state.locked=false;
  renderHands();
  syncState();
}

/* ====================
      INPUT/CONTROLES
==================== */
document.addEventListener("click", (ev)=>{
  const cardEl = ev.target.closest(".card");
  if (!cardEl) return;
  if (cardEl.classList.contains("disabled")) return;
  if (state.locked) return;

  const owner = cardEl.dataset.owner;
  if (owner!=="p1") return; // só pode jogar a mão local

  const idx = Number(cardEl.dataset.idx);
  const chosen = state.p1.hand[idx];

  // ONLINE
  if (roomId){
    state.lastPlay = { p1:{element:chosen.element, power:chosen.power}, p2:null, result:null };
    state.locked = true;
    renderCenter(); renderHands();
    roundResultEl.textContent = "Aguardando oponente…";
    sendMove(chosen);
    return;
  }

  // 2P local
  if (state.mode==="2p"){
    state.locked=true;
    state.lastPlay={ p1:chosen, p2:null, result:null };
    renderCenter(); renderHands();
    playerHandEl.querySelectorAll(".card").forEach(c=>c.classList.add("disabled"));
    enemyHandEl.querySelectorAll(".card").forEach(c=>c.classList.remove("disabled"));
    const onP2=(e)=>{
      const ce=e.target.closest(".card");
      if (!ce || ce.dataset.owner!=="p2") return;
      enemyHandEl.removeEventListener("click", onP2, true);
      const c2 = state.p2.hand[Number(ce.dataset.idx)];
      resolveRound(chosen, c2);
    };
    enemyHandEl.addEventListener("click", onP2, true);
    return;
  }

  // vs CPU
  state.locked=true;
  const cpu = cpuPick();
  setTimeout(()=> resolveRound(chosen, cpu), 300);
});

/* Topbar */
modeSel.addEventListener("change", ()=> initGame());

// Reiniciar (topo) — fecha tarja e reinicia
btnRestart.addEventListener("click", ()=>{
  hideFinalOverlay();
  state.locked = false;
  initGame();
});

// Botões da tarja final
if (btnFinalRestart) {
  btnFinalRestart.addEventListener("click", ()=>{
    hideFinalOverlay();
    state.locked = false;
    initGame();
  });
}
if (btnFinalMenu) {
  btnFinalMenu.addEventListener("click", ()=>{
    hideFinalOverlay();
    state.locked = false;
    showMenu();
  });
}

/* ====================
         MENU
==================== */
function hideMenu(){ $("#menu").classList.add("hidden"); }
function showMenu(){ $("#menu").classList.remove("hidden"); }

async function hostRoom(){
  if (!window.db){ alert("DB não inicializado. Confira o firebaseConfig no index.html."); return; }
  try{
    roomId = randomCode();
    myRole = "p1";
    await roomRef(roomId).set({ createdAt: Date.now(), state: null, moves: {} });

    listenRoom();   // começa a escutar a sala
    hideMenu();
    initGame();     // gera deck e mãos (com seu nick)
    syncState();    // publica estado inicial
    await roomRef(roomId + "/moves").set({}); // turno inicial

    updateTurnIndicator({});

    // mostrar botão "Copiar código"
    const copyBtn = document.getElementById("btn-copy-room");
    if (copyBtn){
      copyBtn.style.display = "inline-block";
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(roomId).then(()=>{
          alert("Código copiado: " + roomId);
        }).catch(err=>{
          console.error("Erro ao copiar:", err);
          alert("Não foi possível copiar o código.");
        });
      };
    }

    alert("Sala criada: " + roomId + " (envie esse código)");
  }catch(e){
    console.error("Erro criando sala:", e);
    alert("Erro criando sala: " + (e?.message || e));
  }
}

async function joinRoom(){
  const code = ($("#room")?.value || "").trim().toUpperCase();
  if (!code){ alert("Digite o código da sala."); return; }
  if (!window.db){ alert("DB não inicializado. Confira o firebaseConfig no index.html."); return; }

  try{
    const snap = await roomRef(code).once("value");
    if (!snap.exists()){
      alert("Sala não encontrada. Confira o código.");
      return;
    }

    roomId = code;
    myRole = "p2";

    await roomRef(roomId + "/presence").update({ p2: Date.now() });

    // esconder botão copiar para convidados
    const copyBtn = document.getElementById("btn-copy-room");
    if (copyBtn) copyBtn.style.display = "none";

    state.mode = "2p"; // estética
    hideMenu();
    roundResultEl.textContent = "Conectado! Aguardando estado do host…";
    renderScores(); renderHands(); renderCenter();

    listenRoom();
  }catch(e){
    console.error("Erro ao entrar na sala:", e);
    alert("Erro ao entrar na sala: " + (e?.message || e));
  }
}

/* eventos do menu */
document.getElementById("menu-vs-cpu").addEventListener("click", ()=>{
  roomId=null; myRole="p1";
  const copyBtn=document.getElementById("btn-copy-room");
  if(copyBtn) copyBtn.style.display="none";
  hideMenu(); 
  initGame();
});
document.getElementById("menu-host").addEventListener("click", hostRoom);
document.getElementById("menu-join").addEventListener("click", joinRoom);

/* start: abre no menu */
showMenu();







