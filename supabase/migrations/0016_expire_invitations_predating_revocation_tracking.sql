begin;

-- Earlier member removals cannot be reconstructed reliably. Expire outstanding
-- links that predate the revocation ledger so they cannot restore old access.
update public.invitations
set expires_at = now()
where accepted_at is null and expires_at > now();

commit;
