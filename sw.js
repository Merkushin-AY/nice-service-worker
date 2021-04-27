'use strict';

/**
 * Some nice service worker
 */
const serviceWorker = {
    version: '1.0',
    offlinePage: '/offline.html',
    offlineImage: '/offlineImage.svg',
    cachePathPattern: /^.*?(js\/|css\/cache\/|images\/|fonts\/|\.html|\/$)(?!.*?php\/)/,
    staticCacheResources: [
        '/offline.html',
        '/offlineImage.svg',
    ],


    getVersion() {
        return this.version || '1.0';
    },

    getCacheNamePrefix() {
        return `sw-${this.getVersion()}`;
    },

    getCacheName(key) {
        return `${this.getCacheNamePrefix()}-${key}`;
    },

    /**
     * Pre-caches static resources
     * @returns {Promise<void>}
     */
    onInstall() {
        let cacheKey = this.getCacheName('static');
        return caches
            .open(cacheKey)
            .then(cache => cache.addAll(this.staticCacheResources));
    },

    /**
     * Deletes old cache depending on sw version
     * @returns {Promise<boolean[]>}
     */
    onActivate() {
        return caches
            .keys()
            .then(cacheKeys => {
                let oldCacheKeys = cacheKeys.filter(key => key.indexOf(this.getCacheNamePrefix()) !== 0);
                let deletePromises = oldCacheKeys.map(oldKey => caches.delete(oldKey));
                return Promise.all(deletePromises);
            });
    },

    /**
     * Caches some items
     * @param cacheName - name of cache for resource
     * @param request - fetch request
     * @param response - fetch response
     * @returns {{ok}|*}
     */
    addToCache(cacheName, request, response) {
        if (response.ok) {
            let copy = response.clone();
            caches
                .open(cacheName)
                .then(cache => cache.put(request, copy));
        }
        return response;
    },

    /**
     * Tries to get resource from cache
     * @param event
     * @throws {Error} - if resource wasn't found in cache
     * @returns {Promise<Response>}
     */
    fetchFromCache(event) {
        return caches
            .match(event.request)
            .then(response => {
                if (!response) {
                    throw Error(`${event.request.url} not found in cache`);
                }
                return response;
            }
        );
    },

    /**
     * Returns offline response for images and text/html
     * @param resourceType
     * @returns {Promise<Response | undefined>|undefined}
     */
    offlineResponse(resourceType) {
        if (resourceType === 'image') {
            return caches.match(this.offlineImage);
        } else if (resourceType === 'content') {
            return caches.match(this.offlinePage);
        }
        return undefined;
    },

    /**
     * Checks if the SW should handle request 
     * @param request
     * @returns {boolean}
     */
    shouldHandleFetch (request) {
        let url = new URL(request.url);
        let res = false;
        
        if (this.cachePathPattern.test(url.pathname) && request.method === 'GET' && url.origin === self.location.origin) {
            res = true;
        }
        return res;
    },

    /**
     * Fetch event handler  
     * For text/html resources always makes a request to the network  
     * For other resources first tries to take them from the cache, in case of failure, downloads them from the network
     * @param event
     */
    onFetch(event) {
        let request = event.request;

        if (!this.shouldHandleFetch(request)) return;
        
        let acceptHeader = request.headers.get('Accept');
        let resourceType = 'static';
        
        if (acceptHeader.indexOf('text/html') !== -1) {
            resourceType = 'content';
        } else if (acceptHeader.indexOf('image') !== -1) {
            resourceType = 'image';
        }

        let cacheName = this.getCacheName(resourceType);


        // Content type downloads from net
        if (resourceType === 'content') {
            event.respondWith(
                fetch(request)
                    .then(response => this.addToCache(cacheName, request, response))
                    .catch(() => this.fetchFromCache(event))
                    .catch(() => this.offlineResponse(resourceType, opts))
            );
        } else {
            event.respondWith(
                this.fetchFromCache(event)
                    .catch(() => fetch(request))
                    .then(response => this.addToCache(cacheName, request, response))
                    .catch(() => this.offlineResponse(resourceType, opts))
            );
        }
    },


    /**
     * SW entrypoint
     */
    init() {
        self.addEventListener('install', event => {
            event.waitUntil(
                this.onInstall().then(() => self.skipWaiting())
            );
        });

        self.addEventListener('activate', event => {
            event.waitUntil(
                this.onActivate().then(() => self.clients.claim())
            );
        });

        self.addEventListener('fetch', this.onFetch.bind(this));
    },

};

serviceWorker.init();