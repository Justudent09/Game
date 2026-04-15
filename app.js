// app.js
const tg = window.Telegram.WebApp;
tg.expand();

document.addEventListener("DOMContentLoaded", () => {
    // Берём список из players.js
    let players = [...TOURNAMENT_PLAYERS];

    // Перемешивание списка
    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
    }

    const stepX = 260;
    const stepY = 50;
    const cardW = 200;
    const lineHalf = 1;
    const wrapper = document.getElementById("wrapper");
    const offset = 0;

    let matchData = {}; 

    function getCenterY(el) { return el.offsetTop + el.offsetHeight / 2; }

    function createMatch(x, y, aName, bName, isChampion=false, matchId) {
        const el = document.createElement("div");
        el.className = "glass-card";
        el.style.left = x + "px";
        el.style.top = y + "px";
        el.dataset.matchId = matchId;

        if (isChampion) {
            el.innerHTML = `
                <div class="row" style="font-size:10px; opacity:0.5;">ЧЕМПИОН</div>
                <div class="row" id="${matchId}-0">${aName}</div>
            `;
        } else if (bName === null) {
            el.innerHTML = `<div class="row" id="${matchId}-0">${aName}</div>`;
        } else {
            el.innerHTML = `
                <div class="row" id="${matchId}-0">${aName}</div>
                <div class="row" id="${matchId}-1">${bName}</div>
            `;
        }

        // На чемпиона нажать нельзя
        if (matchId !== "CHAMP") {
            el.onclick = () => openTelegramPopup(matchId);
        }
        
        wrapper.appendChild(el);
        return el;
    }

    function openTelegramPopup(id) {
        const p1 = document.getElementById(id + "-0").innerText;
        const p2 = document.getElementById(id + "-1")?.innerText;

        if (p1 === "None" && (!p2 || p2 === "None")) return;

        const buttons = [];
        if (p1 && p1 !== "None") buttons.push({id: "p1", type: "default", text: p1});
        if (p2 && p2 !== "None") buttons.push({id: "p2", type: "default", text: p2});
        buttons.push({type: "cancel"});

        tg.showPopup({
            title: 'Результат матча',
            message: 'Кто проходит дальше?',
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

        // Подсветка победителя/проигравшего
        if (p1El) p1El.style.color = (p1El.innerText === name) ? "#44ff44" : "#ff4444";
        if (p2El) p2El.style.color = (p2El.innerText === name) ? "#44ff44" : "#ff4444";

        if (m.nextMatchId) {
            const target = document.getElementById(m.nextMatchId + "-" + m.nextSlot);
            target.innerText = name;
            
            // Если это блок чемпиона — делаем золотым
            if (m.nextMatchId === "CHAMP") {
                target.classList.add("champion-text");
            }

            // Авто-проход для нечетных матчей (но не чемпиона)
            const nextMatchEl = document.querySelector(`[data-match-id="${m.nextMatchId}"]`);
            if (nextMatchEl && nextMatchEl.querySelectorAll('.row').length === 1 && m.nextMatchId !== "CHAMP") {
                setWinner(m.nextMatchId, name);
            }
        }
    }

    function drawH(x, y, w) {
        const l = document.createElement("div");
        l.className = "line h-line";
        l.style.left = x + "px";
        l.style.top = (y - lineHalf) + "px";
        l.style.width = w + "px";
        wrapper.appendChild(l);
    }

    function drawV(x, y, h) {
        const l = document.createElement("div");
        l.className = "line v-line";
        l.style.left = (x - lineHalf) + "px";
        l.style.top = y + "px";
        l.style.height = h + "px";
        wrapper.appendChild(l);
    }

    function run(list) {
        let round = 0;
        let current = [];

        // Раунд 1
        for (let i = 0; i < list.length; i += 2) {
            const a = list[i];
            const b = list[i+1] || null;
            const mid = `r${round}m${i}`;
            const el = createMatch(offset, i * stepY, a, b, false, mid);
            matchData[mid] = { el, nextMatchId: null, nextSlot: 0 };
            current.push({ el, x: offset, mid });
            if (b === null) setTimeout(() => setWinner(mid, a), 50);
        }

        round++;
        while (current.length > 1) {
            const next = [];
            for (let i = 0; i < current.length; i += 2) {
                const A = current[i];
                const B = current[i + 1];
                const mid = `r${round}m${i}`;
                const el = createMatch(offset + round * stepX, 0, "None", B ? "None" : null, false, mid);
                matchData[mid] = { el, nextMatchId: null, nextSlot: 0 };
                const centerA = getCenterY(A.el);
                const centerB = B ? getCenterY(B.el) : centerA;
                const center = (centerA + centerB) / 2;
                el.style.top = (center - el.offsetHeight / 2) + "px";
                const startX = A.x + cardW;
                const midX = startX + 30;
                const endX = offset + round * stepX;
                drawH(startX, centerA, 30);
                if (B) {
                    drawH(startX, centerB, 30);
                    drawV(midX, Math.min(centerA, centerB), Math.abs(centerA - centerB));
                }
                drawH(midX, center, endX - midX);
                matchData[A.mid].nextMatchId = mid;
                matchData[A.mid].nextSlot = 0;
                if (B) {
                    matchData[B.mid].nextMatchId = mid;
                    matchData[B.mid].nextSlot = 1;
                }
                next.push({ el, x: offset + round * stepX, mid });
            }
            current = next;
            round++;
        }

        // Финальный блок чемпиона
        if (current.length === 1) {
            const A = current[0];
            const mid = "CHAMP";
            const el = createMatch(offset + round * stepX, 0, "None", null, true, mid);
            const center = getCenterY(A.el);
            el.style.top = (center - el.offsetHeight / 2) + "px";
            drawH(A.x + cardW, center, 60);
            matchData[mid] = { el, nextMatchId: null, nextSlot: 0 };
            matchData[A.mid].nextMatchId = mid;
            matchData[A.mid].nextSlot = 0;
        }
    }

    function updateWrapperSize() {
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
        const elements = document.querySelectorAll(".glass-card, .line");
        elements.forEach(el => {
            const x = el.offsetLeft, y = el.offsetTop;
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + el.offsetWidth); maxY = Math.max(maxY, y + el.offsetHeight);
        });
        const padding = 50;
        const shiftX = padding - minX, shiftY = padding - minY;
        elements.forEach(el => {
            el.style.left = (el.offsetLeft + shiftX) + "px";
            el.style.top = (el.offsetTop + shiftY) + "px";
        });
        wrapper.style.width = (maxX - minX + padding * 2) + "px";
        wrapper.style.height = (maxY - minY + padding * 2) + "px";
    }

    run(players);
    requestAnimationFrame(updateWrapperSize);
});
