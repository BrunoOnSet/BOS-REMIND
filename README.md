# BOS REMIND

Application de rappels autonome, dans l'identité visuelle BOS.

> **État : première version locale.** Les rappels sont enregistrés sur l'appareil. Les notifications silencieuses de démonstration peuvent s'afficher lorsque l'application reste ouverte et qu'Android les autorise. Les notifications programmées avec l'application fermée demandent encore un service Push/Web Push côté serveur : **ce dépôt ne l'active pas encore**.

## Fonctions
- Rappels ponctuels à date et heure libres.
- Rappels mensuels (même numéro de jour ; mois sans ce numéro sautés) ou annuels (même jour et même mois ; 29 février uniquement les années bissextiles).
- `DONE` clôt le rappel ponctuel ; pour un rappel récurrent, passe à la prochaine occurrence de son calendrier d'origine.
- `AGAIN` reporte la notification au prochain créneau strictement futur parmi **09:00** et **18:30**.
- Modification, suppression, affichage des rappels en attente, à venir et terminés ; thème clair/sombre.
- PWA utilisable hors ligne après premier chargement. Données stockées localement, non synchronisées entre téléphones.

## Lancer l'application
Déployer le dossier à la racine d'un site HTTPS (par exemple GitHub Pages si le dépôt et le compte permettent Pages), puis ouvrir le site depuis **Chrome sur Android** et utiliser **Ajouter à l'écran d'accueil / Installer**.

Sans HTTPS ou localhost, les Service Workers et les notifications ne fonctionnent pas. Autoriser les notifications du navigateur et du système dans Android. Les notifications silencieuses ne sont pas garanties comme bandeau flottant par Android.

## Prochaine étape technique
Pour obtenir des notifications lorsque BOS REMIND est fermé : enregistrer les données sur un backend sécurisé, programmer le déclenchement des échéances sur serveur, envoyer les Web Push VAPID, enregistrer l'abonnement du téléphone, puis synchroniser les actions `DONE` et `AGAIN` depuis la notification. Ne pas ajouter de clé secrète de serveur au frontend.

## Notifications Push (octobre 2026)
Une fonction Supabase isolée `bos-remind` et un cron par minute envoient des notifications Web Push aux installations Android abonnées. L'abonnement est activé via le bouton **Autoriser les notifications** dans l'app. Chaque installation a son propre identifiant/token aléatoires stockés localement et envoyés uniquement à l'API HTTPS ; les tables serveur sont privées et protégées par RLS. Les rappels déjà créés sont synchronisés lors de l'activation. En cas de changement de téléphone ou de suppression des données Chrome, les rappels locaux ne sont pas restaurés automatiquement. L'heure de notification est soumise aux contraintes réseau/Android et à une précision de l'ordre de la minute. Les actions DONE/AGAIN ouvrent l'application pour synchroniser la modification.
