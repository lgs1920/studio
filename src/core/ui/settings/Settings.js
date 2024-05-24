import { SettingsStore } from './SettingsStore.js'

export class Settings {

    constructor() {
        if (Settings.instance) {
        return Settings.instance
    }

        // App store
        this.app =  new SettingsStore('app',{
            firstVisit:false,
            lastVisit:null
        })



        Settings.instance= this
    }
}