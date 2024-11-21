import { navigateTo } from "../main";
import { Component } from "../micro";
import { router } from "../main";

export default class Login extends Component {
    constructor() {
        super();
    }

    async render() {
        return `
<div class="container-fluid">
    <form class="login-form" action="javascript:void(0)">
        <div class="row mb-3">
            <label for="username" class="col-sm-2 col-form-label">Username</label>
            <div class="col-sm-10">
                <input name=username type="text" class="form-control" id="username" />
            </div>
        </div>
        <div class="row mb-3">
            <label for="username" class="col-sm-2 col-form-label">Nickname</label>
            <div class="col-sm-10">
                <input name=nickname type="text" class="form-control" id="nickname" />
            </div>
        </div>
        <div class="row mb-3">
            <label for="password" class="col-sm-2 col-form-label">Password</label>
            <div class="col-sm-10">
                <input name=password type="password" class="form-control" id="password" />
            </div>
        </div>
        <button type="submit" class="btn btn-primary">Login</button>
        </form>
</div>
        `;
    }

    addEventListeners() {
        this.registrationForm();
    }

    registrationForm() {
        /** @type HTMLFormElement */
        if (localStorage.getItem("isLogged")) {
            return;
        }
        const form = document.querySelector(".login-form");

        form.addEventListener("submit", async (event) => {
            const form = event.target;
            const data = new FormData(form);

            const username = data.get("username");
            const nickname = data.get("nickname");
            const password = data.get("password");

            const response = await fetch(this.api("/api/login"), {
                method: "POST",
                body: JSON.stringify({
                    username: username,
                    nickname: nickname,
                    password: password,
                }),
            })
                .then((res) => res.json())
                .catch((err) => {
                    error: "Bad input";
                });

            localStorage.setItem("isLogged", true);
            navigateTo("/profile");
            router();
        });
    }

    // /api/signin
    //
    // username, nickname, password
}
