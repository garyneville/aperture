/**
 * Custom ESM loader that fixes CJS/ESM interop for dual-format packages.
 * On Node ≥ 22, ts-node resolves astronomy-engine to its ESM entry but
 * still marks it as CJS, breaking named imports. This loader forces the
 * correct module format.
 *
 * Usage: node --loader ts-node/esm --loader ./scripts/esm-compat-loader.mjs <script>
 */

const ESM_PACKAGES = new Set([
  'astronomy-engine',
]);

export async function resolve(specifier, context, nextResolve) {
  if (ESM_PACKAGES.has(specifier)) {
    const resolved = await nextResolve(specifier, context);
    return { ...resolved, format: 'module' };
  }
  return nextResolve(specifier, context);
}
