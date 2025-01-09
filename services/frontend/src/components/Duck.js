import { tr } from "../i18n";

function poundMul(n) {
    return n * 1;
}

function poundCost(n) {
    return n * 200;
}

/** @type {import("../micro").Component}  */
export default async function Duck({ dom, stores }) {
    const [count, setCount] = stores.usePersistent("duckCount", 0);
    const [data, setData] = stores.usePersistent("duckData", {});

    let upgradeHTML = "";

    const upgrades = [
        {
            name: "Pound",
            mul: poundMul,
            cost: poundCost,
        },
    ];

    function getUpgrade(name) {
        return upgrades.find((value) => value.name == name);
    }

    for (let obj of upgrades) {
        let _data = data();
        let value = _data[obj.name];

        if (value == undefined) {
            value = 0;
        }

        upgradeHTML += `<li><button class="duck-upgrade-btn" name="${obj.name}">${obj.name} x${value}</button></li>`;
    }

    dom.querySelector("#the-duck").do((element) => {
        let interval = setInterval(() => {
            let _data = data();
            for (let obj of upgrades) {
                let value = _data[obj.name];
                setCount(count() + obj.mul(value));
            }
        }, 1000);
        dom.addEventListener("delete", (event) => {
            clearInterval(interval);
        });

        // TODO: Fix dom.createInterval
    });

    dom.querySelector("#the-duck").on("click", (event) => {
        event.target.animate(
            [
                {
                    opacity: 0,
                    easing: "ease-out",
                },
                {
                    opacity: 1,
                    easing: "ease-in",
                },
            ],
            2000
        );

        setCount(count() + 1);
    });

    dom.querySelector(".duck-upgrade-btn").on("click", (event) => {
        /** @type {HTMLElement} */
        let target = event.target;
        const name = target.getAttribute("name");

        let _data = data();
        let upgrade = getUpgrade(name);
        let cost = upgrade.cost(_data[name] != undefined ? _data[name] : 0);

        if (count() >= cost) {
            if (_data[name] == undefined) {
                _data[name] = 0;
            } else {
                _data[name] += 1;
            }

            setCount(count() - cost);
            setData(_data);
        }
    });

    return /* HTML */ ` <div class="duck-container">
        <ul class="duck-list duck-card">
            <li><img src="/favicon.svg" width="100%" id="the-duck" /></li>
            <li><div class="duck-count">${count()} ${tr("ducks")}</div></li>
        </ul>
        <div class="duck-card">
            <ul class="duck-upgrade-list">
                ${upgradeHTML}
            </ul>
        </div>
    </div>`;
}
