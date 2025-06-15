// État de l'application
let urls = [];
let monitoringInterval = null;
let saveTimeout = null;

// Configuration du monitoring
const MONITORING_INTERVAL = 60000; // 60 secondes (1 minute)
const SAVE_DEBOUNCE_TIME = 1000; // 1 seconde pour la sauvegarde

// Éléments du DOM
const urlInput = document.getElementById('urlInput');
const addUrlBtn = document.getElementById('addUrlBtn');
const monitorAllBtn = document.getElementById('monitorAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const urlList = document.getElementById('urlList');
const emptyState = document.getElementById('emptyState');

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadSavedUrls();
  updateEmptyState();
});

// Charger les URLs sauvegardées au démarrage
async function loadSavedUrls() {
  try {
    const savedUrls = await window.electronAPI.loadUrls();
    if (savedUrls && savedUrls.length > 0) {
      urls = savedUrls;
      renderUrlList();
      showNotification(`${savedUrls.length} URL(s) chargée(s)`, 'success');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des URLs:', error);
    showNotification('Erreur lors du chargement des données', 'error');
  }
}

// Sauvegarder les URLs avec debounce
function saveUrlsDebounced() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = setTimeout(async () => {
    try {
      const result = await window.electronAPI.saveUrls(urls);
      if (!result.success) {
        console.error('Erreur de sauvegarde:', result.error);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  }, SAVE_DEBOUNCE_TIME);
}

// Configuration des événements
function setupEventListeners() {
  // Ajouter une URL
  addUrlBtn.addEventListener('click', addUrl);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addUrl();
  });

  // Surveiller toutes les URLs
  monitorAllBtn.addEventListener('click', toggleMonitoring);

  // Effacer toutes les URLs
  clearAllBtn.addEventListener('click', clearAllUrls);

  // Sauvegarder avant fermeture
  window.addEventListener('beforeunload', async () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      await window.electronAPI.saveUrls(urls);
    }
  });
}

// Ajouter une nouvelle URL
function addUrl() {
  const url = urlInput.value.trim();
  
  if (!url) {
    showNotification('Veuillez entrer une URL', 'error');
    return;
  }

  if (!isValidUrl(url)) {
    showNotification('URL invalide', 'error');
    return;
  }

  if (urls.some(item => item.url === url)) {
    showNotification('Cette URL est déjà surveillée', 'warning');
    return;
  }

  // Ajouter l'URL à la liste
  const urlItem = {
    id: Date.now(),
    url: url,
    status: null,
    title: null,
    responseTime: null,
    lastCheck: null,
    error: null,
    addedAt: new Date().toISOString(),
    checkCount: 0,
    errorCount: 0
  };

  urls.push(urlItem);
  urlInput.value = '';
  
  renderUrlList();
  updateEmptyState();
  saveUrlsDebounced();
  
  // Vérifier immédiatement la nouvelle URL
  checkUrl(urlItem);
}

