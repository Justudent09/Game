const tg = window.Telegram.WebApp;
tg.expand();

document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "tournament_bracket_state";
    const wrapper = document.getElementById("wrapper");

    // 1. ПОЛУЧАЕМ ПАРАМЕТРЫ ОКНА И SAFE AREA
    const style = getComputedStyle(document.documentElement);
    // Складываем все системные отступы сверху
    const safeAreaTop = (parseFloat(style.getPropertyValue('--tg-content-safe-area-inset-top')) || 0) + 
                       (parseFloat(style.getPropertyValue('--tg-safe-area-inset-top')) || 0);
    
    const vh = window.innerHeight / 100;
    const padding2vh = 2 * vh;

    // Итоговый отступ сверху, который нужно ПЕРЕШАГНУТЬ
    const startY = safeAreaTop + padding2vh;
    // Доступная чистая высота (отнимаем safeAreaTop и 2vh сверху, и 2vh снизу)
    const availableH = window.innerHeight - startY - padding2vh;

    const stepX = 260;
    const cardW = 200;
    let players = [];
    let matchData = {};

    // 2. ДАННЫЕ
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

    // 3. РАСЧЕТ ВЕРТИКАЛИ
    const matchCountR1 = Math.ceil(players.length / 2);
    // Шаг вычисляется строго из доступного остатка высоты
    const stepY = availableH / matchCountR1;
    // Высота карточки адаптируется под плотность сетки
    const cardH = Math.min(stepY * 0.7, 65); 

    function getCenterY(el) { return el.offsetTop + el.offsetHeight / 2; }

    function createMatch(x, y, aName, bName, isChampion, matchId) {
        const el = document.createElement("div");
        el.className = "glass-card";
        el.style.left = x + "px";
        el.style.height = cardH + "px";
        el.style.top = (y - cardH / 2) + "px";
        el.dataset.matchId = matchId;

        let contentA = aName, contentB = bName, styleA = "", styleB = "", classA = "";
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
                    title: 'Победитель',
                    message: 'Кто проходит дальше?',
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
        // Сохранение
        const state = {};
        document.querySelectorAll('.row[id]').forEach(row => {
            state[row.id] = { text: row.innerText, color: row.style.color, isChamp: row.classList.contains('champion-text') };
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, cells: state }));
    }

    function run(list) {
        let current = [];
        // Первый раунд: Y координата стартует от startY
        for (let i = 0; i < list.length; i += 2) {
            const mid = `r0m${i}`;
            const yPos = startY + (i/2 * stepY) + (stepY / 2);
            const el = createMatch(50, yPos, list[i], list[i+1] || null, false, mid);
            matchData[mid] = { el, nextMatchId: null, nextSlot: 0 };
            current.push({ el, x: 50, mid });
            if (!list[i+1] && !savedData) setTimeout(() => setWinner(mid, list[i]), 50);
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
                const lh1 = document.createElement("div"); lh1.className="line h-line"; lh1.style.left=sX+"px"; lh1.style.top=cA+"px"; lh1.style.width="30px"; wrapper.appendChild(lh1);
                if (B) {
                    const lh2 = document.createElement("div"); lh2.className="line h-line"; lh2.style.left=sX+"px"; lh2.style.top=cB+"px"; lh2.style.width="30px"; wrapper.appendChild(lh2);
                    const lv = document.createElement("div"); lv.className="line v-line"; lv.style.left=mX+"px"; lv.style.top=Math.min(cA,cB)+"px"; lv.style.height=Math.abs(cA-cB)+"px"; wrapper.appendChild(lv);
                }
                const lh3 = document.createElement("div"); lh3.className="line h-line"; lh3.style.left=mX+"px"; lh3.style.top=center+"px"; lh3.style.width=(eX-mX)+"px"; wrapper.appendChild(lh3);

                matchData[A.mid].nextMatchId = mid; matchData[A.mid].nextSlot = 0;
                if (B) { matchData[B.mid].nextMatchId = mid; matchData[B.mid].nextSlot = 1; }
                next.push({ el, x: 50 + round * stepX, mid });
            }
            current = next; round++;
        }

        if (current.length === 1) {
            const A = current[0], mid = "CHAMP", center = getCenterY(A.el);
            const el = createMatch(50 + round * stepX, center, "None", null, true, mid);
            const lh = document.createElement("div"); lh.className="line h-line"; lh.style.left=(A.x+cardW)+"px"; lh.style.top=center+"px"; lh.style.width="40px"; wrapper.appendChild(lh);
            matchData[A.mid].nextMatchId = mid; matchData[A.mid].nextSlot = 0;
        }
        
        wrapper.style.width = (50 + (round + 1) * stepX) + "px";
        wrapper.style.height = window.innerHeight + "px";
    }

    run(players);
});
