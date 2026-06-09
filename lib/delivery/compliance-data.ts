import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryAgentAccessRecord } from "@/lib/delivery/data";
import { deliveryRiskLevel, type DeliveryRiskLevel } from "@/lib/delivery/incident-data";

export type DeliveryVerificationStatus = "not_started" | "pending_review" | "verified" | "rejected" | "expired";
export type DeliveryEligibilityStatus = "eligible" | "not_eligible" | "pending_review" | "suspended" | "blocked";
export type DeliveryComplianceBadge = "Verified" | "Pending" | "Not Eligible" | "Suspended";

export type DeliveryComplianceChecklist = {
  assignedRegionConfirmed: boolean;
  licenseUploadedPlaceholder: boolean;
  noActiveViolations: boolean;
  ownerApproved: boolean;
  phoneVerified: boolean;
  profileCompleted: boolean;
  vehicleInformationCompleted: boolean;
};

export type DeliveryComplianceData = {
  badge: DeliveryComplianceBadge;
  checklist: DeliveryComplianceChecklist;
  checklistCompleted: number;
  checklistTotal: number;
  eligibilityStatus: DeliveryEligibilityStatus;
  isAssignmentEligible: boolean;
  sections: Array<{
    label: string;
    status: DeliveryVerificationStatus | DeliveryEligibilityStatus;
  }>;
  verificationStatus: DeliveryVerificationStatus;
  violationSummary: {
    active: number;
    critical: number;
    incidentHistory: number;
    riskLevel: DeliveryRiskLevel;
    total: number;
  };
};

type ComplianceRow = {
  assigned_region_confirmed?: boolean | null;
  eligibility_status?: DeliveryEligibilityStatus | null;
  identity_status?: DeliveryVerificationStatus | null;
  license_status?: DeliveryVerificationStatus | null;
  license_uploaded_placeholder?: boolean | null;
  no_active_violations?: boolean | null;
  owner_approved?: boolean | null;
  phone_status?: DeliveryVerificationStatus | null;
  phone_verified?: boolean | null;
  profile_completed?: boolean | null;
  store_approval_status?: DeliveryVerificationStatus | null;
  vehicle_information_completed?: boolean | null;
  vehicle_status?: DeliveryVerificationStatus | null;
  verification_status?: DeliveryVerificationStatus | null;
};

type ViolationRow = {
  severity?: string | null;
  status?: string | null;
};

type IncidentRow = {
  priority?: string | null;
  status?: string | null;
};

function normalizeVerification(value: string | null | undefined): DeliveryVerificationStatus {
  if (
    value === "pending_review" ||
    value === "verified" ||
    value === "rejected" ||
    value === "expired"
  ) {
    return value;
  }

  return "not_started";
}

function normalizeEligibility(value: string | null | undefined): DeliveryEligibilityStatus {
  if (
    value === "eligible" ||
    value === "not_eligible" ||
    value === "pending_review" ||
    value === "suspended" ||
    value === "blocked"
  ) {
    return value;
  }

  return "pending_review";
}

export function deliveryComplianceBadge({
  eligibilityStatus,
  verificationStatus
}: {
  eligibilityStatus: DeliveryEligibilityStatus;
  verificationStatus: DeliveryVerificationStatus;
}): DeliveryComplianceBadge {
  if (eligibilityStatus === "suspended" || eligibilityStatus === "blocked") {
    return "Suspended";
  }

  if (eligibilityStatus === "not_eligible" || verificationStatus === "rejected" || verificationStatus === "expired") {
    return "Not Eligible";
  }

  if (eligibilityStatus === "eligible" && verificationStatus === "verified") {
    return "Verified";
  }

  return "Pending";
}

export function isDeliveryAssignmentEligible(status: DeliveryEligibilityStatus) {
  return status !== "not_eligible" && status !== "suspended" && status !== "blocked";
}

