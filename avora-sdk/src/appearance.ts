/** Portable appearance contract. Local files contain paths; exchanged configs include PNG bytes. */
export interface NodeLogoAsset { path: string; data?: string }
export interface NodeLogo { light: NodeLogoAsset; dark?: NodeLogoAsset }
export const HEADER_TINT = 0.10;
export const LOGO_MAX_BYTES = 256_000;
export const LOGO_SIZE = 256;
export const isHexColor = (value: unknown): boolean => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export const safeLogoPath = (value: unknown): value is string => typeof value === 'string' && /^assets\/[a-z0-9_-]+\.png$/.test(value);
export function logoAssets(config: { logo?: NodeLogo }): NodeLogoAsset[] {
  return config.logo ? [config.logo.light, ...(config.logo.dark ? [config.logo.dark] : [])] : [];
}
export function appearanceIssues(config: any, embedded = false): string[] {
  const issues: string[] = [];
  if (config.colorSource !== undefined && !['logo', 'manual'].includes(config.colorSource)) issues.push('colorSource must be logo or manual.');
  if (config.colorSource !== undefined && !isHexColor(config.color)) issues.push('Appearance color must be #RRGGBB (opacity is fixed by Avora).');
  if (config.logo !== undefined) {
    if (!config.logo || typeof config.logo !== 'object' || !config.logo.light) return [...issues, 'A logo requires a default light asset.'];
    for (const key of Object.keys(config.logo)) if (!['light', 'dark'].includes(key)) issues.push(`Unknown logo theme: ${key}`);
    for (const asset of logoAssets(config)) {
      if (!asset || !safeLogoPath(asset.path)) { issues.push('Logo paths must be assets/<name>.png.'); continue; }
      if (embedded || asset.data !== undefined) {
        if (typeof asset.data !== 'string' || asset.data.length > Math.ceil(LOGO_MAX_BYTES / 3) * 4 || !/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(asset.data)) issues.push(`Missing or invalid PNG data: ${asset.path}`);
      }
    }
  }
  return issues;
}
export function hydrateAppearance<T extends { logo?: NodeLogo }>(config: T, files: Record<string, string>): T {
  const result = JSON.parse(JSON.stringify(config)) as T;
  for (const asset of logoAssets(result)) asset.data = files[asset.path] ?? asset.data;
  const issues = appearanceIssues(result, true);
  if (issues.length) throw new Error(issues[0]);
  return result;
}
export const LEGACY_COLORS: Record<string, string> = { blue:'#3b82f6',green:'#22c55e',purple:'#a855f7',yellow:'#eab308',red:'#ef4444',orange:'#f97316',teal:'#14b8a6',cyan:'#06b6d4',indigo:'#6366f1',pink:'#ec4899',gray:'#6b7280',emerald:'#10b981',amber:'#f59e0b',violet:'#8b5cf6',rose:'#f43f5e',slate:'#64748b',zinc:'#71717a' };
export function accentHex(value?: string): string {
  if (isHexColor(value)) return value!.toLowerCase();
  return LEGACY_COLORS[value?.match(/(?:^|\s)text-([a-z]+)-500(?:\s|$)/)?.[1] || ''] || '#3b82f6';
}
/** Largest alpha-weighted color cluster; clear pixels never turn the result black. */
export function dominantColor(rgba: ArrayLike<number>): string {
  const bins = new Map<number, { weight:number; r:number; g:number; b:number }>();
  for (let i=0;i<rgba.length;i+=4) {
    const a=rgba[i+3]/255; if (a < 0.1) continue;
    const r=rgba[i],g=rgba[i+1],b=rgba[i+2];
    const key=(r>>4)*256+(g>>4)*16+(b>>4);
    const bin=bins.get(key)||{weight:0,r:0,g:0,b:0};
    bin.weight+=a;bin.r+=r*a;bin.g+=g*a;bin.b+=b*a;bins.set(key,bin);
  }
  let winner: {weight:number;r:number;g:number;b:number}|undefined;
  for (const bin of bins.values()) if (!winner || bin.weight>winner.weight) winner=bin;
  if (!winner) throw new Error('The logo is fully transparent.');
  return '#'+[winner.r,winner.g,winner.b].map(v=>Math.round(v/winner!.weight).toString(16).padStart(2,'0')).join('');
}
