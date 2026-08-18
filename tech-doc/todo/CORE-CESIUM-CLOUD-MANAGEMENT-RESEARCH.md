# Cesium Cloud Management and Reusable Cloud Resources

Status: research and future implementation guidance

Research date: 2026-08-18

## Scope

This document records the discussion about adding clouds to the LGS1920 CesiumJS scene, loading cloud models, and reusing cloud systems or assets produced by other applications.

The current repository declares CesiumJS `^1.144.0` in `package.json`.

No cloud implementation is introduced by this document. It is a technical research note for a future implementation decision.

## Conclusions from the discussion

CesiumJS supports native procedural cumulus clouds through `CloudCollection`. A cloud collection is added to `scene.primitives`, and individual clouds are positioned with Cartesian coordinates. The native API is appropriate for a limited number of lightweight cumulus clouds, but it is not a complete global volumetric weather simulator.

CesiumJS also supports glTF and GLB models through `Model.fromGltfAsync`. A cloud exported as a mesh can therefore be loaded like any other 3D model. The preferred exchange format is GLB because geometry, materials, textures, and animations can be packaged into one file.

Cloud systems from other applications are not automatically portable. A static mesh or a glTF animation can usually be reused after export. A volumetric renderer based on compute shaders, engine-specific materials, ray marching, or proprietary runtime data normally has to be recreated or adapted for CesiumJS.

## Reuse decision matrix

| Source or output | CesiumJS reuse level | Recommended treatment |
| --- | --- | --- |
| Cesium `CloudCollection` | Direct | Use for a small set of procedural cumulus clouds |
| Static `.glb` or `.gltf` cloud mesh | Direct | Load with `Model.fromGltfAsync` and position with a model matrix |
| Animated glTF cloud model | Direct with validation | Load the model and play its glTF animations after it is ready |
| `.obj`, `.fbx`, `.dae`, or `.blend` asset | Indirect | Convert to GLB, validate materials, and check the asset license |
| HDRI cloud panorama | Direct as an environment or background asset | Use for sky or lighting. It is not a 3D cloud volume |
| Sprite sheet or cloud texture | Adaptable | Use with billboards, particles, or a custom material |
| OpenVDB or sparse volume | Not direct | Bake it to a supported representation or recreate the volume in a Cesium shader |
| Unity, Unreal, Godot, or DirectX cloud renderer | Not direct | Reuse algorithms, noise data, or references only after checking dependencies and licenses |
| Large collection of georeferenced cloud meshes | Indirect | Convert or publish as 3D Tiles for streaming and level of detail |

## Recommended implementation paths

### Path A: native Cesium cumulus clouds

Use `CloudCollection` when the requirement is visual scene decoration with a moderate number of clouds.

Advantages:

- No external model assets are required
- Positions are expressed directly in longitude, latitude, and height
- Cloud appearance can be adjusted through size, slice, brightness, and noise settings
- The implementation is already part of the installed CesiumJS version

Limitations:

- The supported cloud type is procedural cumulus
- It does not provide a complete meteorological simulation
- It does not reproduce a volumetric cloud renderer from a game engine

Official references:

