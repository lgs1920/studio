export class POIManager {


    constructor() {
        // Singleton
        if (POIManager.instance) {
            return POIManager.instance
        }

        this.observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting !== undefined) {
                    lgs.mainProxy.components.poi.entries.set(entry.target, entry.isIntersecting)
                }
                else {
                    lgs.mainProxy.components.poi.entries.set(entry.target, true)
                }
            })
        }, {ratio: 1, rootMargin: '-64px'})

        POIManager.instance = this
    }


}