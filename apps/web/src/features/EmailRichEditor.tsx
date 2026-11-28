import { useEffect, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, Underline, Unlink2 } from 'lucide-react';
import { Tooltip } from '@astryxdesign/core/Tooltip';

export type RichDraft = { body: string; html: string };

export default function EmailRichEditor({ disabled, onChange }: {
  disabled: boolean; onChange: (value: RichDraft) => void;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState('');
  const editor = useEditor({
    extensions: [StarterKit.configure({
      heading: { levels: [2, 3] },
      link: { openOnClick: false, autolink: false, linkOnPaste: false, defaultProtocol: 'https' },
    })],
    immediatelyRender: false,
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': 'Message', 'aria-multiline': 'true', 'aria-placeholder': 'Write a message' },
      handleKeyDown: (view, event) => {
        if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return false;
        event.preventDefault();
        view.dom.closest('form')?.requestSubmit();
        return true;
      },
      transformPastedHTML: html => DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'blockquote', 'code', 'pre'],
        ALLOWED_ATTR: ['href'],
        ALLOW_DATA_ATTR: false,
        ALLOW_ARIA_ATTR: false,
      }),
    },
    onUpdate: ({ editor }) => onChange({
      body: editor.getText({ blockSeparator: '\n\n' }),
      html: editor.getHTML(),
    }),
  });
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      empty: editor?.isEmpty ?? true,
      bold: editor?.isActive('bold') || false,
      italic: editor?.isActive('italic') || false,
      underline: editor?.isActive('underline') || false,
      bullets: editor?.isActive('bulletList') || false,
      numbered: editor?.isActive('orderedList') || false,
      quote: editor?.isActive('blockquote') || false,
      heading: editor?.isActive('heading', { level: 2 }) || false,
      link: editor?.isActive('link') || false,
    }),
  });
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  if (!editor || !active) return null;

  const formats = [
    ['Bold', Bold, active.bold, () => editor.chain().focus().toggleBold().run()],
    ['Italic', Italic, active.italic, () => editor.chain().focus().toggleItalic().run()],
    ['Underline', Underline, active.underline, () => editor.chain().focus().toggleUnderline().run()],
    ['Bulleted list', List, active.bullets, () => editor.chain().focus().toggleBulletList().run()],
    ['Numbered list', ListOrdered, active.numbered, () => editor.chain().focus().toggleOrderedList().run()],
    ['Quote', Quote, active.quote, () => editor.chain().focus().toggleBlockquote().run()],
    ['Heading', Heading2, active.heading, () => editor.chain().focus().toggleHeading({ level: 2 }).run()],
  ] as const;

  function applyLink() {
    if (link === null || !editor) return;
    const url = URL.canParse(link.trim()) ? new URL(link.trim()) : null;
    if (!url || !['https:', 'http:', 'mailto:'].includes(url.protocol)) {
      setLinkError('Enter a web address starting with https:// or a mailto: link.');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.href }).run();
    setLink(null);
  }

  const linkLabel = active.link ? 'Edit link' : 'Insert link';
  return <div className="email-beta-editor">
    <EditorContent editor={editor} className={'email-compose-body' + (active.empty ? ' is-empty' : '')} />
    <div className="email-beta-formatting" role="group" aria-label="Message formatting">
      {formats.map(([name, Icon, pressed, apply]) => <Tooltip key={name} content={name}>
        <button className="icon-button" type="button" aria-label={name} aria-pressed={pressed}
          disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={apply}>
          <Icon size={17} aria-hidden="true" />
        </button>
      </Tooltip>)}
      <Tooltip content={linkLabel}>
        <button className="icon-button email-format-link" type="button" aria-label={linkLabel} aria-expanded={link !== null}
          disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => {
            setLinkError('');
            setLink(link === null ? editor.getAttributes('link').href || '' : null);
          }}><Link2 size={17} aria-hidden="true" /></button>
      </Tooltip>
    </div>
    {link !== null && <div className="email-beta-link-editor">
      <label>Link address<input type="url" value={link} disabled={disabled} onChange={event => setLink(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyLink(); } }} /></label>
      <button className="button" type="button" disabled={disabled} onClick={applyLink}>Apply link</button>
      {active.link && <button className="icon-button" aria-label="Remove link" title="Remove link" type="button" disabled={disabled} onClick={() => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        setLink(null);
      }}><Unlink2 size={17} aria-hidden="true" /></button>}
      {linkError && <p role="alert">{linkError}</p>}
    </div>}
  </div>;
}
