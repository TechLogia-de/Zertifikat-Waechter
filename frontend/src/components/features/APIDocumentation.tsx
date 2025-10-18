import { useState } from 'react'

interface Endpoint {
  method: string
  path: string
  description: string
  auth: boolean
  rateLimit: string
  parameters?: Array<{
    name: string
    type: string
    required: boolean
    description: string
  }>
  requestBody?: {
    type: string
    example: any
  }
  responses: Array<{
    status: number
    description: string
    example: any
  }>
}

const API_ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/certificates',
    description: 'Liste alle Zertifikate des Tenants',
    auth: true,
    rateLimit: '100 requests/minute',
    parameters: [
      { name: 'limit', type: 'integer', required: false, description: 'Max. Anzahl Ergebnisse (default: 50, max: 100)' },
      { name: 'offset', type: 'integer', required: false, description: 'Offset für Pagination' },
      { name: 'status', type: 'string', required: false, description: 'Filter: active, expiring, expired' },
      { name: 'days_until_expiry', type: 'integer', required: false, description: 'Nur Zertifikate die in X Tagen ablaufen' },
    ],
    responses: [
      {
        status: 200,
        description: 'Erfolg',
        example: {
          data: [
            {
              id: 'uuid',
              subject_cn: 'example.com',
              issuer: 'Let\'s Encrypt',
              not_after: '2025-12-31T00:00:00Z',
              key_size: 2048,
              fingerprint: 'sha256:abc123...'
            }
          ],
          total: 42,
          limit: 50,
          offset: 0
        }
      },
      {
        status: 401,
        description: 'Unauthorized - API Key fehlt oder ungültig',
        example: { error: 'Invalid API key' }
      }
    ]
  },
  {
    method: 'GET',
    path: '/api/v1/certificates/{id}',
    description: 'Hole ein spezifisches Zertifikat',
    auth: true,
    rateLimit: '100 requests/minute',
    parameters: [
      { name: 'id', type: 'uuid', required: true, description: 'Zertifikat ID' },
    ],
    responses: [
      {
        status: 200,
        description: 'Erfolg',
        example: {
          id: 'uuid',
          subject_cn: 'example.com',
          san: ['example.com', 'www.example.com'],
          issuer: 'Let\'s Encrypt R3',
          not_before: '2025-01-01T00:00:00Z',
          not_after: '2025-12-31T00:00:00Z',
          key_alg: 'RSA',
          key_size: 2048,
          serial: '03:ab:cd:ef...',
          fingerprint: 'sha256:abc123...',
          is_trusted: true
        }
      },
      {
        status: 404,
        description: 'Zertifikat nicht gefunden',
        example: { error: 'Certificate not found' }
      }
    ]
  },
  {
    method: 'GET',
    path: '/api/v1/alerts',
    description: 'Liste alle aktiven Alerts',
    auth: true,
    rateLimit: '100 requests/minute',
    parameters: [
      { name: 'acknowledged', type: 'boolean', required: false, description: 'Filter nach Quittierungsstatus' },
      { name: 'level', type: 'string', required: false, description: 'Filter: info, warning, critical' },
    ],
    responses: [
      {
        status: 200,
        description: 'Erfolg',
        example: {
          data: [
            {
              id: 'uuid',
              certificate_id: 'uuid',
              level: 'warning',
              message: 'Zertifikat läuft in 30 Tagen ab',
              first_triggered_at: '2025-10-17T10:00:00Z',
              acknowledged_at: null
            }
          ]
        }
      }
    ]
  },
  {
    method: 'POST',
    path: '/api/v1/alerts/{id}/acknowledge',
    description: 'Quittiere einen Alert',
    auth: true,
    rateLimit: '50 requests/minute',
    parameters: [
      { name: 'id', type: 'uuid', required: true, description: 'Alert ID' },
    ],
    responses: [
      {
        status: 200,
        description: 'Alert quittiert',
        example: { success: true, acknowledged_at: '2025-10-17T12:00:00Z' }
      }
    ]
  },
  {
    method: 'GET',
    path: '/api/v1/compliance/checks',
    description: 'Compliance Check Ergebnisse',
    auth: true,
    rateLimit: '100 requests/minute',
    parameters: [
      { name: 'standard', type: 'string', required: false, description: 'Filter nach Standard (PCI-DSS, HIPAA, ISO27001, BSI)' },
      { name: 'is_compliant', type: 'boolean', required: false, description: 'Nur konforme oder nicht-konforme' },
    ],
    responses: [
      {
        status: 200,
        description: 'Erfolg',
        example: {
          data: [
            {
              certificate_id: 'uuid',
              standard: 'PCI-DSS',
              is_compliant: false,
              violations: [
                { rule: 'min_key_size', expected: 2048, actual: 256, severity: 'high' }
              ]
            }
          ]
        }
      }
    ]
  }
]

