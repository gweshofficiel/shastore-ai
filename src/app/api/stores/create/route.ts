import { NextResponse } from "next/server";
import { createStore } from "../../../../server/stores/create-store";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.name || !body.slug) {
      return NextResponse.json(
        { error: "name and slug are required" },
        { status: 400 }
      );
    }

    const ownerUserId = body.ownerUserId;

    if (!ownerUserId) {
      return NextResponse.json(
        { error: "Authenticated owner is required" },
        { status: 401 }
      );
    }

    const store = await createStore({
      ownerUserId,
      name: body.name,
      slug: body.slug,
      description: body.description,
    });

    return NextResponse.json({ success: true, store }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create store",
      },
      { status: 500 }
    );
  }
}