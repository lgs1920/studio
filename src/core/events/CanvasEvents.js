import { AnyOtherMouseCoordinates } from '@Components/FloatingMenu/AnyOtherMouseCoordinates'
import { MarkerMenu }               from '@Components/FloatingMenu/MarkerMenu'
import { TrackMenu }                from '@Components/FloatingMenu/TrackMenu'
import { MouseUtils }               from '@Utils/cesium/MouseUtils'
import * as Cesium                  from 'cesium'

export class CanvasEvents {
    static manager = (movement) => {

        const event = window.event
        // May be it's too late but let'try...ok ?
        event.preventDefault()

        /**
         * we check if it is a track or marker and build the object that contains all information
         */
        const picked = MouseUtils.getEntityType(movement)
        const data = {
            picked: picked,
            event: event,
            positions: movement,
        }

        /**
         * Emit all subscribed events
         */
        lgs.eventHandler.getSubscriptionsTo('canvas').map(event => lgs.events.emit(event, data))

    }

    /**
     * Add canvas events listeners
     *
     *
     */
    static addListeners = () => {

        // Add events
        lgs.events.on('canvas/click', AnyOtherMouseCoordinates.show)
        lgs.events.on('canvas/click', MarkerMenu.show)
        lgs.events.on('canvas/click', TrackMenu.show)

        lgs.events.on('canvas/rightClick', AnyOtherMouseCoordinates.show)
        lgs.events.on('canvas/ctrlClick', AnyOtherMouseCoordinates.show)
    }

    /**
     * Attach all Cesium events we will use on canvas
     *
     *
     */
    static attach = () => {

        /**
         * We need to trap some events on canvas
         */
        const handlerOnCanvas = new Cesium.ScreenSpaceEventHandler(lgs.canvas)
        const canvasEventsManager = CanvasEvents.manager

        // Click
        lgs.eventHandler.subscribeEventManager({
            target: 'canvas',
            name: 'canvas/click',
            event: Cesium.ScreenSpaceEventType.LEFT_CLICK,
            manager: canvasEventsManager,
            handler: handlerOnCanvas,
        })

        // Right Click
        lgs.eventHandler.subscribeEventManager({
            target: 'canvas',
            name: 'canvas/rightClick',
            event: Cesium.ScreenSpaceEventType.RIGHT_CLICK,
            manager: canvasEventsManager,
            handler: handlerOnCanvas,
        })

        // Ctrl+Click
        lgs.eventHandler.subscribeEventManager({
            target: 'canvas',
            name: 'canvas/ctrlClick',
            event: Cesium.ScreenSpaceEventType.LEFT_CLICK,
            manager: canvasEventsManager,
            handler: handlerOnCanvas,
            keyboard: lgs.eventHandler.keyboard.CTRL,
        })
    }
}