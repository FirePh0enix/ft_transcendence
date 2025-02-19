import { tr } from "../i18n";
import { Component } from "../micro";

export default class Settings extends Component {
    async init() {
        document.title = tr("Settings");
    }

    render() {
        return /* HTML */ `<div class="container-fluid dashboard-container">
            <ProfileNavBar />
            <ul class="list-group settings">
                <ChangeProfilePictureForm />
                <ChangeNicknameForm />
                <ChangePasswordForm />
                <Activate2FAForm />
                <DeleteAccountForm />
            </ul>
        </div>`;
    }
}
