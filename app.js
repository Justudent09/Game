const tg = window.Telegram.WebApp;
tg.expand();

// Настройка кнопки сброса (Проверка на наличие метода для браузера)
if (tg.SettingsButton) {
    tg.SettingsButton.show();
    tg.SettingsButton.onClick(() => {
        const resetAction = () => {
            localStorage.removeItem("tournament_bracket_state");
            location.reload();
        };
        
        if (tg.showConfirm) {
            tg.showConfirm("Сбросить прогресс турнира?", (ok) => { if(ok) resetAction(); });
        } else if (confirm("Сбросить прогресс турнира?")) {
            resetAction();
        }
    });
}

function initTournament() {
    const STORAGE_KEY = "tournament_bracket_state";
    const wrapper = document.getElementById("wrapper");
    wrapper.innerHTML = ""; 

    // Расчет отступов Safe Area
    const style = getComputedStyle(document.documentElement);
    const safeTop = parseFloat(style.getPropertyValue('--tg-safe-area-inset-top')) || (tg.safeAreaInset ? tg.safeAreaInset.top : 0);
    const contentSafeTop = parseFloat(style.getPropertyValue('--tg-content-safe-area-inset-top')) || (tg.contentSafeAreaInset ? tg.contentSafeAreaInset.top : 0);

    const totalSafeTop = safeTop + contentSafeTop;
    const vh = window.innerHeight / 100;
    const paddingVal = 4 * vh; // Небольшой отступ сверху/снизу
    const startY = totalSafeTop + paddingVal;

    // Параметры игроков и сетки
    const total = (typeof TOURNAMENT_PLAYERS !== 'undefined') ? TOURNAMENT_PLAYERS.length : 0;
    if (total === 0) return;

    const power = Math.pow(2, Math.floor(Math.log2(total - 0.1)));
    const matchCountR1 = power / 2;
    
    // Динамическое масштабирование по высоте
    const availableH = window.innerHeight - startY - paddingVal;
    const stepY = Math.max(availableH / matchCountR1, 90); 
    const cardH = Math.min(stepY * 0.7, 64); 

    const stepX = 260;
    const cardW = 200;

    let players = [];
    let matchData = {};

    const savedData = JSON.parse(localStorage.getItem(STORAGE_KEY));
    players = savedData ? savedData.players : [...TOURNAMENT_PLAYERS];

    function createMatch(x, y, aName, bName, isChampion, matchId) {
        const el = document.createElement("div");
        el.className = "glass-card";
        el.style.left = x + "px";
        el.style.height = cardH + "px";
        el.style.top = (y - cardH / 2) + "px";
        el.dataset.matchId = matchId;

        let contentA = aName || "???", contentB = bName || "???";
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
                if (p1 === "???" || p2 === "???") return;

                // Проверка: мы в Telegram или в браузере?
                const isTelegram = window.Telegram && tg.initData !== "";

                if (isTelegram && tg.showPopup) {
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
                    const win = confirm(`Победил ${p1}?\n\nОК — ${p1}\nОтмена — ${p2}`);
                    setWinner(matchId, win ? p1 : p2);
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

    // ЛОГИКА СЕТКИ
    const numPrelims = total - power;
    let pIdx = 0;
    let currentLevel = [];
    const r0_X = stepX + 50;

    // Раунд 0 и Отборочные
    for (let i = 0; i < power / 2; i++) {
        const mid = `r0m${i}`;
        matchData[mid] = { nextMatchId: null, nextSlot: 0 };
        const y = startY + (i * stepY) + (stepY / 2);
        
        const p1 = i < numPrelims ? "???" : players[numPrelims * 2 + (pIdx++)];
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

    // Последующие раунды
    let round = 1;
    while (currentLevel.length > 1) {
        let nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const mid = `r${round}m${i}`;
            matchData[mid] = { nextMatchId: null, nextSlot: 0 };
            const m1 = currentLevel[i], m2 = currentLevel[i+1];
            const y1 = m1.el.offsetTop + cardH/2;
            const y2 = m2.el.offsetTop + cardH/2;
            const y = (y1 + y2) / 2;
            
            const el = createMatch(r0_X + (stepX * round), y, "???", "???", false, mid);
            
            matchData[m1.id].nextMatchId = mid; matchData[m1.id].nextSlot = 0;
            matchData[m2.id].nextMatchId = mid; matchData[m2.id].nextSlot = 1;
            
            drawStepLine(m1.el.offsetLeft + cardW, y1, el.offsetLeft, y - (cardH / 4));
            drawStepLine(m2.el.offsetLeft + cardW, y2, el.offsetLeft, y + (cardH / 4));

            nextLevel.push({ el, id: mid });
        }
        currentLevel = nextLevel;
        round++;
    }

    // Финал -> Чемпион
    if (currentLevel.length === 1) {
        const last = currentLevel[0];
        const mid = "CHAMP";
        const y = last.el.offsetTop + cardH/2;
        createMatch(r0_X + (stepX * round), y, "???", null, true, mid);
        matchData[last.id].nextMatchId = mid;
        matchData[last.id].nextSlot = 0;
        
        const l = document.createElement("div");
        l.className = "line";
        l.style.left = (last.el.offsetLeft + cardW) + "px";
        l.style.top = y + "px";
        l.style.width = (stepX - cardW) + "px";
        l.style.height = "2px";
        wrapper.appendChild(l);
    }

    wrapper.style.width = (r0_X + (round + 1) * stepX + 100) + "px";
    wrapper.style.height = (startY + (power/2) * stepY + 100) + "px";
}

// Запуск
window.addEventListener('load', () => {
    setTimeout(initTournament, 200); 
});

tg.onEvent('viewportChanged', () => {
    initTournament();
});
