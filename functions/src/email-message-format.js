// Stored messages stay editable as text. Only these three formatting controls
// generate markup. Message content is escaped independently of its source.
export function emailMessageBlocks(value) {
  return value.split(/\r?\n/).reduce((blocks, line) => {
    if (!line.trim()) {
      if (blocks.at(-1)?.kind !== 'break') blocks.push({ kind: 'break', lines: [] });
      return blocks;
    }
    const bullet = line.match(/^\s*[-•]\s+(.+)$/);
    const kind = bullet ? 'list' : 'paragraph';
    const tail = blocks.at(-1);
    if (tail?.kind === kind) tail.lines.push(bullet?.[1] || line);
    else blocks.push({ kind, lines: [bullet?.[1] || line] });
    return blocks;
  }, []);
}

export function emailMessageRuns(line) {
  return line.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).filter(Boolean).map(text => {
    if (text.startsWith('**') && text.endsWith('**') && text.length > 4)
      return { kind: 'bold', text: text.slice(2, -2) };
    if (text.startsWith('*') && text.endsWith('*') && text.length > 2)
      return { kind: 'italic', text: text.slice(1, -1) };
    return { kind: 'text', text };
  });
}

const escape = value => value.replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function renderCorrespondenceV1(body) {
  const blocks = emailMessageBlocks(body);
  const asText = line => emailMessageRuns(line).map(run => run.text).join('');
  const asHtml = line => emailMessageRuns(line).map(({ kind, text }) =>
    kind === 'bold' ? '<strong>' + escape(text) + '</strong>' :
      kind === 'italic' ? '<em>' + escape(text) + '</em>' : escape(text)).join('');
  const text = blocks.map(block => block.lines.map(line =>
    (block.kind === 'list' ? '• ' : '') + asText(line)).join('\n')).join('\n');
  const html = blocks.map(block => {
    if (block.kind === 'list') return '<ul style="margin:0 0 16px;padding-left:24px">' +
      block.lines.map(line => '<li>' + asHtml(line) + '</li>').join('') + '</ul>';
    if (block.kind === 'paragraph') return '<p style="margin:0 0 16px">' + block.lines.map(asHtml).join('<br>') + '</p>';
    return '';
  }).join('');
  return { text, html: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head>' +
    '<body style="margin:0;font-family:Open Sans,Arial,sans-serif">' +
    '<div style="max-width:640px;margin:0 auto;padding:24px;line-height:1.65;font-size:16px;overflow-wrap:anywhere">' +
    html + '<div style="border-top:1px solid #b9c3d0;padding-top:12px;margin-top:24px;font-size:13px;font-weight:600">' +
    '<img src="https://salesdrone.in/brand/salesdrone-mark.png" width="18" height="18" alt="" style="vertical-align:middle;margin-right:7px;border:0">SalesDrone</div>' +
    '</div></body></html>' };
}
