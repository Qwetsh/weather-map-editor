# 🌦️ Éditeur de carte météo – SVT (Collège)

Un **éditeur de cartes météo interactif** conçu pour un usage pédagogique en **SVT (cycle 4)**.
L’outil permet aux élèves de **créer une carte météo du futur** en lien avec le changement climatique, puis de l’utiliser comme support pour un **bulletin météo écrit ou filmé**.

---

## 🎯 Objectifs pédagogiques

* Comprendre les **conséquences du changement climatique** sur la météo
* Réinvestir des notions scientifiques :

  * températures et anomalies
  * événements météorologiques extrêmes
  * anticyclones et dépressions
* Développer des compétences en :

  * lecture et production de cartes
  * communication scientifique
  * travail collaboratif
* Produire un support visuel pour un **bulletin météo du futur**

---

## 🧰 Fonctionnalités principales

### 🗺️ Carte

* Fonds intégrés :

  * France
  * Europe
  * Monde
* Import d’un fond personnalisé (PNG / JPG)
* Export de la carte en **PNG**

### 🌤️ Éléments météo

* Pictos météo dessinés en SVG, identiques sur tous les appareils : soleil, éclaircies, nuages, pluie, orage, neige, brouillard, vent, canicule, sécheresse, incendie, inondation, cyclone
* Création de pictos personnalisés (emoji + nom pour la légende)
* Ajout de villes
* Ajout de températures (pastille colorée automatiquement selon la valeur, ou texte libre)
* Ajout de la force du vent

### 🌀 Pressions atmosphériques

* Zones de **dépression** et **anticyclone**
* Création par clic + glisser (comme dans Word / PowerPoint)
* Cercle coloré avec :

  * texte central (A / D ou mot complet)
  * **flèches animées** montrant le sens de rotation
* Choix de l’**hémisphère Nord / Sud** (sens de rotation adapté)

### ✏️ Édition avancée

* Sélection simple ou multiple
* Déplacement groupé
* Redimensionnement à la souris
* Copie / collage (Ctrl+C / Ctrl+V)
* Menu contextuel (clic droit)
* Verrouillage d’éléments
* Annuler / rétablir (Ctrl+Z / Ctrl+Y)
* Déplacement fin aux flèches du clavier, premier plan / arrière-plan

### 📌 Aide à la lecture

* **Légende automatique** générée selon les éléments présents
* Option pour masquer / afficher la légende

### 💾 Projet

* Sauvegarde automatique
* Export / import du projet (JSON)

---

## 🎥 Usage en classe (exemple)

1. Les élèves créent une **carte météo 2050**
2. Ils placent :

   * villes
   * températures
   * phénomènes météorologiques
   * zones de pression
3. Ils exportent la carte
4. La carte sert de support pour :

   * un texte explicatif
   * un bulletin météo filmé
   * un travail interdisciplinaire (SVT / Anglais)

---

## 🧑‍🏫 Public cible

* Enseignants de **SVT**
* Élèves de **5ᵉ / 4ᵉ**
* Usage en classe, en groupe ou en autonomie

---

## 🛠️ Stack technique

* **Vite 8** + **React 19**
* **TypeScript** (mode strict)
* **Tailwind CSS 4**, composants **Radix UI**, icônes **Lucide**
* **Leaflet** pour la carte interactive (tuiles Esri Light Gray)
* Police **Lexend** embarquée (fonctionne hors connexion)

### Organisation du code

```
src/editor/
  model.ts          types, fonds de carte, pictos, valeurs par défaut
  project.ts        sauvegarde auto, import/export JSON (compatible anciens projets)
  useHistory.ts     annuler / rétablir
  EditorContext.tsx état de l'éditeur et actions
  stage/            la carte : interactions, éléments, légende, menu contextuel
  panels/           barre du haut, outils, palette de pictos, panneau de propriétés
```

---

## 🚀 Installation (développeurs)

```bash
npm install
npm run dev        # serveur de développement
npm run build      # vérification TypeScript + build dans docs/ (GitHub Pages)
npm run lint
```

---

## 📄 Licence

Projet développé dans un cadre **pédagogique**.
Les fonds cartographiques utilisés sont issus de sources libres (ex. Natural Earth).

---

## ✍️ Auteur

Projet conçu par Thomas CHARLES pour un usage réel en classe et à la maison.
