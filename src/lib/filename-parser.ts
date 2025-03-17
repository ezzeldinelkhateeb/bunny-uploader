import { ParsedFilename, LibraryInfo, ParseResult, CollectionResult, LibraryMatch, COLLECTIONS_CONFIG } from '../types/filename-parser';
import { VALID_COLLECTIONS } from '../types/filename-parser';

export function normalizeFilename(filename: string): string {
  return filename
    // Remove file extension
    .replace(/\.[^/.]+$/, '')
    // Replace multiple dashes/underscores with single dash
    .replace(/[-_]{2,}/g, '-')
    // Remove brackets and parentheses
    .replace(/[\[\]()]/g, '')
    // Normalize spaces around dashes
    .replace(/\s*-\s*/g, '-')
    // Extract Arabic text within curly braces separately
    .replace(/\{([^}]+)\}/, (_, arabic) => `{${arabic.trim()}}`)
    .trim();
}

export function parseFilename(filename: string): ParseResult {
  const normalized = normalizeFilename(filename);
  
  try {
    // Extract Arabic text within curly braces
    const arabicMatch = normalized.match(/\{([^}]+)\}/);
    const arabicText = arabicMatch ? arabicMatch[1] : undefined;
    const cleanName = normalized.replace(/\{[^}]+\}/, '').trim();

    // Split parts by dash
    const parts = cleanName.split('-').filter(Boolean);

    // Determine video type
    let type: ParsedFilename['type'] = 'FULL';
    if (parts[0] === 'RE') {
      type = 'RE';
      parts.shift();
    } else if (parts.join('-').match(/[Qq]\d+/)) {
      type = 'QV';
    }

    const parsed: ParsedFilename = {
      type,
      academicYear: parts[0], // S1, M2, etc.
      arabicText
    };

    // Parse remaining components
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('T')) parsed.term = part;
      else if (part.startsWith('U')) parsed.unit = part;
      else if (part.startsWith('L')) parsed.lesson = part;
      else if (part.startsWith('P')) parsed.teacherCode = part;
      else if (part.startsWith('C')) parsed.class = part;
      else if (part.match(/^(AR|EN)$/)) parsed.branch = part;
      else if (!parsed.teacherName && part.includes(' ')) parsed.teacherName = part;
    }

    return {
      filename,
      parsed,
      libraryMatch: { library: null, confidence: 0, alternatives: [] },
      collection: determineCollection(parsed)
    };

  } catch (error) {
    return {
      filename,
      parsed: null,
      libraryMatch: { library: null, confidence: 0, alternatives: [] },
      collection: { name: '', reason: 'Failed to parse filename' },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export function findMatchingLibrary(parsed: ParsedFilename, libraries: LibraryInfo[]): LibraryMatch {
  const matches: Array<{ library: LibraryInfo; score: number }> = [];
  
  for (const library of libraries) {
    let score = 0;
    const maxScore = 100;

    // Exact matches for all components
    if (library.name.includes(parsed.academicYear) && 
        library.name.includes(parsed.teacherCode || '') && 
        library.name.includes(parsed.branch || '') &&
        library.name.includes(parsed.teacherName || '')) {
      score = maxScore;
    } else {
      // Academic year match (M1, S2, etc)
      if (library.name.startsWith(parsed.academicYear)) {
        score += 30;
      }

      // Teacher code match (P0114, etc)
      if (parsed.teacherCode && library.name.includes(parsed.teacherCode)) {
        score += 30;
      }

      // Branch match (AR, EN, MATH, SCI, etc)
      if (parsed.branch && library.name.includes(parsed.branch)) {
        score += 20;
      }

      // Teacher name partial match
      if (parsed.teacherName) {
        const normalizedTeacherName = parsed.teacherName.toLowerCase();
        const normalizedLibraryName = library.name.toLowerCase();
        if (normalizedLibraryName.includes(normalizedTeacherName)) {
          score += 20;
        }
      }
    }

    if (score > 0) {
      matches.push({ library, score });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return {
    library: matches[0]?.library || null,
    confidence: matches[0]?.score || 0,
    alternatives: matches.map(m => m.library) // Return all matches for manual selection
  };
}

export function determineCollection(parsed: ParsedFilename): CollectionResult {
  const year = "2025"; // This could be made configurable
  const configs = COLLECTIONS_CONFIG[year];
  
  // Normalize filename for pattern matching
  const testString = [
    parsed.type === 'RE' ? 'RE' : '',
    parsed.term,
    parsed.arabicText
  ].filter(Boolean).join('-');

  // Test against each pattern in order
  for (const config of configs) {
    if (config.pattern.test(testString)) {
      // For revision videos, ensure proper term handling
      if (config.name.startsWith('RE-')) {
        if (parsed.type !== 'RE') continue;
        
        // Special handling for term-specific revision
        if (parsed.term) {
          return {
            name: `RE-${parsed.term}-${year}-QV`,
            reason: `Revision video for ${parsed.term}`
          };
        }
      }
      
      // For question videos
      if (config.name.includes('-QV')) {
        if (parsed.type === 'QV' || parsed.arabicText?.includes('Q')) {
          return {
            name: parsed.term ? `${parsed.term}-${year}-QV` : config.name,
            reason: config.reason
          };
        }
      }
      
      // For regular videos
      if (!config.name.includes('-QV') && !config.name.startsWith('RE-')) {
        if (parsed.type === 'FULL') {
          return {
            name: parsed.term ? `${parsed.term}-${year}` : config.name,
            reason: config.reason
          };
        }
      }
    }
  }

  // Default fallback
  return {
    name: `${parsed.term || 'T1'}-${year}`,
    reason: 'Regular content video'
  };
}

export function determineLibrary(parsed: ParsedFilename): string {
  // Format: academicYear-branch-teacherCode-teacherName
  // e.g., "S1-AR-P0046-Zakaria Seif Eldin"
  
  const parts = [
    parsed.academicYear,
    parsed.branch,
    parsed.teacherCode,
    parsed.teacherName
  ].filter(Boolean);

  return parts.join('-');
}
