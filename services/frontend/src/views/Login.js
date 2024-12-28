import { fetchApi } from "../api";
import { navigateTo } from "../router";
import { Component, html } from "../micro";
import { sanitizeInput } from "../validateInput";
import { tr } from "../i18n";

export default class Login extends Component {
    constructor() {
        super();
    }

    async render() {
        this.query(".login-form").on("submit", async (event) => {
            const form = event.target;
            const data = new FormData(form);

            const username = data.get("username");
            const password = data.get("password");

            if (!sanitizeInput(username) || !sanitizeInput(password)) {
                this.showToast(
                    "Invalid input detected. Please fill out all fields correctly.",
                    "bi bi-exclamation-triangle-fill"
                );
                return;
            }

            const response = await fetchApi("/api/login", {
                method: "POST",
                body: JSON.stringify({
                    username: username,
                    password: password,
                }),
            })
                .then((res) => res.json())
                .catch((err) => {
                    this.showToast("An error occurred. Please try again.", "bi bi-exclamation-triangle-fill");
                });
            if (response.error) {
                this.showToast(response.error, "bi bi-exclamation-triangle-fill");
            } else {
                navigateTo("/");
            }
        });

        this.query(".create-account-redirect").on("click", () => navigateTo("register"));

        const usernameLanguage = tr("Username");
        const passwordLanguage = tr("Password");
        const createLanguage = tr("Create an account");

        return html(
            /* HTML */
            ` <div>
                <div class="container-fluid login-container">
                    <div id="toast-container"></div>
                    <form class="login-form was-validated" action="javascript:void(0)">
                        <img src="/img/login/Amadeus-Logo.webp" class="login-logo" />
                        <div class="row mb-3 login">
                            <label for="username" class="col-sm-2 col-form-label">${usernameLanguage}</label>
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
                            <label for="password" class="col-sm-2 col-form-label">${passwordLanguage}</label>
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
                            <div class="col-sm-1 login">
                                <button type="submit" class="btn btn-primary">
                                    <img src="/img/login/login-button.png" />
                                </button>
                            </div>
                        </div>
                        <a class="create-account-redirect" href="javascript:void(0)">${createLanguage}</a>
                    </form>
                </div>
            </div>`
        );
    }
}
