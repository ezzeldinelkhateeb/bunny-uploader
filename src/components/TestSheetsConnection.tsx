import React, { useState } from 'react';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from './ui/use-toast';

export function TestSheetsConnection() {
  const [isLoading, setIsLoading] = useState(false);

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/test-sheets-connection', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: `Connected to sheet: ${data.data.sheetName}`,
        });
      } else {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
      }
      
      console.log('Test connection response:', data);
    } catch (error) {
      console.error('Test connection error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={testConnection} 
      disabled={isLoading}
      className="flex gap-2 items-center"
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      Test Sheets Connection
    </Button>
  );
}