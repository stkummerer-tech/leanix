# LeanIX Automation Script for ACL Control

Dieses Projekt stellt ein Node.js-Skript bereit, das täglich alle LeanIX-Factsheets des Typs "Application" überprüft. Falls die Felder `permittedReadACL` oder `permittedWriteACL` leer sind, werden sie automatisch auf den Standardwert `evnat` gesetzt.

## Voraussetzungen

- Node.js 18 oder neuer
- Ein API-Token für den Zugriff auf die LeanIX GraphQL-API
- Zugriff auf die URL Ihres LeanIX-Workspaces

## Installation

```bash
npm install
```

## Konfiguration

Die Automatisierung wird über folgende Umgebungsvariablen gesteuert:

| Variable | Beschreibung |
| --- | --- |
| `LEANIX_BASE_URL` | Basis-URL Ihres LeanIX-Workspaces, z. B. `https://example.leanix.net`. |
| `LEANIX_API_TOKEN` | API-Token mit Berechtigung zum Lesen und Aktualisieren von Factsheets. |
| `DEFAULT_ACL_VALUE` | (Optional) Standardwert für ACL-Einträge. Voreinstellung: `evnat`. |
| `FACTSHEET_TYPE` | (Optional) Factsheet-Typ, der überprüft werden soll. Voreinstellung: `Application`. |
| `CRON_SCHEDULE` | (Optional) Cron-Ausdruck für den Ausführungsplan. Voreinstellung: `0 2 * * *` (täglich um 02:00 Uhr). |

## Ausführung

```bash
node index.js
```

Beim Start wird ein erster Lauf sofort ausgeführt. Anschließend wird das Skript gemäß dem Cron-Zeitplan ausgeführt. Aktualisierungen und Fehler werden im Log ausgegeben.

## Lizenz

ISC
