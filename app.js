const tg = window.Telegram.WebApp;
tg.expand();

// Настройка кнопки сброса
tg.SettingsButton.show();
tg.SettingsButton.onClick(() => {
    tg.showConfirm("Сбросить прогресс турнира?", (isConfirmed) => {
        if (isConfirmed) {
            localStorage.removeItem("tournament_bracket_state");
            if (tg.CloudStorage) tg.CloudStorage.removeItem("tournament_bracket_state");
            location.reload();
        }
    });
});

// Основная функция отрисовки, обернутая для вызова после готовности данных
function initTournament() {
    const STORAGE_KEY = "tournament_bracket_state";
    const wrapper = document.getElementById("wrapper");
    wrapper.innerHTML = ""; // Очистка при ререндере

    // --- ГЕОМЕТРИЯ С УЧЕТОМ SAFE AREA (ФИКС ДЛЯ REFRESH) ---
    const style = getComputedStyle(document.documentElement);
    
    // Пытаемся взять из CSS, если там 0 — берем из объекта tg (если доступен)
    const safeTop = parseFloat(style.getPropertyValue('--tg-safe-area-inset-top')) || (tg.safeAreaInset ? tg.safeAreaInset.top : 0);
    const contentSafeTop = parseFloat(style.getPropertyValue('--tg-content-safe-area-inset-top')) || (tg.contentSafeAreaInset ? tg.contentSafeAreaInset.top : 0);
    
    const totalSafeTop = safeTop + contentSafeTop;
    const vh = window.innerHeight / 100;
    const padding2vh = 2 * vh;

    const startY = totalSafeTop + padding2vh;
    const availableH = window.innerHeight - startY - padding2vh;

    const stepX = 260;
    const cardW = 200;
    let players = [];
    let matchData = {};

    const savedData = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (savedData) {
        players = savedData.players;
    } else {
        players = [...TOURNAMENT_PLAYERS];
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
    }

    const matchCountR1 = Math.ceil(players.length / 2);
    const stepY = availableH / matchCountR1;
    const cardH = Math.min(stepY * 0.75, 70); 

    function getCenterY(el) { return el.offsetTop + el.offsetHeight / 2; }

    function createMatch(x, y, aName, bName, isChampion, matchId) {
        const el = document.createElement("div");
        el.className = "glass-card";
        el.style.left = x + "px";
        el.style.height = cardH + "px";
        el.style.top = (y - cardH / 2) + "px";
        el.dataset.matchId = matchId;

        let contentA = aName || "None", contentB = bName || "None";
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
            const row2 = (bName === null) ? "" : `<div class="row" id="${matchId}-1" ${styleB}>${contentB}</div>`;
            el.innerHTML = `<div class="row" id="${matchId}-0" ${styleA}>${contentA}</div>${row2}`;
        }

        if (matchId !== "CHAMP") {
            el.onclick = () => {
                const p1 = document.getElementById(matchId + "-0")?.innerText;
                const p2 = document.getElementById(matchId + "-1")?.innerText;
                if (!p2 || p1 === "None" || p2 === "None") return;
                tg.showPopup({
                    title: 'Результат',
                    message: 'Кто победил?',
                    buttons: [{id:"p1", type:"default", text:p1}, {id:"p2", type:"default", text:p2}, {type:"cancel", text:"Отмена"}]
                }, (btn) => {
                    if (btn === "p1") setWinner(matchId, p1);
                    if (btn === "p2") setWinner(matchId, p2);
                });
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

        if (m.nextMatchId) {
            const target = document.getElementById(m.nextMatchId + "-" + m.nextSlot);
            target.innerText = name;
            target.style.color = "";
            if (m.nextMatchId === "CHAMP") target.classList.add("champion-text");
            const nextEl = document.querySelector(`[data-match-id="${m.nextMatchId}"]`);
            if (nextEl && nextEl.querySelectorAll('.row').length === 1 && m.nextMatchId !== "CHAMP") {
                setWinner(m.nextMatchId, name);
            }
        }
        
        const state = {};
        document.querySelectorAll('.row[id]').forEach(row => {
            state[row.id] = { text: row.innerText, color: row.style.color, isChamp: row.classList.contains('champion-text') };
        });
        const finalData = JSON.stringify({ players, cells: state });
        localStorage.setItem(STORAGE_KEY, finalData);
    }

    function drawLine(x, y, w, h) {
        const l = document.createElement("div");
        l.className = h > 2 ? "line v-line" : "line h-line";
        l.style.left = x + "px";
        l.style.top = h > 2 ? y + "px" : (y - 1) + "px";
        if (h > 2) l.style.height = h + "px"; else l.style.width = w + "px";
        wrapper.appendChild(l);
    }

    // Отрисовка
    let current = [];
    for (let i = 0; i < players.length; i += 2) {
        const mid = `r0m${i}`;
        const yPos = startY + (i/2 * stepY) + (stepY / 2);
        const el = createMatch(50, yPos, players[i], players[i+1] || null, false, mid);
        matchData[mid] = { el, nextMatchId: null, nextSlot: 0 };
        current.push({ el, x: 50, mid });
        if (!players[i+1] && !savedData) setTimeout(() => setWinner(mid, players[i]), 50);
    }

    let round = 1;
    while (current.length > 1) {
        const next = [];
        for (let i = 0; i < current.length; i += 2) {
            const A = current[i], B = current[i+1], mid = `r${round}m${i}`;
            const cA = getCenterY(A.el), cB = B ? getCenterY(B.el) : cA;
            const center = (cA + cB) / 2;
            const el = createMatch(50 + round * stepX, center, "None", B ? "None" : null, false, mid);
            matchData[mid] = { el, nextMatchId: null, nextSlot: 0 };
            
            const sX = A.x + cardW, mX = sX + 30, eX = 50 + round * stepX;
            drawLine(sX, cA, 30, 2);
            if (B) {
                drawLine(sX, cB, 30, 2);
                drawLine(mX, Math.min(cA, cB), 2, Math.abs(cA - cB));
            }
            drawLine(mX, center, (eX - mX), 2);

            matchData[A.mid].nextMatchId = mid; matchData[A.mid].nextSlot = 0;
            if (B) { matchData[B.mid].nextMatchId = mid; matchData[B.mid].nextSlot = 1; }
            next.push({ el, x: 50 + round * stepX, mid });
        }
        current = next; round++;
    }

    if (current.length === 1) {
        const A = current[0], mid = "CHAMP", center = getCenterY(A.el);
        const el = createMatch(50 + round * stepX, center, "None", null, true, mid);
        drawLine(A.x + cardW, center, 40, 2);
        matchData[A.mid].nextMatchId = mid; matchData[A.mid].nextSlot = 0;
    }
    
    wrapper.style.width = (50 + (round + 1) * stepX) + "px";
    wrapper.style.height = window.innerHeight + "px";
}

// Запуск с микро-задержкой, чтобы дать Telegram пробросить стили
window.addEventListener('load', () => {
    setTimeout(initTournament, 100); 
});

// Также перезапускаем, если Telegram изменил Safe Area (например, поворот экрана)
tg.onEvent('viewportChanged', () => {
    initTournament();
});
