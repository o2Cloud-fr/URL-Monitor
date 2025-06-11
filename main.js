const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const tls = require('tls');

let mainWindow;

// Configuration du dossier de données
const APP_NAME = 'URL-Monitor';
const DATA_DIR = path.join(app.getPath('userData'), APP_NAME);
const URLS_FILE = path.join(DATA_DIR, 'urls.json');

// Configuration pour les requêtes HTTP
const HTTP_CONFIG = {
  timeout: 15000, // 15 secondes de timeout
  maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; URL-Monitor/1.0)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  }
};

// Créer le dossier de données s'il n'existe pas
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch (error) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Charger les URLs sauvegardées
async function loadUrls() {
  try {
    const data = await fs.readFile(URLS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Fichier n'existe pas ou erreur de lecture, retourner un tableau vide
    return [];
  }
}

// Sauvegarder les URLs
async function saveUrls(urls) {
  try {
    await ensureDataDir();
    await fs.writeFile(URLS_FILE, JSON.stringify(urls, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    return { success: false, error: error.message };
  }
}

// Fonction pour obtenir le message d'erreur HTTP approprié
function getHttpErrorMessage(status) {
  const httpMessages = {
    // 1xx Informational
    100: 'Continue',
    101: 'Switching Protocols',
    
    // 2xx Success (pas d'erreur)
    200: null, // OK
    201: null, // Created
    202: null, // Accepted
    204: null, // No Content
    
    // 3xx Redirection (généralement OK)
    300: 'Multiple Choices',
    301: null, // Moved Permanently (OK)
    302: null, // Found (OK)
    304: null, // Not Modified (OK)
    
    // 4xx Client Error
    400: 'Requête incorrecte (Bad Request)',
    401: 'Non autorisé (Unauthorized)',
    402: 'Paiement requis (Payment Required)',
    403: 'Accès interdit (Forbidden)',
    404: 'Page non trouvée (Not Found)',
    405: 'Méthode non autorisée (Method Not Allowed)',
    406: 'Non acceptable (Not Acceptable)',
    408: 'Timeout de la requête (Request Timeout)',
    409: 'Conflit (Conflict)',
    410: 'Ressource supprimée (Gone)',
    411: 'Longueur requise (Length Required)',
    412: 'Précondition échouée (Precondition Failed)',
    413: 'Entité trop large (Payload Too Large)',
    414: 'URI trop longue (URI Too Long)',
    415: 'Type de média non supporté (Unsupported Media Type)',
    416: 'Plage non satisfiable (Range Not Satisfiable)',
    417: 'Attente échouée (Expectation Failed)',
    418: 'Je suis une théière (I\'m a teapot)',
    421: 'Requête mal dirigée (Misdirected Request)',
    422: 'Entité non traitable (Unprocessable Entity)',
    423: 'Verrouillé (Locked)',
    424: 'Dépendance échouée (Failed Dependency)',
    425: 'Trop tôt (Too Early)',
    426: 'Mise à niveau requise (Upgrade Required)',
    428: 'Précondition requise (Precondition Required)',
    429: 'Trop de requêtes (Too Many Requests)',
    431: 'Champs d\'en-tête trop grands (Request Header Fields Too Large)',
    451: 'Indisponible pour des raisons légales (Unavailable For Legal Reasons)',
    
    // 5xx Server Error
    500: 'Erreur interne du serveur (Internal Server Error)',
    501: 'Non implémenté (Not Implemented)',
    502: 'Mauvaise passerelle (Bad Gateway)',
    503: 'Service indisponible (Service Unavailable)',
    504: 'Timeout de la passerelle (Gateway Timeout)',
    505: 'Version HTTP non supportée (HTTP Version Not Supported)',
    506: 'Variant Also Negotiates',
    507: 'Stockage insuffisant (Insufficient Storage)',
    508: 'Boucle détectée (Loop Detected)',
    510: 'Non étendu (Not Extended)',
    511: 'Authentification réseau requise (Network Authentication Required)'
  };
  
  return httpMessages[status] || `Code HTTP ${status}`;
}

// Fonction pour vérifier le certificat SSL
async function checkSSLCertificate(hostname, port = 443) {
  return new Promise((resolve, reject) => {
    const options = {
      host: hostname,
      port: port,
      servername: hostname,
      rejectUnauthorized: false // Pour pouvoir analyser même les certificats invalides
    };

    const socket = tls.connect(options, () => {
      try {
        const cert = socket.getPeerCertificate(true);
        const cipher = socket.getCipher();
        
        if (!cert || Object.keys(cert).length === 0) {
          socket.destroy();
          return resolve({
            valid: false,
            error: 'Aucun certificat trouvé',
            hasSSL: false
          });
        }

        const now = new Date();
        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));
        
        // Vérifier la validité du certificat
        const isValid = now >= validFrom && now <= validTo;
        const isExpired = now > validTo;
        const isNotYetValid = now < validFrom;
        
        // Analyser le niveau de sécurité du chiffrement
        let securityLevel = 'unknown';
        if (cipher) {
          const keyLength = cipher.bits || 0;
          if (keyLength >= 256) {
            securityLevel = 'high';
          } else if (keyLength >= 128) {
            securityLevel = 'medium';
          } else if (keyLength > 0) {
            securityLevel = 'low';
          }
        }

        // Extraire les informations du certificat
        const certInfo = {
          valid: isValid,
          hasSSL: true,
          issuer: cert.issuer ? cert.issuer.CN || cert.issuer.O || 'Inconnu' : 'Inconnu',
          subject: cert.subject ? cert.subject.CN || cert.subject.O || 'Inconnu' : 'Inconnu',
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysUntilExpiry: daysUntilExpiry,
          isExpired: isExpired,
          isNotYetValid: isNotYetValid,
          algorithm: cert.sigalg || 'Inconnu',
          fingerprint: cert.fingerprint || '',
          serialNumber: cert.serialNumber || '',
          version: cert.version || 0,
          cipher: cipher ? {
            name: cipher.name,
            version: cipher.version,
            bits: cipher.bits
          } : null,
          securityLevel: securityLevel,
          subjectAltName: cert.subjectaltname || null,
          error: null
        };

        // Ajouter des avertissements si nécessaire
        if (isExpired) {
          certInfo.error = `Certificat expiré depuis ${Math.abs(daysUntilExpiry)} jours`;
        } else if (isNotYetValid) {
          certInfo.error = `Certificat pas encore valide (valide à partir du ${validFrom.toLocaleDateString()})`;
        } else if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          certInfo.warning = `Certificat expire dans ${daysUntilExpiry} jours`;
        }

        socket.destroy();
        resolve(certInfo);

      } catch (error) {
        socket.destroy();
        resolve({
          valid: false,
          hasSSL: true,
          error: `Erreur d'analyse du certificat: ${error.message}`
        });
      }
    });

    socket.on('error', (error) => {
      let errorMessage = 'Erreur SSL inconnue';
      
      if (error.code === 'ENOTFOUND') {
        errorMessage = 'Hôte introuvable';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connexion SSL refusée';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Timeout SSL';
      } else if (error.code === 'CERT_HAS_EXPIRED') {
        errorMessage = 'Certificat SSL expiré';
      } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        errorMessage = 'Certificat SSL non vérifiable';
      } else if (error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
        errorMessage = 'Certificat auto-signé dans la chaîne';
      } else if (error.message) {
        errorMessage = error.message;
      }

      resolve({
        valid: false,
        hasSSL: true,
        error: errorMessage
      });
    });

    socket.setTimeout(10000, () => {
      socket.destroy();
      resolve({
        valid: false,
        hasSSL: false,
        error: 'Timeout lors de la vérification SSL'
      });
    });
  });
}

