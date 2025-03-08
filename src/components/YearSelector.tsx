import React from "react";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

interface YearSelectorProps {
  selectedYear: "2024" | "2025";
  onYearChange: (value: "2024" | "2025") => void;
}

const YearSelector: React.FC<YearSelectorProps> = ({
  selectedYear,
  onYearChange,
}) => {
  return (
    <div className="space-y-2">
      <Label>Year</Label>
      <RadioGroup
        value={selectedYear}
        onValueChange={(value) => onYearChange(value as "2024" | "2025")}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="2024" id="2024" />
          <Label htmlFor="2024">2024</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="2025" id="2025" />
          <Label htmlFor="2025">2025</Label>
        </div>
      </RadioGroup>
    </div>
  );
};

export default YearSelector;