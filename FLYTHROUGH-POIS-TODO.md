# Mini spec : POIs proches du trace dans le flythrough drawer

## 1. Objectif

A l'ouverture du drawer de flythrough, l'application doit construire une liste de POIs contextuels pour la journey
courante :

- tous les POIs globaux situes a moins de `x` metres du trace de la journey ;
- tous les POIs deja rattaches a la journey.

Cette liste sert de base aux usages flythrough dependants du parcours : reperes, clips, navigation assistee, et
positionnement futur de POIs sur la timeline.

## 2. Regles metier

- La recherche est declenchee a chaque ouverture du flythrough drawer.
- La recherche ne s'applique que s'il existe une journey courante avec au moins un trace exploitable.
- Les POIs globaux sont filtres par distance au trace de la journey, et non par distance a un simple sommet de la
  polyligne.
- Les POIs de la journey sont toujours ajoutes au resultat, meme s'ils sont au-dela du seuil `x`.
- Un POI present a la fois comme POI global candidat et comme POI deja rattache a la journey ne doit apparaitre qu'une
  seule fois dans le resultat final.

## 3. Parametre UI

Ajouter dans le flythrough drawer un champ editable pour `x` :

- composant coherent avec les autres reglages du drawer ;
- presentation UI respectant les conventions existantes : `label-at-start`, largeur `50%` (`half-width`), valeur
  numerique en metres ;
- valeur persistee dans les settings du flythrough ;
- valeur par defaut a definir fonctionnellement. Recommendation : reprendre la distance deja utilisee cote association
  POI/journey, puis ajuster si besoin.

## 4. Regle geometrique

Pour chaque POI global candidat :

- projeter la coordonnee du POI sur la courbe decrite par le trace de la journey ;
- retenir le point projete `P` sur le segment le plus proche ;
- calculer la distance metrique entre le POI et `P` ;
- conserver le POI si cette distance est `<= x`.

Le point `P` devient la reference de position le long du parcours pour le flythrough.

## 5. Donnees retournees

Chaque POI retenu devrait idealement etre enrichi avec des metadonnees dediees au flythrough :

- `distanceToJourneyMeters` : distance minimale POI -> trace ;
- `projectedPoint` : coordonnees du point `P` sur la journey ;
- `projectedAbscissa` ou equivalent : position cumulee de `P` le long du trace ;
- `source` : `global-near-journey` ou `journey-poi`.

Ces donnees permettront de trier, afficher et rattacher proprement les POIs au deroule du flythrough.

## 6. Tri recommande

Le resultat final devrait etre trie par :

- abscisse curviligne croissante le long de la journey ;
- puis distance au trace croissante en cas d'egalite.

## 7. Notes d'implementation

- La logique actuelle d'association POI/journey dans `src/core/ui/POIManager.js` repose sur la proximite avec des
  points de reference du trace ; pour le flythrough il faut passer a une logique point -> segment projete.
- Une etape de preselection par bounding box reste pertinente pour eviter de projeter tous les POIs globaux.
- Le calcul doit supporter `LineString` et `MultiLineString`.
- Le recalcul peut etre refait a l'ouverture du drawer puis lors de la modification du seuil `x` ou du changement de
  journey courante.

## 8. Criteres d'acceptation

- A l'ouverture du flythrough drawer, les POIs globaux situes a moins de `x` metres du trace sont retrouves.
- Les POIs rattaches a la journey sont presents meme s'ils sont hors seuil.
- Le seuil `x` est modifiable depuis le drawer et son rendu UI est conforme aux autres champs : `label-at-start`,
  `50%`.
- Chaque POI retenu peut etre positionne sur la journey via son point projete `P`.
- Aucun doublon n'apparait dans la liste finale.

## 9 Pendant l'execution du flythrough.

- on réduit tous les POI concernés
- quand on arrive au POI, on ouvre le POI pendant n second (n parametrable par POI, défini à 3 second par défaut)
- lePOI est ensuite réduit

## 10 implémentation de l'UI'

Rajouter un onglet "POIs", icon des POI dans le drawer Flythrough

Les POIs concernés sont listé sous forme de détails hoverable

Dans chaque details on peut jouer sur :

- la durée d'affichage
- le % de la taille réelle
- masquage ou pas des lignes du POIS
  o lieu, categorie, altitude,coordonées

Ces données sont perdistés dans un objet flythrough du POI.

IL y a aussi un bouton Edit POI qui ouvre le POI drawer en mode stacked 
