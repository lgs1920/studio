import * as Cesium                  from 'cesium'
import { AnyOtherMouseCoordinates } from '../../Components/UI/VT3D_UI/FloatingMenu/AnyOtherMouseCoordinates'
import { MarkerMenu }               from '../../Components/UI/VT3D_UI/FloatingMenu/MarkerMenu'
import { MouseUtils }               from '../../Utils/cesium/MouseUtils'

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
        vt3d.eventHandler.getSubscriptionsTo('canvas').map(event => vt3d.events.emit(event, data))

    }

    /**
     * Add canvas events listeners
     *
     *
     */
    static addListeners = () => {

        // Add events
        vt3d.events.on('canvas/click', AnyOtherMouseCoordinates.show)
        vt3d.events.on('canvas/click', MarkerMenu.show)

        vt3d.events.on('canvas/rightClick', AnyOtherMouseCoordinates.show)
        vt3d.events.on('canvas/ctrlClick', AnyOtherMouseCoordinates.show)
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
        const handlerOnCanvas = new Cesium.ScreenSpaceEventHandler(vt3d.canvas)
        const canvasEventsManager = CanvasEvents.manager

        // Click
        vt3d.eventHandler.subscribeEventManager({
            target: 'canvas',
            name: 'canvas/click',
            event: Cesium.ScreenSpaceEventType.LEFT_CLICK,
            manager: canvasEventsManager,
            handler: handlerOnCanvas,
        })

        // Right Click
        vt3d.eventHandler.subscribeEventManager({
            target: 'canvas',
            name: 'canvas/rightClick',
            event: Cesium.ScreenSpaceEventType.RIGHT_CLICK,
            manager: canvasEventsManager,
            handler: handlerOnCanvas,
        })

        // Ctrl+Click
        vt3d.eventHandler.subscribeEventManager({
            target: 'canvas',
            name: 'canvas/ctrlClick',
            event: Cesium.ScreenSpaceEventType.LEFT_CLICK,
            manager: canvasEventsManager,
            handler: handlerOnCanvas,
            keyboard: vt3d.eventHandler.keyboard.CTRL,
        })
    }
}