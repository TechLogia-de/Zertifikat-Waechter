// Quick start banner that launches the ACME wizard for beginners

interface ACMEQuickStartProps {
  onStartWizard: () => void
}

export default function ACMEQuickStart({ onStartWizard }: ACMEQuickStartProps) {
  return (
    <div className="bg-gradient-to-r from-[#10B981] to-[#059669] rounded-xl p-6 shadow-lg text-white">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="text-6xl">🎓</div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-2xl font-bold mb-2">
            Neu hier? Starte mit dem geführten Setup!
          </h2>
          <p className="text-white/90 mb-4">
            Wir führen dich Schritt für Schritt durch die Erstellung deines ersten SSL-Zertifikats.
            Perfekt für Anfänger - keine Vorkenntnisse nötig!
          </p>
          <button
            onClick={onStartWizard}
            className="px-8 py-3 bg-white text-[#10B981] rounded-lg font-bold hover:bg-[#F0FDF4] transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            🚀 Geführtes Setup starten
          </button>
        </div>
      </div>
    </div>
  )
}
