"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MarkdownFile } from "@/shared/types";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";

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

  return (
      <div className="h-full overflow-auto">
          <CodeMirror
        value={content}
              height="100%"
              extensions={[
                  markdown(),
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
