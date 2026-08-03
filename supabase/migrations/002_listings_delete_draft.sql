-- Agents may delete their own draft listings (UI: Dashboard → Drafts → Delete)
create policy "listings_delete_own_draft"
on public.listings for delete
using (auth.uid() = agent_id and stage = 'draft');
