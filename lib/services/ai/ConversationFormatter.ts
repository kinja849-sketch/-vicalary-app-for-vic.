export function formatConversationalOutput(rawText: string): string {
  if (!rawText) return '';

  let text = rawText.trim();

  // Remove markdown headers: # Title -> Title
  text = text.replace(/^#{1,6}\s+(.*)$/gm, '$1');

  // Clean decorative bold headers e.g. **Breakfast:** -> Breakfast:
  // But leave conversational emphasis intact
  text = text.replace(/^[*_]{2}([^:*_]+):[*_]{2}/gm, '$1:');

  // Remove bullet points if the message is short conversation
  // e.g. * Point -> Point or keep readable lines
  text = text.replace(/^[*\-•]\s+/gm, '• ');

  // Collapse multiple consecutive newlines (more than 2) to 2
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
