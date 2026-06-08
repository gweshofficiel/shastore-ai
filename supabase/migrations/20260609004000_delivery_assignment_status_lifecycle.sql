-- Delivery assignment status lifecycle.
-- Additive only: lets linked delivery users update their own assignment rows.

drop policy if exists "delivery agents update own assignments" on public.delivery_assignments;

create policy "delivery agents update own assignments"
on public.delivery_assignments for update to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_assignments.delivery_agent_id
      and agents.store_id = delivery_assignments.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
)
with check (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_assignments.delivery_agent_id
      and agents.store_id = delivery_assignments.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);
