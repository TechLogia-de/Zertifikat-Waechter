interface ACMEProviderInfoProps {
  domain: string
  challengeType: string
  hasCloudflare: boolean
}

export default function ACMEProviderInfo({ domain, challengeType, hasCloudflare }: ACMEProviderInfoProps) {
  const isWildcard = domain.startsWith('*.')
  const canAutoProcess = challengeType === 'dns-01' && hasCloudflare

  return (
    <div className={`rounded-lg p-4 border ${
      canAutoProcess 
        ? 'bg-green-50 border-green-200' 
        : 'bg-yellow-50 border-yellow-200'
    }`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">
          {canAutoProcess ? '🤖' : '⚠️'}
        </span>
        <div className="flex-1">
          <h4 className={`font-semibold mb-1 ${
            canAutoProcess ? 'text-green-900' : 'text-yellow-900'
          }`}>
            {canAutoProcess ? 'Automatische Verarbeitung' : 'Manuelle Verarbeitung erforderlich'}
          </h4>
          
          {canAutoProcess ? (
            <div className="text-sm text-green-800">
              <p className="mb-2">
                Diese Order wird automatisch verarbeitet:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>DNS-01 Challenge via Cloudflare</li>
                <li>DNS TXT Record wird erstellt</li>
                <li>Let's Encrypt validiert automatisch</li>
                <li>Zertifikat wird ausgestellt</li>
                <li>Dauer: ca. 1-2 Minuten</li>
              </ul>
            </div>
          ) : (
            <div className="text-sm text-yellow-800">
              {challengeType === 'dns-01' && !hasCloudflare ? (
                <>
                  <p className="mb-2">
                    DNS-01 Challenge erfordert Cloudflare-Integration.
                  </p>
                  <p className="font-semibold mb-1">Optionen:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Konfiguriere Cloudflare unter "Integrationen"</li>
                    <li>Oder erstelle neue Order mit HTTP-01</li>
                    {isWildcard && (
                      <li className="text-red-700">⚠️ Wildcards brauchen IMMER DNS-01!</li>
                    )}
                  </ul>
                </>
              ) : (
                <>
                  <p className="mb-2">
                    HTTP-01 Challenge erfordert Webserver-Zugriff.
                  </p>
                  <p className="font-semibold mb-1">Manuelle Schritte:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Lege Datei auf deinem Webserver ab</li>
                    <li>Pfad: /.well-known/acme-challenge/[token]</li>
                    <li>Details siehe Dokumentation</li>
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

