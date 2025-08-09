/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PWAInstallButton.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-09
 * Last modified: 2025-08-09
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SlButton }            from '@shoelace-style/shoelace/dist/react'
import { useEffect, useState } from 'react'

export const PWAInstallButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallButton(false);
    }
  };

  if (!showInstallButton) return null;

  return (
    <SlButton size="small" onClick={handleInstall}>
        {'Install App'}
    </SlButton>
  );
};
