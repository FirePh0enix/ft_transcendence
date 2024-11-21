import { Component, globalComponents, html } from "../micro";
import NavBar from "./NavBar";

export default class Counter extends Component {
    constructor() {
        super();
        // this.navBar = new NavBar();
    }

    async render() {
        const [count, setCount] = this.usePersistentStore("count", 0);

        this.query("#add").on("click", (event) => {
            setCount(count + 1);
        });

        this.query("#sub").on("click", (event) => {
            setCount(count - 1);
        });

        return html(
            this.parent,
            /*html*/ `<div><NavBar /><p>Count is ${count}</p><button id="add">Add !</button><button id="sub">Sub !</button></div>`
        );
    }
}
globalComponents.set("Counter", Counter);
