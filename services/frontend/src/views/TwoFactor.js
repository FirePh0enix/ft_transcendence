import { fetchApi, getOrigin, showToast } from "../utils";
import { sanitizeInput } from "../validateInput";
import { tr } from "../i18n";
import { Component, navigateTo } from "../micro";

export default class TwoFactor extends Component {
    redirectAuth42() {
        const accessToken = localStorage.getItem("accessToken");

        if (accessToken == undefined) {
            const clientId = "u-s4t2ud-fd6496bf5631feb3051ccd4d5be873a3e47614223c9ebb635abaefda7d894f92";
            const redirectUrl = getOrigin() + "/callback";
            const url = `https://api.intra.42.fr/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUrl}&response_type=code`;
            window.location.href = url;
        } else {
            navigateTo("/callback");
        }
    }

    async init() {
        this.onready = () => {
            document.querySelector(".login-form").addEventListener("submit", async (event) => {
                const form = event.target;
                const data = new FormData(form);

                const username = localStorage.getItem("username");
                const otp = data.get("otp");

                const response = await fetchApi("/api/login", {
                    method: "POST",
                    body: JSON.stringify({
                        username: username,
                        otp: otp,
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
                        const redirect = decodeURIComponent(
                            window.location.search.substring(1).replace("redirect=", "")
                        );
                        navigateTo(redirect);
                    }
                }
            });
        };
    }

    render() {
        return /* HTML */ ` <div>
            <div class="container-fluid login-container">
                <form class="login-form was-validated" action="javascript:void(0)">
                    <img src="/img/login/Amadeus-Logo.webp" class="login-logo" />
                    <div class="row mb-3 login">
                        <label for="password" class="col-sm-2 col-form-label">${tr("One Time Code")}</label>
                        <div class="col-sm-8 login">
                            <input
                                name="otp"
                                autocomplete="off"
                                type="text"
                                class="form-control settings"
                                id="otp"
                                required
                            />
                        </div>
                    </div>
                    <div class="col-sm-1 login">
                        <button type="submit" class="btn btn-primary">
                            <img src="/img/login/login-button.png" />
                        </button>
                    </div>
                </form>
            </div>
        </div>`;
    }
}
