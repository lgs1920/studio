
export class Vr3DContext {
    #context

    constructor() {
        this.#context={}
    }

     get context() {
        return this.#context
    }
    get viewer() {
        return this.#context.viewer
    }

    set viewer(viewer) {
        this.#context.viewer = viewer
    }

    get camera() {
        return this.#context.viewer?.scene?.camera
    }

}