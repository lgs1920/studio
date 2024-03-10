export class MouseEventHandler {

    handlers = new Map()
    events = {
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
    mouseButtons = {
        LEFT: 0,
        MIDDLE: 1,
        RIGHT: 2,
    }

    set handler(event) {
        return this.handlers.get(event)
    }

    set onClick(callback) {
        this.action = [callback, this.events.LEFT_CLICK]
    }

    set onRightClick(callback) {
        this.action = [callback, this.events.RIGHT_CLICK]
    }

    set action(props) {
        this.handlers.get(props[1]).setInputAction(props[0], props[1])
    }

    subscribe = (event, handler) => {
        this.handlers.set(event, handler)
    }

    unSubscribe = (event) => {
        return this.handlers.delete(event)
    }

}