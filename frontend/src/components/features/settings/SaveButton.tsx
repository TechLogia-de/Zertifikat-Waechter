interface SaveButtonProps {
  saving: boolean
  onSave: () => void
}

/**
 * Save button for persisting settings changes.
 */
export default function SaveButton({ saving, onSave }: SaveButtonProps) {
  return (
    <div className="flex space-x-3">
      <button
        onClick={onSave}
        disabled={saving}
        className="flex-1 px-6 py-3 bg-[#3B82F6] text-white rounded-lg font-semibold hover:bg-[#2563EB] disabled:opacity-50 transition-colors shadow-md"
      >
        {saving ? '⏳ Speichern...' : '💾 Einstellungen speichern'}
      </button>
    </div>
  )
}
