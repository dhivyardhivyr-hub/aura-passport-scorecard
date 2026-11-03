create table public.aura_results (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  aura_points integer not null,
  rizz integer not null,
  chaos integer not null,
  hustle integer not null,
  rank_title text not null,
  roast text not null,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT ON public.aura_results TO anon;
GRANT ALL ON public.aura_results TO service_role;

alter table public.aura_results enable row level security;

create policy "Anyone can view aura results"
  on public.aura_results for select
  to anon, authenticated
  using (true);

create policy "Anyone can submit an aura scan"
  on public.aura_results for insert
  to anon, authenticated
  with check (true);

create index idx_aura_results_points on public.aura_results (aura_points desc);