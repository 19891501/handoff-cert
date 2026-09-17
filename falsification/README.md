# Falsification — contrat de banc

Le juge V0 ne bouge pas. Ce dossier est un registre de dettes, pas une TODO.

1. Chaque cas KFP enregistre `v0_verdict` tel quel. Si le moteur change et que le verdict change, le test casse — il ne passe pas.
2. La règle manquante vit ici. Elle ne remonte jamais dans le moteur.
3. Deux bancs, jamais additionnés : REPRENABLE à tort → machine (adversarial). CORROMPU à tort → humain (trophée).

## Méthodes

| Méthode | Contre |
|---|---|
| Trophée | Accuracy, « 24/24 » |
| Vérité après | Ground truth dans le prompt |
| Juge gelé | Retuner jusqu'à ce que le corpus passe |
| Faux REPRENABLE critique | F1 global |
| Transfert de cadre | Un seul JSON |
| Reset A→B | GO interne pour reconstruct |

Reset : protocole gelé, pas lancé.

Pas de KFP-005 tant que 001–004 et le lock sont verts.
