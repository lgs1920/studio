export class MouseEventHandler {

    handlers = new Map()


    constructor() {
        this.events = {
            LEFT_DOWN: 0,
            LEFT_UP: 1,
            LEFT_CLICK: 2,
            LEFT_DOUBLE_CLICK: 3,
            RIGHT_DOWN: 5,
            RIGHT_UP: 6,
            RIGHT_CLICK: 7,
            MIDDLE_DOWN: 10,
            MIDDLE_UP: 11,
            MIDDLE_CLICK: 12,
            MOUSE_MOVE: 15,
            WHEEL: 16,
            PINCH_START: 17,
            PINCH_END: 18,
            PINCH_MOVE: 19,
        }

        this.buttons = {
            LEFT: 0,
            MIDDLE: 1,
            RIGHT: 2,
        }

        this.keyboard = {
            SHIFT: 0,
            CTRL: 1,
            ALT: 2,
        }
    }

    set handler(event) {
        return this.handlers.get(event)
    }

    /**
     *
     * @param callback
     */
    set onClick(callback) {
        this.action = [callback, this.events.LEFT_CLICK]
    }

    /**
     *
     * @param callback
     */
    set onCtrlClick(callback) {
        this.action = [callback, this.events.LEFT_CLICK, this.keyboard.CTRL]
    }

    /**
     *
     * @param callback
     */
    set onRightClick(callback) {
        this.action = [callback, this.events.RIGHT_CLICK]
    }

    /**
     *
     * @param props 0 = callback, 1=event type, 2=keyboard
     */
    set action(props) {
        const [action, type, keyboard] = props
        if (keyboard === undefined) {
            this.handlers.get(`${type}`).setInputAction(action, type)
        } else {
            this.handlers.get(`${type}-${keyboard}`).setInputAction(action, type, keyboard)
        }
    }

    /**
     * Subscribe event type
     * @param event
     * @param handler
     * @param keyboard
     */
    subscribe = (event, handler, keyboard = '') => {
        if (keyboard === '') {
            this.handlers.set(`${event}`, handler)
            return
        }
        this.handlers.set(`${event}-${keyboard}`, handler)
    }

    unSubscribe = (event, keyboard = '') => {
        if (keyboard === '') {
            this.handlers.delete(`${event}`)
            return
        }
        this.handlers.delete(`${event}-${keyboard}`)

    }

}