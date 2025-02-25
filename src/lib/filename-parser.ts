export interface ParsedFilename {
  type: "RE" | "QV" | "FULL";
  academicYear: string;
  term: string;
  branch: string;
  teacherCode: string;
  teacherName: string;
  lessonName: string;
}

export function parseFilename(filename: string): {
  parsed: ParsedFilename | null;
  error?: string;
} {
  try {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

    // Original regex pattern to restore previous functionality
    const pattern =
      /^(?:(RE-)?)?([JSM][1-6])-(T[12])-(U[0-9])-(L[0-9])-([A-Z]+)-([P][0-9]{4})-([^-]+)--\{(.+?)\}(?:-Q[0-9]+)?$/;
    const match = nameWithoutExt.match(pattern);

    if (!match) {
      console.warn(`Failed to match filename: ${filename}`);
      return {
        parsed: null,
        error:
          "Invalid filename format. Expected format: [RE-]<Year><Number>-T<1|2>-U<Number>-L<Number>-<Subject>-P<Number>-<TeacherName>--{<LessonName>}[-Q<Number>]",
      };
    }

    const [
      ,
      isRevision,
      academicYear,
      term,
      unit,
      lesson,
      branch,
      teacherCode,
      teacherName,
      lessonName,
    ] = match;

    // Log parsed components for debugging
    console.log("Parsed filename components:", {
      isRevision,
      academicYear,
      term,
      unit,
      lesson,
      branch,
      teacherCode,
      teacherName,
      lessonName,
    });

    // Ensure required fields are not empty
    if (!branch || !teacherCode || !teacherName) {
      return {
        parsed: null,
        error: `Invalid filename components for ${filename}: branch=${branch}, teacherCode=${teacherCode}, teacherName=${teacherName}`,
      };
    }

    // Determine type based on filename
    let type: ParsedFilename["type"] = "FULL";
    if (isRevision) type = "RE";
    else if (nameWithoutExt.includes("-Q")) type = "QV";

    return {
      parsed: {
        type,
        academicYear,
        term,
        branch: branch.toUpperCase(),
        teacherCode,
        teacherName,
        lessonName,
      },
    };
  } catch (error) {
    console.error("Error parsing filename:", error);
    return {
      parsed: null,
      error:
        "Error parsing filename: " +
        (error instanceof Error ? error.message : String(error)),
    };
  }
}

export function determineLibrary(parsed: ParsedFilename): string {
  // Convert academic year to library format (e.g., S1 -> M1)
  const yearMap: Record<string, string> = {
    S1: "M1",
    S2: "M2",
    S3: "M3",
    M1: "M1",
    M2: "M2",
    M3: "M3",
    J4: "J4",
    J5: "J5",
    J6: "J6",
  };

  const mappedYear = yearMap[parsed.academicYear] || parsed.academicYear;

  // Format the expected library name
  const expectedLibrary = `${mappedYear}-${parsed.branch}-${parsed.teacherCode}-${parsed.teacherName
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")}`;

  // Check predefined libraries (restore original list or update with actual libraries)
  const predefinedLibraries = {
    "J6-SS-P0114-Ahmed Bakr": {
      branch: "SS",
      teacherCode: "P0114",
      academicYear: "J6",
    },
    "M1-AR-P0046-Zakaria Seif Eldin": {
      branch: "AR",
      teacherCode: "P0046",
      academicYear: "M1",
    },
    "M2-SCI-AR-P0078-Muslim Elsayed": {
      branch: "SCI",
      teacherCode: "P0078",
      academicYear: "M2",
    },
    // Add other libraries from your Bunny.net dashboard or settings.py
  };

  // Check if the expected library exists in predefined libraries
  for (const libName in predefinedLibraries) {
    const lib = predefinedLibraries[libName];
    if (
      lib.branch === parsed.branch &&
      lib.teacherCode === parsed.teacherCode &&
      lib.academicYear === mappedYear
    ) {
      return libName;
    }
  }

  // If no match, log a warning and try to find a partial match or throw an error
  console.warn(
    `Library not found for parsed data: ${JSON.stringify(parsed)}. Generated: ${expectedLibrary}`,
  );
  for (const libName in predefinedLibraries) {
    if (
      libName
        .toLowerCase()
        .startsWith(
          expectedLibrary.toLowerCase().split("-").slice(0, 3).join("-"),
        )
    ) {
      console.warn(`Partial match found: ${libName} for ${expectedLibrary}`);
      return libName;
    }
  }

  throw new Error(`Library not found: ${expectedLibrary}`);
}

export function determineCollection(
  parsed: ParsedFilename,
  year: "2024" | "2025",
): string {
  const termNum = parsed.term.replace("T", "");

  if (parsed.type === "RE") {
    return `RE-T${termNum}-${year}`;
  } else if (parsed.type === "QV") {
    return `T${termNum}-${year}-QV`;
  } else {
    return `T${termNum}-${year}`;
  }
}
