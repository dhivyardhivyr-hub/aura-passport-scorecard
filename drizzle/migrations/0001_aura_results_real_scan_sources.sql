alter table public.aura_results add column if not exists sources jsonb not null default '[]'::jsonb;
alter table public.aura_results add column if not exists scan_mode text not null default 'low_signal';

insert into public.aura_results (display_name, aura_points, rizz, chaos, hustle, rank_title, roast, sources, scan_mode)
select v.display_name, v.aura_points, v.rizz, v.chaos, v.hustle, v.rank_title, v.roast, '[]'::jsonb, 'low_signal'
from (values
  ('neon_overlord', 1873, 92, 34, 88, 'OG AURA CELESTIAL', 'The scan reports near-celestial output: every group chat gets sharper when this handle posts. The only real threat to the score is logging off for a week. Keep farming, celestial one.'),
  ('glitch_witch', 1421, 88, 51, 77, 'CERTIFIED AURA FARMER', 'Scans as a certified aura farmer: consistent output, minimum embarrassment, maximum watchability. People screenshot the messages. The algorithm has no notes, only applause.'),
  ('mainframe_mike', 964, 71, 62, 70, 'SOLID W VIBES', 'The algorithm rates this one a certified W with occasional self-inflicted Ls. The chaos keeps things interesting and the charm keeps it out of trouble. One bold move per week upgrades the tier.'),
  ('pixel_pigeon', 431, 48, 44, 55, 'MID-CLASS AURA CITIZEN', 'Scanned as aggressively adequate: stable, dependable, forgettable in the way default wallpapers are forgettable. The upside is that mid is a launchpad. One strong hobby bends the graph upward.'),
  ('sleepy_kenji', 118, 31, 57, 40, 'NPC ADJACENT', 'The scan returned mostly background radiation. This persona reacts to life instead of posting it. One opinion and one unreturned text sent at noon is the entire escape sequence.'),
  ('chaos_gremlin', -64, 22, 89, 26, 'AURA DEBTOR', 'The algorithm checked twice and then quietly lowered the brightness. The chaos is unearned and the hustle is theoretical. Start the recovery arc with a hobby that does not involve scrolling.')
) as v(display_name, aura_points, rizz, chaos, hustle, rank_title, roast)
where not exists (select 1 from public.aura_results r where r.display_name = v.display_name);