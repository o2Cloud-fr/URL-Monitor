const { contextBridge, ipcRenderer } = require('electron');

// Exposition sécurisée des APIs vers le renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Surveiller une URL unique
  monitorUrl: (url) => ipcRenderer.invoke('monitor-url', url),
  
  // Surveiller plusieurs URLs
  monitorUrls: (urls) => ipcRenderer.invoke('monitor-urls', urls),
  
  // Charger les URLs sauvegardées
  loadUrls: () => ipcRenderer.invoke('load-urls'),
  
  // Sauvegarder les URLs
  saveUrls: (urls) => ipcRenderer.invoke('save-urls', urls),
  
  // Obtenir le chemin du dossier de données
  getDataPath: () => ipcRenderer.invoke('get-data-path')
});