import { NextRequest, NextResponse } from "next/server";
import {
  exportCurrentDraftTheme,
  exportPublishedTheme,
  serializeThemeExport
} from "@/src/lib/platform-theme/platform-theme-import-export";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source");

  try {
    const exportFile = source === "published" ? await exportPublishedTheme() : await exportCurrentDraftTheme();
    const filename = `platform-theme-${exportFile.source}-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(serializeThemeExport(exportFile), {
      headers: {
        "content-disposition": `attachment; filename="${filename}"`,
        "content-type": "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Platform theme export failed." },
      { status: 400 }
    );
  }
}
