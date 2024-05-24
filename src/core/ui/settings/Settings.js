import { Store } from './Store.js'

export class Settings {

    constructor() {
        if (Settings.instance) {
        return Settings.instance
    }

        // App store
        this.app =  new Store('app',{
            firstVisit:false,
            lastVisit:null
        })



        Settings.instance= this
    }
}