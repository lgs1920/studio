/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PopupDrawer.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-06
 * Last modified: 2026-06-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSPopup } from '@Components/LGSPopup'
import { WaCard } from '@web.awesome.me/webawesome-pro/dist/react'
import classNames from 'classnames'
import { forwardRef, memo } from 'react'

export const PopupDrawer = memo(forwardRef(function PopupDrawer(props, ref) {
    const {
              active = false,
              anchor,
              onRequestClose,
              header = null,
              headerActions = null,
              footer = null,
              children,
              className = '',
              cardClassName = '',
              appearance = 'filled',
              popupProps = {},
              ...restProps
          } = props

    return (
        <LGSPopup
            ref={ref}
            active={active}
            anchor={anchor}
            onRequestClose={onRequestClose}
            {...popupProps}
            {...restProps}
        >
            <WaCard
                appearance={appearance}
                className={classNames('lgs--popup-in-drawer lgs-slide-down', className, cardClassName)}
            >
                {headerActions}
                {header !== null && (
                    <span slot="header">{header}</span>
                )}
                {children}
                {footer !== null && (
                    <div slot="footer">
                        <div className="lgs--popup-in-drawer-footer">
                            {footer}
                        </div>
                    </div>
                )}
            </WaCard>
        </LGSPopup>
    )
}))

export default PopupDrawer
