/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: registerSW.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-24
 * Last modified: 2026-01-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/dev-sw.js?dev-sw', {scope: '/', type: 'module'})
}