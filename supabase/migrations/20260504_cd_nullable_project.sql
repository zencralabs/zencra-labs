-- Migration: make project_id nullable on creative_generations
--
-- Creative Director v2 creates "free" directions with no project.
-- The generate route therefore has no project_id to supply, but the
-- original schema required project_id NOT NULL. This caused a silent
-- FK-constraint failure that left creative_generations empty and the
-- OutputPanel in its empty state after every CDv2 generate call.
--
-- Fix: drop the NOT NULL constraint + FK, re-add as nullable FK.
-- Existing rows (which all have a project_id) are unaffected.

alter table creative_generations
  alter column project_id drop not null;

-- Re-add FK as deferrable so future inserts with null are allowed.
-- (The FK itself is still enforced when non-null.)
alter table creative_generations
  drop constraint if exists creative_generations_project_id_fkey;

alter table creative_generations
  add constraint creative_generations_project_id_fkey
    foreign key (project_id)
    references creative_projects(id)
    on delete cascade
    deferrable initially deferred;
