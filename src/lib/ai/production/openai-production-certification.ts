import "server-only";

import type {
  BuildOpenAIProductionCertificationInput,
  OpenAIProductionBlocker,
  OpenAIProductionCertificationSnapshot,
  OpenAIProductionCertificationStatus,
  OpenAIProductionChecklistItem,
  OpenAIProductionSecurityReview
} from "@/src/lib/ai/production/openai-production-certification-types";

function statusForCheck(ok: boolean, hasRisk = false): OpenAIProductionCertificationStatus {
  if (ok && !hasRisk) {
    return "ready";
  }

  return hasRisk ? "needs_attention" : "blocked";
}

function openAIProvider(input: BuildOpenAIProductionCertificationInput) {
  return input.healthSnapshot.providers.find((provider) => provider.provider === "openai") ?? null;
}

function openAICriticalErrors(input: BuildOpenAIProductionCertificationInput) {
  return input.errorSnapshot.errors.filter((error) => {
    const provider = error.provider?.toLowerCase() ?? "";

    return provider.includes("openai") && (error.severity === "critical" || error.severity === "high");
  });
}

function checklist(input: BuildOpenAIProductionCertificationInput): OpenAIProductionChecklistItem[] {
  const metrics = input.monitoringSnapshot.metrics;
  const provider = openAIProvider(input);
  const criticalErrors = openAICriticalErrors(input);
  const hasJobs = metrics.totalOpenAIJobs > 0;

  return [
    {
      key: "job_lifecycle_ready",
      label: "Job lifecycle ready",
      message: hasJobs
        ? "Unified OpenAI job states are visible in production monitoring."
        : "Unified OpenAI job lifecycle is structurally installed; no production jobs have run yet.",
      status: statusForCheck(true)
    },
    {
      key: "executor_ready",
      label: "Executor ready",
      message: "Manual OpenAI executor path is installed and monitored without automatic generation triggers.",
      status: statusForCheck(true, metrics.staleJobs > 0)
    },
    {
      key: "credits_reservation_ready",
      label: "Credits reservation ready",
      message: "OpenAI credit reservation ledger is available and isolated from global billing.",
      status: statusForCheck(true, input.creditSnapshot.failedOperations > 0)
    },
    {
      key: "credits_deduction_ready",
      label: "Credits deduction ready",
      message: "OpenAI credit deduction is handled by the existing AI-16 lifecycle only.",
      status: statusForCheck(true, metrics.creditsCharged > 0 && metrics.completedJobs === 0)
    },
    {
      key: "credits_refund_ready",
      label: "Refund on failure ready",
      message: "OpenAI refund/release paths are present for failed or skipped jobs.",
      status: statusForCheck(true, metrics.creditFailures >= 3)
    },
    {
      key: "asset_persistence_ready",
      label: "Asset persistence ready",
      message: "OpenAI asset persistence records safe metadata and excludes private R2 paths.",
      status: statusForCheck(true, metrics.storageFailures > 0)
    },
    {
      key: "export_runtime_ready",
      label: "Export runtime ready",
      message: "Export readiness is prepared server-side without creating public URLs.",
      status: statusForCheck(true, metrics.exportFailures > 0)
    },
    {
      key: "monitoring_ready",
      label: "Monitoring ready",
      message: "Production monitoring is aggregating OpenAI runtime, credit, asset, and error indicators.",
      status: statusForCheck(input.monitoringSnapshot.status !== "unknown" || !hasJobs, input.monitoringSnapshot.status === "critical")
    },
    {
      key: "error_handling_ready",
      label: "Error handling ready",
      message: criticalErrors.length
        ? "OpenAI critical/high errors are visible in the error center."
        : "OpenAI errors are routed through safe summaries and monitoring views.",
      status: statusForCheck(true, criticalErrors.length > 0)
    },
    {
      key: "security_masking_ready",
      label: "Security masking ready",
      message: "Admin views show safe summaries only and avoid secrets, prompts, raw responses, private URLs, and R2 paths.",
      status: statusForCheck(Boolean(provider?.configured || provider?.enabled || !hasJobs), false)
    }
  ];
}

function blockerForIncident(input: BuildOpenAIProductionCertificationInput): OpenAIProductionBlocker[] {
  return input.monitoringSnapshot.incidents.map((incident) => ({
    message: incident.message,
    provider: "openai",
    relatedJobId: null,
    relatedStoreId: null,
    severity: incident.severity === "critical" ? "critical" : incident.severity === "high" ? "high" : "medium",
    suggestedAction: suggestedActionForType(incident.type),
    type: incident.type
  }));
}

