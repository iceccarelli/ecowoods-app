/**
 * The two path aliases the renderer is written against, resolved for a plain
 * Node process. Next does this from tsconfig `paths`; there is no Next here.
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('./loader.mjs', pathToFileURL(import.meta.filename));
