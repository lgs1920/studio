export class POIManager {

    default = {inside: false, behind: true}

    constructor() {
        // Singleton
        if (POIManager.instance) {
            return POIManager.instance
        }

        this.observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                const data = lgs.mainProxy.components.poi.items.get(entry.target) ?? this.default
                data.inside = entry !== undefined ? entry.isIntersecting : true
                lgs.mainProxy.components.poi.items.set(entry.target, data)
            })
        }, {ratio: 1, rootMargin: '-64px'})

        POIManager.instance = this
    }


}