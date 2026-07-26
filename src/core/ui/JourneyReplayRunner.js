/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayRunner.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-05
 * Last modified: 2026-07-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MILLIS }   from '@Core/constants'
import { POIUtils } from '@Utils/cesium/POIUtils.js'
import { Track }    from '../Track'

export class JourneyReplayRunner {
    /**
     * Duration of a tour
     *
     * @type {number}
     */
    #duration

    /**
     * Number of points
     *
     * @type {number}
     */
    #points

    /**
     * current
     *
     * @type {number}
     */
    #current

    /**
     * Time interval
     *
     * @type {number}
     */
    #interval

    /**
     * Running status
     *
     * @type {null|boolean}
     */
    #running

    /**
     * loop status
     *
     * @type {boolean}
     */
    #loop

    /**
     * Direction of the tour (forward/backward)
     *
     * @type {boolean}
     */
    #initialDirection

    /**
     * All data
     *
     * @type {[]}
     */
    #pathway

    /**
     * Event
     *
     * @type {Map}
     */
    #events

    static START_TICK_EVENT = 'tick/start'
    static PAUSE_TICK_EVENT = 'tick/pause'
    static UPDATE_TICK_EVENT = 'tick/update'
    static STOP_TICK_EVENT = 'tick/stop'

    /**
     * All possible durations
     *
     * @type {[{time: number, text: string}]}
     */
    static DURATIONS = [
        {time: 15, text: '15s'},
        {time: 30, text: '30s'},
        {time: 60, text: '1mn'},
        {time: 120, text: '2mn'},
    ]

    /**
     * Starting point
     * @type {number}
     */
    #start

    /**
     * End point
     * @type {number}
     */
    #end

    /**
     * Interval ID
     * @type {number}
     */
    #timer

    /**
     * ProfileTrackMarker
     * @type {ProfileTrackMarker|null}
     */
    #marker

    /** step between path, to maintain required time
     * @type {Number}
     */
    #step
    constructor(options) {
        // Singleton
        if (JourneyReplayRunner.instance) {
            return JourneyReplayRunner.instance
        }
        this.forward = true
        this.marker = null
        this.update(options)
        this.#current = 1

        JourneyReplayRunner.instance = this

    }

    /**
     * Update the JourneyReplayRunner
     *
     * @param options
     *
     * @return {JourneyReplayRunner}
     *
     */
    update = (options) => {
        if (options) {
            this.#pathway = options.coordinates ?? this.#pathway
            this.#points = this.#pathway.length
            this.duration = (options.duration ?? this.duration)*MILLIS
            this.#step =1

            this.#interval = this.#duration/this.#points
            if (this.#interval < lgs.settings.getProfile.minInterval) {
                this.#interval = lgs.settings.getProfile.minInterval
                this.#step = Number.parseInt(this.#points/this.#duration*this.#interval)
                this.#duration = this.#step *this.#interval/MILLIS
            }

            this.forward = options.forward ?? this.forward
            this.#marker = options.marker ?? this.marker

            this.#start = (this.forward) ? 0 : this.#points - 1
            this.#end = (this.forward) ? this.#points - 1 : 0

            this.#loop = options.loop ?? this.#loop

            this.#events = options.events ?? this.#events

            this.#events.forEach((callback, event) => {
                lgs.events.off(event)
                lgs.events.on(event, callback)
            })

        }

        return this
    }

    /**
     *
     * @return {number}
     */
    get duration() {
        return this.#duration
    }

    /**
     *
     * @param {number} duration
     */
    set duration(duration) {
        this.#duration = duration
    }

    /**
     * Get time interval
     *
     * @return {number}
     */
    get interval() {
        return this.#interval
    }

    /**
     * Compute the timeintrval
     *
     * @param {number} pointsNumber
     */
    set interval(pointsNumber) {
        this.#interval = this.#duration *MILLIS/ pointsNumber
    }

    /**
     *
     * @return {boolean}
     */
    get running() {
        return this.#running
    }

    /**
     *
     * @param {boolean} running
     */
    set running(running) {
        this.#running = running
    }

    /**
     *
     * @return {boolean}
     */
    get forward() {
        return this.#initialDirection
    }

    /**
     *
     * @param {boolean} initialDirection
     */
    set forward(initialDirection) {
        this.#initialDirection = initialDirection
    }

    /**
     *
     * @return {ProfileTrackMarker}
     */
    get marker() {
        return this.#marker
    }

    /**
     *
     * @param {ProfileTrackMarker} marker
     */
    set marker(marker) {
        this.#marker = marker
    }

    /**
     * Run or continue the JourneyReplay runner
     */
    play = () => {
        this.running = true
        this.#clearTimer()
        this.#timer = setInterval(this.tick, this.interval)
    }

    /**
     * Pause the JourneyReplay runner
     */
    pause = () => {
        this.running = false
        lgs.events.emit(JourneyReplayRunner.PAUSE_TICK_EVENT, this.current, this.#pathway[this.#current]??null)
    }

    /**
     * Start the JourneyReplay runner
     */
    start = () => {
        this.#clearTimer()
        this.#current = this.#start
        lgs.events.emit(JourneyReplayRunner.START_TICK_EVENT, this.current, this.#pathway[this.#current]??null)
        this.play()
        this.tick()
    }

     #clearTimer = ()=> {
         if (this.#timer) {
             clearInterval(this.#timer)
         }
     }

    /**
     * resume alias to start
     */
    resume = this.start

    /**
     * Stop the JourneyReplay runner
     */
    stop = () => {
        if (this.running) {
            this.running = false
            const track = Track.deserialize({object: Track.unproxify(lgs.theTrack)}) // TODO Check
            track.marker.hide()
            clearInterval(this.#timer)
            lgs.events.emit(JourneyReplayRunner.STOP_TICK_EVENT, this.current, this.#pathway[this.#current] ?? null)
            this.#events.forEach((callback, event) => {
                lgs.events.off(event)
            })
        }
    }


    /**
     * Return the number of remaining points
     *
     * @return {number}
     */
    remains = () => {
        return Math.abs(this.#end - this.#current)
    }

    /**
     * Returns the remaining time
     *
     * @return {number}
     */
    remainsTime = () => {
        return this.remains * this.duration
    }

    /**
     * Increment or decrement through data Array.
     * and emit a tick event
     */
    tick = () => {
        if (this.running) {
            if (this.forward) {
                this.#current+=this.#step
                if (this.#current >= this.#points) {
                    if (this.#loop) {
                        this.#current = 0
                    } else {
                        this.stop()
                    }
                }
            } else {
                this.#current-=this.#step
                if (this.#current < 0) {
                    if (this.#loop) {
                        this.#current = this.#points - 1
                    } else {
                        this.stop()
                    }
                }
            }
            // New tick, we dispatch a new event    //TODO Change 0 to series index
            lgs.events.emit(JourneyReplayRunner.UPDATE_TICK_EVENT, [lgs.theJourney.getTrackIndex(lgs.theTrack.slug),this.#current, this.#pathway[this.#current]??null])
        }
    }

    prepareData = () => {
        if (lgs.theJourney === null) {
            return
        }
        const data=[]
        lgs.theJourney.tracks.forEach((track) => {
            if (track.visible && track.metrics.points !== undefined) {
                track.metrics.points.forEach(point => {
                    data.push({
                        longitude: point.longitude,
                        latitude: point.latitude,
                        height: point.altitude,
                    })
                })

            }
        })
        return data
    }

    updateColor = ()=> {
        POIUtils.remove(lgs.theTrack.marker)
__.ui.profiler.initMarker({force:true})
    }



}
