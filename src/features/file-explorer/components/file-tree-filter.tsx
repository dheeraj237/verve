import { useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface FileTreeFilterProps {
  onFilterChange: (filter: string) => void;
  className?: string;
}

export function FileTreeFilter({ onFilterChange, className }: FileTreeFilterProps) {
  const [filterValue, setFilterValue] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilterValue(value);
    onFilterChange(value);
  };

  const handleClear = () => {
    setFilterValue("");
    onFilterChange("");
  };

  return (
    <div className={cn("px-2 py-1.5 border-b border-sidebar-border", className)}>
      <div className="relative">
        <Input
          type="text"
          placeholder="Filter files..."
          value={filterValue}
          onChange={handleChange}
          className="h-7 text-xs pr-7"
        />
        {filterValue && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 hover:bg-accent cursor-pointer"
            title="Clear filter"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
