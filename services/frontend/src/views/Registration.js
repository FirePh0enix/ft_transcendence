import { sanitizeInput } from "../validateInput";
import { tr } from "../i18n";
import { api, showToast } from "../utils";
import { Component, navigateTo } from "../micro";

/** @type {import("../micro").Component} */
export default class Registration extends Component {
    async init() {
        this.onready = () => {
            document.querySelector(".login-form").addEventListener("submit", async (event) => {
                const form = event.target;
                const data = new FormData(form);

                const username = data.get("username");
                const nickname = data.get("nickname");
                const password = data.get("password");
                const email = data.get("email");

                if (!sanitizeInput(username) || !sanitizeInput(nickname) || !sanitizeInput(password)) {
                    showToast(
                        "Invalid input detected. Please fill out all fields correctly.",
                        "bi bi-exclamation-triangle-fill"
                    );
                    return;
                }

                const response = await fetch(api("/api/signin"), {
                    method: "POST",
                    body: JSON.stringify({
                        username: username,
                        nickname: nickname,
                        password: password,
                        email: email,
                    }),
                })
                    .then((res) => res.json())
                    .catch((err) => {
                        showToast("An error occurred. Please try again.", "bi bi-exclamation-triangle-fill");
                    });
                if (response.error) {
                    showToast(response.error, "bi bi-exclamation-triangle-fill");
                } else {
                    if (window.location.search.length == 0) {
                        navigateTo("/");
                    } else {
                        const redirect = window.location.search.substring(1).replace("redirect=", "");
                        navigateTo(redirect);
                    }
                }
            });

            document
                .querySelector(".login-redirect")
                .addEventListener("click", () => navigateTo("login" + window.location.search));
        };
    }
    render() {
        return /* HTML */ ` <div>
            <div class="container-fluid login-container">
                <div id="toast-container"></div>
                <form class="login-form was-validated" action="javascript:void(0)">
                    <img src="/img/login/Amadeus-Logo.webp" class="login-logo" />
                    <div class="row mb-3 login">
                        <label for="username" class="col-sm-2 col-form-label">${tr("Username")}</label>
                        <div class="col-sm-8 login">
                            <input
                                name="username"
                                autocomplete="off"
                                type="text"
                                class="form-control settings"
                                id="username"
                                required
                            />
                        </div>
                    </div>
                    <div class="row mb-3 login">
                        <label for="nickname" class="col-sm-2 col-form-label">${tr("Nickname")}</label>
                        <div class="col-sm-8 login">
                            <input
                                name="nickname"
                                autocomplete="off"
                                type="text"
                                class="form-control settings"
                                id="nickname"
                                required
                            />
                        </div>
                    </div>
                    <div class="row mb-3 login">
                        <label for="password" class="col-sm-2 col-form-label">${tr("Password")}</label>
                        <div class="col-sm-8 login">
                            <input
                                name="password"
                                autocomplete="off"
                                type="password"
                                class="form-control settings"
                                id="password"
                                required
                            />
                        </div>
                    </div>
                    <div class="row mb-3 login">
                        <label for="email" class="col-sm-2 col-form-label">${tr("Email")}</label>
                        <div class="col-sm-8 login">
                            <input
                                name="email"
                                autocomplete="off"
                                type="email"
                                class="form-control settings"
                                id="email"
                                required
                            />
                        </div>
                        <div class="col-sm-1 login">
                            <button type="submit" class="btn btn-primary">
                                <img src="/img/login/login-button.png" />
                            </button>
                        </div>
                    </div>
                    <a class="login-redirect" href="javascript:void(0)">${tr("Already have an account ?")}</a>
                </form>
            </div>
        </div>`;
    }
}
