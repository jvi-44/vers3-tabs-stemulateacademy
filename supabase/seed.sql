-- STEMulate Academy: fixed lists for the sign-up drop-downs.
-- Run after schema.sql (Supabase > SQL Editor > New query > paste > Run).
-- Safe to run again: existing rows are skipped. The order matches
-- server/db.js, so the ids line up with the SQLite version.

INSERT INTO organisations (org_name) VALUES
    ('Brighton Connection'),
    ('Caritas Singapore'),
    ('CDAC'),
    ('Faithacts'),
    ('New Life Care Centre'),
    ('Sheng Hong Student Care'),
    ('VIVA Foundation')
ON CONFLICT (org_name) DO NOTHING;

INSERT INTO school_levels (level_name) VALUES
    ('Primary 1'),
    ('Primary 2'),
    ('Primary 3'),
    ('Primary 4'),
    ('Primary 5'),
    ('Primary 6')
ON CONFLICT (level_name) DO NOTHING;

INSERT INTO recovery_colours (colour_name) VALUES
    ('Red'),
    ('Orange'),
    ('Yellow'),
    ('Green'),
    ('Blue'),
    ('Purple'),
    ('Pink')
ON CONFLICT (colour_name) DO NOTHING;

INSERT INTO recovery_subjects (subject_name) VALUES
    ('Mathematics'),
    ('Science'),
    ('English'),
    ('Mother Tongue'),
    ('Art'),
    ('Music'),
    ('Physical Education')
ON CONFLICT (subject_name) DO NOTHING;
