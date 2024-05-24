import { proxy }          from 'valtio'
import { SETTINGS_STORE } from '../../LGS1920Context.js'

export class SettingsStore {
    constructor(key,store) {
        this.key = key
        this.store = proxy(store)
        this.read().then(async data => {
            if (data === null) {
                await this.save()
            } else {
                this.store = proxy(data)
            }
        })
    }

    save=async () => {
        await lgs.db.lgs1920.put(this.key, JSON.parse(JSON.stringify(this.store)), SETTINGS_STORE)
    }

    read=async (parameter =undefined) => {
       const all =  await lgs.db.lgs1920.get(this.key, SETTINGS_STORE)
        return parameter ?all[parameter]:all
    }
}
