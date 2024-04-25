import { SlAlert, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { UIToast }         from '@Utils/UIToast'
import { useState }        from 'react'

/**
 * Toast
 *
 * @param message
 * @param type
 * @param duration
 *
 */
export const useToast = ({message = message, type = 'primary', duration = UIToast.DURATION}) => {

    const [showToast, setShowToast] = useState(false)

    if (typeof message === 'string') {
        message = {caption: message}
    }
    const caption = message.caption !== undefined && message.caption !== null && message.caption !== ''
    const iconName = (icon) => UIToast.icon(icon)

    const Toast = () => {
        return (
            <SlAlert open={showToast} variant={type} closable>
                <SlIcon slot="icon" library="fa" name={iconName(type)}></SlIcon>
                {caption &&
                    <div className="toast-caption">${message.caption}</div>
                }
                <div className="toast-text">{message.text}</div>
            </SlAlert>
        )
    }

    const trigger = () => setShowToast(true)
    const toast = <Toast/>

    return [toast, trigger]

}
