export function getPlayers() {

    const names = [
        "ShadowFox",
        "NeonBlade",
        "ZeroPulse",
        "DarkSniper",
        "GhostRider",
        "IronClaw",
        "NightWolf",
        "StormBreaker",
        "CyberKnight",
        "PhantomX",
        "Vortex",
        "BlazeStorm",
        "SilentEdge",
        "ToxicRush",
        "NovaStrike",
        "FrostByte",
        "CrimsonKing"
    ];

    for (let i = names.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [names[i], names[j]] = [names[j], names[i]];
    }

    return names.map(name => ({ name }));
}