const tg = window.Telegram.WebApp;
tg.expand();

// Настраиваем системную кнопку настроек
tg.SettingsButton.show();
tg.SettingsButton.onClick(() => {
    tg.showConfirm("Вы уверены, что хотите полностью сбросить прогресс турнира?", (isConfirmed) => {
        if (isConfirmed) {
            localStorage.removeItem("tournament_bracket_state");
            if (tg.CloudStorage) {
                tg.CloudStorage.removeItem("tournament_bracket_state");
            }
            tg.showAlert("Данные удалены. Приложение будет перезагружено.", () => {
                location.reload();
            });
        }
    });
});

document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "tournament_bracket_state";
    const wrapper = document.getElementById("wrapper");
    const stepX = 260;
    const stepY = 50;
    const cardW = 200;
    const lineHalf = 1;
    const offset = 0;

    let matchData = {}; 
    let players = [];

    // --- ЛОГИКА ХРАНЕНИЯ ---

    function saveState() {
        const state = {};
        document.querySelectorAll('.row[id]').forEach(row => {
            state[row.id] = {
                text: row.innerText,
                color: row.style.color,
                isChamp: row.classList.contains('champion-text')
            };
        });
        const dataToSave = JSON.stringify({
            players: players,
            cells: state
        });

        localStorage.setItem(STORAGE_KEY, dataToSave);
        if (tg.CloudStorage) {
            tg.CloudStorage.setItem(STORAGE_KEY, dataToSave);
        }
    }

    function loadState() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return null;
        return JSON.parse(saved);
    }

    // --- ИНИЦИАЛИЗАЦИЯ ДАННЫХ ---

    const savedData = loadState();

    if (savedData) {
        players = savedData.players;
    } else {
        // TOURNAMENT_PLAYERS берется из players.js
        players = [...TOURNAMENT_PLAYERS];
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
    }

    // --- ОТРИСОВКА ---

    function getCenterY(el) { return el.offsetTop + el.offsetHeight / 2; }

    function createMatch(x, y, aName, bName, isChampion=false, matchId) {
        const el = document.createElement("div");
        el.className = "glass-card";
        el.style.left = x + "px";
        el.style.top = y + "px";
        el.dataset.matchId = matchId;

        let contentA = aName;
        let contentB = bName;
        let styleA = "";
        let styleB = "";
        let classA = "";

        if (savedData && savedData.cells) {
            const sA = savedData.cells[`${matchId}-0`];
            const sB = savedData.cells[`${matchId}-1`];
            if (sA) {
                contentA = sA.text;
                styleA = `style="color: ${sA.color}"`;
                if (sA.isChamp) classA = "champion-text";
            }
            if (sB) {
                contentB = sB.text;
                styleB = `style="color: ${sB.color}"`;
            }
        }

        if (isChampion) {
            el.innerHTML = `
                <div class="row" style="font-size:10px; opacity:0.5;">ЧЕМПИОН</div>
                <div class="row ${classA}" id="${matchId}-0" ${styleA}>${contentA}</div>
            `;
        } else {
            const row2 = (bName === null) ? "" : `<div class="row" id="${matchId}-1" ${styleB}>${contentB}</div>`;
            el.innerHTML = `<div class="row" id="${matchId}-0" ${styleA}>${contentA}</div>${row2}`;
        }

        if (matchId !== "CHAMP") {
            el.onclick = () => openTelegramPopup(matchId);
        }

        wrapper.appendChild(el);
        return el;
    }

    function openTelegramPopup(id) {
        const p1El = document.getElementById(id + "-0");
        const p2El = document.getElementById(id + "-1");
        
        const p1 = p1El ? p1El.innerText : "None";
        const p2 = p2El ? p2El.innerText : "None";

        // 1. Если второго участника нет (технический проход в 1 раунде) - ничего не делаем
        if (!p2El) return;

        // 2. Если хотя бы один из участников "None", значит матч еще не готов
        if (p1 === "None" || p2 === "None") {
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
            return;
        }

        const buttons = [
            {id: "p1", type: "default", text: p1},
            {id: "p2", type: "default", text: p2},
            {type: "cancel", text: "Отмена"}
        ];

        tg.showPopup({
            title: 'Результат матча',
            message: `Кто одержал победу и проходит дальше?`,
            buttons: buttons
        }, (buttonId) => {
            if (buttonId === "p1") setWinner(id, p1);
            if (buttonId === "p2") setWinner(id, p2);
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
            target.style.color = ""; // Сбрасываем цвет в следующей ячейке

            if (m.nextMatchId === "CHAMP") {
                target.classList.add("champion-text");
                if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            }

            // Авто-переход, если в следующей карточке только одно место (финал или бай-раунды)
            const nextMatchEl = document.querySelector(`[data-match-id="${m.nextMatchId}"]`);
            if (nextMatchEl && nextMatchEl.querySelectorAll('.row').length === 1 && m.nextMatchId !== "CHAMP") {
                setWinner(m.nextMatchId, name);
            }
        }
        saveState();
    }

    function drawH(x, y, w) {
        const l = document.createElement("div");
        l.className = "line h-line";
        l.style.left = x + "px"; l.style.top = (y - lineHalf) + "px";
        l.style.width = w + "px"; wrapper.appendChild(l);
    }

    function drawV(x, y, h) {
        const l = document.createElement("div");
        l.className = "line v-line";
        l.style.left = (x - lineHalf) + "px"; l.style.top = y + "px";
        l.style.height = h + "px"; wrapper.appendChild(l);
    }

    function run(list) {
        let round = 0;
        let current = [];

        // Первый раунд
        for (let i = 0; i < list.length; i += 2) {
            const a = list[i];
            const b = list[i+1] || null;
            const mid = `r${round}m${i}`;
            const el = createMatch(offset, i * stepY, a, b, false, mid);
            matchData[mid] = { el, nextMatchId: null, nextSlot: 0 };
            current.push({ el, x: offset, mid });
            
            // Если оппонента нет, игрок сразу побеждает
            if (b === null && !savedData) {
                setTimeout(() => setWinner(mid, a), 50);
            }
        }

        round++;
        while (current.length > 1) {
            const next = [];
            for (let i = 0; i < current.length; i += 2) {
                const A = current[i]; const B = current[i + 1];
                const mid = `r${round}m${i}`;
                const el = createMatch(offset + round * stepX, 0, "None", B ? "None" : null, false, mid);
                matchData[mid] = { el, nextMatchId: null, nextSlot: 0 };
                
                const cA = getCenterY(A.el); 
                const cB = B ? getCenterY(B.el) : cA;
                const center = (cA + cB) / 2;
                
                el.style.top = (center - el.offsetHeight / 2) + "px";
                
                const sX = A.x + cardW; const mX = sX + 30; const eX = offset + round * stepX;
                drawH(sX, cA, 30);
                if (B) { 
                    drawH(sX, cB, 30); 
                    drawV(mX, Math.min(cA, cB), Math.abs(cA - cB)); 
                }
                drawH(mX, center, eX - mX);
                
                matchData[A.mid].nextMatchId = mid; matchData[A.mid].nextSlot = 0;
                if (B) { matchData[B.mid].nextMatchId = mid; matchData[B.mid].nextSlot = 1; }
                next.push({ el, x: offset + round * stepX, mid });
            }
            current = next;
            round++;
        }

        // Карточка чемпиона
        if (current.length === 1) {
            const A = current[0]; const mid = "CHAMP";
            const el = createMatch(offset + round * stepX, 0, "None", null, true, mid);
            const center = getCenterY(A.el);
            el.style.top = (center - el.offsetHeight / 2) + "px";
            drawH(A.x + cardW, center, 60);
            matchData[mid] = { el, nextMatchId: null, nextSlot: 0 };
            matchData[A.mid].nextMatchId = mid; matchData[A.mid].nextSlot = 0;
        }
    }

    function updateWrapperSize() {
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
        const items = document.querySelectorAll(".glass-card, .line");
        if(items.length === 0) return;

        items.forEach(el => {
            minX = Math.min(minX, el.offsetLeft); minY = Math.min(minY, el.offsetTop);
            maxX = Math.max(maxX, el.offsetLeft + el.offsetWidth); maxY = Math.max(maxY, el.offsetTop + el.offsetHeight);
        });
        const p = 50;
        items.forEach(el => {
            el.style.left = (el.offsetLeft + (p - minX)) + "px";
            el.style.top = (el.offsetTop + (p - minY)) + "px";
        });
        wrapper.style.width = (maxX - minX + p * 2) + "px";
        wrapper.style.height = (maxY - minY + p * 2) + "px";
    }

    run(players);
    requestAnimationFrame(updateWrapperSize);
});
