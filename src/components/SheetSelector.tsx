import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import { listSpreadsheets, loadSheets } from '../lib/google-sheets';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';

interface SheetSelectorProps {
  onSelect: (data: {
    spreadsheetId: string;
    sheetName: string;
    nameColumn: string;
    embedColumn: string;
  }) => void;
}

export function SheetSelector({ onSelect }: SheetSelectorProps) {
  const { isSignedIn, isInitialized, error, signIn } = useGoogleAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<Array<{id: string, name: string}>>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState('');
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [nameColumn, setNameColumn] = useState('N');
  const [embedColumn, setEmbedColumn] = useState('W');

  useEffect(() => {
    const fetchSpreadsheets = async () => {
      if (isSignedIn && isInitialized) {
        setIsLoading(true);
        try {
          const sheets = await listSpreadsheets();
          setSpreadsheets(sheets);
        } catch (error) {
          console.error('Error fetching spreadsheets:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchSpreadsheets();
  }, [isSignedIn, isInitialized]);

  useEffect(() => {
    if (selectedSpreadsheetId) {
      loadSheets(selectedSpreadsheetId);
    }
  }, [selectedSpreadsheetId]);

  useEffect(() => {
    if (selectedSpreadsheetId && selectedSheet && nameColumn && embedColumn) {
      onSelect({
        spreadsheetId: selectedSpreadsheetId,
        sheetName: selectedSheet,
        nameColumn,
        embedColumn
      });
    }
  }, [selectedSpreadsheetId, selectedSheet, nameColumn, embedColumn]);

  if (!isInitialized) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Initializing Google API...</span>
        </div>
      </Card>
    );
  }

  if (!isSignedIn) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4">
          <p>Please sign in to access Google Sheets</p>
          <Button onClick={signIn}>
            Sign in with Google
          </Button>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>اختر ملف جوجل شيت</Label>
          <Select value={selectedSpreadsheetId} onValueChange={setSelectedSpreadsheetId}>
            <SelectTrigger>
              <SelectValue placeholder="اختر الملف" />
            </SelectTrigger>
            <SelectContent>
              {spreadsheets.map((sheet) => (
                <SelectItem key={sheet.id} value={sheet.id}>
                  {sheet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>اختر الورقة</Label>
          <Select value={selectedSheet} onValueChange={setSelectedSheet}>
            <SelectTrigger disabled={!selectedSpreadsheetId}>
              <SelectValue placeholder="اختر الورقة" />
            </SelectTrigger>
            <SelectContent>
              {sheets.map((sheetName) => (
                <SelectItem key={sheetName} value={sheetName}>
                  {sheetName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>عمود اسم الفيديو</Label>
            <Input 
              value={nameColumn}
              onChange={(e) => setNameColumn(e.target.value.toUpperCase())}
              placeholder="مثال: N"
              maxLength={2}
            />
          </div>
          <div className="space-y-2">
            <Label>عمود كود التضمين</Label>
            <Input 
              value={embedColumn}
              onChange={(e) => setEmbedColumn(e.target.value.toUpperCase())}
              placeholder="مثال: W"
              maxLength={2}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}