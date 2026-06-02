import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { useEffect, useRef } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link as LinkIcon, RemoveFormatting,
  Heading2, Heading3, Type,
} from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff"];
const TEXT_COLORS = ["#18181b", "#dc2626", "#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0891b2"];

function ToolbarButton({
  onClick, active = false, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${
        active ? "bg-primary-100 text-primary-700" : "text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-neutral-200 mx-0.5" />;
}

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value === "" && editor.getHTML() !== "<p></p>") {
      editor.commands.clearContent();
    }
  }, [value, editor]);

  if (!editor) return null;

  const insertLink = () => {
    const url = window.prompt("URL do link:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="border border-neutral-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent">
      {/* Toolbar */}
      <div className="bg-neutral-50 border-b border-neutral-200 px-2 py-1.5 flex flex-wrap gap-0.5 items-center">

        {/* Paragraph style */}
        <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")} title="Normal">
          <Type className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Título">
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Subtítulo">
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Text formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrito (Ctrl+B)">
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Itálico (Ctrl+I)">
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Sublinhado (Ctrl+U)">
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Tachado">
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Text color */}
        <div className="flex items-center gap-0.5">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(color).run(); }}
              title={`Cor: ${color}`}
              className="w-4 h-4 rounded-full border border-neutral-300 hover:scale-110 transition-transform flex-shrink-0"
              style={{ backgroundColor: color }}
            />
          ))}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); colorInputRef.current?.click(); }}
            title="Escolher cor personalizada"
            className="w-4 h-4 rounded-full border border-neutral-300 bg-gradient-to-br from-red-400 via-green-400 to-blue-400 hover:scale-110 transition-transform flex-shrink-0"
          />
          <input
            ref={colorInputRef}
            type="color"
            className="sr-only"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </div>

        <Divider />

        {/* Highlight */}
        <div className="flex items-center gap-0.5">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                editor.chain().focus().toggleHighlight({ color }).run();
              }}
              title={`Destaque`}
              className={`w-4 h-4 rounded border hover:scale-110 transition-transform flex-shrink-0 ${
                editor.isActive("highlight", { color }) ? "border-neutral-500" : "border-neutral-300"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <Divider />

        {/* Alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Alinhar à esquerda">
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centralizar">
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Alinhar à direita">
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justificar">
          <AlignJustify className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista com marcadores">
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerada">
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Link */}
        <ToolbarButton onClick={insertLink} active={editor.isActive("link")} title="Inserir link">
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Clear formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Remover formatação">
          <RemoveFormatting className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <div className="relative">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none text-neutral-800"
        />
        {editor.isEmpty && placeholder && (
          <p className="absolute top-4 left-4 text-sm text-neutral-400 pointer-events-none">
            {placeholder}
          </p>
        )}
      </div>
    </div>
  );
}
