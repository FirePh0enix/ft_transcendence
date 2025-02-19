import { tr } from "../../i18n";
import { Component } from "../../micro";
import { post, fetchApi, showToast } from "../../utils";

/** @type {import("../../micro").Component} */

export default class Activate2FAForm extends Component {
    async init() {
        this.onready = () => {
            const switch2FA = document.getElementById("switch2FA");

            switch2FA.addEventListener("change", async () => {
                const response = await post("/api/player/c/set-2fa/true", {})
                    .then((res) => res.json())
                    .catch((err) => {
                        showToast(tr("An error occurred. Please try again."), "bi bi-exclamation-triangle-fill");
                    });

                if (response.error) {
                    showToast(response.error, "bi bi-exclamation-triangle-fill");
                }
            });
        };
    }

    render() {
        return /* HTML */ ` <div>
            <div class="container-fluid settings">
                <div class="card settings">
                    <h5 class="card-title settings">${tr("Delete your account")}</h5>
                    <div class="card-body settings">
                        <p class="card-text settings">${tr("Permanently delete your account here.")}</p>
                        <div class="form-check form-switch 2FA">
                            <input class="form-check-input 2FA" type="checkbox" role="switch" id="switch2FA" />
                            <label class="form-check-label 2FA" for="switch2FA">2FA</label>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }
}
