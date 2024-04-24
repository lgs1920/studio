/**********************************************************************************************************************
 *                                                                                                                    *
 * Project : dashboard                                                                                                *
 * File : EventEmitter.js                                                                                             *
 *                                                                                                                    *
 * @author: Christian Denat                                                                                           *
 * @email: contact@noleam.fr                                                                                          *
 *                                                                                                                    *
 * Last updated on : 24/02/2023  16:07                                                                                *
 *                                                                                                                    *
 * Copyright (c) 2023 - noleam.fr                                                                                     *
 *                                                                                                                    *
 **********************************************************************************************************************/

/**
 * Fork of https://github.com/dimitrilahaye/vanilla-js-es6-event-emitter
 */

/**
 * EventEmitter class
 */
export class EventEmitter {

    events = []

    constructor() {
        /** @type {array} the EventEmitter's events */
        this.events = []
    }

    /**
     * Will register an event with a name for a specific context and its specific callback.
     *
     * Method can be bound to change this object.
     *
     * @since 2.0 : change signature (add options)
     *
     * @param {string} name the name of the event to create or to update
     * @param {Function} callback the callback called when the event is emitted
     * @param {Object} options :
     *          {int} priority:     The priority (default = 100, lower > 100, higher <100)
     *          {Object} context:   the object's context on what the event is acting (default null)
     *
     */
    on = (name, callback, options = {}) => {
        this.#registerEvent(name, callback, {
            on: true,
            priority: options?.priority,
            context: options?.context ?? {},
        })
        return this
    }

    /**
     * Will register an event with a name for a specific context and its specific callback for only once emitting.
     *
     * Method can be bound to change this object.
     *
     * @since 2.0 : change signature (add options)
     *
     * @param {string} name the name of the event to create or to update
     * @param {Function} callback the callback called when the event is emited
     * @param {Object} options :
     *          {Object} context:   the object's context on what the event is acting (default null)
     *
     */
    once = (name, callback, options = {}) => {
        this.#registerEvent(name, callback, {
            on: false,
            once: true,
            context: options?.context ?? {},
        })
    }


    /**
     * Will register an event with a name for a specific context and its specific callback for exactly x emitting.
     *
     * Method can be bound to change this object.
     *
     * @since 2.0 : change signature (add options)
     * @since 2.1 : it's possible to specify only 'to' value
     *
     * @param {string} name the name of the event to create or to update
     * @param {Function} callback the callback called when the event is emited
     * @param {Object} options :
     *          {int} to:           number of time the event has to be emit
     *          {int} priority:     The priority (default =  lower > 100, higher <1000)
     *          {Object} context:   the object's context on what the event is acting (default null)
     *
     *        It is also possible to declare an integer, equal to 'to' value.
     */
    to = (name, callback, options = {}) => {
        if (Number.isInteger(options)) {
            options = {to: options}
        }
        this.#registerEvent(name, callback, {
            on: false,
            priority: options?.priority,
            to: options.to,
            context: options?.context ?? {},
        })
    }


    /**
     * Will register an event with a name for a specific context and its specific callback which be called after x
     * emitting.
     *
     * Method can be bound to change this object.
     *
     * @since 2.0 : change signature (add options)
     * @since 2.1 : it's possible to specify only 'at' value
     *
     * @param {string} name the name of the event to create or to update
     * @param {Function} callback the callback called when the event is emited
     * @param {Object} options :
     *          {int} at:           how many time the event has to be emit before to launch its callback
     *          {int} priority:     The priority (default = 100,  lower > 100, higher <100)
     *          {Object} context:   the object's context on what the event is acting (default null)
     *
     *        It is also possible to declare an integer, equal to 'at' value.
     */
    at = (name, callback, options = {}) => {
        if (Number.isInteger(options)) {
            options = {at: options}
        }
        this.#registerEvent(name, callback, {
            on: false,
            priority: options?.priority,
            context: options?.context ?? {},
            at: --options.at,
        })
    }


    /**
     * Will register an event with a name for a specific context and its specific callback which be called once after x
     * emitting.
     *
     * Method can be bound to change this object.
     *
     * @since 2.0 : change signature (add options)
     * @since 2.1 : it's possible to specify only 'there' value
     *
     * @param {string} name the name of the event to create or to update
     * @param {Function} callback the callback called when the event is emited*
     * @param {Object} options :
     *           {int} there:       how many time the event has to be emit before to launch its callback once
     *           {int} priority:    The priority (default = 100, lower > 100, higher <100)
     *           {Object} context:  the object's context on what the event is acting (default null)
     *
     *        It is also possible to declare an integer, equal to 'at' value.
     */
    there = (name, callback, options = {}) => {
        if (Number.isInteger(options)) {
            options = {there: options}
        }
        this.#registerEvent(name, callback, {
            on: false,
            priority: options?.priority,
            context: options?.context ?? {},
            there: options.there,
        })
    }


    /**
     * Will emit the event with the specific name, passing the args into the event's callbacks
     *
     * @param {array | string} names the names of all the events to emit.
     *                               Could be a string if we want to emit only one event, or an array for many.
     * @param {array} args the array of arguments to pass into the event's callbacks to emit
     *
     */
    emit = (names, ...args) => {
        args = args || []
        for (const e of this.events) {
            if (names instanceof Array) {
                for (const name of names) {
                    this.#emitEvent(name, e, args[0])
                }
            } else {
                this.#emitEvent(names, e, args[0])
            }
        }
    }


    /**
     * Will remove from an array of events namespace the registered context.
     *
     * Method can be bound to change this object.
     *
     * @param {array | string} names the names of the events where we want to unregistred a context.
     *                               Could be a string if we want to unregister only one event, or an array for many.
     *
     *
     * @param {Object} context:  the object's context on what the event is acting (default {}')
     *
     */
    off = (names, context = {}) => {
        for (const event of this.events) {
            if (names instanceof Array) {
                for (const name of names) {
                    this.#unregisterEvent(name, event, context)
                }
            } else {
                this.#unregisterEvent(names, event, context)
            }
        }
    }

    /**
     * Remove all the registered events. Method called between called views.
     */
    clean = () => {
        this.events = []
    }


    /**
     * Will register an event with a name for a specific context and its specific callback.
     * If an event with this name already exists, it will just create the event for the context and the callback
     * then push it into the name namespace.
     *
     * @since 2.0 : creation
     *
     * @param {string} name         the name of the event to create or to update
     * @param {Function} callback   the callback call ed when the event is emitted
     *
     * @param {Object} options :
     *         {int} priority:      The priority (default = 100, lower>100, higher <100)
     *         {bool} on:           has this event to be emitted (default)
     *         {bool} once:         has this event to be emitted only once
     *         {int} to:            number of time the event has to be emit
     *         {int} at:            how many time the event has to be emit before to launch its callback
     *                              if {at} is a boolean false, it is uneficiant
     *         {int|bool} there:    how many time the event has to be emit before to launch its callback once
     *         {Object} context     the object's context on what the event is acting (default null)
     *
     * @private
     *
     */
    #registerEvent = (name, callback, options = {}) => {

        let alreadyExists = false

        const event = {
            context: options?.context ?? {},
            callback: callback,
            on: options.on ?? true,
            priority: options?.priority ?? 100,
            once: options?.once ?? false,
            to: options?.to ?? -1,
            at: options?.at ?? false,
            there: options?.there ?? -1,
        }

        // 1st we check all existing events to see if the required event already exists
        // If it is the case, we add it accordingly to priority
        for (const e of this.events) {
            if (e.name === name) {
                e.events.push(event)
                e.events.sort((a, b) => (a.priority > b.priority) ? 1 : -1)
                alreadyExists = true
            }
        }

        // If there no existing event, we create one and push it
        if (!alreadyExists) {
            const events = {
                'name': name,
                'events': [event],
            }
            this.events.push(events)
        }


    }

    /**
     * Check if the given event corresponds to the given name and so, emit the event.
     *
     * @since 2.0 change name
     *
     * @param {string} name     the name of the event
     * @param {Object} e        the event we are evaluating
     * @param {array} args      the array of arguments to pass into the event's callbacks to emit
     *
     * @private
     *
     */
    #emitEvent = (name, e, ...args) => {
        if (e.name === name) {
            for (const event of e.events) {
                // resolve {at}
                if (event.at !== false) {
                    if (event.at <= 0) {
                        event.callback.apply(event.context, args)
                    }
                    if (event.at > 0) {
                        event.at--
                    }
                }
                // resolve {there}
                else if (event.there > 0) {
                    event.there--
                } else if (event.there === 0) {
                    event.callback.apply(event.context, args)
                    this.off([name], event.context)
                }
                // resolve {to}
                else if (event.to > 0) {
                    event.callback.apply(event.context, args)
                    event.to--
                } else if (event.to === 0) {
                    this.off([name], event.context)
                }
                // resolve {on}
                else if (event.on === true) {
                    event.callback.apply(event.context, args)
                }
                // resolve {once}
                else if (event.once) {
                    event.callback.apply(event.context, args)
                    this.off([name], event.context)
                }
            }
        }
    }

    /**
     * Check if the given event corresponds to the given name and so, remove the event from the list.
     *
     * @since 2.0 change name
     *
     * @param {string} name     the name of the event
     * @param {Object} event    the event we are evaluating
     * @param {Object} context  the object's context on what the event is acting
     *
     * @private
     *
     */
    #unregisterEvent = (name, event, context = {}) => {
        if (event.name === name) {
            let j = 0
            for (const e of event.events) {
                if (this.#equals(e.context?.constructor.name, context?.constructor.name)) {
                    event.events.splice(j, 1)
                }
                j++
            }
        }
    }

    /**
     * Check if given contexts are equals
     *
     * @since 2.0 change name
     *
     * @param {Object} x context from event
     * @param {Object} y context from off method
     *
     * @private
     */
    #equals = (x, y) => {
        return JSON.stringify(x) === JSON.stringify(y)
    }

}
