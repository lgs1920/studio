import { subscribe }                       from 'valtio'


export class JourneyEditor {
    constructor() {
        // Singleton
        if (JourneyEditor.instance) {
            return JourneyEditor.instance
        }

        // We need to interact with  Editor
        subscribe(lgs.journeyEditorStore, this.trackChanges)
        JourneyEditor.instance = this
    }

    trackChanges= ()=> {
    }
}