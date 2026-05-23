import { NextResponse } from "next/server";
import { createStore } from "../../../../server/stores/create-store";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.ownerUserId || !body.name || !body.slug) {
      return NextResponse.json(
        {
          error: "ownerUserId, name and slug are required",
        },
        {
          status: 400,
        }
      );
    }

    const store = await createStore({
      ownerUserId: body.ownerUserId,
      name: body.name,
      slug: body.slug,
      description: body.description,
    });

    return NextResponse.json(
      {
        success: true,
        store,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create store",
      },
      {
        status: 500,
      }
    );
  }
}