function fallbackCompliance(agent: DeliveryAgentAccessRecord | null): DeliveryComplianceData {
  const checklist = {
    assignedRegionConfirmed: Boolean(agent?.cityZone || agent?.assignedZoneIds.length),
    licenseUploadedPlaceholder: false,
    noActiveViolations: true,
    ownerApproved: agent?.status === "active",
    phoneVerified: Boolean(agent?.email),
    profileCompleted: Boolean(agent?.agentName && agent?.storeId),
    vehicleInformationCompleted: false
  };
  const eligibilityStatus: DeliveryEligibilityStatus = agent?.status === "inactive" ? "suspended" : "pending_review";
  const verificationStatus: DeliveryVerificationStatus = "not_started";
  const checklistCompleted = Object.values(checklist).filter(Boolean).length;

  return {
    badge: deliveryComplianceBadge({ eligibilityStatus, verificationStatus }),
    checklist,
    checklistCompleted,
    checklistTotal: Object.keys(checklist).length,
    eligibilityStatus,
    isAssignmentEligible: isDeliveryAssignmentEligible(eligibilityStatus),
    sections: [
      { label: "Identity Verification", status: "not_started" },
      { label: "Phone Verification", status: checklist.phoneVerified ? "verified" : "not_started" },
      { label: "Vehicle Verification", status: "not_started" },
      { label: "License Verification", status: "not_started" },
      { label: "Store Approval", status: checklist.ownerApproved ? "verified" : "pending_review" },
      { label: "Operational Eligibility", status: eligibilityStatus }
    ],
    verificationStatus,
    violationSummary: {
      active: 0,
      critical: 0,
      incidentHistory: 0,
      riskLevel: "Low",
      total: 0
    }
  };
}

