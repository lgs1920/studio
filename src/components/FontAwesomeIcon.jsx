import { FontAwesomeIcon as FontAwesomeIconOrigin } from '@fortawesome/react-fontawesome'
import { SlIcon }                                   from '@shoelace-style/shoelace/dist/react'

export const FontAwesomeIcon = (props) => {

    let style = {}
    const handleLoad = (event) => {
        if (typeof props.icon === 'string') {
            event.target.updateComplete.then((result) => {
                // Once the icon has been loaded, we check if it is a FontAwesome Duotone
                const primary = event.target?.shadowRoot.querySelector('[part="svg"] path.fa-primary')
                const secondary = event.target?.shadowRoot.querySelector('[part="svg"] path.fa-secondary')
                if (primary && secondary) {
                    // If it is the case, let's add colors and opacities
                    event.target.classList.add('is-duotone')
                    event.target?.shadowRoot.querySelector('[part="svg"]').classList.add('svg-inline--fa')
                    primary.style.fill = 'var(--fa-primary-color,currentColor)'
                    primary.style.opacity = 'var(--fa-primary-opacity,1)'
                    secondary.style.fill = 'var(--fa-secondary-color,currentColor)'
                    secondary.style.opacity = 'var(--fa-secondary-opacity,0.4'
                }
            })
        }
    }

    return (

        <>
            {typeof props.icon === 'string' &&
                <SlIcon src={`/assets/icons/${props.icon}`} onSlLoad={handleLoad} {...props} />
            }
            {typeof props.icon === 'object' &&
                <FontAwesomeIconOrigin {...props}/>
            }
        </>
    )
}