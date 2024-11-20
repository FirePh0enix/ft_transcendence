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
     * @returns {Promise<string>} The generated HTML
     */
    async render() {
        return "";
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

    usePersistentStore(name, defaultValue) {
        var key = this.getFullPath() + "__" + name;
        var item = window.localStorage.getItem(key);

        if (item == null) {
            item = JSON.stringify(defaultValue);
            window.localStorage.setItem(key, item);
        }

        return [
            () => {
                return JSON.parse(window.localStorage.getItem(key));
            },
            (value) => {
                window.localStorage.setItem(key, value);
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
}

class ParsingError {
    EXPECTING_ELEMENT = 0;
    UNKNOWN_ELEMENT = 1;
    ONE_TOP_LEVEL_ELEMENT = 2;

    constructor(err, line, column, source, data) {
        this.err = err;
        this.line = line;
        this.column = column;
        this.source = source;
        this.data = data;
    }

    errorString() {
        switch (this.err) {
            case this.EXPECTING_ELEMENT:
                return ``;
        }
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
                // this.appendChild(this.component.render());
                this.innerHTML = await this.component.render();
                this.component.events();
            }
        }, 0);
    }
}

/**
 * @param {string} str
 * @returns {HTMLElement | ParsingError}
 */
export function html(parent, str, components) {
    // There is probably a better place to put this
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
            throw new ParsingError(); // Expected opening tag!!!
        }

        index++;

        if (tokens[index].type != Token.IDENT) {
            throw new ParsingError(); // Expecting element name!!!
        }

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
                throw new ParsingError(); // Expecting attribute name !!!
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
            }

            attributes.set(name, value);
            index++;
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

        // console.log(name, ...attributes);

        /** @type HTMLElement */
        let el;

        if (components[name] != undefined) {
            el = document.createElement("micro-component");
            el.component = new components[name]();
            el.component.updateHandler = () => {
                el.updateHTML();
            };
        } else {
            el = document.createElement(name);
            if (el == undefined) {
                throw new ParsingError(); // Unknown element!!!
            }

            for (let [key, value] of attributes) {
                el.setAttribute(key, value);
            }
        }

        function findClosingTag(tagName) {
            let index2 = index;
            /** @type Map<string, number> */
            let openTags = new Map();

            while (index2 < end) {
                /*if (tokens[index2].type == Token.OPEN_TAG) {
                        index2++;

                        const name = tokens[index2].s;

                        while (
                            index2 < end &&
                            (tokens[index2].type != Token.CLOSE_TAG || tokens[index2].type != Token.SLASH)
                        ) {
                            index2++;
                        }

                        if (index2 == Token.CLOSE_TAG) {
                            openTags[name] += 1;
                            index++;
                        } else if (index2 == Token.SLASH) {
                            index += 2;
                        }
                    } else*/
                if (tokens[index2].type == Token.OPEN_TAG && tokens[index2 + 1].type == Token.SLASH) {
                    index2 += 2;

                    const name = tokens[index2].s;
                    if (name == tagName) {
                        // TODO: Also check if all values in openTags are 0
                        return index2 - 2;
                    }
                }

                index2++;
            }

            return -1;
        }

        if (hasInnerHTML) {
            const newEnd = findClosingTag(name);

            // index += 4; // `<`, `/`, `...` and `>`

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

    if (stoppedIndex != tokens.length) {
        throw ParsingError(ParsingError.ONE_TOP_LEVEL_ELEMENT, 1, 1, str);
    }
    return el;
}
