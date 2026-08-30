import {forwardRef, useEffect, useImperativeHandle, useRef} from 'react'
import {LGS1920Timeline} from './LGS1920Timeline'

const EVENT_NAMES = [
    'play',
    'pause',
    'replay',
    'export',
    'seek',
    'visibility-change',
    'action-dblclick',
    'add-widget',
    'reorder',
]

/**
 * React adapter for the controlled `lgs1920-timeline` Web Component.
 *
 * This adapter only bridges React properties and event callbacks. The Web
 * Component remains responsible for DOM rendering and pointer interaction.
 *
 * @param {Object} props - React component properties.
 * @param {Object} [props.state={}] - Controlled timeline state.
 * @param {HTMLElement|string|null} [props.parent=null] - Optional popup parent.
 * @param {Object} [props.eventHandlers={}] - Event callbacks keyed by suffix.
 * @param {React.ReactNode} [props.children] - Slotted Web Component children.
 * @param {Object} ref - Forwarded component ref.
 * @returns {JSX.Element} Web Component React adapter.
 */
export const LGS1920TimelineReact = forwardRef(({state = {}, parent = null, eventHandlers = {}, children}, ref) => {
    const _element = useRef(null)

    useImperativeHandle(ref, () => ({
        setState: nextState => _element.current?.setState(nextState),
        setTime: timeMillis => _element.current?.setTime(timeMillis),
        setZoom: zoomPercent => _element.current?.setZoom(zoomPercent),
        handleResize: () => _element.current?.handleResize(),
        get element() {
            return _element.current
        },
    }), [])

    useEffect(() => {
        _element.current?.setState(state)
    }, [state])

    useEffect(() => {
        if (_element.current) _element.current.parent = parent
    }, [parent])

    useEffect(() => {
        const element = _element.current
        if (!element) return undefined
        const listeners = EVENT_NAMES.map(name => {
            const listener = event => eventHandlers[name]?.(event)
            element.addEventListener(`lgs1920-timeline-${name}`, listener)
            return {name, listener}
        })
        return () => listeners.forEach(({name, listener}) => element.removeEventListener(`lgs1920-timeline-${name}`, listener))
    }, [eventHandlers])

    return (
        <lgs1920-timeline ref={_element}>
            {children}
        </lgs1920-timeline>
    )
})

LGS1920TimelineReact.displayName = 'LGS1920TimelineReact'

export {LGS1920Timeline}
