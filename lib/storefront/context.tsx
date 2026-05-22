import type { StoreTenantContext } from "@/lib/tenant/context";
import { getTenantDomain } from "@/lib/tenant/context";

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function getStorefrontTenantPayload(context: StoreTenantContext) {
  const domain = getTenantDomain(context);

  return {
    analyticsScope: {
      storeInstanceId: context.store_instance_id,
      tenantSource: context.source
    },
    branding: context.branding,
    checkoutScope: {
      storeInstanceId: context.store_instance_id
    },
    domain,
    localizationScope: {
      storeInstanceId: context.store_instance_id
    },
    settings: context.settings,
    tenant: {
      hostname: context.hostname,
      ownerUserId: context.owner_user_id,
      primaryDomain: context.primary_domain,
      publishState: context.publish_state,
      source: context.source,
      storeInstanceId: context.store_instance_id,
      storeSlug: context.store_slug
    }
  };
}

export function StorefrontTenantContextScript({
  context
}: {
  context: StoreTenantContext;
}) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: safeJson(getStorefrontTenantPayload(context))
      }}
      id="shastore-tenant-context"
      type="application/json"
    />
  );
}