export default function APIDocumentation() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<'curl' | 'javascript' | 'python' | 'go'>('curl')

  function generateCodeExample(endpoint: Endpoint, language: string, apiKey: string = 'your_api_key_here'): string {
    const baseUrl = 'https://api.cert-watcher.com'
    const fullPath = endpoint.path.replace('{id}', 'certificate-id-123')

    switch (language) {
      case 'curl':
        return `curl -X ${endpoint.method} \\
  "${baseUrl}${fullPath}" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json"${
  endpoint.requestBody 
    ? ` \\\n  -d '${JSON.stringify(endpoint.requestBody.example, null, 2)}'` 
    : ''
}`

      case 'javascript':
        return `const response = await fetch('${baseUrl}${fullPath}', {
  method: '${endpoint.method}',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
    'Content-Type': 'application/json'
  }${endpoint.requestBody ? `,\n  body: JSON.stringify(${JSON.stringify(endpoint.requestBody.example, null, 2)})` : ''}
})

const data = await response.json()
console.log(data)`

      case 'python':
        return `import requests

headers = {
    'Authorization': f'Bearer ${apiKey}',
    'Content-Type': 'application/json'
}

response = requests.${endpoint.method.toLowerCase()}(
    '${baseUrl}${fullPath}',
    headers=headers${endpoint.requestBody ? `,\n    json=${JSON.stringify(endpoint.requestBody.example)}` : ''}
)

data = response.json()
print(data)`

      case 'go':
        return `package main

import (
    "fmt"
    "net/http"
    "io"
)

func main() {
    client := &http.Client{}
    req, _ := http.NewRequest("${endpoint.method}", "${baseUrl}${fullPath}", nil)
    req.Header.Set("Authorization", "Bearer ${apiKey}")
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()
    
    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))
}`

      default:
        return ''
    }
  }

  function getMethodColor(method: string): string {
    switch (method) {
      case 'GET': return 'bg-blue-100 text-blue-700'
      case 'POST': return 'bg-green-100 text-green-700'
      case 'PUT': return 'bg-yellow-100 text-yellow-700'
      case 'DELETE': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-blue-900 mb-3">📚 API Dokumentation</h2>
        <p className="text-sm text-blue-800 mb-4">
          RESTful API für Integration mit externen Tools und Systemen. 
          Alle Endpunkte erfordern Authentifizierung via API Key im Authorization Header.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white rounded-lg p-3">
            <div className="font-semibold text-blue-900 mb-1">Base URL</div>
            <code className="text-blue-700">https://api.cert-watcher.com</code>
          </div>
          <div className="bg-white rounded-lg p-3">
            <div className="font-semibold text-blue-900 mb-1">Authentication</div>
            <code className="text-blue-700">Bearer Token</code>
          </div>
          <div className="bg-white rounded-lg p-3">
            <div className="font-semibold text-blue-900 mb-1">Rate Limit</div>
            <code className="text-blue-700">100 req/min</code>
          </div>
        </div>
      </div>

      {/* Endpoints List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">API Endpoints</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {API_ENDPOINTS.map((endpoint, idx) => (
            <div key={idx} className="p-6 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedEndpoint(endpoint)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded font-mono text-sm font-semibold ${getMethodColor(endpoint.method)}`}>
                    {endpoint.method}
                  </span>
                  <code className="text-sm text-gray-900">{endpoint.path}</code>
                </div>
                <span className="text-gray-400">→</span>
              </div>
              <p className="text-sm text-gray-600">{endpoint.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Endpoint Details Modal */}
      {selectedEndpoint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedEndpoint(null)}>
          <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded font-mono text-sm font-semibold ${getMethodColor(selectedEndpoint.method)}`}>
                  {selectedEndpoint.method}
                </span>
                <code className="text-lg">{selectedEndpoint.path}</code>
              </div>
              <button
                onClick={() => setSelectedEndpoint(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Description */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Beschreibung</h4>
                <p className="text-gray-700">{selectedEndpoint.description}</p>
              </div>

              {/* Auth & Rate Limit */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Authentication</div>
                  <div className="font-semibold text-gray-900">
                    {selectedEndpoint.auth ? '🔒 Required (Bearer Token)' : '🔓 Not Required'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Rate Limit</div>
                  <div className="font-semibold text-gray-900">{selectedEndpoint.rateLimit}</div>
                </div>
              </div>

              {/* Parameters */}
              {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Parameter</h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Typ</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Erforderlich</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Beschreibung</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedEndpoint.parameters.map((param, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm font-mono text-gray-900">{param.name}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{param.type}</td>
                            <td className="px-4 py-2">
                              {param.required ? (
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
                                  Required
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                  Optional
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">{param.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Code Examples */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Code-Beispiele</h4>
                
                {/* Language Tabs */}
                <div className="flex gap-2 mb-3">
                  {(['curl', 'javascript', 'python', 'go'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLanguage(lang)}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        selectedLanguage === lang
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {lang === 'curl' ? 'cURL' : 
                       lang === 'javascript' ? 'JavaScript' :
                       lang === 'python' ? 'Python' : 'Go'}
                    </button>
                  ))}
                </div>

                {/* Code Block */}
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-100 font-mono whitespace-pre-wrap">
                    {generateCodeExample(selectedEndpoint, selectedLanguage)}
                  </pre>
                </div>
              </div>

              {/* Responses */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Antworten</h4>
                <div className="space-y-3">
                  {selectedEndpoint.responses.map((response, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded text-sm font-semibold ${
                          response.status >= 200 && response.status < 300 ? 'bg-green-100 text-green-700' :
                          response.status >= 400 && response.status < 500 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {response.status}
                        </span>
                        <span className="text-sm text-gray-700">{response.description}</span>
                      </div>
                      <div className="bg-gray-50 rounded p-3">
                        <pre className="text-xs text-gray-700 overflow-x-auto">
                          {JSON.stringify(response.example, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Start Guide */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🚀 Quick Start</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">1. API Key erstellen</h4>
            <p className="text-sm text-gray-600">Erstelle einen neuen API Key mit den benötigten Permissions.</p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-2">2. Authentication</h4>
            <p className="text-sm text-gray-600 mb-2">Sende deinen API Key im Authorization Header:</p>
            <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm">
              Authorization: Bearer cw_abc123...
            </code>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-2">3. Ersten Request senden</h4>
            <p className="text-sm text-gray-600 mb-2">Teste mit dem Certificates Endpoint:</p>
            <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm">
              curl -H "Authorization: Bearer YOUR_API_KEY" \<br/>
              &nbsp;&nbsp;https://api.cert-watcher.com/v1/certificates
            </code>
          </div>
        </div>
      </div>

      {/* Rate Limiting */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">⏱️ Rate Limiting</h3>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Standard Endpoints (GET)</span>
            <span className="font-semibold text-gray-900">100 requests/minute</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Mutations (POST, PUT, DELETE)</span>
            <span className="font-semibold text-gray-900">50 requests/minute</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Heavy Operations (Scans, Reports)</span>
            <span className="font-semibold text-gray-900">10 requests/minute</span>
          </div>
        </div>

        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <strong>💡 Tipp:</strong> Bei Überschreitung erhältst du HTTP 429 (Too Many Requests).
            Response enthält <code>Retry-After</code> Header mit Wartezeit in Sekunden.
          </p>
        </div>
      </div>

      {/* Error Codes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Error Codes</h3>
        
        <div className="space-y-2 text-sm">
          {[
            { code: 400, desc: 'Bad Request - Ungültige Parameter oder Request Body' },
            { code: 401, desc: 'Unauthorized - API Key fehlt oder ungültig' },
            { code: 403, desc: 'Forbidden - Keine Berechtigung für diese Ressource' },
            { code: 404, desc: 'Not Found - Ressource existiert nicht' },
            { code: 429, desc: 'Too Many Requests - Rate Limit überschritten' },
            { code: 500, desc: 'Internal Server Error - Server-Fehler' },
          ].map((error, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
              <code className="font-semibold text-gray-900">{error.code}</code>
              <span className="text-gray-700">{error.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Best Practices */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-green-900 mb-4">✅ Best Practices</h3>
        
        <ul className="space-y-2 text-sm text-green-800">
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Nutze separate API Keys für verschiedene Anwendungen</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Setze immer ein Ablaufdatum (empfohlen: 90 Tage)</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Verwende minimal Permissions (Read-only wo möglich)</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Implementiere Exponential Backoff bei Rate Limit Errors</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Speichere API Keys sicher (Environment Variables, Secrets Manager)</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Widerrufe kompromittierte Keys sofort</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Nutze Pagination für große Datasets (limit/offset Parameter)</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

