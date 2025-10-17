"""
Startet den Worker API Server
"""
import sys
import os

# Füge worker-Verzeichnis zum Python-Path hinzu
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Importiere und starte API
from api import app

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Zertifikat-Wächter Worker API")
    print("=" * 60)
    print("📧 SMTP Email: POST http://localhost:5000/send-email")
    print("🔍 Cert Scanner: POST http://localhost:5000/scan-certificate")
    print("❤️  Health Check: GET http://localhost:5000/health")
    print("=" * 60)
    print()
    print("✅ Worker läuft! Drücke Strg+C zum Beenden.")
    print()
    
    try:
        app.run(host='0.0.0.0', port=5000, debug=False)
    except KeyboardInterrupt:
        print("\n🛑 Worker wird beendet...")
    except Exception as e:
        print(f"\n❌ Fehler: {e}")
        print("\nMögliche Ursachen:")
        print("1. Port 5000 ist bereits belegt")
        print("2. Dependencies fehlen (pip install flask flask-cors)")
        print("3. .env Datei fehlt")
        input("\nDrücke Enter zum Beenden...")