// Configuration de la fenêtre principale
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset', // Style macOS
    frame: false, // Pour un look plus moderne
    backgroundColor: '#f5f5f7',
    show: false, // Ne pas afficher tant que ready-to-show n'est pas émis
    vibrancy: 'under-window', // Effet de transparence macOS (si disponible)
    webSecurity: true
  });

  // Charger le fichier HTML
  mainWindow.loadFile(path.join(__dirname, 'renderer.html'));

  // Afficher la fenêtre quand elle est prête
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Ouvrir les DevTools en mode développement
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// Fonction pour surveiller une URL avec gestion d'erreurs améliorée et SSL
async function monitorUrl(url) {
  const startTime = Date.now();
  
  try {
    // Validation de l'URL
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Protocole non supporté');
    }

    // Vérifier le certificat SSL si c'est une URL HTTPS
    let sslInfo = null;
    if (urlObj.protocol === 'https:') {
      try {
        const port = urlObj.port || 443;
        sslInfo = await checkSSLCertificate(urlObj.hostname, parseInt(port));
      } catch (sslError) {
        console.warn('Erreur lors de la vérification SSL:', sslError);
        sslInfo = {
          valid: false,
          hasSSL: true,
          error: `Erreur SSL: ${sslError.message}`
        };
      }
    }

    // Configuration spécifique pour cette requête
    const config = {
      ...HTTP_CONFIG,
      url: url,
      method: 'GET',
      validateStatus: function (status) {
        // Accepter tous les codes de statut pour les analyser correctement
        return status >= 100 && status < 600;
      }
    };

    const response = await axios(config);
    const responseTime = Date.now() - startTime;

    // Extraire le titre de la page
    let title = 'Sans titre';
    if (response.data && typeof response.data === 'string') {
      try {
        const $ = cheerio.load(response.data);
        const titleElement = $('title').first();
        title = titleElement.text().trim() || 'Sans titre';
        
        if (title.length > 100) {
          title = title.substring(0, 97) + '...';
        }
      } catch (parseError) {
        console.warn('Erreur lors de l\'extraction du titre:', parseError.message);
        title = urlObj.hostname;
      }
    } else {
      title = urlObj.hostname;
    }

    // Gérer correctement tous les codes de statut HTTP
    let errorMessage = null;
    let success = false;

    if (response.status >= 200 && response.status < 300) {
      // 2xx - Succès
      success = true;
    } else if (response.status >= 300 && response.status < 400) {
      // 3xx - Redirection (généralement OK mais à noter)
      success = true; // Les redirections sont gérées automatiquement par axios
    } else if (response.status >= 400 && response.status < 500) {
      // 4xx - Erreur client
      success = false;
      errorMessage = getHttpErrorMessage(response.status);
    } else if (response.status >= 500) {
      // 5xx - Erreur serveur
      success = false;
      errorMessage = getHttpErrorMessage(response.status);
    }

    return {
      url,
      status: response.status,
      title,
      responseTime,
      timestamp: new Date().toISOString(),
      success,
      error: errorMessage,
      ssl: sslInfo // Ajouter les informations SSL
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    let errorMessage = 'Erreur inconnue';
    let status = 0;

    // Améliorer la gestion des erreurs réseau
    if (error.response) {
      // Le serveur a répondu avec un code d'erreur
      status = error.response.status;
      errorMessage = getHttpErrorMessage(status);
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Nom de domaine introuvable (DNS)';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connexion refusée par le serveur';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      errorMessage = 'Timeout de connexion (15s)';
    } else if (error.code === 'EPROTO') {
      errorMessage = 'Erreur de protocole SSL/TLS';
    } else if (error.code === 'CERT_HAS_EXPIRED') {
      errorMessage = 'Certificat SSL expiré';
    } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      errorMessage = 'Certificat SSL non vérifiable';
    } else if (error.code === 'ECONNRESET') {
      errorMessage = 'Connexion fermée par le serveur';
    } else if (error.code === 'EHOSTUNREACH') {
      errorMessage = 'Hôte inaccessible';
    } else if (error.code === 'ENETUNREACH') {
      errorMessage = 'Réseau inaccessible';
    } else if (error.request) {
      errorMessage = 'Aucune réponse du serveur';
    } else {
      errorMessage = error.message || 'Erreur de connexion inconnue';
    }

    // Extraire le nom d'hôte pour le titre en cas d'erreur
    let title = 'Erreur';
    let sslInfo = null;
    try {
      const urlObj = new URL(url);
      title = urlObj.hostname;
      
      // Même en cas d'erreur HTTP, essayer de vérifier SSL si c'est HTTPS
      if (urlObj.protocol === 'https:') {
        try {
          const port = urlObj.port || 443;
          sslInfo = await checkSSLCertificate(urlObj.hostname, parseInt(port));
        } catch (sslError) {
          sslInfo = {
            valid: false,
            hasSSL: true,
            error: `Erreur SSL: ${sslError.message}`
          };
        }
      }
    } catch (parseError) {
      title = 'URL invalide';
    }

    return {
      url,
      status,
      title,
      responseTime,
      timestamp: new Date().toISOString(),
      success: false,
      error: errorMessage,
      ssl: sslInfo
    };
  }
}

