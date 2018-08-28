/**
 * This module allows to deduplicate function calls with the same params and
 * cache result of function call.
 */

export class CachingProxy {

  constructor(cacheOptions) {
    this.cacheEnabled = cacheOptions.enabled;
    this.ttl          = cacheOptions.ttl || 600000; // 10 minutes by default

    // Internal objects for data storing
    this.cache = {};
    this.promises = {};
  }

  /**
   * Check that result is present in the cache and is up to date or send request otherwise.
   */
  cacheRequest(func, funcName, funcScope) {
    return cacheRequest(func, funcName, funcScope, this);
  }

  /**
   * Wrap request to prevent multiple calls with same params when request is waiting for response.
   */
  proxyfy(func, funcName, funcScope) {
    if (!this.promises[funcName]) {
      this.promises[funcName] = {};
    }
    const promiseKeeper = this.promises[funcName];
    return callOnce(func, promiseKeeper, funcScope);
  }

  proxyfyWithCache(func, funcName, funcScope) {
    let proxyfied = this.proxyfy(func, funcName, funcScope);
    return this.cacheRequest(proxyfied, funcName, funcScope);
  }

  _isExpired(cacheObject) {
    if (cacheObject) {
      let object_age = Date.now() - cacheObject.timestamp;
      return !(cacheObject.timestamp && object_age < this.ttl);
    } else {
      return true;
    }
  }
}

/**
 * Wrap request to prevent multiple calls
 * with same params when waiting for result.
 */
function callOnce(func, promiseKeeper, funcScope) {
  return function() {
    var hash = getRequestHash(arguments);
    if (!promiseKeeper[hash]) {
      promiseKeeper[hash] = Promise.resolve(
        func.apply(funcScope, arguments)
        .then(result => {
          promiseKeeper[hash] = null;
          return result;
        })
      );
    }
    return promiseKeeper[hash];
  };
}

function cacheRequest(func, funcName, funcScope, self) {
  return function() {
    if (!self.cache[funcName]) {
      self.cache[funcName] = {};
    }

    let cacheObject = self.cache[funcName];
    let hash = getRequestHash(arguments);
    if (self.cacheEnabled && !self._isExpired(cacheObject[hash])) {
      return Promise.resolve(cacheObject[hash].value);
    } else {
      return func.apply(funcScope, arguments)
      .then(result => {
        cacheObject[hash] = {
          value: result,
          timestamp: Date.now()
        };
        return result;
      });
    }
  };
}

function getRequestHash(args) {
  const argsJson = JSON.stringify(args);
  return argsJson.getHash();
}

String.prototype.getHash = function() {
  var hash = 0, i, chr, len;
  if (this.length !== 0) {
    for (i = 0, len = this.length; i < len; i++) {
      chr   = this.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
  }
  return hash;
};
