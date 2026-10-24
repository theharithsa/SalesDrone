import pkg from '../package.json' with {type:'json'};
import release from './release.json' with {type:'json'};
export const APP_VERSION=pkg.version;
export const BUILD_COMMIT=release.commit||'development';
