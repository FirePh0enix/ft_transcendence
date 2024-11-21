class Store {
    constructor(defaultValue) {
        this.value = defaultValue;
    }
}

class ElementAccessor {
    constructor() {
        this.eventCallbacks = new Map();
    }

    on(eventName, callback) {
        this.eventCallbacks.set(eventName, callback);
    }
}

export class Component {
    constructor(parent, name = "default") {
        /** @type Map<string, Store> */
        this.stores = new Map();
        /** @type Map<string, Selector>  */
        this.accessors = new Map();
        this.parent = parent;
        /** @type string */
        this.name = name;
        this.updateHandler = undefined;
    }

    setTitle(title) {
        document.title = title;
    }

    /**
     * @returns {Promise<HTMLElement>} The generated HTML
     */
    async render() {
        return null;
    }

    events() {
        for (let [selector, values] of this.accessors) {
            for (let [eventName, callback] of values.eventCallbacks) {
                document.querySelector(selector).addEventListener(eventName, callback);
            }
        }
    }

    /**
     * @param {string} name
     */
    useStore(name, defaultValue) {
        var store;

        if (!this.stores.has(name)) {
            this.stores.set(name, new Store(defaultValue));
        }
        store = this.stores.get(name);

        return [
            store.value,
            (value) => {
                store.value = value;
                setTimeout(() => this.update(), 0);
            },
        ];
    }

    // TODO:
    // Dont return a function for the getter if possible !!!

    useGlobalStore(name, defaultValue) {
        var item = localStorage.getItem(name);

        if (item == null) {
            item = JSON.stringify(defaultValue);
            localStorage.setItem(name, item);
        }

        return [
            JSON.parse(localStorage.getItem(name)),
            (value) => {
                localStorage.setItem(name, value);
                setTimeout(() => this.update(), 0);
            },
        ];
    }

    usePersistentStore(name, defaultValue) {
        var key = this.getFullPath() + "__" + name;
        var item = localStorage.getItem(key);

        if (item == null) {
            item = JSON.stringify(defaultValue);
            localStorage.setItem(key, item);
        }

        return [
            JSON.parse(localStorage.getItem(key)),
            (value) => {
                localStorage.setItem(key, value);
                setTimeout(() => this.update(), 0);
            },
        ];
    }

    async update() {
        if (this.updateHandler != undefined) await this.updateHandler();
        if (this.parent != undefined) await this.parent.update();
    }

    /**
     * @param {string} selector
     * @returns {ElementAccessor}
     */
    query(selector) {
        var accessor;
        if (!this.accessors.has(selector)) {
            accessor = new ElementAccessor();
            this.accessors.set(selector, accessor);
        } else {
            accessor = this.accessors.get(selector);
        }
        return accessor;
    }

    getFullPath() {
        if (this.parent != undefined)
            return this.parent.getFullPath() + "_" + (this.constructor.name + "#" + this.name);
        return this.constructor.name + "#" + this.name;
    }

    getOrigin() {
        return window.location.origin.substring(0, window.location.origin.lastIndexOf(":"));
    }

    api(route) {
        return this.getOrigin() + ":8000" + route;
    }
}

class ParsingError extends Error {
    static EXPECTING_TAG = 0;
    static UNKNOWN_ELEMENT = 1;
    static ONE_TOP_LEVEL_ELEMENT = 2;
    static NO_CLOSING_TAG = 3;
    static EXPECTING_IDENT = 4;

    constructor(err, token, source, data) {
        super(ParsingError.errorString(err, token, source, data), null);

        this.err = err;
        this.token = token;
        this.source = source;
        this.data = data;
    }

    static errorString(err, token, source, data) {
        switch (err) {
            case ParsingError.EXPECTING_TAG:
                return `Expecting an element but found ${token.s}`;
            case ParsingError.UNKNOWN_ELEMENT:
                return `Unknown element <${token.s}>`;
            case ParsingError.ONE_TOP_LEVEL_ELEMENT:
                return `Only top element is supported` /*+
                    ParsingError.errorLocation(source, token.line, token.column, 2 + token.s.length)*/;
            case ParsingError.NO_CLOSING_TAG:
                return `No closing tag for <${token.s}>`;
            case ParsingError.EXPECTING_IDENT:
                return (
                    `Expecting identifier but got \`${token.s}\`` +
                    ParsingError.errorLocation(source, token.line, token.column, token.s.length)
                );
        }
    }

