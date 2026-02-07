"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MarkdownFile } from "@/shared/types";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
// import { java } from "@codemirror/lang-java";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
// import { xml } from "@codemirror/lang-xml";
import { json } from "@codemirror/lang-json";
import { sql } from "@codemirror/lang-sql";
import { EditorView } from "@codemirror/view";
import { getLanguageExtension } from "@/shared/utils/file-type-detector";

interface CodeEditorProps {
  file: MarkdownFile;
  onContentChange: (content: string) => void;
}

export function CodeEditor({ file, onContentChange }: CodeEditorProps) {
    const [content, setContent] = useState(file.content);
    const { theme, systemTheme } = useTheme();
    const currentTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
      setContent(file.content);
  }, [file.id, file.content]);

    const handleChange = (value: string) => {
        setContent(value);
        onContentChange(value);
  };

  // Determine language extension based on file type
  const getExtensions = () => {
    const langName = getLanguageExtension(file.name);

    const extensionMap: Record<string, any> = {
      "javascript": [javascript({ typescript: false })],
      "typescript": [javascript({ typescript: true })],
      "python": [python()],
      // "java": [java()],
      "html": [html()],
      "css": [css()],
      // "xml": [xml()],
      "json": [json()],
      "sql": [sql()],
      "markdown": [markdown()],
    };

    return extensionMap[langName] || [markdown()];
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="px-4 py-2 border-b border-border bg-muted/10 text-xs text-muted-foreground">
        {file.name}
      </div>
      <CodeMirror
        value={content}
        height="100%"
        extensions={[
          ...getExtensions(),
          EditorView.lineWrapping,
        ]}
        onChange={handleChange}
        theme={currentTheme === "dark" ? "dark" : "light"}
              basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: true,
                  highlightActiveLine: true,
                  foldGutter: true,
                  dropCursor: true,
                  allowMultipleSelections: true,
                  indentOnInput: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  autocompletion: true,
                  rectangularSelection: true,
                  crosshairCursor: true,
                  highlightSelectionMatches: true,
                  closeBracketsKeymap: true,
                  searchKeymap: true,
                  foldKeymap: true,
                  completionKeymap: true,
                  lintKeymap: true,
              }}
              style={{
                  height: "100%",
                  fontSize: "14px",
              }}
      />
    </div>
  );
}
