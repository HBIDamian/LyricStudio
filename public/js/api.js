export async function getAiHealth() {
  const response = await fetch('/api/health');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Could not reach Lyric Studio.');
  }

  return data;
}

export async function requestAssistant(payload) {
  const response = await fetch('/api/assist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'The assistant could not complete that request.');
  }

  return data;
}
