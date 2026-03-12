export function bufferToBase64DataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}

export function buildImageMessage(base64DataUrl: string): object {
  return {
    role: 'user',
    content: [
      {
        type: 'image_url',
        image_url: { url: base64DataUrl },
      },
      {
        type: 'text',
        text: 'Please extract all text content from this academic paper image and analyze it according to the schema.',
      },
    ],
  }
}
