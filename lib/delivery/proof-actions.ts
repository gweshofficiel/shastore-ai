"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDeliveryAccess } from "@/lib/delivery/access";
import { createAdminClient } from "@/lib/supabase/admin";

const assignedOrdersPath = "/delivery/dashboard/orders";

type AssignmentRow = {
  delivery_agent_id: string;
  delivery_code_placeholder?: string | null;
  id: string;
  metadata?: Record<string, unknown> | null;
  order_id: string;
  order_source: "orders" | "store_orders";
  status: string;
  store_id: string;
  workspace_id: string;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function proofRedirect(status: string): never {
  redirect(`${assignedOrdersPath}?delivery=${encodeURIComponent(status)}`);
}

async function recordProofEvent({
  actorUserId,
  assignment,
  codeVerified,
  deliveredAt,
  notes
}: {
  actorUserId: string;
  assignment: AssignmentRow;
  codeVerified: boolean;
  deliveredAt: string;
  notes: string | null;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const events = [
    {
      message: "Proof of delivery submitted.",
      newValue: "proof_submitted",
      previousValue: assignment.status
    },
    {
      message: "Delivery completed with proof.",
      newValue: "delivered",
      previousValue: assignment.status
    }
  ];

  const { error } = await admin.from("store_delivery_events" as never).insert(
    events.map((event) => ({
      actor_user_id: actorUserId,
      delivery_agent_id: assignment.delivery_agent_id,
      event_type: "delivery_status_changed",
      message: event.message,
      metadata: {
        agentId: assignment.delivery_agent_id,
        codeVerified,
        deliveredAt,
        hasNotes: Boolean(notes),
        source: "delivery_proof_submission"
      },
      new_value: event.newValue,
      order_id: assignment.order_id,
      order_source: assignment.order_source,
      previous_value: event.previousValue,
      store_id: assignment.store_id,
      workspace_id: assignment.workspace_id
    })) as never
  );

  if (error) {
    console.warn("[delivery-proof] timeline event skipped", {
      assignmentId: assignment.id,
      message: error.message
    });
  }
}

async function syncOrderDelivered({
  assignment,
  deliveredAt,
  notes
}: {
  assignment: AssignmentRow;
  deliveredAt: string;
  notes: string | null;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const proofSummary = notes ? `Proof submitted. ${notes}` : "Proof of delivery submitted.";
  const { error } = await admin
    .from(assignment.order_source as never)
    .update({
      delivered_at: deliveredAt,
      delivery_delivered_at: deliveredAt,
      delivery_notes: proofSummary.slice(0, 500),
      delivery_status: "delivered",
      proof_of_delivery: "proof_recorded",
      updated_at: deliveredAt
    } as never)
    .eq("id" as never, assignment.order_id as never)
    .eq("workspace_id" as never, assignment.workspace_id as never);

  if (error) {
    console.warn("[delivery-proof] legacy order proof sync skipped", {
      assignmentId: assignment.id,
      message: error.message
    });
  }
}

export async function submitProofOfDeliveryAction(formData: FormData) {
  const assignmentId = cleanText(formData.get("assignmentId"), 80);
  const deliveryCode = cleanText(formData.get("deliveryCode"), 80);
  const customerName = cleanText(formData.get("customerName"), 160);
  const notes = cleanText(formData.get("notes"), 500);
  const signatureTextPlaceholder = cleanText(formData.get("signatureTextPlaceholder"), 160);
  const photoUrlPlaceholder = cleanText(formData.get("photoUrlPlaceholder"), 240);

  if (!assignmentId) {
    proofRedirect("proof-invalid");
  }

  const { agent, user } = await requireDeliveryAccess();

  if (!agent) {
    proofRedirect("access-denied");
  }

  const admin = createAdminClient();

  if (!admin) {
    proofRedirect("unavailable");
  }

  const { data, error } = await admin
    .from("delivery_assignments" as never)
    .select(
      "id, workspace_id, store_id, order_source, order_id, delivery_agent_id, status, delivery_code_placeholder, metadata"
    )
    .eq("id" as never, assignmentId as never)
    .eq("delivery_agent_id" as never, agent.agentId as never)
    .eq("store_id" as never, agent.storeId as never)
    .maybeSingle();

  if (error || !data) {
    proofRedirect("not-found");
  }

  const assignment = data as unknown as AssignmentRow;

  if (assignment.status !== "picked_up") {
    proofRedirect("proof-status-required");
  }

  const expectedCode = assignment.delivery_code_placeholder?.trim();
  const codeVerified = expectedCode ? deliveryCode === expectedCode : true;

  if (expectedCode && !codeVerified) {
    proofRedirect("proof-code-invalid");
  }

  const { data: existingProof } = await admin
    .from("delivery_proofs" as never)
    .select("id")
    .eq("assignment_id" as never, assignment.id as never)
    .maybeSingle();

  if (existingProof) {
    proofRedirect("proof-duplicate");
  }

  const deliveredAt = new Date().toISOString();
  const { error: proofError } = await admin.from("delivery_proofs" as never).insert({
    assignment_id: assignment.id,
    customer_name: customerName || null,
    delivered_at: deliveredAt,
    delivery_agent_id: assignment.delivery_agent_id,
    delivery_code: deliveryCode || null,
    delivery_code_verified: codeVerified,
    metadata: {
      codeFallbackUsed: !expectedCode,
      source: "delivery_dashboard"
    },
    notes: notes || null,
    order_id: assignment.order_id,
    order_source: assignment.order_source,
    photo_url_placeholder: photoUrlPlaceholder || null,
    proof_type: "delivery_confirmation",
    signature_text_placeholder: signatureTextPlaceholder || null,
    store_id: assignment.store_id,
    workspace_id: assignment.workspace_id
  } as never);

  if (proofError) {
    console.warn("[delivery-proof] proof insert failed", {
      assignmentId: assignment.id,
      message: proofError.message
    });
    proofRedirect("proof-failed");
  }

  const metadata = assignment.metadata ?? {};
  const statusHistory = Array.isArray(metadata.status_history) ? metadata.status_history : [];
  const { error: assignmentError } = await admin
    .from("delivery_assignments" as never)
    .update({
      metadata: {
        ...metadata,
        last_status_change: {
          agent_id: agent.agentId,
          changed_at: deliveredAt,
          new_status: "delivered",
          old_status: assignment.status,
          proof_submitted: true
        },
        proof: {
          code_verified: codeVerified,
          submitted_at: deliveredAt
        },
        status_history: [
          ...statusHistory,
          {
            agent_id: agent.agentId,
            changed_at: deliveredAt,
            new_status: "delivered",
            old_status: assignment.status,
            proof_submitted: true
          }
        ]
      },
      status: "delivered",
      updated_at: deliveredAt
    } as never)
    .eq("id" as never, assignment.id as never)
    .eq("delivery_agent_id" as never, agent.agentId as never)
    .eq("store_id" as never, agent.storeId as never);

  if (assignmentError) {
    console.warn("[delivery-proof] assignment delivery sync failed", {
      assignmentId: assignment.id,
      message: assignmentError.message
    });
    proofRedirect("proof-failed");
  }

  await Promise.all([
    recordProofEvent({
      actorUserId: user.id,
      assignment,
      codeVerified,
      deliveredAt,
      notes: notes || null
    }),
    syncOrderDelivered({
      assignment,
      deliveredAt,
      notes: notes || null
    })
  ]);

  revalidatePath(assignedOrdersPath);
  revalidatePath("/delivery/dashboard");
  revalidatePath(`/dashboard/orders/${assignment.order_id}`);
  proofRedirect("proof-submitted");
}
