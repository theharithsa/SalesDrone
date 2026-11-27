import { useEffect, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';

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
      attributes: { role: 'textbox', 'aria-label': 'Message', 'aria-multiline': 'true' },
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
    ['Bold', active.bold, () => editor.chain().focus().toggleBold().run()],
    ['Italic', active.italic, () => editor.chain().focus().toggleItalic().run()],
    ['Underline', active.underline, () => editor.chain().focus().toggleUnderline().run()],
    ['Bullets', active.bullets, () => editor.chain().focus().toggleBulletList().run()],
    ['Numbered list', active.numbered, () => editor.chain().focus().toggleOrderedList().run()],
    ['Quote', active.quote, () => editor.chain().focus().toggleBlockquote().run()],
    ['Heading', active.heading, () => editor.chain().focus().toggleHeading({ level: 2 }).run()],
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

  return <div className="email-beta-editor">
    <div className="email-beta-formatting" role="group" aria-label="Message formatting">
      {formats.map(([name, pressed, apply]) => <button key={name} type="button" aria-pressed={pressed}
        disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={apply}>{name}</button>)}
      <button type="button" aria-expanded={link !== null} disabled={disabled}
        onMouseDown={event => event.preventDefault()} onClick={() => {
          setLinkError('');
          setLink(link === null ? editor.getAttributes('link').href || '' : null);
        }}>{active.link ? 'Edit link' : 'Link'}</button>
    </div>
    {link !== null && <div className="email-beta-link-editor">
      <label>Link address<input type="url" value={link} disabled={disabled} onChange={event => setLink(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyLink(); } }} /></label>
      <button type="button" disabled={disabled} onClick={applyLink}>Apply link</button>
      {active.link && <button type="button" disabled={disabled} onClick={() => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        setLink(null);
      }}>Remove link</button>}
      {linkError && <p role="alert">{linkError}</p>}
    </div>}
    <EditorContent editor={editor} />
  </div>;
}
