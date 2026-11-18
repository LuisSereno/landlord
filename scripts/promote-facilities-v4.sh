#!/bin/bash
set -e
cd /home/luis/RepositorioGitHub/landlord
export PATH=/home/luis/.local/share/nodejs/v24.19.0/bin:/home/luis/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
python3 scripts/promote-facilities-v4.py
pnpm prettier --write blender_artist/manifests/runtime-promotions.json
node scripts/build-blender-assets.mjs --promote-approved
B=docs/art/quality-vj/batch-facilities-v4
node scripts/promote-building-variants.mjs --batch=$B/lane1/day --mood=day_civic --types=town_hall,school_block --output=apps/web/src/generated/runtime-building-variants.json --variantDir=apps/web/public/assets/runtime/variants
node scripts/promote-building-variants.mjs --batch=$B/lane2/day --mood=day_civic --types=clinic,police_station --output=apps/web/src/generated/runtime-building-variants.json --variantDir=apps/web/public/assets/runtime/variants
node scripts/promote-building-variants.mjs --batch=$B/lane3/day --mood=day_civic --types=fire_station,market_hall --output=apps/web/src/generated/runtime-building-variants.json --variantDir=apps/web/public/assets/runtime/variants
node scripts/promote-building-variants.mjs --batch=$B/lane1/night --mood=night_civic --types=town_hall,school_block --output=apps/web/src/generated/runtime-building-variants-night.json --variantDir=apps/web/public/assets/runtime/variants-night
node scripts/promote-building-variants.mjs --batch=$B/lane2/night --mood=night_civic --types=clinic,police_station --output=apps/web/src/generated/runtime-building-variants-night.json --variantDir=apps/web/public/assets/runtime/variants-night
node scripts/promote-building-variants.mjs --batch=$B/lane3/night --mood=night_civic --types=fire_station,market_hall --output=apps/web/src/generated/runtime-building-variants-night.json --variantDir=apps/web/public/assets/runtime/variants-night
for lane in lane1 lane2 lane3; do
  for sub in day night; do
    for d in $B/$lane/$sub/*/; do
      [ -f "$d/manifest.json" ] && node scripts/validate-building-composer.mjs --manifest="$d/manifest.json" || true
    done
  done
done
echo PROMOTION-DONE
