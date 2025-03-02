import { useSnapshot } from 'valtio'
import { MapPOI }      from '../../cesium/MapPOI'
import './style.css'

/**
 * Functional React component that handles displaying a cluster of Points of Interest (POI) on the scene.
 *
 * @param {Object} props - The properties passed to the component (not used here, but left for future extensions).
 * @returns {JSX.Element} A list of MapPOI components rendered inside a div container with the ID "poi-list".
 */
export const MapPOICluster = () => {
    // Utiliser useSnapshot uniquement sur les keys pour la réactivité de la structure
    const list = useSnapshot(lgs.mainProxy.components.pois.list)
    return (
        <div id="poi-list">
            {__.ui.sceneManager.is3D && Array.from(list.keys()).map((id) => (
                <MapPOI key={id} point={id}/>
            ))}
        </div>
    )
}