export async function getDeliveryComplianceData(agent: DeliveryAgentAccessRecord | null): Promise<DeliveryComplianceData> {
  if (!agent) {
    return fallbackCompliance(agent);
  }

  const admin = createAdminClient();

  if (!admin) {
    return fallbackCompliance(agent);
  }

  const [complianceResult, violationsResult, incidentsResult] = await Promise.all([
    admin
      .from("delivery_agent_compliance" as never)
      .select(
        "verification_status, eligibility_status, identity_status, phone_status, vehicle_status, license_status, store_approval_status, profile_completed, phone_verified, vehicle_information_completed, license_uploaded_placeholder, assigned_region_confirmed, owner_approved, no_active_violations"
      )
      .eq("workspace_id" as never, agent.workspaceId as never)
      .eq("store_id" as never, agent.storeId as never)
      .eq("delivery_agent_id" as never, agent.agentId as never)
      .maybeSingle(),
    admin
      .from("delivery_violations" as never)
      .select("status, severity")
      .eq("workspace_id" as never, agent.workspaceId as never)
      .eq("store_id" as never, agent.storeId as never)
      .eq("delivery_agent_id" as never, agent.agentId as never),
    admin
      .from("delivery_incidents" as never)
      .select("status, priority")
      .eq("workspace_id" as never, agent.workspaceId as never)
      .eq("store_id" as never, agent.storeId as never)
      .eq("delivery_agent_id" as never, agent.agentId as never)
  ]);
  const row = complianceResult.data as unknown as ComplianceRow | null;
  const violations = (violationsResult.data ?? []) as unknown as ViolationRow[];
  const incidents = (incidentsResult.data ?? []) as unknown as IncidentRow[];

  if (!row) {
    return fallbackCompliance(agent);
  }

  const activeViolations = violations.filter((violation) => violation.status === "open" || violation.status === "reviewing");
  const activeIncidents = incidents.filter((incident) => incident.status === "open" || incident.status === "under_review" || incident.status === "escalated");
  const criticalViolations = violations.filter((violation) => violation.severity === "critical").length;
  const criticalIncidents = incidents.filter((incident) => incident.priority === "critical" && (incident.status === "open" || incident.status === "under_review" || incident.status === "escalated")).length;
  const escalatedIncidents = incidents.filter((incident) => incident.status === "escalated").length;
  const checklist = {
    assignedRegionConfirmed: Boolean(row.assigned_region_confirmed),
    licenseUploadedPlaceholder: Boolean(row.license_uploaded_placeholder),
    noActiveViolations: Boolean(row.no_active_violations) && activeViolations.length === 0 && activeIncidents.length === 0,
    ownerApproved: Boolean(row.owner_approved),
    phoneVerified: Boolean(row.phone_verified),
    profileCompleted: Boolean(row.profile_completed),
    vehicleInformationCompleted: Boolean(row.vehicle_information_completed)
  };
  const verificationStatus = normalizeVerification(row.verification_status);
  const eligibilityStatus =
    agent.status === "inactive" ? "suspended" : normalizeEligibility(row.eligibility_status);
  const checklistCompleted = Object.values(checklist).filter(Boolean).length;

  return {
    badge: deliveryComplianceBadge({ eligibilityStatus, verificationStatus }),
    checklist,
    checklistCompleted,
    checklistTotal: Object.keys(checklist).length,
    eligibilityStatus,
    isAssignmentEligible: isDeliveryAssignmentEligible(eligibilityStatus),
    sections: [
      { label: "Identity Verification", status: normalizeVerification(row.identity_status) },
      { label: "Phone Verification", status: normalizeVerification(row.phone_status) },
      { label: "Vehicle Verification", status: normalizeVerification(row.vehicle_status) },
      { label: "License Verification", status: normalizeVerification(row.license_status) },
      { label: "Store Approval", status: normalizeVerification(row.store_approval_status) },
      { label: "Operational Eligibility", status: eligibilityStatus }
    ],
    verificationStatus,
    violationSummary: {
      active: activeViolations.length + activeIncidents.length,
      critical: criticalViolations + criticalIncidents,
      incidentHistory: incidents.length,
      riskLevel: deliveryRiskLevel({
        active: activeViolations.length + activeIncidents.length,
        critical: criticalViolations + criticalIncidents,
        escalated: escalatedIncidents
      }),
      total: violations.length + incidents.length
    }
  };
}

export async function getDeliveryComplianceMap({
  agentIds,
  storeId,
  workspaceId
}: {
  agentIds: string[];
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();
  const compliance = new Map<string, DeliveryComplianceData>();

  if (!admin || !agentIds.length) {
    return compliance;
  }

  const { data } = await admin
    .from("store_delivery_agents" as never)
    .select("id, name, email, status, store_id, workspace_id, city_zone, availability_status, capacity_limit, current_active_orders, assigned_zone_ids")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .in("id" as never, agentIds as never);

  for (const row of (data ?? []) as unknown as Array<{
    assigned_zone_ids?: string[] | null;
    availability_status?: "online" | "offline" | "busy" | null;
    capacity_limit?: number | null;
    city_zone?: string | null;
    current_active_orders?: number | null;
    email?: string | null;
    id: string;
    name: string;
    status?: "active" | "inactive" | null;
    store_id: string;
    workspace_id: string;
  }>) {
    compliance.set(row.id, await getDeliveryComplianceData({
      agentId: row.id,
      agentName: row.name,
      assignedZoneIds: row.assigned_zone_ids ?? [],
      availabilityStatus: row.availability_status ?? "offline",
      capacityLimit: row.capacity_limit ?? 0,
      cityZone: row.city_zone ?? null,
      currentActiveOrders: row.current_active_orders ?? 0,
      email: row.email ?? null,
      role: row.status === "inactive" ? "suspended_delivery" : "delivery",
      status: row.status === "inactive" ? "inactive" : "active",
      storeId: row.store_id,
      storeName: null,
      workspaceId: row.workspace_id
    }));
  }

  return compliance;
}
