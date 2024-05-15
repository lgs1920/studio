import { Singleton } from '../Singleton'

export class Wanderer extends Singleton {
    constructor() {
        super()
    }

}

export const WANDER_DURATION = [
    {time: 15, text: '15s'},
    {time: 30, text: '30s'},
    {time: 60, text: '1mn'},
    {time: 120, text: '2mn'},
]