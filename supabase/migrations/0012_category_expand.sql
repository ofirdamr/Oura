-- Migration 0012: Expand photo category CHECK constraint to include all 7 labels.
-- The original constraint in 0009 only covered the first four values; the pipeline
-- has since grown to 7 categories. Drop and recreate so new values are accepted.

alter table photos
  drop constraint if exists photos_category_check;

alter table photos
  add constraint photos_category_check
    check (category in (
      'ceremony', 'couple', 'dances', 'reception', 'main_course', 'family', 'venue'
    ));