// Fonction pour surveiller plusieurs URLs en parallèle avec limitation
async function monitorUrls(urls) {
  const MAX_CONCURRENT = 3; // Limiter les requêtes simultanées
  const results = [];
  
  // Traiter les URLs par lots
  for (let i = 0; i < urls.length; i += MAX_CONCURRENT) {
    const batch = urls.slice(i, i + MAX_CONCURRENT);
    const batchPromises = batch.map(url => monitorUrl(url));
    
    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    } catch (error) {
      console.error('Erreur lors du traitement d\'un lot:', error);
      // Ajouter des résultats d'erreur pour ce lot
      batch.forEach(url => {
        results.push({
          url,
          status: 0,
          title: 'Erreur de lot',
          responseTime: 0,
          timestamp: new Date().toISOString(),
          success: false,
          error: 'Erreur de traitement par lot',
          ssl: null
        });
      });
    }
    
    // Petite pause entre les lots pour éviter la surcharge
    if (i + MAX_CONCURRENT < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

// Gestionnaires IPC
ipcMain.handle('monitor-url', async (event, url) => {
  try {
    return await monitorUrl(url);
  } catch (error) {
    console.error('Erreur dans monitor-url:', error);
    return {
      url,
      status: 0,
      title: 'Erreur système',
      responseTime: 0,
      timestamp: new Date().toISOString(),
      success: false,
      error: error.message,
      ssl: null
    };
  }
});

ipcMain.handle('monitor-urls', async (event, urls) => {
  try {
    return await monitorUrls(urls);
  } catch (error) {
    console.error('Erreur dans monitor-urls:', error);
    return urls.map(url => ({
      url,
      status: 0,
      title: 'Erreur système',
      responseTime: 0,
      timestamp: new Date().toISOString(),
      success: false,
      error: error.message,
      ssl: null
    }));
  }
});

// Gestionnaire IPC spécifique pour vérifier uniquement SSL
ipcMain.handle('check-ssl', async (event, url) => {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'https:') {
      return {
        valid: false,
        hasSSL: false,
        error: 'URL non HTTPS'
      };
    }
    
    const port = urlObj.port || 443;
    return await checkSSLCertificate(urlObj.hostname, parseInt(port));
  } catch (error) {
    console.error('Erreur dans check-ssl:', error);
    return {
      valid: false,
      hasSSL: false,
      error: error.message
    };
  }
});