    /**
     * @param {string} source
     * @param {number} line
     * @param {number} columnStart
     * @param {number} size
     */
    static errorLocation(source, line, columnStart, size) {
        const lines = source.split("\n");
        let s = `\n${lines[line - 1]}\n`;

        for (let i = 0; i < columnStart - 1; i++) {
            s += " ";
        }

        s += "^";

        for (let i = 1; i < size; i++) {
            s += "~";
        }

        return s;
    }
}

class HTMLComponent extends HTMLElement {
    constructor() {
        super();
        /** @type Component */
        this.component = undefined;
    }

    connectedCallback() {
        this.updateHTML();
    }

    disconnectedCallback() {}

    adoptedCallback() {
        this.updateHTML();
    }

    attributeChangedCallback(name, oldValue, newValue) {}

    updateHTML() {
        setTimeout(async () => {
            if (this.component != undefined) {
                const newChild = await this.component.render();
                if (this.children.length > 0) this.removeChild(this.children[0]);
                this.appendChild(newChild);
                this.component.events();
            }
        }, 0);
    }
}

/**
 * @param {string} str
 * @returns {HTMLElement | ParsingError}
 */
export function html(parent, str) {
    // There is probably a better place to put this. This maybe should go away when parsing is done.
    if (customElements.get("micro-component") == undefined) {
        customElements.define("micro-component", HTMLComponent);
    }

    class Token {
        static IDENT = 0;
        static EQUALS = 1; // `=`
        static OPEN_TAG = 2; // `<`
        static CLOSE_TAG = 3; // `>`
        static QUOTES_STRING = 4; // `'...'`
        static DQUOTES_STRING = 5; // `"..."`
        static SLASH = 6; // `/`
        static CONTENT = 7; // Any text inside an element

        constructor(type, s, line, column) {
            this.type = type;
            this.s = s;
            this.line = line;
            this.column = column;
        }
    }

    /** @type Array<Token> */
    let tokens = new Array();
    let index = 0;
    let line = 1;
    let column = 1;

    function isWhitespace(c) {
        return c == " " || c == "\n" || c == "\r" || c == "\t";
    }

    function skipWhitespaces() {
        while (index < str.length && isWhitespace(str[index])) {
            if (str[index] == "\n") {
                line++;
                column = 1;
            } else {
                column++;
            }
            index++;
        }
    }

    let insideElement = false;

    while (index < str.length) {
        skipWhitespaces();

        if (str[index] == "<") {
            tokens.push(new Token(Token.OPEN_TAG, str[index], line, column));
            index++;
            column++;
            insideElement = false;
        } else if (str[index] == ">") {
            tokens.push(new Token(Token.CLOSE_TAG, str[index], line, column));
            index++;
            column++;
            insideElement = true;
        } else if (str[index] == "/") {
            tokens.push(new Token(Token.SLASH, str[index], line, column));
            index++;
            column++;
        } else if (str[index] == "=") {
            tokens.push(new Token(Token.EQUALS, str[index], line, column));
            index++;
            column++;
        } else if (str[index] == '"') {
            let value = "";
            let startColumn = column;
            index++;
            column++;
            while (index < str.length && str[index] != '"') {
                value += str[index];
                index++;
                column++;
            }
            // TODO: Check for errors
            tokens.push(new Token(Token.DQUOTES_STRING, value, line, startColumn));
            index++;
            column++;
        } else if (str[index] == "'") {
            let value = "";
            let startColumn = column;
            index++;
            column++;
            while (index < str.length && str[index] != "'") {
                value += str[index];
                index++;
                column++;
            }
            // TODO: Check for errors
            tokens.push(new Token(Token.QUOTES_STRING, value, line, startColumn));
            index++;
            column++;
        } else if (insideElement) {
            let value = "";
            let startColumn = column;
            while (index < str.length && str[index] != "<") {
                value += str[index];
                index++;
                column++;
            }
            // TODO: Check for errors
            tokens.push(new Token(Token.CONTENT, value, line, startColumn));
        } else {
            let value = "";
            let startColumn = column;
            while (
                index < str.length &&
                !isWhitespace(str[index]) &&
                str[index] != "<" &&
                str[index] != ">" &&
                str[index] != "/" &&
                str[index] != "="
            ) {
                value += str[index];
                index++;
                column++;
            }
            // TODO: Check for errors
            tokens.push(new Token(Token.IDENT, value, line, startColumn));
        }
    }

    // console.log(...tokens);

    function parseTags(parent, tokens, start, end) {
        let index = start;

        if (tokens[index].type != Token.OPEN_TAG) {
            throw new ParsingError(ParsingError.EXPECTING_TAG, tokens[index], str); // Expected opening tag!!!
        }

        index++;

        if (tokens[index].type != Token.IDENT) {
            throw new ParsingError(ParsingError.EXPECTING_IDENT, tokens[index], str); // Expecting element name!!!
        }

        const startToken = tokens[index];
        const name = tokens[index].s;
        index++;

        /** @type Map<string, string> */
        let attributes = new Map();
        let hasInnerHTML = false;

        // TODO: Check unexpected end of element

        while (index < end) {
            if (tokens[index].type == Token.CLOSE_TAG || tokens[index].type == Token.SLASH) {
                break;
            } else if (tokens[index].type != Token.IDENT) {
                throw new ParsingError(ParsingError.EXPECTING_IDENT, tokens[index], str); // Expecting attribute name !!!
            }

            const name = tokens[index].s;
            let value = "";

            index++;

            if (tokens[index].type == Token.EQUALS) {
                if (
                    tokens[index + 1].type == Token.IDENT ||
                    tokens[index + 1].type == Token.QUOTES_STRING ||
                    tokens[index + 1].type == Token.DQUOTES_STRING
                ) {
                    value += tokens[index + 1].s;
                    index++;
                } else {
                    throw new ParsingError(); // Expecting attribute value !!!
                }
                index++;
            }

            attributes.set(name, value);
        }

        if (tokens[index].type == Token.CLOSE_TAG) {
            hasInnerHTML = true;
            index++;
        } else if (tokens[index].type == Token.SLASH) {
            if (tokens[index + 1].type != Token.CLOSE_TAG) {
                throw new ParsingError(); // Expeced `>` after `/` !!!
            }
            index += 2;
        }

        /** @type HTMLElement */
        let el;

        if (globalComponents.has(name)) {
            el = document.createElement("micro-component");

            const c = globalComponents.get(name);

            el.component = new c();
            el.component.parent = parent;
            el.component.updateHandler = () => {
                el.updateHTML();
            };
        } else {
            el = document.createElement(name);
            if (el == undefined) {
                throw new ParsingError(ParsingError.UNKNOWN_ELEMENT, tokens[startToken], str); // Unknown element!!!
            }

            for (let [key, value] of attributes) {
                el.setAttribute(key, value);
            }
        }

        function findClosingTag(tagName) {
            let index2 = index;
            /** @type Map<string, number> */
            let openTags = new Map();

            function checkAllClosed() {
                for (let [key, count] of openTags) {
                    if (count != 0) {
                        return false;
                    }
                }
                return true;
            }

            while (index2 < end) {
                if (tokens[index2].type == Token.OPEN_TAG) {
                    if (tokens[index2 + 1].type == Token.SLASH) {
                        index2 += 2;

                        const name = tokens[index2].s;
                        if (name == tagName && checkAllClosed()) {
                            return index2 - 2;
                        }
                    } else {
                        index2++;
                        const name = tokens[index2].s;
                        while (
                            index2 < end &&
                            tokens[index2].type != Token.CLOSE_TAG &&
                            tokens[index2].type != Token.SLASH
                        ) {
                            index2++;
                        }
                        if (index2 == Token.CLOSE_TAG) {
                            openTags[name] += 1;
                            index2++;
                        } else if (index2 == Token.SLASH) {
                            index2 += 2;
                        }
                    }
                }

                index2++;
            }

            return -1;
        }

        if (hasInnerHTML) {
            const newEnd = findClosingTag(name);

            if (newEnd >= tokens.length) {
                throw new ParsingError(ParsingError.NO_CLOSING_TAG, startToken, str);
            }

            if (tokens[index].type == Token.CONTENT) {
                el.innerText = tokens[index].s;
                index++;
            } else {
                while (index < newEnd) {
                    const [child, stoppedIndex] = parseTags(el, tokens, index, newEnd); // `el` here could mess up events.
                    index = stoppedIndex;
                    el.appendChild(child);
                }
            }

            index += 4; // `<`, `/`, `...` and `>`
        }

        return [el, index];
    }

    const [el, stoppedIndex] = parseTags(parent, tokens, 0, tokens.length);

    if (stoppedIndex < tokens.length) {
        throw new ParsingError(ParsingError.ONE_TOP_LEVEL_ELEMENT, tokens[stoppedIndex], str);
    }
    return el;
}

/** @type Map<string, any> */
export const globalComponents = new Map();
