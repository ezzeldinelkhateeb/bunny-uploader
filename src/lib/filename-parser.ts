import { LibraryInfo } from '../types/library';

export interface ParsedFilename {
  type: "RE" | "QV" | "FULL";
  academicYear: string;
  term: string;
  unit?: string;
  lesson?: string;
  branch: string;
  teacherCode: string;
  teacherName: string;
  lessonName: string;
  classNumber?: string;
  questionNumber?: string;
  collectionGroup?: string; // لتجميع الملفات المتشابهة
  parseConfidence: 'high' | 'medium' | 'low'; // مستوى الثقة في التحليل
  suggestedLibraries?: string[]; // اقتراحات للمكتبات المحتملة
}

export function normalizeString(str: string): string {
  return str
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function parseFilename(filename: string): {
  parsed: ParsedFilename | null;
  error?: string;
} {
  try {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "").trim();
    
    // Enhanced pattern to handle more variations
    const pattern = /^(?:(RE)-)?([JSM][1-6])(?:-+)?(?:T([12]))?(?:-+)?(?:U(\d+))?(?:-+)?(?:L(\d+))?(?:-+)?([A-Z-]+)-([P]\d{4})-([^-{]+?)(?:-C(\d+))?(?:-+)?\{([^}]+)\}(?:-Q(\d+))?(?:-([A-Z]+))?$/i;
    
    // Alternative pattern for different format
    const alternativePattern = /^([JSM][1-6])(?:-+)?T([12])(?:-+)?(?:U(\d+))?(?:-+)?(?:L(\d+))?(?:-+)?([A-Z-]+)(?:-[A-Z]+)?-([P]\d{4})-([^-{]+?)(?:-C(\d+))?\{(.+?)\}(?:-Q(\d+))?(?:-([A-Z]+))?$/i;
    
    let match = nameWithoutExt.match(pattern);
    let isAlternativeFormat = false;

    if (!match) {
      match = nameWithoutExt.match(alternativePattern);
      isAlternativeFormat = true;
    }

    if (!match) {
      console.warn(`Failed to match filename: ${filename}`);
      return {
        parsed: null,
        error: "Invalid filename format"
      };
    }

    let [
      ,
      isRevision,
      academicYear,
      termNum,
      unit,
      lesson,
      branch,
      teacherCode,
      teacherName,
      classNumber,
      lessonName,
      questionNumber,
      langSuffix
    ] = isAlternativeFormat 
      ? [null, null, ...match] 
      : match;

    // Handle branch and language parts
    const branchParts = branch.split('-');
    const mainBranch = branchParts[0];
    let lang = branchParts[1] || langSuffix || '';

    // Clean up teacher name
    teacherName = teacherName.trim().replace(/\s+/g, ' ');

    // Handle lesson name with Arabic text
    lessonName = lessonName.trim();

    return {
      parsed: {
        type: isRevision ? "RE" : (questionNumber ? "QV" : "FULL"),
        academicYear: academicYear.toUpperCase(),
        term: `T${termNum || "1"}`,
        unit: unit ? `U${unit}` : undefined,
        lesson: lesson ? `L${lesson}` : undefined,
        branch: `${mainBranch}${lang ? `-${lang}` : ''}`,
        teacherCode: teacherCode.toUpperCase(),
        teacherName,
        lessonName,
        classNumber,
        questionNumber,
        collectionGroup: `${academicYear}-T${termNum}`,
        parseConfidence: 'high',
        suggestedLibraries: getSuggestedLibraries({ academicYear, branch }, [])
      }
    };
  } catch (error) {
    console.error("Error parsing filename:", error);
    return {
      parsed: null,
      error: `Error parsing filename: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function findMatchingLibrary(libraryName: string, libraries: LibraryInfo[]): LibraryInfo | null {
  const normalizedTarget = normalizeString(libraryName);
  
  // Try exact match first
  let match = libraries.find(lib => 
    normalizeString(lib.name) === normalizedTarget
  );

  // If no exact match, try flexible matching with more lenient comparison
  if (!match) {
    match = libraries.find(lib => {
      const normalizedLib = normalizeString(lib.name);
      const targetParts = normalizedTarget.split('-').filter(Boolean);
      const libParts = normalizedLib.split('-').filter(Boolean);
      
      // تحقق من تطابق الأجزاء الأساسية
      const matchesYear = targetParts[0] === libParts[0]; // M2
      const matchesBranch = libParts.includes(targetParts[1]); // SCI
      const matchesTeacherCode = targetParts.includes(libParts.find(p => p.startsWith('p')) || '');
      
      // يجب أن تتطابق على الأقل السنة والمادة وكود المعلم
      return matchesYear && matchesBranch && matchesTeacherCode;
    });
  }

  return match || null;
}

export function findMatchingGroup(filename: string): string | null {
  try {
    // استخراج المعرف الأساسي للمجموعة
    const basicPattern = /^([JSM][1-6])[-_]?T([12])[-_]?(.*?)\{/;
    const match = filename.match(basicPattern);
    
    if (match) {
      const [, year, term] = match;
      return `${year}-T${term}`;
    }
    
    return null;
  } catch (error) {
    console.warn("Error finding group for:", filename);
    return null;
  }
}

export function getSuggestedLibraries(parsed: Partial<ParsedFilename>, libraries: LibraryInfo[]): string[] {
  if (!parsed.academicYear || !parsed.branch) return [];

  return libraries
    .filter(lib => {
      const libName = lib.name.toLowerCase();
      return (
        libName.includes(parsed.academicYear.toLowerCase()) && 
        libName.includes(parsed.branch.toLowerCase())
      );
    })
    .map(lib => lib.name)
    .slice(0, 5); // اقترح أول 5 مكتبات متطابقة
}

// تعريف الكولكشنز الثابتة
export const VALID_COLLECTIONS = {
  TERM1: {
    NORMAL: "T1-2025",
    QUESTIONS: "T1-2025-QV",
    REVISION: "RE-T1-2025-QV"
  },
  TERM2: {
    NORMAL: "T2-2025",
    QUESTIONS: "T2-2025-QV",
    REVISION: "RE-T2-2025-QV"
  },
  REVISION: "RE-2025"
} as const;

export function determineCollection(parsed: ParsedFilename, year: "2024" | "2025"): {
  collection: string;
  reason: string;
} {
  const termNum = parsed.term.replace("T", "");
  const term = termNum === "1" ? "TERM1" : "TERM2";
  
  // حالة المراجعات
  if (parsed.type === "RE") {
    if (parsed.questionNumber) {
      return {
        collection: VALID_COLLECTIONS[term].REVISION,
        reason: "مراجعة مع أسئلة"
      };
    }
    return {
      collection: VALID_COLLECTIONS.REVISION,
      reason: "مراجعة عامة"
    };
  }
  
  // حالة الأسئلة (إما بوجود Q في نهاية الاسم أو في النوع)
  if (parsed.questionNumber || parsed.lessonName.includes("Q")) {
    return {
      collection: VALID_COLLECTIONS[term].QUESTIONS,
      reason: `أسئلة - ترم ${termNum}`
    };
  }
  
  // الحالة العادية
  return {
    collection: VALID_COLLECTIONS[term].NORMAL,
    reason: `محتوى عادي - ترم ${termNum}`
  };
}

export function determineLibrary(parsed: ParsedFilename): string {
  // تعديل طريقة معالجة اسم المكتبة
  const branchParts = parsed.branch.split('-');
  const mainBranch = branchParts[0]; // SCI
  const lang = branchParts[1] || ''; // AR
  
  // Format: AcademicYear-Branch[-Lang]-TeacherCode-TeacherName
  const libraryParts = [
    parsed.academicYear, // M2
    mainBranch, // SCI
    lang, // AR
    parsed.teacherCode, // P0078
    parsed.teacherName // Muslim Elsayed
  ].filter(Boolean); // يزيل القيم الفارغة

  return libraryParts.map(p => normalizeString(p)).join('-');
}

function normalizeFileName(filename: string): string {
  return filename
    // تصحيح الفواصل المتعددة
    .replace(/[-_\s]+/g, '-')
    // تصحيح الأقواس
    .replace(/[\[\]()]/g, '')
    // تنظيف المسافات الزائدة
    .trim();
}

export function attemptFilenameRecovery(filename: string): {
  recovered: string;
  confidence: 'high' | 'medium' | 'low';
} {
  const normalized = normalizeFileName(filename);
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  // محاولة استخراج المعلومات الأساسية
  const basicInfo = normalized.match(/([JSM][1-6]).*?(T[12])/i);
  if (basicInfo) {
    confidence = 'medium';
    // إذا وجدنا المعلومات الأساسية، نحاول إعادة تشكيل اسم الملف
    const [year, term] = basicInfo;
    // ... المزيد من المنطق لاسترداد المعلومات
  }

  return {
    recovered: normalized,
    confidence
  };
}
