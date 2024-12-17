import { BASE_ENTITY }  from '@Core/constants'
import { CustomShader } from 'cesium'

export class LayersUtils {
    static layerOrder = (layer, index) => {
        // During the layer change , the collection is reordered, so we need to manipulate it.
        // we read credit to see the layer type
        const type = layer.imageryProvider.credit.html
        if (index === 1 && type === BASE_ENTITY) {
            lgs.viewer.imageryLayers.lowerToBottom(layer)
        }
    }

    static snowShader = `
    uniform sampler2D colorTexture;
    varying vec2 v_textureCoordinates;

    void main() {
        vec4 color = texture2D(colorTexture, v_textureCoordinates);
        // Détecter les zones vertes et les remplacer par du blanc
       // if (color.g > 0.4 && color.r < 0.3 && color.b < 0.3)
            color = vec4(1.0, 0.0, 0.0, 1.0); // Remplacer par du blanc
       // }
        gl_FragColor = color;
    }
`

    static testShader = new CustomShader({
                                             uniforms:           {},
                                             varyings:           {},
                                             fragmentShaderText: `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
            vec4 color = texture(fsInput.colorTexture, fsInput.st);
            //if (color.g > 0.4 && color.r < 0.3 && color.b < 0.3) {
                material.diffuse = vec3(1.0, 1.0, 1.0); // Remplacer par du blanc
                material.alpha = 1.0;
            //} else {
            //    material.diffuse = color.rgb;
           //     material.alpha = color.a;
           // }
        }
    `,
                                         })

}