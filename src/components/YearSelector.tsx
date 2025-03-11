import React from "react";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { cn } from "@/lib/utils";

interface YearSelectorProps {
  selectedYear: string;
  onYearChange: (value: string) => void;
}

const YearSelector: React.FC<YearSelectorProps> = ({
  selectedYear,
  onYearChange,
}) => {
  const startYear = 2023;
  const endYear = 2033;
  const years = Array.from(
    { length: endYear - startYear + 1 }, 
    (_, i) => (startYear + i).toString()
  );
  
  const currentIndex = years.indexOf(selectedYear);

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <Label>Year: {selectedYear}</Label>
        <Slider
          value={[currentIndex]}
          max={years.length - 1}
          step={1}
          onValueChange={(values) => onYearChange(years[values[0]])}
          className="w-full"
        />
      </div>
      
      <div className="flex justify-between text-xs text-muted-foreground">
        {years.map((year, index) => (
          <span 
            key={year}
            className={cn(
              "cursor-pointer hover:text-primary transition-colors",
              year === selectedYear && "text-primary font-bold"
            )}
            onClick={() => onYearChange(year)}
          >
            {year}
          </span>
        ))}
      </div>
    </div>
  );
};

export default YearSelector;