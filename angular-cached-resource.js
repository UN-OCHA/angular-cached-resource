(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var DEFAULT_ACTIONS, buildCachedResourceClass, readArrayCache, readCache, writeCache;

DEFAULT_ACTIONS = {
  get: {
    method: 'GET'
  },
  query: {
    method: 'GET',
    isArray: true
  },
  save: {
    method: 'POST'
  },
  remove: {
    method: 'DELETE'
  },
  "delete": {
    method: 'DELETE'
  }
};

readArrayCache = require('./read_array_cache');

readCache = require('./read_cache');

writeCache = require('./write_cache');

module.exports = buildCachedResourceClass = function($resource, $timeout, $q, providerParams, args) {
  var $key, $log, Cache, CachedResource, Resource, ResourceCacheArrayEntry, ResourceCacheEntry, ResourceWriteQueue, actionConfig, actionName, actions, arg, boundParams, handler, isPermissibleBoundValue, method, param, paramDefault, paramDefaults, url;
  $log = providerParams.$log;
  ResourceCacheEntry = require('./resource_cache_entry')(providerParams);
  ResourceCacheArrayEntry = require('./resource_cache_array_entry')(providerParams);
  ResourceWriteQueue = require('./resource_write_queue')(providerParams, $q);
  Cache = require('./cache')(providerParams);
  $key = args.shift();
  url = args.shift();
  while (args.length) {
    arg = args.pop();
    if (angular.isObject(arg[Object.keys(arg)[0]])) {
      actions = arg;
    } else {
      paramDefaults = arg;
    }
  }
  actions = angular.extend({}, DEFAULT_ACTIONS, actions);
  if (paramDefaults == null) {
    paramDefaults = {};
  }
  boundParams = {};
  for (param in paramDefaults) {
    paramDefault = paramDefaults[param];
    if (paramDefault[0] === '@') {
      boundParams[paramDefault.substr(1)] = param;
    }
  }
  Resource = $resource.call(null, url, paramDefaults, actions);
  isPermissibleBoundValue = function(value) {
    return angular.isDate(value) || angular.isNumber(value) || angular.isString(value);
  };
  CachedResource = (function() {
    CachedResource.prototype.$cache = true;

    function CachedResource(attrs) {
      angular.extend(this, attrs);
    }

    CachedResource.prototype.toJSON = function() {
      var data;
      data = angular.extend({}, this);
      delete data.$promise;
      delete data.$httpPromise;
      return data;
    };

    CachedResource.prototype.$params = function() {
      var attribute, params;
      params = {};
      for (attribute in boundParams) {
        param = boundParams[attribute];
        if (isPermissibleBoundValue(this[attribute])) {
          params[param] = this[attribute];
        }
      }
      return params;
    };

    CachedResource.prototype.$$addToCache = function(dirty) {
      var entry;
      if (dirty == null) {
        dirty = false;
      }
      entry = new ResourceCacheEntry($key, this.$params());
      entry.set(this, dirty);
      return this;
    };

    CachedResource.$clearCache = function(arg1) {
      var cacheArrayEntry, cacheKeys, clearChildren, clearPendingWrites, entries, exceptFor, isArray, key, params, queue, ref, ref1, translateEntriesToCacheKeys, translateParamsArrayToCacheKeys, translateParamsArrayToEntries, where;
      ref = arg1 != null ? arg1 : {}, where = ref.where, exceptFor = ref.exceptFor, clearPendingWrites = ref.clearPendingWrites, isArray = ref.isArray, clearChildren = ref.clearChildren;
      if (where == null) {
        where = null;
      }
      if (exceptFor == null) {
        exceptFor = null;
      }
      if (clearPendingWrites == null) {
        clearPendingWrites = false;
      }
      if (isArray == null) {
        isArray = false;
      }
      if (clearChildren == null) {
        clearChildren = false;
      }
      if (where && exceptFor) {
        return $log.error("Using where and exceptFor arguments at once in $clearCache() method is forbidden!");
      }
      cacheKeys = [];
      translateParamsArrayToEntries = function(entries) {
        entries || (entries = []);
        if (!angular.isArray(entries)) {
          entries = [entries];
        }
        return entries.map(function(entry) {
          return new CachedResource(entry).$params();
        });
      };
      translateEntriesToCacheKeys = function(params_objects) {
        return params_objects.map(function(params) {
          return new ResourceCacheEntry($key, params).fullCacheKey();
        });
      };
      translateParamsArrayToCacheKeys = function(entries) {
        return translateEntriesToCacheKeys(translateParamsArrayToEntries(entries));
      };
      if (exceptFor || where) {
        if (isArray) {
          cacheArrayEntry = new ResourceCacheArrayEntry($key, exceptFor || where).load();
          cacheKeys.push(cacheArrayEntry.fullCacheKey());
          if (cacheArrayEntry.value && ((exceptFor && !clearChildren) || (where && clearChildren))) {
            entries = (function() {
              var i, len, ref1, results;
              ref1 = cacheArrayEntry.value;
              results = [];
              for (i = 0, len = ref1.length; i < len; i++) {
                params = ref1[i];
                results.push(params);
              }
              return results;
            })();
            if (entries) {
              cacheKeys = cacheKeys.concat(translateEntriesToCacheKeys(entries));
            }
          }
        } else {
          cacheKeys = translateParamsArrayToCacheKeys(where || exceptFor);
        }
      }
      if (!clearPendingWrites && !where) {
        ref1 = CachedResource.$writes, queue = ref1.queue, key = ref1.key;
        cacheKeys.push(key);
        entries = queue.map(function(resource) {
          return resource.resourceParams;
        });
        cacheKeys = cacheKeys.concat(translateEntriesToCacheKeys(entries));
      } else if (clearPendingWrites && where) {
        $log.debug("TODO if clearPendingWrites && where");
      }
      if (where) {
        return Cache.clear({
          key: $key,
          where: cacheKeys
        });
      } else {
        return Cache.clear({
          key: $key,
          exceptFor: cacheKeys
        });
      }
    };

    CachedResource.$addToCache = function(attrs, dirty) {
      return new CachedResource(attrs).$$addToCache(dirty);
    };

    CachedResource.$addArrayToCache = function(attrs, instances, dirty) {
      if (dirty == null) {
        dirty = false;
      }
      instances = instances.map(function(instance) {
        return new CachedResource(instance);
      });
      return new ResourceCacheArrayEntry($key, attrs).addInstances(instances, dirty);
    };

    CachedResource.$resource = Resource;

    CachedResource.$key = $key;

    return CachedResource;

  })();
  CachedResource.$writes = new ResourceWriteQueue(CachedResource, $timeout);
  for (actionName in actions) {
    actionConfig = actions[actionName];
    method = actionConfig.method.toUpperCase();
    if (actionConfig.cache !== false) {
      handler = method === 'GET' && actionConfig.isArray ? readArrayCache($q, providerParams, actionName, CachedResource, actionConfig) : method === 'GET' ? readCache($q, providerParams, actionName, CachedResource, actionConfig) : method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH' ? writeCache($q, providerParams, actionName, CachedResource, actionConfig) : void 0;
      CachedResource[actionName] = handler;
      if (method !== 'GET') {
        CachedResource.prototype["$" + actionName] = handler;
      }
    } else {
      CachedResource[actionName] = Resource[actionName];
      CachedResource.prototype["$" + actionName] = Resource.prototype["$" + actionName];
    }
  }
  return CachedResource;
};


},{"./cache":2,"./read_array_cache":7,"./read_cache":8,"./resource_cache_array_entry":9,"./resource_cache_entry":10,"./resource_write_queue":11,"./write_cache":12}],2:[function(require,module,exports){
var Cache, localStorage;

localStorage = window.localStorage;

Cache = (function() {
  Cache.prototype.memoryCache = {};

  function Cache(arg) {
    this.$log = arg.$log, this.localStoragePrefix = arg.localStoragePrefix;
  }

  Cache.prototype.getItem = function(key, fallbackValue) {
    var item, out;
    key = this._buildKey(key);
    item = this.memoryCache[key];
    if (item == null) {
      item = localStorage.getItem(key);
    }
    out = item != null ? angular.fromJson(item) : fallbackValue;
    this.$log.debug("CACHE GET: " + key, out);
    return out;
  };

  Cache.prototype.setItem = function(key, value) {
    var e, stringValue;
    key = this._buildKey(key);
    stringValue = angular.toJson(value);
    try {
      localStorage.setItem(key, stringValue);
      if (this.memoryCache[key] != null) {
        delete this.memoryCache[key];
      }
    } catch (error) {
      e = error;
      this.$log.error("Failed to write to localStorage.", {
        error: e,
        key: key,
        value: stringValue
      });
      this.memoryCache[key] = stringValue;
    }
    this.$log.debug("CACHE PUT: " + key, angular.fromJson(angular.toJson(value)));
    return value;
  };

  Cache.prototype.clear = function(arg) {
    var cacheKey, cacheKeys, exceptFor, exception, i, j, k, key, l, len, len1, len2, m, ref, ref1, results, results1, skipKey, where;
    ref = arg != null ? arg : {}, key = ref.key, exceptFor = ref.exceptFor, where = ref.where;
    if (where && exceptFor) {
      return this.$log.error("Using where and exceptFor arguments at once in clear() method is forbidden!");
    }
    if (exceptFor) {
      if (exceptFor == null) {
        exceptFor = [];
      }
      cacheKeys = [];
      for (i = j = 0, ref1 = localStorage.length; 0 <= ref1 ? j < ref1 : j > ref1; i = 0 <= ref1 ? ++j : --j) {
        cacheKey = localStorage.key(i);
        if (!this._cacheKeyHasPrefix(cacheKey, key)) {
          continue;
        }
        skipKey = false;
        for (k = 0, len = exceptFor.length; k < len; k++) {
          exception = exceptFor[k];
          if (!(this._cacheKeyHasPrefix(cacheKey, exception))) {
            continue;
          }
          skipKey = true;
          break;
        }
        if (skipKey) {
          continue;
        }
        cacheKeys.push(cacheKey);
      }
      results = [];
      for (l = 0, len1 = cacheKeys.length; l < len1; l++) {
        cacheKey = cacheKeys[l];
        results.push(localStorage.removeItem(cacheKey));
      }
      return results;
    } else {
      results1 = [];
      for (m = 0, len2 = where.length; m < len2; m++) {
        cacheKey = where[m];
        results1.push(localStorage.removeItem(this._buildKey(cacheKey)));
      }
      return results1;
    }
  };

  Cache.prototype._buildKey = function(key) {
    return "" + this.localStoragePrefix + key;
  };

  Cache.prototype._cacheKeyHasPrefix = function(cacheKey, prefix) {
    var index, nextChar;
    if (prefix == null) {
      return cacheKey.indexOf(this.localStoragePrefix) === 0;
    }
    prefix = this._buildKey(prefix);
    index = cacheKey.indexOf(prefix);
    nextChar = cacheKey[prefix.length];
    return index === 0 && ((nextChar == null) || (nextChar === '?' || nextChar === '/'));
  };

  return Cache;

})();

module.exports = function(providerParams) {
  return new Cache(providerParams);
};


},{}],3:[function(require,module,exports){
var indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

module.exports = function(providerParams) {
  var Cache, CachedResourceManager, buildCachedResourceClass;
  buildCachedResourceClass = require('./build_cached_resource_class');
  Cache = require('./cache')(providerParams);
  return CachedResourceManager = (function() {
    function CachedResourceManager($resource, $timeout, $q) {
      this.byKey = {};
      this.build = angular.bind(this, buildCachedResourceClass, $resource, $timeout, $q, providerParams);
    }

    CachedResourceManager.prototype.keys = function() {
      return Object.keys(this.byKey);
    };

    CachedResourceManager.prototype.add = function() {
      var CachedResource, args;
      args = Array.prototype.slice.call(arguments);
      CachedResource = this.build(args);
      this.byKey[CachedResource.$key] = CachedResource;
      CachedResource.$writes.flush();
      return CachedResource;
    };

    CachedResourceManager.prototype.flushQueues = function() {
      var CachedResource, key, ref, results;
      ref = this.byKey;
      results = [];
      for (key in ref) {
        CachedResource = ref[key];
        results.push(CachedResource.$writes.flush());
      }
      return results;
    };

    CachedResourceManager.prototype.clearCache = function(arg) {
      var CachedResource, clearPendingWrites, exceptFor, key, ref, ref1, results;
      ref = arg != null ? arg : {}, exceptFor = ref.exceptFor, clearPendingWrites = ref.clearPendingWrites;
      if (exceptFor == null) {
        exceptFor = [];
      }
      ref1 = this.byKey;
      results = [];
      for (key in ref1) {
        CachedResource = ref1[key];
        if (indexOf.call(exceptFor, key) < 0) {
          results.push(CachedResource.$clearCache({
            clearPendingWrites: clearPendingWrites
          }));
        }
      }
      return results;
    };

    CachedResourceManager.prototype.clearUndefined = function() {
      return Cache.clear({
        exceptFor: this.keys()
      });
    };

    return CachedResourceManager;

  })();
};


},{"./build_cached_resource_class":1,"./cache":2}],4:[function(require,module,exports){
var $cachedResourceFactory, $cachedResourceProvider, app, debugMode, localStoragePrefix, resourceManagerListener,
  slice = [].slice;

resourceManagerListener = null;

debugMode = false;

localStoragePrefix = null;

app = angular.module('ngCachedResource', ['ngResource']);

if (typeof module !== "undefined" && module !== null) {
  module.exports = app;
}

app.provider('$cachedResource', $cachedResourceProvider = (function() {
  function $cachedResourceProvider() {
    this.$get = $cachedResourceFactory;
    localStoragePrefix = 'cachedResource://';
  }

  $cachedResourceProvider.prototype.setDebugMode = function(newSetting) {
    if (newSetting == null) {
      newSetting = true;
    }
    return debugMode = newSetting;
  };

  $cachedResourceProvider.prototype.setLocalStoragePrefix = function(prefix) {
    return localStoragePrefix = prefix;
  };

  return $cachedResourceProvider;

})());

$cachedResourceFactory = [
  '$resource', '$timeout', '$q', '$log', function($resource, $timeout, $q, $log) {
    var $cachedResource, CachedResourceManager, bindLogFunction, fn, i, len, providerParams, ref, resourceManager;
    bindLogFunction = function(logFunction) {
      return function() {
        var message;
        message = 1 <= arguments.length ? slice.call(arguments, 0) : [];
        message.unshift('ngCachedResource');
        return $log[logFunction].apply($log, message);
      };
    };
    providerParams = {
      localStoragePrefix: localStoragePrefix,
      $log: {
        debug: debugMode ? bindLogFunction('debug') : (function() {}),
        error: bindLogFunction('error')
      }
    };
    CachedResourceManager = require('./cached_resource_manager')(providerParams);
    resourceManager = new CachedResourceManager($resource, $timeout, $q);
    if (resourceManagerListener) {
      document.removeEventListener('online', resourceManagerListener);
    }
    resourceManagerListener = function(event) {
      return resourceManager.flushQueues();
    };
    document.addEventListener('online', resourceManagerListener);
    $cachedResource = function() {
      return resourceManager.add.apply(resourceManager, arguments);
    };
    ref = ['clearCache', 'clearUndefined'];
    for (i = 0, len = ref.length; i < len; i++) {
      fn = ref[i];
      $cachedResource[fn] = angular.bind(resourceManager, resourceManager[fn]);
    }
    return $cachedResource;
  }
];


},{"./cached_resource_manager":3}],5:[function(require,module,exports){
var modifyObjectInPlace;

module.exports = modifyObjectInPlace = function(oldObject, newObject, cachedObject) {
  var i, j, key, len, len1, localChange, localChanges, ref, ref1;
  ref = Object.keys(oldObject);
  for (i = 0, len = ref.length; i < len; i++) {
    key = ref[i];
    if (!(key[0] !== '$')) {
      continue;
    }
    localChange = cachedObject && (cachedObject[key] == null);
    if (!((newObject[key] != null) || localChange)) {
      delete oldObject[key];
    }
  }
  ref1 = Object.keys(newObject);
  for (j = 0, len1 = ref1.length; j < len1; j++) {
    key = ref1[j];
    if (key[0] !== '$') {
      if (angular.isObject(oldObject[key]) && angular.isObject(newObject[key])) {
        modifyObjectInPlace(oldObject[key], newObject[key], cachedObject != null ? cachedObject[key] : void 0);
      } else {
        localChanges = cachedObject && !angular.equals(oldObject[key], cachedObject[key]);
        if (!(angular.equals(oldObject[key], newObject[key]) || localChanges)) {
          oldObject[key] = newObject[key];
        }
      }
    }
  }
  if (newObject.length != null) {
    return oldObject.length = newObject.length;
  }
};


},{}],6:[function(require,module,exports){
var processReadArgs;

module.exports = processReadArgs = function($q, args) {
  var deferred, error, params, success;
  args = Array.prototype.slice.call(args);
  params = angular.isObject(args[0]) ? args.shift() : {};
  success = args[0], error = args[1];
  deferred = $q.defer();
  if (angular.isFunction(success)) {
    deferred.promise.then(success);
  }
  if (angular.isFunction(error)) {
    deferred.promise["catch"](error);
  }
  return {
    params: params,
    deferred: deferred
  };
};


},{}],7:[function(require,module,exports){
var modifyObjectInPlace, processReadArgs, readArrayCache,
  slice = [].slice;

processReadArgs = require('./process_read_args');

modifyObjectInPlace = require('./modify_object_in_place');

module.exports = readArrayCache = function($q, providerParams, name, CachedResource, actionConfig) {
  var ResourceCacheArrayEntry, ResourceCacheEntry, first;
  ResourceCacheEntry = require('./resource_cache_entry')(providerParams);
  ResourceCacheArrayEntry = require('./resource_cache_array_entry')(providerParams);
  first = function(array, params) {
    var found, i, item, itemParams, len;
    found = null;
    for (i = 0, len = array.length; i < len; i++) {
      item = array[i];
      itemParams = item.$params();
      if (Object.keys(params).every(function(key) {
        return itemParams[key] === params[key];
      })) {
        found = item;
        break;
      }
    }
    return found;
  };
  return function() {
    var arrayInstance, cacheArrayEntry, cacheDeferred, cacheInstanceEntry, cacheInstanceParams, httpDeferred, i, len, params, readHttp, ref, ref1;
    ref = processReadArgs($q, arguments), params = ref.params, cacheDeferred = ref.deferred;
    httpDeferred = $q.defer();
    arrayInstance = new Array();
    arrayInstance.$promise = cacheDeferred.promise;
    arrayInstance.$httpPromise = httpDeferred.promise;
    cacheArrayEntry = new ResourceCacheArrayEntry(CachedResource.$key, params).load();
    arrayInstance.$push = function(resourceInstance) {
      arrayInstance.push(resourceInstance);
      return cacheArrayEntry.addInstances([resourceInstance], false, {
        append: true
      });
    };
    arrayInstance.$httpPromise.then(function(instances) {
      return cacheArrayEntry.addInstances(instances, false);
    });
    readHttp = function() {
      var resource;
      return resource = CachedResource.$resource[name](params, function(response, headers) {
        var newArrayInstance;
        newArrayInstance = new Array();
        response.map(function(resourceInstance) {
          var existingInstance;
          resourceInstance = new CachedResource(resourceInstance);
          existingInstance = first(arrayInstance, resourceInstance.$params());
          if (existingInstance) {
            modifyObjectInPlace(existingInstance, resourceInstance);
            return newArrayInstance.push(existingInstance);
          } else {
            return newArrayInstance.push(resourceInstance);
          }
        });
        arrayInstance.splice.apply(arrayInstance, [0, arrayInstance.length].concat(slice.call(newArrayInstance)));
        arrayInstance.headers = headers();
        if (!cacheArrayEntry.value) {
          cacheDeferred.resolve(arrayInstance);
        }
        return httpDeferred.resolve(arrayInstance);
      }, function(error) {
        if (!cacheArrayEntry.value) {
          cacheDeferred.reject(error);
        }
        return httpDeferred.reject(error);
      });
    };
    if (!actionConfig.cacheOnly) {
      CachedResource.$writes.flush(readHttp);
    }
    if (cacheArrayEntry.value) {
      ref1 = cacheArrayEntry.value.data;
      for (i = 0, len = ref1.length; i < len; i++) {
        cacheInstanceParams = ref1[i];
        cacheInstanceEntry = new ResourceCacheEntry(CachedResource.$key, cacheInstanceParams).load();
        arrayInstance.push(new CachedResource(cacheInstanceEntry.value));
      }
      if (cacheArrayEntry.value.headers) {
        arrayInstance.headers = cacheArrayEntry.value.headers;
      }
      cacheDeferred.resolve(arrayInstance);
    } else if (actionConfig.cacheOnly) {
      cacheDeferred.reject(new Error("Cache value does not exist for params", params));
    }
    return arrayInstance;
  };
};


},{"./modify_object_in_place":5,"./process_read_args":6,"./resource_cache_array_entry":9,"./resource_cache_entry":10}],8:[function(require,module,exports){
var modifyObjectInPlace, processReadArgs, readCache;

processReadArgs = require('./process_read_args');

modifyObjectInPlace = require('./modify_object_in_place');

module.exports = readCache = function($q, providerParams, name, CachedResource, actionConfig) {
  var ResourceCacheEntry;
  ResourceCacheEntry = require('./resource_cache_entry')(providerParams);
  return function() {
    var cacheDeferred, cacheEntry, httpDeferred, instance, params, readHttp, ref;
    ref = processReadArgs($q, arguments), params = ref.params, cacheDeferred = ref.deferred;
    httpDeferred = $q.defer();
    instance = new CachedResource({
      $promise: cacheDeferred.promise,
      $httpPromise: httpDeferred.promise
    });
    cacheEntry = new ResourceCacheEntry(CachedResource.$key, params).load();
    readHttp = function() {
      var resource;
      resource = CachedResource.$resource[name].call(CachedResource.$resource, params);
      resource.$promise.then(function(httpResponse) {
        modifyObjectInPlace(instance, httpResponse);
        if (!cacheEntry.value) {
          cacheDeferred.resolve(instance);
        }
        httpDeferred.resolve(instance);
        if (cacheEntry.dirty) {
          providerParams.$log.error("unexpectedly setting a clean entry (load) over a dirty entry (pending write)");
        }
        return cacheEntry.set(httpResponse, false);
      });
      return resource.$promise["catch"](function(error) {
        if (!cacheEntry.value) {
          cacheDeferred.reject(error);
        }
        return httpDeferred.reject(error);
      });
    };
    if (cacheEntry.dirty) {
      CachedResource.$writes.processResource(params, readHttp);
    } else if (!actionConfig.cacheOnly) {
      readHttp();
    }
    if (cacheEntry.value) {
      angular.extend(instance, cacheEntry.value);
      cacheDeferred.resolve(instance);
    } else if (actionConfig.cacheOnly) {
      cacheDeferred.reject(new Error("Cache value does not exist for params", params));
    }
    return instance;
  };
};


},{"./modify_object_in_place":5,"./process_read_args":6,"./resource_cache_entry":10}],9:[function(require,module,exports){
var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

module.exports = function(providerParams) {
  var $log, ResourceCacheArrayEntry, ResourceCacheEntry;
  $log = providerParams.$log;
  ResourceCacheEntry = require('./resource_cache_entry')(providerParams);
  return ResourceCacheArrayEntry = (function(superClass) {
    extend(ResourceCacheArrayEntry, superClass);

    function ResourceCacheArrayEntry() {
      return ResourceCacheArrayEntry.__super__.constructor.apply(this, arguments);
    }

    ResourceCacheArrayEntry.prototype.defaultValue = [];

    ResourceCacheArrayEntry.prototype.cacheKeyPrefix = function() {
      return this.key + "/array";
    };

    ResourceCacheArrayEntry.prototype.addInstances = function(instances, dirty, options) {
      var cacheArrayReferences, cacheInstanceEntry, cacheInstanceParams, i, instance, len;
      if (options == null) {
        options = {
          append: false
        };
      }
      cacheArrayReferences = {};
      cacheArrayReferences.data = options.append ? this.value : [];
      if (cacheArrayReferences.data == null) {
        cacheArrayReferences.data = [];
      }
      if (instances.headers) {
        cacheArrayReferences.headers = instances.headers;
      }
      for (i = 0, len = instances.length; i < len; i++) {
        instance = instances[i];
        cacheInstanceParams = instance.$params();
        if (Object.keys(cacheInstanceParams).length === 0) {
          $log.error("'" + this.key + "' instance doesn't have any boundParams. Please, make sure you specified them in your resource's initialization, f.e. `{id: \"@id\"}`, or it won't be cached.");
        } else {
          cacheArrayReferences.data.push(cacheInstanceParams);
          cacheInstanceEntry = new ResourceCacheEntry(this.key, cacheInstanceParams).load();
          if (!(options.append && (cacheInstanceEntry.value != null))) {
            cacheInstanceEntry.set(instance, dirty);
          }
        }
      }
      return this.set(cacheArrayReferences, dirty);
    };

    return ResourceCacheArrayEntry;

  })(ResourceCacheEntry);
};


},{"./resource_cache_entry":10}],10:[function(require,module,exports){
module.exports = function(providerParams) {
  var $log, Cache, ResourceCacheEntry;
  $log = providerParams.$log;
  Cache = require('./cache')(providerParams);
  return ResourceCacheEntry = (function() {
    ResourceCacheEntry.prototype.defaultValue = {};

    ResourceCacheEntry.prototype.cacheKeyPrefix = function() {
      return this.key;
    };

    ResourceCacheEntry.prototype.fullCacheKey = function() {
      return this.cacheKeyPrefix() + this.cacheKeyParams;
    };

    function ResourceCacheEntry(key, params) {
      var param, paramKeys;
      this.key = key;
      paramKeys = angular.isObject(params) ? Object.keys(params).sort() : [];
      if (paramKeys.length) {
        this.cacheKeyParams = '?' + ((function() {
          var i, len, results;
          results = [];
          for (i = 0, len = paramKeys.length; i < len; i++) {
            param = paramKeys[i];
            results.push(param + "=" + params[param]);
          }
          return results;
        })()).join('&');
      } else {
        this.cacheKeyParams = '';
      }
    }

    ResourceCacheEntry.prototype.load = function() {
      var ref;
      ref = Cache.getItem(this.fullCacheKey(), this.defaultValue), this.value = ref.value, this.dirty = ref.dirty;
      return this;
    };

    ResourceCacheEntry.prototype.set = function(value, dirty) {
      this.value = value;
      this.dirty = dirty;
      return this._update();
    };

    ResourceCacheEntry.prototype._update = function() {
      return Cache.setItem(this.fullCacheKey(), {
        value: this.value,
        dirty: this.dirty
      });
    };

    return ResourceCacheEntry;

  })();
};


},{"./cache":2}],11:[function(require,module,exports){
var CACHE_RETRY_TIMEOUT;

CACHE_RETRY_TIMEOUT = 60000;

module.exports = function(providerParams, $q) {
  var $log, Cache, ResourceCacheEntry, ResourceWriteQueue, flushQueueDeferreds, resetDeferred, resolveDeferred;
  $log = providerParams.$log;
  ResourceCacheEntry = require('./resource_cache_entry')(providerParams);
  Cache = require('./cache')(providerParams);
  flushQueueDeferreds = {};
  resetDeferred = function(queue) {
    var deferred;
    deferred = $q.defer();
    flushQueueDeferreds[queue.key] = deferred;
    queue.promise = deferred.promise;
    return deferred;
  };
  resolveDeferred = function(queue) {
    return flushQueueDeferreds[queue.key].resolve();
  };
  return ResourceWriteQueue = (function() {
    ResourceWriteQueue.prototype.logStatusOfRequest = function(status, action, params, data) {
      return $log.debug(action + " for " + this.key + " " + (angular.toJson(params)) + " " + status + " (queue length: " + this.queue.length + ")", data);
    };

    function ResourceWriteQueue(CachedResource, $timeout) {
      var i, len, ref, write;
      this.CachedResource = CachedResource;
      this.$timeout = $timeout;
      this.key = this.CachedResource.$key + "/write";
      this.queue = Cache.getItem(this.key, []);
      ref = this.queue;
      for (i = 0, len = ref.length; i < len; i++) {
        write = ref[i];
        write.busy = false;
      }
      resetDeferred(this);
      if (this.queue.length === 0) {
        resolveDeferred(this);
      }
    }

    ResourceWriteQueue.prototype.enqueue = function(params, resourceData, action, deferred) {
      var ref, ref1, resourceParams, write;
      if (this.queue.length === 0) {
        resetDeferred(this);
      }
      resourceParams = angular.isArray(resourceData) ? resourceData.map(function(resource) {
        return resource.$params();
      }) : resourceData.$params();
      write = this.findWrite({
        params: params,
        action: action
      });
      if (write == null) {
        this.queue.push({
          params: params,
          resourceParams: resourceParams,
          action: action,
          deferred: deferred
        });
        this._update();
      } else {
        if ((ref = write.deferred) != null) {
          ref.promise.then(function(response) {
            return deferred.resolve(response);
          });
        }
        if ((ref1 = write.deferred) != null) {
          ref1.promise["catch"](function(error) {
            return deferred.reject(error);
          });
        }
      }
      return this.logStatusOfRequest('enqueued', action, params, resourceData);
    };

    ResourceWriteQueue.prototype.findWrite = function(arg) {
      var action, i, len, params, ref, write;
      action = arg.action, params = arg.params;
      ref = this.queue;
      for (i = 0, len = ref.length; i < len; i++) {
        write = ref[i];
        if (action === write.action && angular.equals(params, write.params)) {
          return write;
        }
      }
    };

    ResourceWriteQueue.prototype.removeWrite = function(arg) {
      var action, entry, i, len, newQueue, params, ref;
      action = arg.action, params = arg.params;
      newQueue = [];
      ref = this.queue;
      for (i = 0, len = ref.length; i < len; i++) {
        entry = ref[i];
        if (!(action === entry.action && angular.equals(params, entry.params))) {
          newQueue.push(entry);
        }
      }
      this.queue = newQueue;
      if (this.queue.length === 0 && this.timeoutPromise) {
        this.$timeout.cancel(this.timeoutPromise);
        delete this.timeoutPromise;
      }
      this._update();
      if (this.queue.length === 0) {
        return resolveDeferred(this);
      }
    };

    ResourceWriteQueue.prototype.flush = function(done) {
      var i, len, ref, results, write;
      if (angular.isFunction(done)) {
        this.promise.then(done);
      }
      this._setFlushTimeout();
      ref = this.queue;
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        write = ref[i];
        results.push(this._processWrite(write));
      }
      return results;
    };

    ResourceWriteQueue.prototype.processResource = function(params, done) {
      var i, len, notDone, ref, results, write;
      notDone = true;
      ref = this._writesForResource(params);
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        write = ref[i];
        results.push(this._processWrite(write, (function(_this) {
          return function() {
            if (notDone && _this._writesForResource(params).length === 0) {
              notDone = false;
              return done();
            }
          };
        })(this)));
      }
      return results;
    };

    ResourceWriteQueue.prototype._writesForResource = function(params) {
      var i, len, ref, results, write;
      ref = this.queue;
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        write = ref[i];
        if (angular.equals(params, write.params)) {
          results.push(write);
        }
      }
      return results;
    };

    ResourceWriteQueue.prototype._processWrite = function(write, done) {
      var cacheEntries, onFailure, onSuccess, writeData;
      if (write.busy) {
        return;
      }
      write.busy = true;
      if (angular.isArray(write.resourceParams)) {
        cacheEntries = write.resourceParams.map((function(_this) {
          return function(resourceParams) {
            return new ResourceCacheEntry(_this.CachedResource.$key, resourceParams).load();
          };
        })(this));
        writeData = cacheEntries.map(function(cacheEntry) {
          return cacheEntry.value;
        });
      } else {
        cacheEntries = [new ResourceCacheEntry(this.CachedResource.$key, write.resourceParams).load()];
        writeData = cacheEntries[0].value;
      }
      onSuccess = (function(_this) {
        return function(value) {
          var ref;
          _this.removeWrite(write);
          if ((ref = write.deferred) != null) {
            ref.resolve(value);
          }
          _this.logStatusOfRequest('succeeded', write.action, write.resourceParams, writeData);
          if (angular.isFunction(done)) {
            return done();
          }
        };
      })(this);
      onFailure = (function(_this) {
        return function(error) {
          var ref;
          if (error && error.status >= 400 && error.status < 500) {
            _this.removeWrite(write);
            $log.error(write.action + " to " + _this.CachedResource.$key + " failed with error " + error.status, {
              method: error.config.method,
              url: error.config.url,
              writeData: writeData
            });
          } else {
            write.busy = false;
            _this.logStatusOfRequest("failed with error " + (angular.toJson(error)) + "; still in queue", write.action, write.resourceParams, writeData);
          }
          return (ref = write.deferred) != null ? ref.reject(error) : void 0;
        };
      })(this);
      this.CachedResource.$resource[write.action](write.params, writeData, onSuccess, onFailure).$promise.then((function(_this) {
        return function(savedResources) {
          var cacheEntry, i, len, resource, resourceInstance, results;
          savedResources = angular.isArray(savedResources) ? savedResources : [savedResources];
          results = [];
          for (i = 0, len = savedResources.length; i < len; i++) {
            resource = savedResources[i];
            resourceInstance = new _this.CachedResource(resource);
            cacheEntry = new ResourceCacheEntry(_this.CachedResource.$key, resourceInstance.$params()).load();
            results.push(cacheEntry.set(resource, false));
          }
          return results;
        };
      })(this));
      return this.logStatusOfRequest('processed', write.action, write.resourceParams, writeData);
    };

    ResourceWriteQueue.prototype._setFlushTimeout = function() {
      if (this.queue.length > 0 && !this.timeoutPromise) {
        this.timeoutPromise = this.$timeout(angular.bind(this, this.flush), CACHE_RETRY_TIMEOUT);
        return this.timeoutPromise.then((function(_this) {
          return function() {
            delete _this.timeoutPromise;
            return _this._setFlushTimeout();
          };
        })(this));
      }
    };

    ResourceWriteQueue.prototype._update = function() {
      var savableQueue;
      savableQueue = this.queue.map(function(write) {
        return {
          params: write.params,
          resourceParams: write.resourceParams,
          action: write.action
        };
      });
      return Cache.setItem(this.key, savableQueue);
    };

    return ResourceWriteQueue;

  })();
};


},{"./cache":2,"./resource_cache_entry":10}],12:[function(require,module,exports){
var modifyObjectInPlace, writeCache;

modifyObjectInPlace = require('./modify_object_in_place');

module.exports = writeCache = function($q, providerParams, action, CachedResource, actionConfig) {
  var ResourceCacheEntry;
  ResourceCacheEntry = require('./resource_cache_entry')(providerParams);
  return function() {
    var args, cacheEntry, data, deferred, error, i, instanceMethod, isArray, isDirty, len, param, params, queueDeferred, ref, resource, success, value, wrapInCachedResource;
    instanceMethod = this instanceof CachedResource;
    args = Array.prototype.slice.call(arguments);
    params = !instanceMethod && angular.isObject(args[1]) ? args.shift() : instanceMethod && angular.isObject(args[0]) ? args.shift() : {};
    data = instanceMethod ? this : args.shift();
    success = args[0], error = args[1];
    isArray = angular.isArray(data);
    isDirty = !actionConfig.cacheOnly;
    wrapInCachedResource = function(object) {
      if (object instanceof CachedResource) {
        return object;
      } else {
        return new CachedResource(object);
      }
    };
    if (isArray) {
      data = data.map(function(o) {
        return wrapInCachedResource(o);
      });
      for (i = 0, len = data.length; i < len; i++) {
        resource = data[i];
        cacheEntry = new ResourceCacheEntry(CachedResource.$key, resource.$params()).load();
        if (!angular.equals(cacheEntry.data, resource)) {
          cacheEntry.set(resource, isDirty);
        }
      }
    } else {
      data = wrapInCachedResource(data);
      ref = data.$params();
      for (param in ref) {
        value = ref[param];
        params[param] = value;
      }
      cacheEntry = new ResourceCacheEntry(CachedResource.$key, data.$params()).load();
      if (!angular.equals(cacheEntry.data, data)) {
        cacheEntry.set(data, isDirty);
      }
    }
    data.$resolved = false;
    deferred = $q.defer();
    data.$promise = deferred.promise;
    if (angular.isFunction(success)) {
      deferred.promise.then(success);
    }
    if (angular.isFunction(error)) {
      deferred.promise["catch"](error);
    }
    if (actionConfig.cacheOnly) {
      data.$resolved = true;
      deferred.resolve(data);
    } else {
      queueDeferred = $q.defer();
      queueDeferred.promise.then(function(httpResource) {
        cacheEntry.load();
        modifyObjectInPlace(data, httpResource, cacheEntry.value);
        data.$resolved = true;
        return deferred.resolve(data);
      });
      queueDeferred.promise["catch"](deferred.reject);
      CachedResource.$writes.enqueue(params, data, action, queueDeferred);
      CachedResource.$writes.flush();
    }
    return data;
  };
};


},{"./modify_object_in_place":5,"./resource_cache_entry":10}]},{},[1,2,3,4,5,6,7,8,9,10,11,12]);
