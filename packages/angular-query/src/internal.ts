/**
 * Internal APIs shared by the Angular Query packages.
 *
 * This entry point is not part of the application-facing API and may change
 * without notice.
 */
export {
  DestroyRefCompat,
  injectDestroyRefCompat,
} from './utils/destroy-ref-compat'
export type { QueryFeatureKind } from './providers'
export { getQueryFeatureProviders, queryFeature } from './providers'
