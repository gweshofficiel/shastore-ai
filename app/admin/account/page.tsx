import {
  AdminBadge,
  AdminHeader,
  AdminTable
} from "@/components/admin/admin-control";
import { InternalPasswordChangeForm } from "@/components/admin/internal-account-forms";
import { getAdminAccess } from "@/lib/admin-access";
import {
  changeInternalAccountPassword,
  requestInternalAccountEmailChange
} from "@/lib/admin/account-actions";

function feedbackMessage(status: string | string[] | undefined) {
  const code = Array.isArray(status) ? status[0] : status;

  if (code === "email-invalid") {
    return "Enter a different valid email address. Email changes require admin approval.";
  }

  if (code === "email-requested") {
    return "Email change request recorded for admin approval. Your login email was not changed.";
  }

  if (code === "password-failed") {
    return "Password change failed. Try again.";
  }

  if (code === "password-invalid") {
    return "Password must be at least 8 characters and match the confirmation.";
  }

  if (code === "password-updated") {
    return "Password updated.";
  }

  return null;
}

export default async function AdminAccountPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string | string[] }>;
}) {
  const query = await searchParams;
  const access = await getAdminAccess();
  const feedback = feedbackMessage(query?.account);

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Internal admin account controls. Password changes are self-service; email changes are request-only and require admin approval."
        title="Admin Account"
      />

      {feedback ? (
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
          {feedback}
        </div>
      ) : null}

      <AdminTable headers={["Account", "Role", "Policy"]}>
        <tr>
          <td className="break-all px-5 py-4 font-bold text-slate-950">{access.user.email}</td>
          <td className="px-5 py-4"><AdminBadge tone="blue">{access.internalRole}</AdminBadge></td>
          <td className="px-5 py-4 text-slate-600">Direct email mutation is disabled. Submit a request for admin approval.</td>
        </tr>
      </AdminTable>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-black text-slate-950">Change password</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            This updates only your current Supabase Auth password.
          </p>
          <div className="mt-5">
            <InternalPasswordChangeForm action={changeInternalAccountPassword} />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-black text-slate-950">Request email change</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Email changes are approval-only. This form creates an audited request and does not mutate your login email.
          </p>
          <form action={requestInternalAccountEmailChange} className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Requested email
              <input
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none"
                name="requestedEmail"
                required
                type="email"
              />
            </label>
            <button className="h-11 rounded-full border border-amber-200 bg-amber-50 px-5 text-sm font-black text-amber-700" type="submit">
              Request admin approval
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
