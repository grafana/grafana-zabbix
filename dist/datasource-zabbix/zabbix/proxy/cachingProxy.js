"use strict";

System.register([], function (_export, _context) {
  "use strict";

  var _createClass, CachingProxy;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  /**
   * Wrap request to prevent multiple calls
   * with same params when waiting for result.
   */
  function callOnce(func, promiseKeeper, funcScope) {
    return function () {
      var hash = getRequestHash(arguments);
      if (!promiseKeeper[hash]) {
        promiseKeeper[hash] = Promise.resolve(func.apply(funcScope, arguments).then(function (result) {
          promiseKeeper[hash] = null;
          return result;
        }));
      }
      return promiseKeeper[hash];
    };
  }

  function _cacheRequest(func, funcName, funcScope, self) {
    return function () {
      if (!self.cache[funcName]) {
        self.cache[funcName] = {};
      }

      var cacheObject = self.cache[funcName];
      var hash = getRequestHash(arguments);
      if (self.cacheEnabled && !self._isExpired(cacheObject[hash])) {
        return Promise.resolve(cacheObject[hash].value);
      } else {
        return func.apply(funcScope, arguments).then(function (result) {
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
    var argsJson = JSON.stringify(args);
    return argsJson.getHash();
  }

  return {
    setters: [],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export("CachingProxy", CachingProxy = function () {
        function CachingProxy(cacheOptions) {
          _classCallCheck(this, CachingProxy);

          this.cacheEnabled = cacheOptions.enabled;
          this.ttl = cacheOptions.ttl || 600000; // 10 minutes by default

          // Internal objects for data storing
          this.cache = {};
          this.promises = {};
        }

        /**
         * Check that result is present in the cache and is up to date or send request otherwise.
         */


        _createClass(CachingProxy, [{
          key: "cacheRequest",
          value: function cacheRequest(func, funcName, funcScope) {
            return _cacheRequest(func, funcName, funcScope, this);
          }
        }, {
          key: "proxyfy",
          value: function proxyfy(func, funcName, funcScope) {
            if (!this.promises[funcName]) {
              this.promises[funcName] = {};
            }
            var promiseKeeper = this.promises[funcName];
            return callOnce(func, promiseKeeper, funcScope);
          }
        }, {
          key: "proxyfyWithCache",
          value: function proxyfyWithCache(func, funcName, funcScope) {
            var proxyfied = this.proxyfy(func, funcName, funcScope);
            return this.cacheRequest(proxyfied, funcName, funcScope);
          }
        }, {
          key: "_isExpired",
          value: function _isExpired(cacheObject) {
            if (cacheObject) {
              var object_age = Date.now() - cacheObject.timestamp;
              return !(cacheObject.timestamp && object_age < this.ttl);
            } else {
              return true;
            }
          }
        }]);

        return CachingProxy;
      }());

      _export("CachingProxy", CachingProxy);

      String.prototype.getHash = function () {
        var hash = 0,
            i,
            chr,
            len;
        if (this.length !== 0) {
          for (i = 0, len = this.length; i < len; i++) {
            chr = this.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0; // Convert to 32bit integer
          }
        }
        return hash;
      };
    }
  };
});
//# sourceMappingURL=cachingProxy.js.map
