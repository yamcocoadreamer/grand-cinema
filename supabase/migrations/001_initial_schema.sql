
-- GRAND CINEMA - SCHEMA INITIAL
-- Etape 3 : tables et relations

create extension if not exists pgcrypto;

-- Utilisateurs
create table public.profiles (
  id uuid primary key
    references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user'
    check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- Films
create table public.movies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  duration_minutes integer not null
    check (duration_minutes > 0),
  genre text,
  poster_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- Salles
create table public.rooms (
  id bigint generated always as identity primary key,
  name text not null unique,
  capacity integer not null check (capacity > 0)
);

-- Places
create table public.seats (
  id bigint generated always as identity primary key,
  room_id bigint not null
    references public.rooms(id) on delete cascade,
  row_label text not null,
  seat_number integer not null check (seat_number > 0),
  unique (room_id, row_label, seat_number),
  unique (id, room_id)
);

-- Seances
create table public.screenings (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null
    references public.movies(id),
  room_id bigint not null
    references public.rooms(id),
  starts_at timestamptz not null,
  ticket_price numeric(8,2) not null
    check (ticket_price >= 0),
  status text not null default 'scheduled'
    check (status in ('scheduled','cancelled')),
  unique (id, room_id)
);

-- Reservations
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id),
  screening_id uuid not null,
  room_id bigint not null,
  status text not null default 'pending'
    check (status in ('pending','confirmed','cancelled')),
  created_at timestamptz not null default now(),
  foreign key (screening_id, room_id)
    references public.screenings(id, room_id),
  unique (id, screening_id, room_id)
);

-- Places reservees
create table public.reservation_seats (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  screening_id uuid not null,
  room_id bigint not null,
  seat_id bigint not null,
  created_at timestamptz not null default now(),
  foreign key (reservation_id, screening_id, room_id)
    references public.reservations(id, screening_id, room_id)
    on delete cascade,
  foreign key (seat_id, room_id)
    references public.seats(id, room_id),
  unique (reservation_id, seat_id)
);

-- Une place ne peut pas etre attribuee
-- deux fois pour la meme seance.
create unique index unique_screening_seat
on public.reservation_seats(screening_id, seat_id);

-- Billets
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  reservation_seat_id uuid not null unique
    references public.reservation_seats(id)
    on delete cascade,
  ticket_code uuid not null unique default gen_random_uuid(),
  issued_at timestamptz not null default now()
);

-- Paiements
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique
    references public.reservations(id),
  amount numeric(10,2) not null check (amount >= 0),
  status text not null default 'pending'
    check (status in ('pending','paid','failed','refunded')),
  provider_reference text unique,
  created_at timestamptz not null default now()
);
