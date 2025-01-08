import { getOriginNoProtocol, getNickname, post, api } from "../utils";
import { tr } from "../i18n";
import { parseHTML } from "../micro";

/** @type {import("../micro").Component} */
export default async function Tournament({ dom, params, node }) {
    function createBracket(games) {
        const brackets = document.querySelectorAll(".bracket");

        if (games.length == 1) {
            brackets.forEach((bracket) => {
                bracket.style.display = "none";
            });
        }

        if (games.length == 2) {
            brackets.forEach((bracket) => {
                // Display all brackets.
                bracket.style.display = "flex";
                // ! I will remove magic percent.
                bracket.style.height = "50%";
            });
            // Remove the additional brackets on second column.
            brackets[1].style.display = "none";
        }

        if (games.length == 3) {
            brackets.forEach((bracket) => {
                bracket.style.display = "flex";
            });
            const bracketContainer = document.querySelector(".container-fluid.bracket-container");
            // Add another bracket with the right percent.
            const newBracket = document.createElement("div");

            newBracket.className = "bracket";
            newBracket.setAttribute("row", "1");
            // ! I will remove magic percent.
            newBracket.style.height = "25%";
            bracketContainer.appendChild(newBracket);

            brackets[0].style.height = "25%";
            brackets[2].style.display = "none";

            for (let i = 0; i < 3; i++) {
                let dot = document.createElement("div");
                dot.className = "dot";

                const bracket = document.querySelectorAll(".bracket");
                bracket[1].appendChild(dot);
            }
        }
    }

    function createBinaryParticle(particleNumber) {
        const container = document.querySelector(".particle-container");

        for (let i = 0; i < particleNumber; i++) {
            const particle = document.createElement("div");

            if (i % 2 === 0) {
                particle.textContent = "0";
            } else {
                particle.textContent = "1";
            }

            particle.classList.add("binary-particle");

            particle.style.setProperty("--startY", `${Math.random() * 100}vh`);
            particle.style.setProperty("--startX", `${Math.random() * 100}vw`);
            particle.style.setProperty("--endY", `${Math.random() * 100}vh`);
            particle.style.setProperty("--endX", `${Math.random() * 100}vw`);

            container.appendChild(particle);
        }
    }

    function createDotParticle(particleNumber) {
        const container = document.querySelector(".particle-container");

        for (let i = 0; i < particleNumber; i++) {
            const particle = document.createElement("div");

            particle.classList.add("dot-particle");

            particle.style.setProperty("--startY", `${Math.random() * 100}vh`);
            particle.style.setProperty("--startX", `${Math.random() * 100}vw`);
            particle.style.setProperty("--endY", `${Math.random() * 100}vh`);
            particle.style.setProperty("--endX", `${Math.random() * 100}vw`);

            container.appendChild(particle);
        }
    }

    function createRoundTier() {
        const roundNames = [tr("Quarterfinals"), tr("Semifinals"), tr("Final")];
        const roundTiers = document.querySelectorAll(".round-tier");
        let offset = 0;

        if (roundTiers.length == 1) {
            offset = 2;
        } else if (roundTiers.length == 2) {
            offset = 1;
        }

        roundTiers.forEach((roundTier, index) => {
            roundTier.textContent = roundNames[index + offset];
        });
    }

    document.title = tr("Tournament");

    const id = params.get("id");
    const playerInfo = await post("/api/player/c/profile").then((res) => res.json());

    let host = undefined;

    dom.querySelector("#tournament-container").do(async (el) => {
        const ws = new WebSocket(`wss://${getOriginNoProtocol()}:8080/ws/tournament/${id}`);

        ws.onopen = (event) => {
            ws.send(JSON.stringify({ type: "join" }));
        };
        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            if (data["type"] == "players") {
                let players = "";
                for (let p of data["players"]) {
                    let nickname = await getNickname(p);
                    players += /* HTML */ `<span
                        ><img src="${api("/api/player/" + p + "/picture")}" alt="" width="40vw" />${nickname}</span
                    >`;
                }
                el.querySelector("#player-list").innerHTML = players;
                host = data["host"];

                if (host != playerInfo.id) {
                    const startBtn = el.querySelector("#start-tournament");
                    startBtn.disabled = true;
                    startBtn.style.opacity = "0.3";
                    startBtn.style.pointerEvents = "none";
                }
            } else if (data["type"] == "rounds") {
                let container = el.querySelector("#match-container");

                if (container != null) {
                    container.replaceChildren([]);

                    for (let round of data["rounds"]) {
                        let games = round["games"];
                        container.appendChild(
                            // TODO: Remove the use of `parseHTML`, it should be an internal fonction only
                            await parseHTML(
                                /* HTML */ ` <div class="container-fluid round-container">
                                    <TournamentRound roundCount="${games.length}" data="${JSON.stringify(games)}" />
                                    <div class="container-fluid bracket-container">
                                        <div class="bracket" row="1">
                                            <div class="dot"></div>
                                            <div class="dot"></div>
                                            <div class="dot"></div>
                                        </div>
                                        <span class="round-tier"></span>
                                    </div>
                                </div>`,
                                undefined,
                                undefined,
                                undefined
                            )
                        );
                    }
                    createBracket(data["rounds"]);
                    createRoundTier();
                    // createBinaryParticle(15);
                    // createDotParticle(15);
                }
            } else if (data["type"] == "match") {
                navigateTo(`/play/pong/${data["id"]}`);
            }
        };

        dom.querySelector("#start-tournament").on("click", () => {
            ws.send(JSON.stringify({ type: "start" }));
        });
    });

    return /* HTML */ ` <NavBar />
        <div class="container-fluid dashboard-container tournament-container" id="tournament-container">
            <div class="particle-container"></div>
            <div class="container-fluid dashboard-container match-container" id="match-container"></div>
            <div class="container-fluid dashboard-container player-container">
                <h2 id="tournament-title">
                    <i class="bi bi-clock"></i>
                    <span>Tournament Name</span>
                </h2>
                <div id="player-list"></div>
                <button id="start-tournament">
                    <i class="bi bi-rocket-takeoff"></i> <span>${tr("Start !")}</span>
                </button>
            </div>
        </div>`;
}
