# 🌐 URL Monitor - Surveillance d'URLs en temps réel

**URL Monitor** est une application desktop moderne et élégante pour surveiller la disponibilité et les performances de vos URLs en temps réel. Construite avec Electron et Node.js, elle offre une interface utilisateur glassmorphique avec des animations fluides pour une expérience utilisateur exceptionnelle.

![Banner](https://o2cloud.fr/logo/o2Cloud.png)

## ✨ Fonctionnalités principales

- 🔍 **Surveillance en temps réel** - Monitoring automatique toutes les 30 secondes
- 📊 **Tableau de bord intuitif** - Interface moderne avec design glassmorphique
- ⚡ **Performances détaillées** - Temps de réponse et codes de statut HTTP
- 📱 **Design responsive** - Compatible avec différentes tailles d'écran
- 💾 **Sauvegarde automatique** - Persistance des données avec stockage local
- 🎨 **Animations fluides** - Transitions et effets visuels modernes
- 📈 **Statistiques en direct** - Compteurs de statut 2xx, 4xx, 5xx
- 📤 **Export de données** - Sauvegarde des résultats de monitoring
- 🔔 **Notifications** - Alertes en temps réel pour chaque vérification
- 🖥️ **Application native** - Interface desktop avec style macOS/Windows

## 🎯 Cas d'usage

- **Monitoring de production** - Surveillez vos sites web critiques
- **Tests de performance** - Analysez les temps de réponse
- **Détection de pannes** - Alertes automatiques en cas de problème
- **Suivi SLA** - Mesure de disponibilité des services
- **Tests de charge** - Vérification simultanée de multiples endpoints

## 🚀 Installation

### Prérequis

- Node.js (version 16 ou supérieure)
- npm ou yarn

### Installation depuis les sources

```bash
# Clonez le dépôt
git clone https://github.com/o2Cloud-fr/url-monitor.git
cd url-monitor

# Installez les dépendances
npm install

# Lancez l'application en mode développement
npm start

# Ou en mode développement avec DevTools
npm run dev
```

### Installation des dépendances

```bash
# Dépendances principales
npm install electron axios cheerio

# Dépendances de développement
npm install --save-dev electron-builder
```

### Construction des exécutables

```bash
# Construction pour toutes les plateformes
npm run build

# Construction spécifique Windows
npm run build-win

# Construction spécifique Linux
npm run build-linux

# Package sans installateur
npm run pack
```

## 📚 Utilisation

### Démarrage de l'application

```bash
# Démarrage normal
npm start

# Démarrage en mode développement (avec DevTools)
npm run dev

# Via Electron directement
npx electron .
```

### Interface utilisateur

L'application dispose d'une interface native avec :

- **Barre de titre moderne** - Style macOS avec effets de transparence
- **Zone d'ajout d'URL** - Champ de saisie avec validation automatique
- **Boutons d'action** :
  - 🔍 **Surveiller tout** - Démarre le monitoring automatique
  - 🗑️ **Effacer tout** - Supprime toutes les URLs
  - 🔄 **Vérifier maintenant** - Vérifie toutes les URLs immédiatement
  - 📤 **Export** - Sauvegarde les données

### Ajout d'URLs

1. Saisissez une URL complète (ex: `https://example.com`)
2. Cliquez sur "Ajouter URL" ou appuyez sur Entrée
3. L'URL est automatiquement vérifiée et ajoutée à la liste

### Surveillance automatique

- Cliquez sur "Surveiller tout" pour démarrer le monitoring
- Les URLs sont vérifiées toutes les 30 secondes avec limitation de 3 requêtes simultanées
- Le bouton devient "Arrêter" pendant la surveillance active
- Les notifications s'affichent pour chaque vérification

## 🎨 Fonctionnalités visuelles

### Design moderne

- **Glassmorphisme** - Effets de transparence et de flou
- **Animations fluides** - Transitions CSS3 avancées
- **Micro-interactions** - Effets au survol et animations de chargement
- **Interface native** - Intégration parfaite avec l'OS

### Indicateurs de statut

- 🟢 **Vert** - Statuts 2xx (succès)
- 🟠 **Orange** - Statuts 4xx (erreur client)
- 🔴 **Rouge** - Statuts 5xx (erreur serveur)
- ⚪ **Gris** - Non testé ou erreur de connexion

### Notifications intelligentes

- **Succès** - Confirmation des actions positives
- **Avertissement** - Alertes pour les actions à risque
- **Erreur** - Messages d'erreur détaillés avec codes HTTP
- **Information** - Statut des opérations en cours

## 🔧 Architecture technique

### Technologies utilisées

- **Electron** - Framework desktop multi-plateforme
- **Node.js** - Runtime JavaScript côté serveur
- **Axios** - Client HTTP avec gestion d'erreurs avancée
- **Cheerio** - Parsing HTML pour extraction des titres
- **HTML5/CSS3** - Interface utilisateur moderne
- **Tailwind CSS** - Framework CSS utilitaire

### Structure du projet

```
url-monitor/
├── main.js              # Processus principal Electron
├── preload.js           # Script de préchargement
├── renderer.html        # Interface utilisateur
├── renderer.js          # Logique côté interface
├── styles.css           # Styles personnalisés
├── package.json         # Configuration npm
└── assets/             # Icônes et ressources
    ├── icon.ico        # Icône Windows
    ├── icon.icns       # Icône macOS
    └── icon.png        # Icône Linux
```

### Configuration HTTP avancée

```javascript
const HTTP_CONFIG = {
  timeout: 15000,         // 15 secondes de timeout
  maxRedirects: 5,        // Maximum 5 redirections
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; URL-Monitor/1.0)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive'
  }
};
```

### Stockage des données

Les données sont stockées dans le dossier utilisateur de l'application :

- **Windows** : `%APPDATA%/URL-Monitor/urls.json`
- **macOS** : `~/Library/Application Support/URL-Monitor/urls.json`
- **Linux** : `~/.config/URL-Monitor/urls.json`

Structure des données :
```javascript
{
  id: Number,           // Identifiant unique
  url: String,          // URL à surveiller
  status: Number,       // Code de statut HTTP
  title: String,        // Titre de la page
  responseTime: Number, // Temps de réponse en ms
  lastCheck: String,    // Heure de dernière vérification
  error: String         // Message d'erreur éventuel
}
```

## 📊 API IPC (Inter-Process Communication)

### Fonctions disponibles

```javascript
// Monitoring d'une URL unique
const result = await window.electronAPI.monitorUrl(url);

// Monitoring de plusieurs URLs
const results = await window.electronAPI.monitorUrls(urls);

// Chargement des URLs sauvegardées
const urls = await window.electronAPI.loadUrls();

// Sauvegarde des URLs
const result = await window.electronAPI.saveUrls(urls);

// Export des données
const result = await window.electronAPI.exportData();
```

### Gestion d'erreurs HTTP détaillée

L'application reconnaît et gère spécifiquement :

- **Erreurs de réseau** : DNS, connexion refusée, timeout
- **Erreurs SSL/TLS** : Certificats expirés, non vérifiables
- **Codes HTTP** : Messages français pour tous les codes 4xx et 5xx
- **Erreurs système** : Hôte inaccessible, réseau inaccessible

## 🛡️ Sécurité et bonnes pratiques

### Validation des URLs

- Vérification du protocole (HTTP/HTTPS uniquement)
- Validation du format URL avec l'API URL native
- Protection contre les URLs malveillantes

### Gestion des erreurs

- Capture exhaustive des erreurs réseau et HTTP
- Messages d'erreur localisés en français
- Limitation des requêtes simultanées (3 max)
- Timeout configuré à 15 secondes

### Performance

- Requêtes asynchrones non-bloquantes
- Traitement par lots avec pauses entre les lots
- Cache intelligent des User-Agents
- Gestion mémoire optimisée

## 📈 Métriques et analytics

### Données collectées

- **Temps de réponse** - Performance des endpoints en millisecondes
- **Codes de statut HTTP** - Disponibilité et état des services
- **Titres de pages** - Extraction automatique avec Cheerio
- **Historique complet** - Évolution dans le temps

### Export des données

Les données peuvent être exportées au format JSON :

```json
{
  "exportDate": "2025-06-09T10:30:00.000Z",
  "version": "1.0",
  "urls": [
    {
      "url": "https://example.com",
      "status": 200,
      "title": "Example Domain",
      "responseTime": 245,
      "timestamp": "2025-06-09T10:30:15.000Z",
      "success": true,
      "error": null
    }
  ]
}
```

## 🛠️ Scripts npm

```json
{
  "start": "electron .",
  "dev": "electron . --dev",
  "build": "electron-builder",
  "build-win": "electron-builder --win",
  "build-linux": "electron-builder --linux",
  "pack": "electron-builder --dir",
  "dist": "electron-builder"
}
```

## 👨‍💻 Développement

### Configuration de développement

```bash
# Installation des dépendances de développement
npm install --save-dev electron electron-builder

# Lancement avec DevTools ouvertes
npm run dev

# Debug des processus
# Processus principal : node --inspect main.js
# Processus de rendu : F12 dans l'application
```

### Packaging et distribution

```bash
# Package pour la plateforme courante
npm run pack

# Créer des installateurs
npm run build

# Distribution multi-plateforme
npm run build-win    # Windows (NSIS)
npm run build-linux  # Linux (AppImage)
# macOS nécessite un environnement macOS
```

## 🔖 Badges

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://github.com/o2Cloud-fr/url-monitor)
[![Axios](https://img.shields.io/badge/Axios-5A29E4?logo=axios&logoColor=white)](https://axios-http.com/)

## 🎯 Roadmap

- [ ] **Graphiques de performance** - Visualisation des temps de réponse avec Chart.js
- [ ] **Alertes par email** - Notifications SMTP automatiques
- [ ] **API REST** - Interface programmatique avec Express.js
- [ ] **Thèmes personnalisables** - Mode sombre/clair avec préférences système
- [ ] **Monitoring SSL** - Vérification des certificats et dates d'expiration
- [ ] **Groupes d'URLs** - Organisation par catégories et tags
- [ ] **Webhooks** - Intégrations externes (Slack, Discord, Teams)
- [ ] **Monitoring géolocalisé** - Tests depuis plusieurs régions via API
- [ ] **Planificateur** - Intervalles de vérification personnalisables
- [ ] **Base de données** - Migration vers SQLite pour l'historique

## 💬 Feedback

Si vous avez des commentaires ou des suggestions, n'hésitez pas à ouvrir une issue sur notre dépôt GitHub.

## 🔗 Liens

[![linkedin](https://img.shields.io/badge/linkedin-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/remi-simier-2b30142a1/)
[![github](https://img.shields.io/badge/github-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/o2Cloud-fr/)

## 🛠️ Compétences

- Node.js & Electron
- JavaScript ES6+
- HTTP/HTTPS Monitoring
- IPC (Inter-Process Communication)
- Desktop App Development
- Cross-platform Packaging
- Error Handling & Logging
- UI/UX Design

## 📝 Licence

[MIT License](https://opensource.org/licenses/MIT)

## 🆘 Support

Pour obtenir de l'aide, ouvrez une issue sur notre dépôt GitHub ou contactez-nous par email : github@o2cloud.fr

## 💼 Utilisé par

Cette application est idéale pour :

- **Développeurs web** - Monitoring de leurs applications
- **Administrateurs système** - Surveillance d'infrastructure
- **Équipes DevOps** - Intégration dans les pipelines CI/CD
- **Entreprises** - Monitoring de sites web critiques
- **Agences web** - Suivi client et SLA
- **Équipes techniques** - Monitoring d'APIs et services

## 🌟 Captures d'écran

### Interface principale
Application desktop native avec design glassmorphique et barre de titre moderne.

### Monitoring en temps réel
Dashboard avec indicateurs de statut colorés, temps de réponse et titres de pages.

### Notifications système
Système d'alertes intégré avec l'OS et notifications desktop natives.

### Gestion d'erreurs avancée
Messages d'erreur détaillés en français avec codes HTTP spécifiques.

---

⭐ N'oubliez pas de donner une étoile au projet si vous l'appréciez !

Made with ❤️ by [o2Cloud-fr](https://github.com/o2Cloud-fr)