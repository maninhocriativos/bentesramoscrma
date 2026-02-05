import React from 'react';

/**
 * Parse WhatsApp text formatting:
 * - *bold*
 * - _italic_
 * - ~strikethrough~
 * - ```monospace```
 */
export function parseWhatsAppFormatting(text: string): React.ReactNode[] {
  if (!text) return [];

  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Regex patterns for WhatsApp formatting
  const patterns = [
    { regex: /```([\s\S]+?)```/g, tag: 'code' },      // monospace
    { regex: /\*([^*\n]+)\*/g, tag: 'bold' },          // bold
    { regex: /_([^_\n]+)_/g, tag: 'italic' },          // italic
    { regex: /~([^~\n]+)~/g, tag: 'strike' },          // strikethrough
  ];

  // Combined regex to find any formatting
  const combinedRegex = /(```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;

  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const matchedText = match[0];
    
    // Determine which format it is
    if (matchedText.startsWith('```') && matchedText.endsWith('```')) {
      const content = matchedText.slice(3, -3);
      nodes.push(
        React.createElement('code', { 
          key: key++,
          className: 'bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-[13px] font-mono'
        }, content)
      );
    } else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
      const content = matchedText.slice(1, -1);
      nodes.push(
        React.createElement('strong', { key: key++, className: 'font-bold' }, content)
      );
    } else if (matchedText.startsWith('_') && matchedText.endsWith('_')) {
      const content = matchedText.slice(1, -1);
      nodes.push(
        React.createElement('em', { key: key++, className: 'italic' }, content)
      );
    } else if (matchedText.startsWith('~') && matchedText.endsWith('~')) {
      const content = matchedText.slice(1, -1);
      nodes.push(
        React.createElement('del', { key: key++, className: 'line-through' }, content)
      );
    }

    lastIndex = match.index + matchedText.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  // If no formatting was found, just return the original text as a node
  if (nodes.length === 0) {
    return [text];
  }

  return nodes;
}

/**
 * Format text for display with WhatsApp formatting and link detection
 */
export function formatWhatsAppText(text: string): React.ReactNode {
  const formattedNodes = parseWhatsAppFormatting(text);
  
  // Further process each text node to detect URLs
  return formattedNodes.map((node, i) => {
    if (typeof node === 'string') {
      return processUrls(node, `url-${i}`);
    }
    return node;
  });
}

/**
 * Convert URLs in text to clickable links
 */
function processUrls(text: string, keyPrefix: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    nodes.push(
      React.createElement('a', {
        key: `${keyPrefix}-${key++}`,
        href: match[0],
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'text-blue-500 hover:underline break-all'
      }, match[0])
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
