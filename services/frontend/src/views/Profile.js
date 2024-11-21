import { Component } from "../micro";
import NavBar from "./NavBar";
import Login from "./Login";
import Registration from "./Registration";

export default class extends Component {
    constructor() {
        super();
        this.registration = new Registration();
    }

    async render() {
        this.setTitle("Profile");

        const navBar = await new NavBar().render();
        const registration = await new Registration().render();

        return localStorage.getItem("isLogged") ? navBar + "Hello dear connected stranger !" : navBar + registration;
    }

    events() {
        super.events();
        this.registration.events();
        this.registration.addEventListeners();
    }

    addEventListeners() {
        this.registration.addEventListeners();
    }
}
