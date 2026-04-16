const tg = window.Telegram.WebApp;
tg.expand();

tg.SettingsButton.show();
tg.SettingsButton.onClick(() => {
    tg.showConfirm("Вы уверены, что хотите сбросить прогресс турнира?", (isConfirmed) => {
        if (isConfirmed) {
            localStorage.removeItem("tournament_bracket_state");
            location.reload();
        }
    });
});

document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "tournament_bracket_state";
    const wrapper = document.getElementById("wrapper");
    
    // --- ГЕОМЕТРИЯ ЭКРАНА С УЧЕТОМ SAFE AREA ---
    // Читаем значения отступов, которые прописал Telegram
    const style = getComputedStyle(document.documentElement);
    const safeTop = parseFloat(style.getPropertyValue('--tg-safe-area-inset-top')) || 0;
    const contentSafeTop = parseFloat(style.getPropertyValue('--tg-content-safe-area-inset-top')) || 0;
    const totalSafeOffset = safeTop + contentSafeTop;

    const vh = window.innerHeight / 100;
    const paddingT = 2 * vh; // 2vh сверху
    const paddingB = 2 * vh; // 2vh снизу
    
    // Доступная высота для сетки (минус безопасная зона и наши отступы)
    const availableH = window.innerHeight - totalSafeOffset - paddingT - paddingB;

    const stepX = 260; // Расстояние между раундами по горизонтали
    const cardW = 200; // Ширина карточки
    
    let players = [];
    let matchData = {};

    function saveState() {
        const state = {};
        document.querySelectorAll('.row[id]').forEach(row => {
            state[row.id] = {
                text: row.innerText,
                color: row.style.color,
                isChamp: row.classList.contains('champion-text')
            };
        });
        const dataToSave = JSON.stringify({ players, cells: state });
        localStorage.setItem(STORAGE_KEY, dataToSave);
    }

    const savedData = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (savedData) {
        players = savedData.players;
    } else {
        players = [...TOURNAMENT_PLAYERS]; // Массив из players.js
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
    }

    // Расчет высоты карточек и шага
    const matchCountR1 = Math.ceil(players.length / 2);
    const stepY = availableH / matchCountR1; 
    const cardH = Math.min(stepY * 0.75, 70); // Высота карточки (макс 70px для эстетики)

    function getCenterY(el) { return el.offsetTop + el.offsetHeight / 2; }

    function createMatch(x, y, aName, bName, isChampion=false, matchId) {
        const el = document.createElement("div");
        el.className = "glass-card";
        el.style.left = x + "px";
        el.style.top = (y - cardH / 2) + "px"; // Центрируем по расчетной точке
        el.style.height = cardH + "px";
        el.dataset.matchId = matchId;

        let contentA = aName, contentB = bName, styleA = "", styleB = "", classA = "";

        if (savedData?.cells) {
            const sA = savedData.cells[`${matchId}-0`];
            const sB = savedData.cells[`${matchId}-1`];
            if (sA) { contentA = sA.text; styleA = `style="color: ${sA.color}"`; if (sA.isChamp) classA = "champion-text"; }
            if (sB) { contentB = sB.text; styleB = `style="color: ${sB.color}"`; }
        }

        if (isChampion) {
            el.innerHTML = `
                <div class="row" style="font-size:9px; opacity:0.5; flex:0.4;">ЧЕМПИОН</div>
                <div class="row ${classA}" id="${matchId}-0" ${styleA}>${contentA}</div>
            `;
        } else {
            const row2 = (bName === null) ? "" : `<div class="row" id="${matchId}-1" ${styleB}>${contentB}</div>`;
            el.innerHTML = `<div class="row" id="${matchId}-0" ${styleA}>${contentA}</div>${row2}`;
        }

        if (matchId !== "CHAMP") el.onclick = () => openPopup(matchId);
        wrapper.appendChild(el);
        return el;
    }

    function openPopup(id) {
        const p1 = document.getElementById(id + "-0")?.innerText;
        const p2 = document.getElementById(id + "-1")?.innerText;
        if (!p2 || p1 === "None" || p2 === "None") return;

        tg.showPopup({
            title: 'Результат матча',
            message: 'Выберите победителя:',
            buttons: [
                {id: "p1", type: "default", text: p1}, 
                {id: "p2", type: "default", text: p2}, 
                {type: "cancel", text: "Отмена"}
            ]
        }, (btn) => {
            if (btn === "p1") setWinner(id, p1);
            if (btn === "p2") setWinner(id, p2);
        });
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
        saveState();
    }

    function drawLineH(x, y, w) {
        const l = document.createElement("div");
        l.className = "line h-line";
        l.style.left = x + "px"; l.style.top = y + "px";
        l.style.width = w + "px"; wrapper.appendChild(l);
    }

    function drawLineV(x, y, h) {
        const l = document.createElement("div");
        l.className = "line v-line";
        l.style.left = x + "px"; l.style.top = y + "px";
        l.style.height = h + "px"; wrapper.appendChild(l);
    }

    function run(list) {
        let current = [];
        // Раунд 1
        for (let i = 0; i < list.length; i += 2) {
            const a = list[i], b = list[i+1] || null;
            const mid = `r0m${i}`;
            // Центрируем карточку внутри выделенного ей сегмента по высоте
            const yPos = paddingT + (i/2 * stepY) + (stepY / 2);
            const el = createMatch(50, yPos, a, b, false, mid);
            matchData[mid] = { el, nextMatchId: null, nextSlot: 0 };
            current.push({ el, x: 50, mid });
            if (b === null && !savedData) setTimeout(() => setWinner(mid, a), 50);
        }

        let round = 1;
        while (current.length > 1) {
            const next = [];
            for (let i = 0; i < current.length; i += 2) {
                const A = current[i], B = current[i+1];
                const mid = `r${round}m${i}`;
                const cA = getCenterY(A.el), cB = B ? getCenterY(B.el) : cA;
                const center = (cA + cB) / 2;

                const el = createMatch(50 + round * stepX, center, "None", B ? "None" : null, false, mid);
                matchData[mid] = { el, nextMatchId: null, nextSlot: 0 };

                const sX = A.x + cardW, mX = sX + 30, eX = 50 + round * stepX;
                drawLineH(sX, cA, 30);
                if (B) { 
                    drawLineH(sX, cB, 30); 
                    drawLineV(mX, Math.min(cA, cB), Math.abs(cA - cB)); 
                }
                drawLineH(mX, center, eX - mX);

                matchData[A.mid].nextMatchId = mid; matchData[A.mid].nextSlot = 0;
                if (B) { matchData[B.mid].nextMatchId = mid; matchData[B.mid].nextSlot = 1; }
                next.push({ el, x: 50 + round * stepX, mid });
            }
            current = next; round++;
        }

        if (current.length === 1) {
            const A = current[0], mid = "CHAMP", center = getCenterY(A.el);
            const el = createMatch(50 + round * stepX, center, "None", null, true, mid);
            drawLineH(A.x + cardW, center, 40);
            matchData[A.mid].nextMatchId = mid; matchData[A.mid].nextSlot = 0;
        }
        
        // Устанавливаем итоговую высоту контейнера для корректного скролла
        wrapper.style.width = (50 + (round + 1) * stepX) + "px";
        wrapper.style.height = (availableH + paddingT + paddingB) + "px";
    }

    run(players);
});
