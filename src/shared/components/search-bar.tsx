import { useState, useEffect, useRef } from "react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Search, File, FolderOpen, Hash } from "lucide-react";
import { useEditorStore } from "@/features/editor/store/editor-store";
import { useFileExplorerStore } from "@/features/file-explorer/store/file-explorer-store";
import { FileNode, FileNodeType } from "@/shared/types";
import { cn } from "@/shared/utils/cn";

enum SearchResultType {
  File = 'file',
  Content = 'content',
  Command = 'command',
}

interface SearchResult {
  type: SearchResultType;
  title: string;
  description?: string;
  action: () => void;
  icon: React.ReactNode;
}

interface SearchBarProps {
  className?: string;
}

export function SearchBar({ className }: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { openTabs, openFile } = useEditorStore();
  const { fileTree, openLocalDirectory } = useFileExplorerStore();

  // Listen for Cmd+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
      
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search through files and content
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const newResults: SearchResult[] = [];

    // Search through file tree
    const searchInFileTree = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        if (node.name.toLowerCase().includes(query)) {
          newResults.push({
            type: SearchResultType.File,
            title: node.name,
            description: node.path,
            icon: node.type === FileNodeType.Folder ? 
              <FolderOpen className="h-4 w-4" /> : 
              <File className="h-4 w-4" />,
            action: () => {
                if (node.type === FileNodeType.File) {
                // This would need to be implemented to open the file
                console.log('Opening file:', node.path);
              }
              setIsOpen(false);
              setSearchQuery("");
            }
          });
        }
        
        if (node.children) {
          searchInFileTree(node.children);
        }
      });
    };

    searchInFileTree(fileTree);

    // Search through open tabs
    openTabs.forEach(tab => {
      if (tab.name.toLowerCase().includes(query) && 
          !newResults.some(r => r.title === tab.name)) {
        newResults.push({
          type: SearchResultType.File,
          title: tab.name,
          description: 'Open tab • ' + tab.path,
          icon: <File className="h-4 w-4" />,
          action: () => {
            openFile(tab);
            setIsOpen(false);
            setSearchQuery("");
          }
        });
      }
    });

    // Add common commands
    const commands = [
      {
        title: 'Open Folder',
        description: 'Browse and open a local folder',
        icon: <FolderOpen className="h-4 w-4" />,
        action: () => {
          openLocalDirectory();
          setIsOpen(false);
          setSearchQuery("");
        }
      },
    ];

    commands.forEach(cmd => {
      if (cmd.title.toLowerCase().includes(query) || 
          cmd.description.toLowerCase().includes(query)) {
        newResults.push({
          type: SearchResultType.Command,
          ...cmd
        });
      }
    });

    setResults(newResults.slice(0, 10)); // Limit to 10 results
  }, [searchQuery, fileTree, openTabs, openFile, openLocalDirectory]);

  const handleSelect = (result: SearchResult) => {
    result.action();
  };

  return (
    <div className={cn("relative", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-sidebar-background border-sidebar-border"
              onFocus={() => setIsOpen(true)}
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              ⌘K
            </kbd>
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 p-0" 
          align="start"
          side="bottom"
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Search files, content, and commands..."
              className="border-0"
            />
            <CommandList>
              {results.length === 0 && searchQuery && (
                <CommandEmpty>No results found for "{searchQuery}"</CommandEmpty>
              )}
              {results.length === 0 && !searchQuery && (
                <CommandEmpty>
                  Type to search files and commands...
                  <div className="text-xs text-muted-foreground mt-1">
                    Press Cmd+K to focus
                  </div>
                </CommandEmpty>
              )}
              {results.length > 0 && (
                <CommandGroup>
                  {results.map((result, index) => (
                    <CommandItem
                      key={`${result.type}-${index}`}
                      onSelect={() => handleSelect(result)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        {result.icon}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{result.title}</div>
                          {result.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {result.description}
                            </div>
                          )}
                        </div>
                        {result.type === SearchResultType.Command && (
                          <Hash className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}