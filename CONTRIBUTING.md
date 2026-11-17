# Conventions de développement – Grand Cinéma

## Organisation des branches

- main : version stable de l'application
- develop : intégration des nouvelles fonctionnalités
- feature/nom-fonctionnalite : développement d'une User Story
- fix/nom-bug : correction d'un problème
- docs/nom-document : documentation

## Règles de travail

1. Créer une branche feature depuis develop.
2. Développer et tester la fonctionnalité.
3. Réaliser des commits avec des messages explicites.
4. Ouvrir une Pull Request vers develop.
5. Vérifier les modifications avant fusion.
6. Fusionner develop vers main après validation.

## Convention de commits

- feat: ajout d'une fonctionnalité
- fix: correction d'un bug
- docs: mise à jour de documentation
- test: ajout ou modification de tests
- chore: maintenance du projet
