import { MILLIS }                          from '@Utils/AppUtils.js'
import { DISTANCE_UNITS, ELEVATION_UNITS } from '../../Utils/UnitUtils.js'
import { ELEVATION_VS_DISTANCE }           from './Profiler.js'

export class Wanderer {
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

    constructor(options) {
        // Singleton
        if (Wanderer.instance) {
            return Wanderer.instance
        }
        this.forward = true
        this.update(options)

        Wanderer.instance = this

    }

    /**
     * Update the Wanderer
     *
     * @param options
     *
     * @return {Wanderer}
     *
     */
    update = (options) => {
        if (options) {
            this.#pathway = options.coordinates ?? this.#pathway
            this.#points = this.#pathway.length
            this.duration = options.duration ?? this.duration
            this.#interval = this.duration / this.#points
            this.forward = options.forward ?? this.forward


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
        this.#interval = this.#duration / pointsNumber
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
     * Run or continue the wanderer
     */
    play = () => {
        this.running = true
        this.#clearTimer()
        this.#timer = setInterval(this.tick, this.interval * MILLIS)
    }

    /**
     * Pause the wanderer
     */
    pause = () => {
        this.running = false
        lgs.events.emit(Wanderer.PAUSE_TICK_EVENT, this.current, this.#pathway[this.#current]??null)
    }

    /**
     * Start the wanderer
     */
    start = () => {
        this.#clearTimer()
        this.#current = this.#start
        lgs.events.emit(Wanderer.START_TICK_EVENT, this.current, this.#pathway[this.#current]??null)
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
     * Stop the wanderer
     */
    stop = () => {
        this.running = undefined
        clearInterval(this.#timer)
        lgs.events.emit(Wanderer.STOP_TICK_EVENT, this.current, this.#pathway[this.#current]??null)
        this.#events.forEach((callback,event) => {
            lgs.events.off(event)
        })
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
                this.#current++
                if (this.#current >= this.#points) {
                    if (this.#loop) {
                        this.#current = 0
                    } else {
                        this.stop()
                    }
                }
            } else {
                this.#current--
                if (this.#current < 0) {
                    if (this.#loop) {
                        this.#current = this.#points - 1
                    } else {
                        this.stop()
                    }
                }
            }

            // New tick, we dispatch a new event
            lgs.events.emit(Wanderer.UPDATE_TICK_EVENT, [this.#current, this.#pathway[this.#current]??null])

        }
    }

    prepareData = () => {
        if (lgs.theJourney === null) {
            return
        }
        const data=[]
        lgs.theJourney.tracks.forEach((track, slug) => {
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



}