// Valider une URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Vérifier une URL spécifique avec gestion d'erreurs améliorée
async function checkUrl(urlItem) {
  const element = document.querySelector(`[data-id="${urlItem.id}"]`);
  if (element) {
    element.classList.add('loading');
  }

  try {
    const result = await window.electronAPI.monitorUrl(urlItem.url);
    
    // Incrémenter le compteur de vérifications
    urlItem.checkCount = (urlItem.checkCount || 0) + 1;
    
    // Mettre à jour correctement les données selon le résultat
    urlItem.status = result.status;
    urlItem.title = result.title;
    urlItem.responseTime = result.responseTime;
    urlItem.lastCheck = new Date().toLocaleTimeString();
    
    // Gérer les erreurs selon le success du résultat
    if (result.success) {
      urlItem.error = null; // Pas d'erreur si succès
    } else {
      urlItem.error = result.error;
      urlItem.errorCount = (urlItem.errorCount || 0) + 1;
    }

    // Mettre à jour l'affichage
    renderUrlItem(urlItem);
    saveUrlsDebounced();
    
    // Notification basée sur le succès, pas seulement le code
    const statusText = result.status ? `HTTP ${result.status}` : 'Erreur';
    const notifType = result.success ? 'success' : 'error';
    
    if (!result.success || urlItem.checkCount === 1) {
      showNotification(
        `${formatUrl(urlItem.url)}: ${statusText}${result.error ? ' - ' + result.error : ''}`,
        notifType
      );
    }
    
  } catch (error) {
    urlItem.error = error.message;
    urlItem.errorCount = (urlItem.errorCount || 0) + 1;
    urlItem.status = 0; // Code 0 pour les erreurs de connexion
    renderUrlItem(urlItem);
    saveUrlsDebounced();
    
    if (urlItem.errorCount <= 3) {
      showNotification(`Erreur ${formatUrl(urlItem.url)}: ${error.message}`, 'error');
    }
  }

  if (element) {
    element.classList.remove('loading');
  }
}

// Vérifier toutes les URLs avec gestion séquentielle pour éviter la surcharge
async function checkAllUrls() {
  if (urls.length === 0) return;

  showNotification(`Vérification de ${urls.length} URL(s)...`, 'info');
  
  try {
    // Vérification par lots pour éviter de surcharger le serveur
    const batchSize = 5;
    const batches = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      batches.push(urls.slice(i, i + batchSize));
    }
    
    // Traiter chaque lot avec un délai
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const urlsToCheck = batch.map(item => item.url);
      
      try {
        const results = await window.electronAPI.monitorUrls(urlsToCheck);
        
        results.forEach((result, index) => {
          const urlItem = batch[index];
          urlItem.checkCount = (urlItem.checkCount || 0) + 1;
          urlItem.status = result.status;
          urlItem.title = result.title;
          urlItem.responseTime = result.responseTime;
          urlItem.lastCheck = new Date().toLocaleTimeString();
          
          if (result.success) {
            urlItem.error = null;
          } else {
            urlItem.error = result.error;
            urlItem.errorCount = (urlItem.errorCount || 0) + 1;
          }
        });
      } catch (error) {
        console.error(`Erreur lors de la vérification du lot ${i + 1}:`, error);
        // Marquer toutes les URLs du lot comme ayant une erreur
        batch.forEach(urlItem => {
          urlItem.error = `Erreur de lot: ${error.message}`;
          urlItem.errorCount = (urlItem.errorCount || 0) + 1;
        });
      }
      
      // Délai entre les lots pour éviter la surcharge
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    renderUrlList();
    saveUrlsDebounced();
    
    const errorCount = urls.filter(url => url.error).length;
    const successCount = urls.length - errorCount;
    
    showNotification(
      `Vérification terminée: ${successCount} OK, ${errorCount} erreurs`,
      errorCount > successCount ? 'warning' : 'success'
    );
    
  } catch (error) {
    showNotification(`Erreur générale: ${error.message}`, 'error');
  }
}

// Basculer le monitoring automatique
function toggleMonitoring() {
  if (monitoringInterval) {
    // Arrêter le monitoring
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    monitorAllBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 12l2 2 4-4"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
      Surveiller tout
    `;
    monitorAllBtn.style.background = '';
    monitorAllBtn.style.color = '';
    showNotification('Monitoring arrêté', 'info');
  } else {
    // Démarrer le monitoring
    if (urls.length === 0) {
      showNotification('Aucune URL à surveiller', 'warning');
      return;
    }
    
    checkAllUrls(); // Vérification immédiate
    monitoringInterval = setInterval(checkAllUrls, MONITORING_INTERVAL); // Toutes les minutes
    monitorAllBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
      </svg>
      Arrêter
    `;
    monitorAllBtn.style.background = 'var(--error-color)';
    monitorAllBtn.style.color = 'white';
    showNotification(`Monitoring démarré (vérification chaque minute)`, 'success');
  }
}

