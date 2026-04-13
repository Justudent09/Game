const tg = window.Telegram.WebApp;
tg.expand();

// ТВОЙ ID
const ADMIN_ID = 5136839421;

// СПИСОК ИГРОКОВ (21)
const players = [
"ShadowX","NeoBlast","DarkWolf","IceFire","VenomX",
"Ghosty","CyberKing","ZeroCool","NightHunter","FrostByte",
"AlphaZ","ToxicRush","BlazeX","SilentAim","StormEye",
"Quantum","RedViper","NovaShot","PixelGod","EchoX",
"LuckyOne"
];

let bracketData = [];

// Проверка админа
if (tg.initDataUnsafe?.user?.id === ADMIN_ID) {
    document.getElementById("createBtn").style.display = "block";
}

// Перемешивание
function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

// Создание турнира
document.getElementById("createBtn").onclick = () => {
    let shuffled = shuffle([...players]);

    bracketData = [];

    while (shuffled.length > 0) {
        let p1 = shuffled.shift();
        let p2 = shuffled.length ? shuffled.shift() : null;

        bracketData.push([p1, p2]);
    }

    renderBracket();
};

// Рендер
function renderBracket() {
    const container = document.getElementById("bracket");
    container.innerHTML = "";

    let currentRound = bracketData;

    while (currentRound.length > 0) {
        const roundDiv = document.createElement("div");
        roundDiv.className = "round";

        let nextRound = [];

        currentRound.forEach(match => {
            const matchDiv = document.createElement("div");
            matchDiv.className = "match";

            match.forEach(player => {
                if (!player) return;

                const p = document.createElement("div");
                p.className = "player";
                p.innerText = player;

                // выбор победителя (только админ)
                p.onclick = () => {
                    if (tg.initDataUnsafe?.user?.id !== ADMIN_ID) return;

                    if (confirm(`Победитель: ${player}?`)) {
                        p.classList.add("winner");
                        nextRound.push(player);
                        renderNextRound(nextRound);
                    }
                };

                matchDiv.appendChild(p);
            });

            roundDiv.appendChild(matchDiv);
        });

        container.appendChild(roundDiv);
        break;
    }
}

// следующий раунд
function renderNextRound(players) {
    if (players.length < 2) return;

    let next = [];

    while (players.length > 0) {
        let p1 = players.shift();
        let p2 = players.length ? players.shift() : null;
        next.push([p1, p2]);
    }

    bracketData = next;
    renderBracket();
}