// Gestionnaires IPC pour la persistance des données
ipcMain.handle('load-urls', async () => {
  try {
    return await loadUrls();
  } catch (error) {
    console.error('Erreur lors du chargement des URLs:', error);
    return [];
  }
});

ipcMain.handle('save-urls', async (event, urls) => {
  try {
    return await saveUrls(urls);
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des URLs:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-data-path', () => {
  return DATA_DIR;
});

// Gestionnaire pour l'export des données
ipcMain.handle('export-data', async () => {
  try {
    const urls = await loadUrls();
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.1', // Mise à jour de version pour inclure SSL
      urls: urls
    };
    
    const exportPath = path.join(DATA_DIR, `export-${Date.now()}.json`);
    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2), 'utf8');
    
    return { success: true, path: exportPath };
  } catch (error) {
    console.error('Erreur lors de l\'export:', error);
    return { success: false, error: error.message };
  }
});

// Gestionnaire pour nettoyer les anciennes données
ipcMain.handle('cleanup-data', async () => {
  try {
    // Ici on pourrait implémenter un nettoyage des anciennes sauvegardes
    // ou des logs, selon les besoins
    return { success: true, message: 'Nettoyage effectué' };
  } catch (error) {
    console.error('Erreur lors du nettoyage:', error);
    return { success: false, error: error.message };
  }
});

// Événements de l'application
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('Erreur non capturée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesse rejetée non gérée:', reason);
});

// Nettoyage avant fermeture
app.on('before-quit', async () => {
  // Sauvegarder toute donnée en attente si nécessaire
  console.log('Application en cours de fermeture...');
});