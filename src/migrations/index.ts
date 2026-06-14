import * as migration_20260614_035839_initial_schema from './20260614_035839_initial_schema';
import * as migration_20260614_072915_post_internal_links_auto_slug from './20260614_072915_post_internal_links_auto_slug';

export const migrations = [
  {
    up: migration_20260614_035839_initial_schema.up,
    down: migration_20260614_035839_initial_schema.down,
    name: '20260614_035839_initial_schema',
  },
  {
    up: migration_20260614_072915_post_internal_links_auto_slug.up,
    down: migration_20260614_072915_post_internal_links_auto_slug.down,
    name: '20260614_072915_post_internal_links_auto_slug'
  },
];