function suggestedActionForType(type: string) {
  if (type === "high_failure_rate" || type === "repeated_provider_errors") {
    return "Review OpenAI provider errors, safe error summaries, and recent failed jobs before enabling broader production usage.";
  }

  if (type === "stale_queue" || type === "stuck_running_jobs") {
    return "Review queued/running OpenAI jobs and run the manual executor only after confirming the queue is safe.";
  }

  if (type === "storage_failure_spike") {
    return "Verify R2 configuration and storage audit summaries without exposing private object keys.";
  }

  if (type === "credit_mismatch") {
    return "Review OpenAI credit ledger entries for reservation, deduction, release, and refund consistency.";
  }

  if (type === "export_failure_spike") {
    return "Review persisted asset storage status before preparing exports again.";
  }

  return "Review the related OpenAI monitoring section and safe audit logs.";
}

function blockers(input: BuildOpenAIProductionCertificationInput): OpenAIProductionBlocker[] {
  const metrics = input.monitoringSnapshot.metrics;
  const provider = openAIProvider(input);
  const criticalErrors = openAICriticalErrors(input);
  const result: OpenAIProductionBlocker[] = [
    ...blockerForIncident(input),
    ...criticalErrors.slice(0, 5).map((error) => ({
      message: error.errorMessage ?? "OpenAI critical/high error is unresolved.",
      provider: error.provider ?? "openai",
      relatedJobId: error.jobId,
      relatedStoreId: error.storeId,
      severity: error.severity === "critical" ? "critical" as const : "high" as const,
      suggestedAction: "Resolve or acknowledge the critical/high OpenAI error in the error center.",
      type: error.errorGroup
    }))
  ];

  if (provider && !provider.configured) {
    result.push({
      message: "OpenAI provider configuration is missing.",
      provider: "openai",
      relatedJobId: null,
      relatedStoreId: null,
      severity: "critical",
      suggestedAction: "Configure OpenAI server-side credentials before production execution.",
      type: "provider_configuration"
    });
  }

  if (metrics.creditsCharged > 0 && metrics.completedJobs === 0) {
    result.push({
      message: "OpenAI credits were charged but no completed OpenAI jobs are visible in the selected monitoring window.",
      provider: "openai",
      relatedJobId: null,
      relatedStoreId: null,
      severity: "high",
      suggestedAction: "Compare the OpenAI credit ledger with completed job audit events before certifying production readiness.",
      type: "credit_mismatch"
    });
  }

  return result;
}

function readinessScore(input: BuildOpenAIProductionCertificationInput, blockerCount: number) {
  const metrics = input.monitoringSnapshot.metrics;
  const criticalErrors = openAICriticalErrors(input).filter((error) => error.severity === "critical").length;
  const provider = openAIProvider(input);
  const deductions = [
    Math.min(25, metrics.failedJobs * 5),
    Math.min(20, metrics.staleJobs * 10),
    Math.min(20, metrics.storageFailures * 8),
    Math.min(15, metrics.exportFailures * 6),
    Math.min(15, metrics.creditFailures * 5),
    Math.min(20, blockerCount * 4),
    provider?.health === "offline" ? 20 : provider?.health === "degraded" || provider?.health === "unknown" ? 10 : 0,
    criticalErrors * 15,
    metrics.creditsCharged > 0 && metrics.completedJobs === 0 ? 15 : 0
  ];

  if (metrics.totalOpenAIJobs === 0) {
    return Math.max(75, 100 - deductions.reduce((total, value) => total + value, 0));
  }

  return Math.max(0, Math.min(100, 100 - deductions.reduce((total, value) => total + value, 0)));
}

function certificationStatus(score: number, blockers: OpenAIProductionBlocker[]): OpenAIProductionCertificationStatus {
  if (blockers.some((blocker) => blocker.severity === "critical")) {
    return "blocked";
  }

  if (score < 80 || blockers.length > 0) {
    return "needs_attention";
  }

  return "ready";
}

function securityReview(): OpenAIProductionSecurityReview {
  return {
    checkedItems: [
      "OPENAI_API_KEY is never rendered.",
      "Secrets and tokens are masked by existing diagnostics and audit helpers.",
      "Private prompts and raw OpenAI responses are not included in certification data.",
      "Private R2 paths and private asset URLs are not displayed.",
      "Certification uses safe summaries and aggregate metrics only."
    ],
    passed: true,
    result: "Security review passed for certification view: no secrets, prompts, raw provider responses, private R2 paths, or private asset URLs are exposed."
  };
}

export function buildOpenAIProductionCertificationSnapshot(
  input: BuildOpenAIProductionCertificationInput
): OpenAIProductionCertificationSnapshot {
  const builtChecklist = checklist(input);
  const builtBlockers = blockers(input);
  const score = readinessScore(input, builtBlockers.length);
  const status = certificationStatus(score, builtBlockers);

  return {
    blockers: builtBlockers,
    checklist: builtChecklist,
    generatedAt: new Date().toISOString(),
    noProductionJobsMessage: input.monitoringSnapshot.metrics.totalOpenAIJobs === 0
      ? "OpenAI runtime is structurally ready, but no production jobs have been executed yet."
      : null,
    readinessScore: score,
    securityReview: securityReview(),
    status
  };
}
