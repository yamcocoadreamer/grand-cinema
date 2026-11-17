
alter table public.profiles enable row level security;
alter table public.movies enable row level security;
alter table public.rooms enable row level security;
alter table public.seats enable row level security;
alter table public.screenings enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_seats enable row level security;
alter table public.tickets enable row level security;
alter table public.payments enable row level security;

-- Consultation publique des films publies
create policy "Read published movies"
on public.movies for select
to anon, authenticated
using (is_published = true);

-- Consultation des salles
create policy "Read rooms"
on public.rooms for select
to anon, authenticated
using (true);

-- Consultation des places
create policy "Read seats"
on public.seats for select
to anon, authenticated
using (true);

-- Consultation des seances programmees
create policy "Read scheduled screenings"
on public.screenings for select
to anon, authenticated
using (status = 'scheduled');

-- Un utilisateur consulte son profil
create policy "Read own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

-- Un utilisateur consulte ses reservations
create policy "Read own reservations"
on public.reservations for select
to authenticated
using (user_id = (select auth.uid()));
