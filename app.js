const tg = window.Telegram.WebApp;
tg.expand();

// Общая логика сброса
function triggerReset() {
    const performReset = () => {
        localStorage.removeItem("tournament_bracket_state");
        location.reload();
    };

    if (window.Telegram && tg.initData !== "" && tg.showConfirm) {
        tg.showConfirm("Сбросить весь прогресс турнира?", (ok) => { if(ok) performReset(); });
    } else {
        if (confirm("Создать новую турнирную сетку?")) performReset();
    }
}

// Показ кнопок сброса в зависимости от среды
if (window.Telegram && tg.initData !== "" && tg.SettingsButton) {
    tg.SettingsButton.show();
    tg.SettingsButton.onClick(triggerReset);
} else {
    const btn = document.getElementById('browser-reset-btn');
    if (btn) btn.style.display = 'block';
}

function closeBrowserModal() {
    document.getElementById('custom-modal').style.display = 'none';
}

function initTournament() {
    const STORAGE_KEY = "tournament_bracket_state";
    const wrapper = document.getElementById("wrapper");
    wrapper.innerHTML = ""; 

    const style = getComputedStyle(document.documentElement);
    const safeTop = parseFloat(style.getPropertyValue('--tg-safe-area-inset-top')) || (tg.safeAreaInset ? tg.safeAreaInset.top : 0);
    const contentSafeTop = parseFloat(style.getPropertyValue('--tg-content-safe-area-inset-top')) || (tg.contentSafeAreaInset ? tg.contentSafeAreaInset.top : 0);

    const isBrowser = !(window.Telegram && tg.initData !== "");
    const topMargin = isBrowser ? 50 : 0; 

    const totalSafeTop = safeTop + contentSafeTop + topMargin;
    const vh = window.innerHeight / 100;
    const startY = totalSafeTop + (4 * vh);

    const total = (typeof TOURNAMENT_PLAYERS !== 'undefined') ? TOURNAMENT_PLAYERS.length : 0;
    if (total === 0) return;

    // --- ЛОГИКА РАНДОМА И ЗАГРУЗКИ ---
    const savedData = JSON.parse(localStorage.getItem(STORAGE_KEY));
    let players;

    if (savedData && savedData.players) {
        // Если есть сохраненный порядок — используем его
        players = savedData.players;
    } else {
        // Если данных нет — создаем новый рандомный порядок
        players = [...TOURNAMENT_PLAYERS];
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
        // Сразу сохраняем структуру, чтобы рандом не пересчитывался при ресайзе
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ players: players, cells: {} }));
    }
    // --------------------------------

    const power = Math.pow(2, Math.floor(Math.log2(total - 0.1)));
    const matchCountR1 = power / 2;
    const availableH = window.innerHeight - startY - (4 * vh);
    const stepY = Math.max(availableH / matchCountR1, 90); 
    const cardH = Math.min(stepY * 0.7, 64); 

    const stepX = 260;
    const cardW = 200;

    let matchData = {};

    function createMatch(x, y, aName, bName, isChampion, matchId) {
        const el = document.createElement("div");
        el.className = "glass-card";
        el.style.left = x + "px";
        el.style.height = cardH + "px";
        el.style.top = (y - cardH / 2) + "px";

        let contentA = aName || "❓", contentB = bName || "❓";
        let styleA = "", styleB = "", classA = "";

        if (savedData?.cells) {
            const sA = savedData.cells[`${matchId}-0`];
            const sB = savedData.cells[`${matchId}-1`];
            if (sA) { contentA = sA.text; styleA = `style="color: ${sA.color}"`; if (sA.isChamp) classA = "champion-text"; }
            if (sB) { contentB = sB.text; styleB = `style="color: ${sB.color}"`; }
        }

        if (isChampion) {
            el.innerHTML = `<div class="row" style="font-size:9px; opacity:0.5; flex:0.4;">ЧЕМПИОН</div>
                            <div class="row ${classA}" id="${matchId}-0" ${styleA}>${contentA}</div>`;
        } else {
            el.innerHTML = `<div class="row" id="${matchId}-0" ${styleA}>${contentA}</div>
                            <div class="row" id="${matchId}-1" ${styleB}>${contentB}</div>`;
        }

        if (matchId !== "CHAMP") {
            el.onclick = () => {
                const p1 = document.getElementById(matchId + "-0")?.innerText;
                const p2 = document.getElementById(matchId + "-1")?.innerText;
                if (p1 === "❓" || p2 === "❓") return;

                if (window.Telegram && tg.initData !== "" && tg.showPopup) {
                    tg.showPopup({ 
                        title: 'Победитель', 
                        message: 'Кто проходит дальше?', 
                        buttons: [
                            {id:"p1", type:"default", text:p1},
                            {id:"p2", type:"default", text:p2},
                            {type:"cancel", text:"Отмена"}
                        ] 
                    }, (btn) => {
                        if (btn === "p1") setWinner(matchId, p1);
                        if (btn === "p2") setWinner(matchId, p2);
                    });
                } else {
                    const modal = document.getElementById('custom-modal');
                    const container = document.getElementById('modal-buttons-container');
                    container.innerHTML = "";
                    [p1, p2].forEach(name => {
                        const btn = document.createElement('button');
                        btn.className = 'modal-btn';
                        btn.innerText = name;
                        btn.onclick = () => { setWinner(matchId, name); closeBrowserModal(); };
                        container.appendChild(btn);
                    });
                    modal.style.display = 'flex';
                }
            };
        }
        wrapper.appendChild(el);
        return el;
    }

    function setWinner(matchId, name) {
        const m = matchData[matchId];
        const p1El = document.getElementById(matchId + "-0");
        const p2El = document.getElementById(matchId + "-1");
        if (p1El) p1El.style.color = (p1El.innerText === name) ? "#44ff44" : "#ff4444";
        if (p2El) p2El.style.color = (p2El.innerText === name) ? "#44ff44" : "#ff4444";

        if (m && m.nextMatchId) {
            const target = document.getElementById(m.nextMatchId + "-" + m.nextSlot);
            if (target) {
                target.innerText = name;
                target.style.color = "";
                if (m.nextMatchId === "CHAMP") target.classList.add("champion-text");
            }
        }
        const state = {};
        document.querySelectorAll('.row[id]').forEach(row => {
            state[row.id] = { text: row.innerText, color: row.style.color, isChamp: row.classList.contains('champion-text') };
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, cells: state }));
    }

    function drawStepLine(x1, y1, x2, y2) {
        const midX = x1 + (x2 - x1) / 2;
        const createL = (x, y, w, h) => {
            const l = document.createElement("div");
            l.className = "line";
            l.style.left = x + "px"; l.style.top = y + "px";
            l.style.width = (w || 2) + "px"; l.style.height = (h || 2) + "px";
            wrapper.appendChild(l);
        };
        createL(x1, y1, midX - x1, 2);
        createL(midX, Math.min(y1, y2), 2, Math.abs(y1 - y2) + 2);
        createL(midX, y2, x2 - midX, 2);
    }

    const numPrelims = total - power;
    let pIdx = 0;
    let currentLevel = [];
    const r0_X = stepX + 50;

    for (let i = 0; i < power / 2; i++) {
        const mid = `r0m${i}`;
        matchData[mid] = { nextMatchId: null, nextSlot: 0 };
        const y = startY + (i * stepY) + (stepY / 2);
        const p1 = i < numPrelims ? "❓" : players[numPrelims * 2 + (pIdx++)];
        const p2 = players[numPrelims * 2 + (pIdx++)];
        const el = createMatch(r0_X, y, p1, p2, false, mid);
        currentLevel.push({ el, id: mid });

        if (i < numPrelims) {
            const preMid = `pre-${i}`;
            matchData[preMid] = { nextMatchId: mid, nextSlot: 0 };
            createMatch(50, y, players[i*2], players[i*2+1], false, preMid);
            drawStepLine(50 + cardW, y, r0_X, y - (cardH / 4));
        }
    }

    let round = 1;
    while (currentLevel.length > 1) {
        let nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const mid = `r${round}m${i}`;
            matchData[mid] = { nextMatchId: null, nextSlot: 0 };
            const m1 = currentLevel[i], m2 = currentLevel[i+1];
            const y1 = m1.el.offsetTop + cardH/2, y2 = m2.el.offsetTop + cardH/2;
            const y = (y1 + y2) / 2;
            const el = createMatch(r0_X + (stepX * round), y, "❓", "❓", false, mid);
            matchData[m1.id].nextMatchId = mid; matchData[m1.id].nextSlot = 0;
            matchData[m2.id].nextMatchId = mid; matchData[m2.id].nextSlot = 1;
            drawStepLine(m1.el.offsetLeft + cardW, y1, el.offsetLeft, y - (cardH / 4));
            drawStepLine(m2.el.offsetLeft + cardW, y2, el.offsetLeft, y + (cardH / 4));
            nextLevel.push({ el, id: mid });
        }
        currentLevel = nextLevel; round++;
    }

    if (currentLevel.length === 1) {
        const last = currentLevel[0], mid = "CHAMP";
        const y = last.el.offsetTop + cardH/2;
        createMatch(r0_X + (stepX * round), y, "❓", null, true, mid);
        matchData[last.id].nextMatchId = mid; matchData[last.id].nextSlot = 0;
        const l = document.createElement("div");
        l.className = "line";
        l.style.left = (last.el.offsetLeft + cardW) + "px";
        l.style.top = y + "px"; l.style.width = (stepX - cardW) + "px";
        l.style.height = "2px"; wrapper.appendChild(l);
    }
    wrapper.style.width = (r0_X + (round + 1) * stepX) + "px";
    wrapper.style.height = (startY + (power/2) * stepY) + "px";
}

window.addEventListener('load', () => setTimeout(initTournament, 200));
tg.onEvent('viewportChanged', initTournament);
