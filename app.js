const tg = window.Telegram.WebApp;
tg.expand();

tg.SettingsButton.show();
tg.SettingsButton.onClick(() => {
    tg.showConfirm("Сбросить сетку?", (ok) => {
        if (ok) { localStorage.removeItem("tournament_state"); location.reload(); }
    });
});

document.addEventListener("DOMContentLoaded", () => {
    const wrapper = document.getElementById("wrapper");
    const STORAGE_KEY = "tournament_state";
    
    // Настройки размеров
    const cardW = 180;
    const cardH = 84; // Примерная высота карточки с 2 строками
    const stepX = 240; 
    
    let matchData = {};
    let players = [];

    // Загрузка или инициализация
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
        players = saved.players;
    } else {
        players = [...TOURNAMENT_PLAYERS];
        players.sort(() => Math.random() - 0.5);
    }

    // Рассчитываем динамический stepY, но не меньше высоты карточки + отступ
    const availableHeight = wrapper.offsetHeight;
    const firstRoundMatches = Math.ceil(players.length / 2);
    const stepY = Math.max(cardH + 20, availableHeight / firstRoundMatches);

    function save() {
        const cells = {};
        document.querySelectorAll('.row[id]').forEach(el => {
            cells[el.id] = { text: el.innerText, color: el.style.color, isChamp: el.classList.contains('champion-text') };
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, cells }));
    }

    function createMatch(x, y, p1, p2, isChamp, mid) {
        const el = document.createElement("div");
        el.className = "glass-card";
        el.style.left = x + "px";
        el.style.top = y + "px";
        
        let s1 = "", s2 = "", c1 = p1, c2 = p2, classChamp = "";
        if (saved && saved.cells) {
            const d1 = saved.cells[mid + "-0"];
            const d2 = saved.cells[mid + "-1"];
            if (d1) { c1 = d1.text; s1 = `style="color:${d1.color}"`; if (d1.isChamp) classChamp = "champion-text"; }
            if (d2) { c2 = d2.text; s2 = `style="color:${d2.color}"`; }
        }

        if (isChamp) {
            el.innerHTML = `<div class="row" style="opacity:0.5;font-size:10px">ЧЕМПИОН</div><div class="row ${classChamp}" id="${mid}-0" ${s1}>${c1}</div>`;
        } else {
            el.innerHTML = `<div class="row" id="${mid}-0" ${s1}>${c1}</div><div class="row" id="${mid}-1" ${s2}>${c2 || ""}</div>`;
            el.onclick = () => {
                const b = [];
                if (c1 && c1 !== "None") b.push({id:"1", type:"default", text:c1});
                if (c2 && c2 !== "None") b.push({id:"2", type:"default", text:c2});
                b.push({type:"cancel"});
                tg.showPopup({title:"Победитель", message:"Кто прошел дальше?", buttons:b}, (btn) => {
                    if (btn === "1") setWinner(mid, c1);
                    if (btn === "2") setWinner(mid, c2);
                });
            };
        }
        wrapper.appendChild(el);
        return el;
    }

    function setWinner(mid, name) {
        const r1 = document.getElementById(mid + "-0");
        const r2 = document.getElementById(mid + "-1");
        if (r1) r1.style.color = r1.innerText === name ? "#44ff44" : "#ff4444";
        if (r2) r2.style.color = r2.innerText === name ? "#44ff44" : "#ff4444";

        const m = matchData[mid];
        if (m && m.next) {
            const nextEl = document.getElementById(m.next + "-" + m.slot);
            if (nextEl) {
                nextEl.innerText = name;
                if (m.next === "CHAMP") nextEl.classList.add("champion-text");
                save();
                // Авто-проход если матч из 1 игрока
                const parentMatch = document.querySelector(`[data-id="${m.next}"]`);
                if (m.next !== "CHAMP" && !document.getElementById(m.next + "-1")) {
                    setWinner(m.next, name);
                }
            }
        }
    }

    function drawLine(x, y, w, h) {
        const l = document.createElement("div");
        l.className = "line";
        l.style.left = x + "px"; l.style.top = y + "px";
        l.style.width = w + "px"; l.style.height = h + "px";
        wrapper.appendChild(l);
    }

    function init() {
        let round = 0;
        let current = [];

        // Раунд 1
        for (let i = 0; i < players.length; i += 2) {
            const mid = `r0m${i}`;
            const y = (i/2) * stepY + (stepY/2 - cardH/2);
            const el = createMatch(0, y, players[i], players[i+1], false, mid);
            current.push({ el, mid, x: 0 });
            matchData[mid] = { next: null, slot: 0 };
        }

        while (current.length > 1) {
            round++;
            const next = [];
            for (let i = 0; i < current.length; i += 2) {
                const mid = `r${round}m${i}`;
                const a = current[i], b = current[i+1];
                const yA = a.el.offsetTop + cardH/2;
                const yB = b ? b.el.offsetTop + cardH/2 : yA;
                const yM = (yA + yB) / 2;
                
                const el = createMatch(round * stepX, yM - cardH/2, "None", b ? "None" : null, false, mid);
                el.dataset.id = mid;
                matchData[mid] = { next: null, slot: 0 };
                
                // Линии
                drawLine(a.x + cardW, yA, 30, 2);
                if (b) {
                    drawLine(a.x + cardW, yB, 30, 2);
                    drawLine(a.x + cardW + 30, Math.min(yA, yB), 2, Math.abs(yA - yB));
                    drawLine(a.x + cardW + 30, yM, stepX - cardW - 30, 2);
                } else {
                    drawLine(a.x + cardW, yA, stepX - cardW, 2);
                }

                matchData[a.mid].next = mid; matchData[a.mid].slot = 0;
                if (b) { matchData[b.mid].next = mid; matchData[b.mid].slot = 1; }
                next.push({ el, mid, x: round * stepX });
            }
            current = next;
        }

        // Финал
        const last = current[0];
        const fY = last.el.offsetTop + cardH/2;
        const champ = createMatch((round + 1) * stepX, fY - cardH/2, "None", null, true, "CHAMP");
        drawLine(last.x + cardW, fY, stepX - cardW, 2);
        matchData[last.mid].next = "CHAMP";
        
        wrapper.style.width = ((round + 2) * stepX + 100) + "px";
    }

    init();
});
