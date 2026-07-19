import { addRootProvider } from '@schematics/angular/utility'
import {
  NodeDependencyType,
  addPackageJsonDependency,
} from '@schematics/angular/utility/dependencies'
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks'
import { chain } from '@angular-devkit/schematics'
import type { Rule } from '@angular-devkit/schematics'
import type { Schema } from './schema'

// Replaced with package metadata by scripts/inject-schematic-package-info.js.
// The published schematic contains literal values and does not read package.json.
const PACKAGE_NAME = '__ANGULAR_QUERY_PACKAGE_NAME__'
const DEVTOOLS_PACKAGE_NAME = '__ANGULAR_QUERY_DEVTOOLS_PACKAGE_NAME__'
const DEVTOOLS_PACKAGE_VERSION = '__ANGULAR_QUERY_DEVTOOLS_PACKAGE_VERSION__'

/**
 * Configures TanStack Query at the application root.
 *
 * The QueryClient factory is resolved by each root injector, preventing query
 * caches from being shared between SSR requests.
 */
export function ngAdd(options: Schema): Rule {
  return chain([
    (tree, context) => {
      addPackageJsonDependency(tree, {
        type: NodeDependencyType.Default,
        name: DEVTOOLS_PACKAGE_NAME,
        version: DEVTOOLS_PACKAGE_VERSION,
        overwrite: false,
      })
      context.addTask(new NodePackageInstallTask())
      return tree
    },
    addRootProvider(
      options.project,
      ({ code, external }) =>
        code`${external(
          'provideTanStackQuery',
          PACKAGE_NAME,
        )}(() => new ${external(
          'QueryClient',
          PACKAGE_NAME,
        )}(), ${external('withDevtools', DEVTOOLS_PACKAGE_NAME)}())`,
    ),
  ])
}
