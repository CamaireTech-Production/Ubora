/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-b5039ba5'], (function (workbox) { 'use strict';

  self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "fav-icons/android-icon-144x144.png",
    "revision": "4a11b48c79a5c96020af3d69257c4d40"
  }, {
    "url": "fav-icons/android-icon-192x192.png",
    "revision": "34d4b5bc59f91fa7cdb9378d2bdf5817"
  }, {
    "url": "fav-icons/android-icon-36x36.png",
    "revision": "cc4c6f378ae956a8e8b72f20044bdde6"
  }, {
    "url": "fav-icons/android-icon-48x48.png",
    "revision": "e623969ee7b69f01fb002fde9cc3252f"
  }, {
    "url": "fav-icons/android-icon-512x512.png",
    "revision": "34d4b5bc59f91fa7cdb9378d2bdf5817"
  }, {
    "url": "fav-icons/android-icon-72x72.png",
    "revision": "20b52be0c1c95e12aebf37808add6dc6"
  }, {
    "url": "fav-icons/android-icon-96x96.png",
    "revision": "7f6fe7c94583c3619e175a579b439567"
  }, {
    "url": "fav-icons/apple-icon.png",
    "revision": "586a19f9a10aeede895df94099319927"
  }, {
    "url": "fav-icons/favicon.ico",
    "revision": "ecf7ecccee45d1d42c4b19f6598b6a63"
  }, {
    "url": "manifest.webmanifest",
    "revision": "8440b1b1a04222dec5e3cc6bf8230e86"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  self.__WB_DISABLE_DEV_LOGS = true;

}));
