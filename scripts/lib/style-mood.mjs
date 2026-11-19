/** Resolves mood inheritance and per-band overrides from the Blender style-layer manifest. */
function cloneStyleValue(value) {
  if (Array.isArray(value)) return value.map(cloneStyleValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneStyleValue(entry)]),
    );
  }
  return value;
}

export function deepMergeStyle(base, override) {
  if (override === null || typeof override !== "object") {
    return override;
  }
  if (Array.isArray(override)) return override.map(cloneStyleValue);
  if (base === null || typeof base !== "object" || Array.isArray(base))
    return cloneStyleValue(override);
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = key in merged ? deepMergeStyle(merged[key], value) : cloneStyleValue(value);
  }
  return merged;
}

export function resolveStyleMood(styleLayer, moodId) {
  const resolve = (id, seen = new Set()) => {
    const profile = styleLayer.moodProfiles?.[id];
    if (!profile) throw new Error(`activeMood desconocido: ${id}`);
    if (seen.has(id)) throw new Error(`ciclo de herencia de mood: ${[...seen, id].join(" → ")}`);
    const ancestors = new Set(seen).add(id);
    const parent = profile.extends ? resolve(profile.extends, ancestors) : {};
    return deepMergeStyle(
      parent,
      Object.fromEntries(Object.entries(profile).filter(([key]) => key !== "extends")),
    );
  };

  const resolved = resolve(moodId);
  const treatment = resolved.externalTreatment;
  if (!treatment) throw new Error(`mood profile ${moodId} no declara externalTreatment`);
  for (const [bandId, overrides] of Object.entries(treatment.bandOverrides ?? {})) {
    const band = treatment.hueBands?.find((entry) => entry.id === bandId);
    if (!band) throw new Error(`mood profile ${moodId} sobrescribe banda inexistente ${bandId}`);
    Object.assign(band, overrides);
  }
  delete treatment.bandOverrides;
  return resolved;
}
