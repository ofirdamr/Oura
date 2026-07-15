-- Migration 0007: extend gallery_theme check to allow 'personal' value.
-- PR #50 introduced a third picker option ("שלי" / personal) on the branding
-- page, but the original 0001_init constraint only covered ('festive','minimal').
-- Saving 'personal' from the branding page was silently failing the check,
-- leaving every event stuck on the default 'festive' theme.
alter table events
  drop constraint if exists events_gallery_theme_check;

alter table events
  add constraint events_gallery_theme_check
    check (gallery_theme in ('festive', 'minimal', 'personal'));
