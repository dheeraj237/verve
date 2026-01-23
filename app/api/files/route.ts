import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { FileNode } from "@/shared/types";

async function buildFileTree(dirPath: string, relativePath: string = ""): Promise<FileNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      const children = await buildFileTree(fullPath, relPath);
      nodes.push({
        id: relPath,
        name: entry.name,
        path: relPath,
        type: "folder",
        children,
      });
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
      nodes.push({
        id: relPath,
        name: entry.name,
        path: relPath,
        type: "file",
      });
    }
  }

  // Sort: folders first, then files, both alphabetically
  return nodes.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === "folder" ? -1 : 1;
  });
}

export async function GET(request: NextRequest) {
  try {
    const contentDir = path.join(process.cwd(), "content");
    
    // Check if content directory exists
    try {
      await fs.access(contentDir);
    } catch {
      return NextResponse.json(
        { error: "Content directory not found" },
        { status: 404 }
      );
    }

    const fileTree = await buildFileTree(contentDir);

    return NextResponse.json({
      success: true,
      data: fileTree,
    });
  } catch (error) {
    console.error("Error building file tree:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