- [Cesium CloudCollection API](https://cesium.com/learn/ion-sdk/ref-doc/CloudCollection.html)
- [Cesium Clouds Sandcastle](https://sandcastle.cesium.com/?src=Clouds.html)
- [Cesium Cloud Parameters Sandcastle](https://sandcastle.cesium.com/?src=Cloud%20Parameters.html)

### Path B: reusable GLB cloud assets

Use a GLB model when the desired result is a specific cloud shape, a stylized cloud, or a cloud asset produced by Blender or another 3D tool.

Expected integration flow:

1. Export the asset to glTF 2.0 or GLB
2. Pack textures into the GLB where possible
3. Apply transforms and verify the up axis in the authoring application
4. Use meters as the scene unit
5. Keep the model origin near the center of the cloud
6. Validate alpha blending and back-face behavior in CesiumJS
7. Place the model using a longitude, latitude, height position and a model matrix
8. Add a glTF animation only if the animation is actually needed

Cesium and Khronos references:

- [Cesium glTF architecture](https://cesium.com/blog/2022/10/05/tour-of-the-new-gltf-architecture-in-cesiumjs/)
- [Khronos glTF specification and ecosystem](https://github.com/KhronosGroup/glTF)
- [Khronos glTF Blender I/O exporter](https://github.com/KhronosGroup/glTF-Blender-IO)
- [Cesium ion supported model formats and tiling options](https://cesium.com/learn/ion/self-hosted/)

Basic loading shape:

```js
import {
  Cartesian3,
  Model,
  ShadowMode,
  Transforms
} from 'cesium'

const position = Cartesian3.fromDegrees(2.35, 48.85, 2500)

const cloudModel = await Model.fromGltfAsync({
  url: '/assets/models/cloud.glb',
  modelMatrix: Transforms.eastNorthUpToFixedFrame(position),
  scale: 1000,
  shadows: ShadowMode.DISABLED
})

viewer.scene.primitives.add(cloudModel)
```

This is suitable for a small number of models. Many geographically distributed cloud models should be considered for 3D Tiles instead of individual primitives.

### Path C: reusable textures and HDRIs

Cloud HDRIs and textures can improve the sky appearance or provide input for a custom material. They do not automatically become navigable 3D clouds above the globe.

Potentially reusable sources:

- [Poly Haven Cloud Layers HDRI](https://polyhaven.com/a/cloud_layers) — a CC0 cloud-layer HDRI. Useful for a sky or background treatment, not for a volumetric cloud layer
- [Poly Haven](https://polyhaven.com/) — a CC0 library of HDRIs, textures, and 3D assets. Every chosen asset must still be checked individually before packaging
- [ambientCG](https://ambientcg.com/) — assets are published under CC0 according to the service licensing statement. It is useful for texture searches, but it is not a source of a Cesium-ready volumetric cloud simulator

### Path D: reuse an external volumetric cloud simulator

External simulators can be useful as algorithmic references, but their runtime rendering code is usually coupled to their original graphics engine.

Relevant projects:

- [Godot volumetric cloud demo](https://github.com/clayjohn/godot-volumetric-cloud-demo-v2) — demonstrates compute-shader and sky-shader volumetric clouds. The repository license contains MIT notices, including a separate notice for the atmosphere shader. It cannot be dropped into CesiumJS directly because it relies on Godot 4 rendering features
- [SunshineClouds2 for Godot](https://github.com/Bonkahe/SunshineClouds2) — a procedural volumetric cloud system for Godot. Treat it as a technical reference unless its current license and all bundled dependencies are explicitly verified
- [Cumulus DirectX 12 cloud renderer](https://github.com/rubenaryo/Cumulus) — an MIT-licensed DirectX 12 implementation of procedural volumetric clouds. It is useful for studying density fields, ray marching, lighting, and noise baking, but it is not a browser or CesiumJS module
- [Precomputed Atmospheric Scattering](https://ebruneton.github.io/precomputed_atmospheric_scattering/) — a reference implementation and research resource for atmospheric rendering. It is relevant to the atmosphere around clouds, not a drop-in Cesium cloud layer

The practical reuse options from these projects are:

- Study the cloud density representation and noise strategy
- Reuse compatible shader algorithms after a license review
- Bake procedural output to textures or meshes
- Reimplement the final effect with Cesium `CustomShader`, a post-process stage, particles, or a dedicated primitive

The full original renderer should not be copied into the application without checking its graphics API, shader language, asset licenses, dependencies, and redistribution requirements.

## License and redistribution checklist

Before adding any external cloud asset to the repository or shipping it to users:

- Record the exact source URL
- Record the asset author and license
- Check the license of the asset itself, not only the website or tool
- Check licenses for textures, shader code, noise libraries, and bundled dependencies
- Preserve attribution and license notices when required
- Confirm that commercial use and redistribution are allowed
- Avoid linking to a remote asset at runtime when the service does not grant redistribution rights
- Keep a local license or attribution file next to imported third-party assets when appropriate

CC0 resources are the simplest candidates for direct redistribution, but the source page and the asset license should still be recorded.

## Performance considerations

Cloud models are transparent or semi-transparent objects and can be expensive when they cover a large part of the viewport. Performance should be validated with the actual camera paths used by the application.

Recommended constraints for an initial prototype:

- Prefer a small number of instanced or reused cloud shapes
- Prefer GLB over a collection of external model and texture files
- Use low or moderate mesh complexity for close clouds
- Disable shadows on decorative cloud models unless shadows are required
- Avoid loading hundreds of independent models
- Use 3D Tiles when spatial distribution, streaming, or level of detail becomes important
- Use `CloudCollection` when individual glTF assets are not needed

## Proposed next step

The lowest-risk prototype is to compare two implementations in a small Cesium scene:

1. A `CloudCollection` with several procedural cumulus clouds
2. One CC0-compatible or internally authored GLB cloud loaded with `Model.fromGltfAsync`

The comparison should measure visual quality, camera distance behavior, transparency, loading time, and frame rate before choosing a larger volumetric or 3D Tiles direction.
