# Replay Glow and Neon Cesium validation

## Status

Current implementation validation for milestone `1.1.0`.

Related issues: [#422](https://github.com/lgs1920/studio/issues/422), [#423](https://github.com/lgs1920/studio/issues/423), and [#424](https://github.com/lgs1920/studio/issues/424).

## Conclusion

The official Cesium API supports the replay implementation used here:

- `PolylineGlowMaterialProperty` provides the documented polyline `color`, `glowPower`, and `taperPower` properties used by the trace renderer.
- `PointGraphics` provides documented `color`, `pixelSize`, `heightReference`, and `disableDepthTestDistance` properties used by marker layers.
- `PointPrimitive` exposes color, size, outline, and depth behavior, but no native Neon material property.

Therefore, trace effects use `PolylineGlowMaterialProperty`, while marker Glow and Neon use renderer-owned layered `PointGraphics` entities. No undocumented Cesium point property or shader is required.

## Renderer contract

`JourneyReplayCesiumRenderer` resolves the shared effect mode from `replay.progression.effect` on every update. The outer effect layer uses the visible border color and border opacity, while the inner effect layer uses the fill color and fill opacity. When no border is visible, both layers fall back to the fill color and fill opacity. There is no independent effect opacity.

`No effect` keeps the existing trace polyline materials and marker point styling. Switching effects does not alter path sampling, camera behavior, or marker positioning.

## References

- [Cesium `PolylineGlowMaterialProperty`](https://cesium.com/learn/cesiumjs/ref-doc/PolylineGlowMaterialProperty.html)
- [Cesium `PointGraphics`](https://cesium.com/learn/cesiumjs/ref-doc/PointGraphics.html)
- [Cesium `PointPrimitive`](https://cesium.com/learn/cesiumjs/ref-doc/PointPrimitive.html)
- [Cesium `PolylineOutlineMaterialProperty`](https://cesium.com/learn/cesiumjs/ref-doc/PolylineOutlineMaterialProperty.html)
