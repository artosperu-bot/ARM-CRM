-- Verified from the preexisting Meta WhatsApp test configuration.
-- Fail closed: no inbound processing until signed delivery and test allowlist are configured.
insert into public.arm_meta_accounts
  (workspace_id, channel, account_ref, display_name, status, inbound_enabled)
select w.id, 'whatsapp', '1283086411554196', 'Meta WhatsApp test number', 'verified_read_only', false
from public.arm_workspaces w where w.name='STECH PERU'
on conflict (workspace_id, channel, account_ref) do nothing;
