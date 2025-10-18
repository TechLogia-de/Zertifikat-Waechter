import { useState } from 'react'

interface Tag {
  id: string
  name: string
  color: string
}

interface CertificateTagsProps {
  certificateId: string
  currentTags: Tag[]
  availableTags: Tag[]
  onAssignTag: (certificateId: string, tagId: string) => void
  onRemoveTag: (certificateId: string, tagId: string) => void
  onCreateTag: (name: string, color: string) => void
}

export default function CertificateTags({
  certificateId,
  currentTags,
  availableTags,
  onAssignTag,
  onRemoveTag,
  onCreateTag,
}: CertificateTagsProps) {
  const [showAddTag, setShowAddTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3B82F6')

  const unassignedTags = availableTags.filter(
    (tag) => !currentTags.find((ct) => ct.id === tag.id)
  )

  function handleCreateTag() {
    if (!newTagName) return
    onCreateTag(newTagName, newTagColor)
    setNewTagName('')
    setNewTagColor('#3B82F6')
    setShowAddTag(false)
  }

  const colorOptions = [
    { name: 'Blau', value: '#3B82F6' },
    { name: 'Grün', value: '#10B981' },
    { name: 'Gelb', value: '#F59E0B' },
    { name: 'Rot', value: '#EF4444' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Grau', value: '#6B7280' },
  ]

  return (
    <div className="space-y-4">
      {/* Current Tags */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Zugewiesene Tags</h4>
        <div className="flex flex-wrap gap-2">
          {currentTags.length === 0 ? (
            <span className="text-sm text-gray-500">Keine Tags zugewiesen</span>
          ) : (
            currentTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
                style={{ backgroundColor: tag.color + '20', color: tag.color }}
              >
                {tag.name}
                <button
                  onClick={() => onRemoveTag(certificateId, tag.id)}
                  className="hover:opacity-70"
                >
                  ✕
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Assign Existing Tags */}
      {unassignedTags.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Tag zuweisen</h4>
          <div className="flex flex-wrap gap-2">
            {unassignedTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => onAssignTag(certificateId, tag.id)}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border-2 hover:opacity-80 transition-opacity"
                style={{ borderColor: tag.color, color: tag.color }}
              >
                + {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create New Tag */}
      <div>
        {showAddTag ? (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag Name"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setNewTagColor(color.value)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    newTagColor === color.value ? 'border-gray-900' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAddTag(false)}
                className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreateTag}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Erstellen
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddTag(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Neuer Tag
          </button>
        )}
      </div>
    </div>
  )
}

