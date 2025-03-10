import { POI_CATEGORY_ICONS, POI_STANDARD_TYPE } from '@Core/constants'
import { FontAwesomeIcon }                       from '@fortawesome/react-fontawesome'
import { SlOption, SlSelect }                    from '@shoelace-style/shoelace/dist/react'
import { useState }                              from 'react'
import { useSnapshot }                           from 'valtio'

export const MapPOICategorySelector = (point, props) => {

    const store = lgs.mainProxy.components.pois
    const pois = useSnapshot(store)

    const [category, setCategory] = useState(store.categories.get(point.category ?? POI_STANDARD_TYPE))
    const [icon, setIcon] = useState(Object.values(POI_CATEGORY_ICONS.get(category.slug))[0])

    const handleCategory = async (event) => {
        Object.assign(__.ui.poiManager.list.get(pois.current.id), {
            category: event.target.value,
        })
        await __.ui.poiManager.saveInDB(__.ui.poiManager.list.get(pois.current.id))

        setIcon(Object.values(POI_CATEGORY_ICONS.get(event.target.value))[0])
        setCategory(store.categories.get(event.target.value))
    }


    return (
        <SlSelect label={'Category'} value={pois.current.category} size={props?.size ?? 'small'}
                  className="map-poi-categorie-selector"
                  onSlChange={handleCategory}>
            <FontAwesomeIcon slot="prefix" icon={pois.current.icon} style={{
                '--fa-secondary-color':   pois.current.color,
                '--fa-secondary-opacity': 0.5,
            }}/>
            {Array.from(pois.categories).map(([slug, category]) =>
                                                 <SlOption key={slug} value={slug}>
                                                     <FontAwesomeIcon slot="prefix"
                                                                      icon={Object.values(POI_CATEGORY_ICONS.get(slug))[0]}
                                                                      style={{
                                                                          '--fa-secondary-color':   pois.current.color,
                                                                          '--fa-secondary-opacity': 0.5,
                                                                      }}/>
                                                     {category.title}
                                                 </SlOption>,
            )}
        </SlSelect>
    )
}