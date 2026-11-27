import { Fragment, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { emailMessageBlocks, emailMessageRuns } from '../../../../functions/src/email-message-format.js';
import { displayDate } from '../lib/types';

export type EmailMessage = {
  id: string; direction: 'inbound' | 'outbound'; body: string;
  createdAt: string; state: string; attachments: boolean; truncated: boolean;
  formatVersion?: 1;
};

function splitQuotedReply(value: string) {
  const lines = value.split(/\r?\n/);
  const quote = lines.findIndex((line, index) =>
    index > 0 && (
      /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i.test(line) ||
      (/^On\s/.test(line) && [1, 2, 3].some(count =>
        /\bwrote:\s*$/.test(lines[index + count - 1] || '') &&
        /^\s*>/.test(lines.slice(index + count).find(part => part.trim()) || ''))) ||
      (index > 0 && /^\s*>/.test(line) && lines.slice(index).every(part => !part.trim() || /^\s*>/.test(part)))
    ));
  return quote < 0 ? [value, ''] : [lines.slice(0, quote).join('\n').trimEnd(), lines.slice(quote).join('\n')];
}

export function FormattedEmailText({ value }: { value: string }) {
  function line(value: string) {
    return emailMessageRuns(value).map((part, index) =>
      part.kind === 'bold' ? <strong key={index}>{part.text}</strong> :
        part.kind === 'italic' ? <em key={index}>{part.text}</em> : <Fragment key={index}>{part.text}</Fragment>);
  }
  return <div className="email-beta-formatted">{emailMessageBlocks(value).map((block, index) =>
    block.kind === 'list' ? <ul key={index}>{block.lines.map((item, number) => <li key={number}>{line(item)}</li>)}</ul> :
      block.kind === 'paragraph' ? <p key={index}>{block.lines.map((item, number) => <Fragment key={number}>
        {number > 0 && <br />}{line(item)}
      </Fragment>)}</p> : null
  )}</div>;
}

export default function EmailConversationMessage({ message, correspondent, timezone, latest }: {
  message: EmailMessage; correspondent: string; timezone: string; latest: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const from = message.direction === 'inbound' ? correspondent : 'SalesDrone';
  const [body, quote] = message.direction === 'inbound' ? splitQuotedReply(message.body) : [message.body, ''];
  const long = body.length > 1200 || body.split('\n').length > 14;
  const excerpt = body.split('\n').slice(0, 12).join('\n').slice(0, 1100);
  const visible = long && !expanded ? excerpt + '…' : body;
  const snippet = body.replace(/\s+/g, ' ').slice(0, 140);
  const preview = message.formatVersion === 1 ? emailMessageRuns(snippet).map(run => run.text).join('') : snippet;
  return <li className="email-beta-message">
    <details open={latest || undefined}>
      <summary>
        <span className="email-beta-message-avatar" aria-hidden="true">{from[0]?.toUpperCase()}</span>
        <span className="email-beta-message-byline">
          <strong>{from}</strong>
          <span className="email-beta-message-preview">{preview}</span>
        </span>
        <time dateTime={message.createdAt}>{displayDate(message.createdAt, timezone)}</time>
        <ChevronDown size={16} aria-hidden="true" className="email-beta-message-chevron" />
      </summary>
      <div className="email-beta-message-content">
        {message.formatVersion === 1 ? <FormattedEmailText value={visible} /> : <p className="email-beta-plain">{visible}</p>}
        {long && <button className="text-button" type="button" aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : 'Read full message'}</button>}
        {quote && <details className="email-beta-quote">
          <summary>Quoted text</summary>
          <blockquote className="email-beta-plain">{quote}</blockquote>
        </details>}
        <small>{message.state}{message.attachments ? ' · Attachments present' : ''}{message.truncated ? ' · Message shortened' : ''}</small>
      </div>
    </details>
  </li>;
}