// Effacer toutes les URLs
async function clearAllUrls() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    monitorAllBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 12l2 2 4-4"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
      Surveiller tout
    `;
    monitorAllBtn.style.background = '';
    monitorAllBtn.style.color = '';
  }

  urls = [];
  renderUrlList();
  updateEmptyState();
  
  // Sauvegarder immédiatement la liste vide
  try {
    await window.electronAPI.saveUrls(urls);
    showNotification('Toutes les URLs ont été supprimées', 'success');
  } catch (error) {
    showNotification('Erreur lors de la sauvegarde', 'error');
  }
}

// Supprimer une URL spécifique
function removeUrl(id) {
  urls = urls.filter(item => item.id !== id);
  renderUrlList();
  updateEmptyState();
  saveUrlsDebounced();
  showNotification('URL supprimée', 'success');
}

// Rendu de la liste des URLs
function renderUrlList() {
  urlList.innerHTML = '';
  
  urls.forEach(urlItem => {
    const element = createUrlElement(urlItem);
    urlList.appendChild(element);
  });
}

// Rendu d'un élément URL spécifique
function renderUrlItem(urlItem) {
  const existingElement = document.querySelector(`[data-id="${urlItem.id}"]`);
  if (existingElement) {
    const newElement = createUrlElement(urlItem);
    existingElement.replaceWith(newElement);
  }
}

// Créer un élément URL dans le DOM
function createUrlElement(urlItem) {
  const element = document.createElement('div');
  element.className = 'url-item';
  element.setAttribute('data-id', urlItem.id);

  // Déterminer le statut et la couleur
  let statusClass = 'status-unknown';
  let statusText = 'En attente...';
  let statusIcon = '⏳';

  if (urlItem.status !== null) {
    if (urlItem.status >= 200 && urlItem.status < 300) {
      statusClass = 'status-success';
      statusText = `HTTP ${urlItem.status}`;
      statusIcon = '✅';
    } else if (urlItem.status >= 300 && urlItem.status < 400) {
      statusClass = 'status-redirect';
      statusText = `HTTP ${urlItem.status}`;
      statusIcon = '🔄';
    } else if (urlItem.status >= 400 && urlItem.status < 500) {
      statusClass = 'status-client-error';
      statusText = `HTTP ${urlItem.status}`;
      statusIcon = '⚠️';
    } else if (urlItem.status >= 500) {
      statusClass = 'status-server-error';
      statusText = `HTTP ${urlItem.status}`;
      statusIcon = '❌';
    } else if (urlItem.status === 0) {
      statusClass = 'status-connection-error';
      statusText = 'Erreur de connexion';
      statusIcon = '🔌';
    }
  }

  element.innerHTML = `
    <div class="url-header">
      <div class="url-info">
        <div class="url-title">${escapeHtml(urlItem.title || formatUrl(urlItem.url))}</div>
        <div class="url-address">${escapeHtml(urlItem.url)}</div>
      </div>
      <div class="url-actions">
        <button class="btn-check" onclick="checkUrl(urls.find(u => u.id === ${urlItem.id}))" title="Vérifier maintenant">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button class="btn-remove" onclick="removeUrl(${urlItem.id})" title="Supprimer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c0-1 1-2 2-2v2"/>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="url-status">
      <div class="status-indicator ${statusClass}">
        <span class="status-icon">${statusIcon}</span>
        <span class="status-text">${statusText}</span>
      </div>
      
      <div class="url-details">
        ${urlItem.responseTime ? `<span class="response-time">${urlItem.responseTime}ms</span>` : ''}
        ${urlItem.lastCheck ? `<span class="last-check">Dernière vérif: ${urlItem.lastCheck}</span>` : ''}
        ${urlItem.checkCount ? `<span class="check-count">${urlItem.checkCount} vérif.</span>` : ''}
        ${urlItem.errorCount && urlItem.errorCount > 0 ? `<span class="error-count">${urlItem.errorCount} erreurs</span>` : ''}
      </div>
    </div>
    
    ${urlItem.error ? `
      <div class="error-message">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        ${escapeHtml(urlItem.error)}
      </div>
    ` : ''}
  `;

  return element;
}

// Mettre à jour l'état vide
function updateEmptyState() {
  if (urls.length === 0) {
    emptyState.style.display = 'flex';
    urlList.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    urlList.style.display = 'block';
  }
}

// Formater une URL pour l'affichage
function formatUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
  } catch (error) {
    return url;
  }
}

// Échapper le HTML pour éviter les injections XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Système de notifications
function showNotification(message, type = 'info', duration = 4000) {
  // Supprimer les anciennes notifications du même type
  const existingNotifs = document.querySelectorAll(`.notification.${type}`);
  existingNotifs.forEach(notif => notif.remove());

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  // Icônes selon le type
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${icons[type] || icons.info}</span>
      <span class="notification-message">${escapeHtml(message)}</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;

  document.body.appendChild(notification);

  // Animation d'entrée
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  // Suppression automatique
  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 300);
    }
  }, duration);
}

// Gestion des raccourcis clavier
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + Enter pour ajouter une URL
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    addUrl();
    e.preventDefault();
  }
  
  // Ctrl/Cmd + R pour vérifier toutes les URLs
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    checkAllUrls();
    e.preventDefault();
  }
  
  // Échap pour arrêter le monitoring
  if (e.key === 'Escape' && monitoringInterval) {
    toggleMonitoring();
    e.preventDefault();
  }
});

// Focus automatique sur le champ d'entrée au chargement
window.addEventListener('load', () => {
  if (urlInput) {
    urlInput.focus();
  }
});

// Gestion de la visibilité de la page pour optimiser les performances
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page cachée, on peut réduire la fréquence de monitoring
    console.log('Page cachée, monitoring en arrière-plan');
  } else {
    // Page visible, reprendre le monitoring normal
    console.log('Page visible, monitoring actif');
    if (monitoringInterval && urls.length > 0) {
      // Vérification immédiate quand on revient sur la page
      checkAllUrls();
    }
  }
});

// Fonctions utilitaires pour l'export/import (futures fonctionnalités)
function exportData() {
  const dataStr = JSON.stringify({
    urls: urls,
    exportDate: new Date().toISOString(),
    version: '1.0'
  }, null, 2);
  
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `url-monitor-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  showNotification('Données exportées avec succès', 'success');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (importedData.urls && Array.isArray(importedData.urls)) {
        urls = importedData.urls;
        renderUrlList();
        updateEmptyState();
        saveUrlsDebounced();
        showNotification(`${urls.length} URL(s) importée(s) avec succès`, 'success');
      } else {
        throw new Error('Format de fichier invalide');
      }
    } catch (error) {
      showNotification('Erreur lors de l\'importation: ' + error.message, 'error');
    }
  };
  reader.readAsText(file);
}

// Statistiques et métriques
function getStats() {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  
  return {
    totalUrls: urls.length,
    activeUrls: urls.filter(url => url.status && url.status >= 200 && url.status < 300).length,
    errorUrls: urls.filter(url => url.error || (url.status && url.status >= 400)).length,
    recentChecks: urls.filter(url => url.lastCheck && (now - new Date(url.lastCheck).getTime()) < oneHour).length,
    avgResponseTime: urls.filter(url => url.responseTime).reduce((sum, url) => sum + url.responseTime, 0) / urls.filter(url => url.responseTime).length || 0
  };
}

// Console de debug (accessible via F12)
window.urlMonitorDebug = {
  urls: () => urls,
  stats: getStats,
  checkAll: checkAllUrls,
  exportData: exportData,
  clearAll: clearAllUrls,
  version: '1.0.0'
};

console.log('URL Monitor v1.0.0 - Debug tools available via window.urlMonitorDebug');