export class LayersUtils {
    static layerOrder = (layer, index) => {
        // During the layer change , the collection is reordered, so we need to manipulate it.
        // we read credit to see the layer type
        const type = layer.imageryProvider.credit.html
        if (index === 1 && type === 'base') {
            lgs.viewer.imageryLayers.lowerToBottom(layer)
        }
    }
}