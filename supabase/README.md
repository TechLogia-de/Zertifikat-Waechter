# Supabase Configuration

Dieses Verzeichnis enthält alle Supabase-bezogenen Dateien für Zertifikat-Wächter.

## Struktur

```
supabase/
├── config.toml           # Supabase-Konfiguration
├── migrations/           # Datenbank-Migrationen
│   ├── 00001_initial_schema.sql     # Initiales Schema
│   └── 00002_rls_policies.sql       # Row Level Security Policies
├── functions/            # Edge Functions (Deno/TypeScript)
│   ├── scan-certificates/
│   ├── send-alerts/
│   └── generate-report/
├── seed.sql              # Demo-Daten
└── README.md             # Diese Datei
```

## Setup

### 1. Supabase Projekt verbinden

```bash
# Mit deinem Supabase Projekt verbinden
npx supabase link --project-ref ethwkzwsxkhcexibuvwp

# Oder mit interaktivem Setup
npx supabase link
```

### 2. Migrations anwenden

```bash
# Alle Migrations zum Supabase Projekt pushen
npx supabase db push

# Oder einzelne Migration anwenden
npx supabase db push --file migrations/00001_initial_schema.sql
```

### 3. Seed-Daten laden (optional)

```bash
# Seed-Daten in die Datenbank laden
npx supabase db execute --file seed.sql
```

### 4. TypeScript Types generieren

```bash
# Types für Frontend generieren
npx supabase gen types typescript --project-id ethwkzwsxkhcexibuvwp > ../frontend/src/types/database.types.ts

# Oder mit lokalem Schema
npx supabase gen types typescript --local > ../frontend/src/types/database.types.ts
```

## Lokale Entwicklung

### Lokale Supabase Instanz starten

```bash
# Startet lokale PostgreSQL, Auth, Storage, Edge Functions
npx supabase start

# Zeigt Connection Details
npx supabase status
```

### Lokale Datenbank zurücksetzen

```bash
# Löscht alle Daten und wendet Migrations neu an
npx supabase db reset
```

## Edge Functions

### Neue Edge Function erstellen

```bash
npx supabase functions new my-function
```

### Edge Function lokal testen

```bash
npx supabase functions serve my-function
```

### Edge Function deployen

```bash
npx supabase functions deploy my-function
```

## Migrations

### Neue Migration erstellen

```bash
npx supabase migration new my_migration_name
```

### Migration Status prüfen

```bash
npx supabase migration list
```

## Datenbank-Schema

### Haupttabellen

- **tenants**: Mandanten/Organisationen
- **memberships**: User-Tenant-Zuordnung mit Rollen
- **connectors**: Agents für Intranet-Scanning
- **assets**: Zu überwachende Hosts/Services
- **certificates**: SSL/TLS-Zertifikate
- **checks**: Scan-Historie
- **alerts**: Benachrichtigungen
- **policies**: Alert-Richtlinien pro Tenant
- **events**: Audit-Log mit Hash-Kette
- **acme_accounts**: ACME-Provider-Accounts
- **acme_orders**: ACME-Renewal-Orders

### Row Level Security (RLS)

Alle Tabellen haben RLS aktiviert. Policies stellen sicher, dass:
- User nur Daten ihrer Tenants sehen
- Rollen-basierte Zugriffskontrolle (owner, admin, operator, auditor, external)
- Audit-Log ist append-only

### Rollen

- **owner**: Voller Zugriff, kann Tenant löschen
- **admin**: Kann Einstellungen und User verwalten
- **operator**: Kann Assets und Scans verwalten
- **auditor**: Nur Lesezugriff (für Compliance)
- **external**: Eingeschränkter Lesezugriff (für Kunden)

## Umgebungsvariablen

Für lokale Entwicklung `.env.local` erstellen:

```bash
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<anon_key_from_supabase_status>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key_from_supabase_status>
```

Für Produktion (Frontend):
```bash
VITE_SUPABASE_URL=https://ethwkzwsxkhcexibuvwp.supabase.co
VITE_SUPABASE_ANON_KEY=<your_anon_key>
```

⚠️ **WICHTIG**: Service Role Key NIEMALS im Frontend verwenden!

## Nützliche Links

- [Supabase Dashboard](https://supabase.com/dashboard/project/ethwkzwsxkhcexibuvwp)
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Row Level Security Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [Edge Functions Docs](https://supabase.com/docs/guides/functions)


