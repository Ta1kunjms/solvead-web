-- Seed base levels for development/testing.
-- Safe to re-run because of the upsert on level_number.

insert into public.levels (level_number, title, geometry_focus, shape_icon, is_active)
values
  (1, 'Level 1', 'Foundations', null, true),
  (2, 'Level 2', 'Lines and Angles', null, true),
  (3, 'Level 3', 'Triangles', null, true),
  (4, 'Level 4', 'Quadrilaterals', null, true),
  (5, 'Level 5', 'Polygons', null, true),
  (6, 'Level 6', 'Circles', null, true),
  (7, 'Level 7', 'Coordinate Plane', null, true),
  (8, 'Level 8', 'Transformations', null, true),
  (9, 'Level 9', 'Similarity', null, true),
  (10, 'Level 10', 'Congruence', null, true),
  (11, 'Level 11', 'Perimeter and Area', null, true),
  (12, 'Level 12', 'Surface Area', null, true),
  (13, 'Level 13', 'Volume', null, true),
  (14, 'Level 14', 'Pythagorean Theorem', null, true),
  (15, 'Level 15', 'Mixed Review', null, true)
on conflict (level_number) do update
set title = excluded.title,
    geometry_focus = excluded.geometry_focus,
    shape_icon = excluded.shape_icon,
    is_active = excluded.is_active;
