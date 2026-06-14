"use client";

import { useState } from "react";

type ExecutorJobSummary = {
  durationMs: number | null;
  errorSummary: string | null;
  jobId: string;
  outcome: "completed" | "failed" | "skipped" | "timeout";
  provider: string;
  requestId: string | null;
  status: string;
  storeId: string | null;
};

type ExecutorRunSummary = {
  completedAt: string;
  durationMs: number;
  jobs: ExecutorJobSummary[];
  jobsCompleted: number;
  jobsFailed: number;
  jobsScanned: number;
  jobsSkipped: number;
  jobsStarted: number;
  jobsTimedOut: number;
  maxJobs: number;
  maxRuntimeMs: number;
  runId: string;
  startedAt: string;
};

function formatDuration(ms: number | null) {
  if (ms === null) {
    return "Not recorded";
  }

  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${Math.round(ms / 100) / 10}s`;
}

export function OpenAIExecutorRunButton() {
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<ExecutorRunSummary | null>(null);

  async function runExecutor() {
    setError(null);
    setIsRunning(true);

    try {
      const response = await fetch("/api/admin/ai/executor/run", {
        body: JSON.stringify({ maxJobs: 3 }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = await response.json().catch(() => null) as ExecutorRunSummary | { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload && "error" in payload && payload.error ? payload.error : "OpenAI executor run failed.");
      }

      setSummary(payload as ExecutorRunSummary);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "OpenAI executor run failed.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="grid gap-4 rounded-3xl border border-cyan-100 bg-cyan-50/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-500">
            Manual Executor
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
            Runs one limited OpenAI executor pass. No cron, credits, pricing, secrets, prompts, raw responses, or tokens are exposed.
          </p>
        </div>
        <button
          className="rounded-full bg-slate-950 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isRunning}
          onClick={runExecutor}
          type="button"
        >
          {isRunning ? "Running..." : "Run OpenAI executor once"}
        </button>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-5">
            {[
              ["Jobs scanned", summary.jobsScanned],
              ["Jobs started", summary.jobsStarted],
              ["Jobs completed", summary.jobsCompleted],
              ["Jobs failed", summary.jobsFailed],
              ["Jobs skipped", summary.jobsSkipped]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white bg-white/80 p-3">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
                <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs font-bold text-slate-500">
            Run {summary.runId} finished in {formatDuration(summary.durationMs)}.
          </p>
          {summary.jobs.length ? (
            <div className="grid gap-2">
              {summary.jobs.slice(0, 5).map((job) => (
                <div key={`${summary.runId}:${job.jobId}:${job.outcome}`} className="rounded-2xl border border-white bg-white/80 p-3 text-xs font-bold text-slate-600">
                  <span className="font-black text-slate-950">{job.outcome}</span>
                  {" · "}
                  <span className="break-all">{job.jobId}</span>
                  {" · "}
                  <span>{formatDuration(job.durationMs)}</span>
                  {job.errorSummary ? <p className="mt-1 text-red-600">{job.errorSummary}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
