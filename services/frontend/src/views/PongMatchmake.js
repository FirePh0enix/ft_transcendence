import { getOriginNoProtocol, showToast } from "../utils";
import { navigateTo } from "../micro";
import { parseHTML } from "../micro";
import { dirty } from "../micro";
import { tr } from "../i18n";

/** @type {import("../micro").Component} */
export default async function PongMatchmake({ dom, stores }) {
    const GET = location.search
        .substring(1)
        .split("&")
        .map((value) => value.split("="))
        .reduce((obj, item) => ((obj[item[0]] = item[1]), obj), {});

    if (GET["gamemode"] == undefined) {
        navigateTo("/");
    }

    const [time, setTime] = stores.usePersistent("matchmakeTimer", 0); // TODO: No need to store the value in localStorage here.

    function timeInMinutes() {
        const minutes = Math.floor(time() / 60);
        let seconds = Math.floor(time() % 60);

        if (seconds < 10) {
            seconds = "0" + seconds;
        }

        return minutes + ":" + seconds;
    }

    let timer;

    dom.querySelector(".matchmake-container").do(async (c) => {
        const ws = new WebSocket(`wss://${getOriginNoProtocol()}:8080/ws/matchmake/pong`);
        ws.onopen = (event) => {
            ws.send(
                JSON.stringify({
                    type: "request",
                    gamemode: GET["gamemode"],
                })
            );
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            console.log(data);

            if (data["type"] == "matchFound") {
                document.querySelector(".match-found-container").classList.remove("hidden");
                document.querySelector(".matchmake-container").classList.add("hidden");

                // Do not wait if we are playing against ourself.
                if (GET["gamemode"].endsWith("local")) {
                    navigateTo("/play/pong/" + data["id"]);
                } else {
                    setTimeout(() => navigateTo("/play/pong/" + data["id"]), 5000);
                }
            }
        };

        setTime(0);

        // timer = setInterval(() => {
        //     setTime(time() + 1);
        // }, 1000);
    });

    dom.addEventListener("delete", (event) => {
        clearInterval(timer);
        console.log("aaaaaaaaaaaaaaahhhhhhhhhhhhhhhh");
    });

    //     <li>
    //     <Duck />
    // </li>

    return /* HTML */ `<NavBar />
        <div id="toast-container"></div>
        <div class="matchmake-container">
            <ul>
                <li>
                    <span class="searching-for-game">${tr("Searching for a game")}</span>
                </li>
                <li>
                    <span>
                        <span class="timer">${timeInMinutes()}</span>
                    </span>
                </li>
            </ul>
            <div class="match-found-container hidden">
                <div class="player-card">
                    <ul>
                        <li>
                            <img src="/favicon.svg" alt="" />
                        </li>
                        <li>
                            <span>test</span>
                        </li>
                    </ul>
                </div>
                <div class="vs-card">VS</div>
                <div class="player-card">
                    <ul>
                        <li>
                            <img src="/favicon.svg" alt="" />
                        </li>
                        <li>
                            <span>test</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>`;
}
