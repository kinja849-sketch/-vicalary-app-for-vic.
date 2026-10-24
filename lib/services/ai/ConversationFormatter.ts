export function formatConversationalOutput(rawText: string): string {
  if (!rawText) return '';

  let text = rawText.trim();

  // Remove markdown headers: # Title -> Title
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Strip all asterisks and hash marks anywhere in the message
  text = text.replace(/[*#]/g, '');

  // Replace em-dashes, en-dashes, and double hyphens with natural commas/spaces
  text = text.replace(/\s*[—–]\s*|\s*--\s*/g, ', ');
  text = text.replace(/,\s*,/g, ',');

  // Collapse multiple consecutive newlines (more than 2) to 2
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}


