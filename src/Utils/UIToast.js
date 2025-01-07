import { SECOND }                                                      from '@Core/constants'
import { faBomb, faCircleCheck, faCircleInfo, faTriangleExclamation } from '@fortawesome/pro-solid-svg-icons'
import {
    slideInUp,
}                                                                      from '@shoelace-style/animations/dist/sliding_entrances/slideInUp'
import {
    slideOutLeft,
}                                                                      from '@shoelace-style/animations/dist/sliding_exits/slideOutLeft'
import {
    setAnimation,
}                                                                      from '@shoelace-style/shoelace/dist/utilities/animation-registry'
import { FA2SL }                                                       from '@Utils/FA2SL'

export const LGS_INFORMATION_TOAST = 'information'
export const LGS_SUCCESS_TOAST = 'success'
export const LGS_WARNING_TOAST = 'warning'
export const LGS_ERROR_TOAST = 'danger'

export class UIToast {

    static DURATION = 4000 * SECOND

    static LGS_TOAST_ICONS = {
        [LGS_INFORMATION_TOAST]: faCircleInfo,
        [LGS_SUCCESS_TOAST]: faCircleCheck,
        [LGS_WARNING_TOAST]: faTriangleExclamation,
        [LGS_ERROR_TOAST]: faBomb,
    }

    static #notify = (message, type = LGS_INFORMATION_TOAST, duration = this.DURATION) => {
        if (typeof message === 'string') {
            message = {caption: message}
        }
        const alert = Object.assign(document.createElement('sl-alert'), {
            variant: type,
            closable: true,
            duration: duration,
            innerHTML: `
              <sl-icon slot='icon' library="fa" name="${FA2SL.set(UIToast.LGS_TOAST_ICONS[type])}"></sl-icon>

        ${(UIToast.#setNotificationContent(message))}
      
      `,
        })

        // Add animations
        setAnimation(alert, 'alert.hide', {
            keyframes: slideOutLeft,
            options: {
                duration: 200,
            },
        })
        setAnimation(alert, 'alert.show', {
            keyframes: slideInUp,
            options: {
                duration: 400,
            },
        })

        document.body.append(alert)
        return alert.toast()
    }

    static notify = (message, duration = UIToast.DURATION) => {
        UIToast.#notify(message, LGS_INFORMATION_TOAST, duration)
    }
    static success = (message, duration = UIToast.DURATION) => {
        UIToast.#notify(message, LGS_SUCCESS_TOAST, duration)
    }
    static warning = (message, duration = UIToast.DURATION) => {
        UIToast.#notify(message, LGS_WARNING_TOAST, duration)
    }
    static error = (message, duration = UIToast.DURATION) => {
        UIToast.#notify(message, LGS_ERROR_TOAST, duration)
    }

    static #setNotificationContent = (message = {}) => {
        let content = message.caption ? `<div class="toast-caption">${message.caption}</div>` : ''
        content += message.text ? `<div class="toast-text">${message.text}</div>` : ''
        let errors = message.errors ??[]
        if (!Array.isArray(errors)) {
            errors = [errors]
        }
        //errors.forEach(error => {
       //    content +=` <div class="toast-error">${error.message}</div>`
        // })
        return content
    }
}