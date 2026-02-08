import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Security: Maximum file size (10MB for markdown files)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath } = await params;

    // Security: validate file path components
    if (filePath.some(part => part.includes('..') || part.includes('\0'))) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 403 }
      );
    }

    const fullPath = path.join(process.cwd(), "public/content", ...filePath);

    // Security: prevent directory traversal
    const contentDir = path.join(process.cwd(), "public/content");
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(path.resolve(contentDir))) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 403 }
      );
    }

    // Check if file exists and validate
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        return NextResponse.json(
          { error: "Path is not a file" },
          { status: 400 }
        );
      }

      // Security: check file size
      if (stats.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large" },
          { status: 413 }
        );
      }

      // Security: only allow markdown files
      const ext = path.extname(resolvedPath).toLowerCase();
      if (ext !== '.md' && ext !== '.mdx') {
        return NextResponse.json(
          { error: "Invalid file type" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Read file content
    const content = await fs.readFile(resolvedPath, "utf-8");
    
    return NextResponse.json({
      success: true,
      data: {
        path: filePath.join("/"),
        content,
        name: path.basename(resolvedPath),
      },
    });
  } catch (error) {
    console.error("Error reading file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath } = await params;
    const body = await request.json();
    const { content } = body;

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string" },
        { status: 400 }
      );
    }

    // Security: check content size
    const contentSize = Buffer.byteLength(content, 'utf-8');
    if (contentSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Content too large" },
        { status: 413 }
      );
    }

    // Security: validate file path components
    if (filePath.some(part => part.includes('..') || part.includes('\0'))) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 403 }
      );
    }

    const fullPath = path.join(process.cwd(), "content", ...filePath);

    // Security: prevent directory traversal
    const contentDir = path.join(process.cwd(), "content");
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(contentDir)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 403 }
      );
    }

    // Check if file exists
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        return NextResponse.json(
          { error: "Path is not a file" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Write file content
    await fs.writeFile(resolvedPath, content, "utf-8");

    return NextResponse.json({
      success: true,
      message: "File saved successfully",
      data: {
        path: filePath.join("/"),
        name: path.basename(resolvedPath),
      },
    });
  } catch (error) {
    console.error("Error saving file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
