// Shared by the tagging and /ask prompts so both describe the vocabulary identically.
const FACET_ORDER = ['type', 'area', 'cuisine', 'dietary', 'budget', 'time', 'vibe', 'occasion', 'drinks', 'feature']

// tags: [{ name, facet, description }] → "area:\n- Chinatown: Chinatown, Maxwell, ..."
export function formatVocabulary(tags) {
  return FACET_ORDER.map((facet) => {
    const lines = tags.filter((t) => t.facet === facet).map((t) => `- ${t.name}: ${t.description}`)
    return lines.length ? `${facet}:\n${lines.join('\n')}` : null
  })
    .filter(Boolean)
    .join('\n\n')
}
