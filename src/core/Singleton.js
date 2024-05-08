export class Singleton {

    constructor() {
        if (!!Singleton.instance) {
            return Singleton.instance
        }
        Singleton.instance = this
        return this
    }
}