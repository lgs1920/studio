export class MouseEventHandler {

    handlers = new Map()
    eventManagers = new Map()


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

    /**
     * Subscribe to an event manager
     *
     * @param props     settings
     *              name      manager name
     *              event     event
     *              handler   The handler used
     *              manager   the event manager we'll use
     *              keyboard  Additional keyboard event
     *
     */
    subscribeEventManager = (props) => {
        props.handler.setInputAction(props.manager, props.event, props.keyboard)
        this.handlers.set(props.name, props.handler)
        this.#addEventManager(props.target, props.name)
    }

    getSubscriptionsTo = (eventManager) => {
        return this.eventManagers.get(eventManager)
    }

    #addEventManager = (eventManager, name) => {
        let manager = this.getSubscriptionsTo(eventManager)
        if (!manager) {
            this.eventManagers.set(eventManager, [])
            manager = this.getSubscriptionsTo(eventManager)
        }
        manager.push(name)
    }

    /**
     * Unsubscribe an eventManager
     * @param name
     */
    unSubscribeEventManager = (name) => {
        this.handlers.delete(name)
    }

}