
/* global window, module */

; (function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
            global.Router = factory()
}(this, (function () {

    /**
     * Router
     *
     * @version: 1.2.7
     * @author Graidenix
     *
     * @constructor
     *
     * @param {object} options
     * @returns {Router}
     */
    function Router(options) {
        var settings = this._getSettings(options);


        this.notFoundHandler = settings.page404;
        this.mode = (!window.history || !window.history.pushState) ? "hash" : settings.mode;
        this.root = settings.root === "/" ? "/" : "/" + this._trimSlashes(settings.root) + "/";
        this.beforeHook = settings.hooks.before;
        this.afterHook = settings.hooks.after;
        this.securityHook = settings.hooks.secure;

        this.routes = [];
        if (settings.routes && settings.routes.length > 0) {
            var _this = this;
            settings.routes.forEach(function (route) {
                _this.add(route.rule, route.handler, route.options);
            });
        }

        this._pageState = null;
        this._currentPage = null;
        this._skipCheck = false;
        this._action = null;

        if (this.mode === "hash") {
            this._historyStack = [];
            this._historyIdx = 0;
            this._historyState = "add"
        }

        return this;
    }

    /**
     * Define Router Page
     *
     * @param {string} uri
     * @param {object} query
     * @param {Array} params
     * @param {object} state
     * @param {object} options
     *
     * @constructor
     */
    Router.Page = function (uri, query, params, state, options) {
        this.uri = uri || "";
        this.query = query || {};
        this.params = params || [];
        this.state = state || null;
        this.options = options || {};
    };

    /**
     * Sanitize options and add default values
     *
     * @param {object} options
     * @returns {object}
     * @private
     */
    Router.prototype._getSettings = function (options) {
        var settings = {};
        var defaults = {
            routes: [],
            mode: "history",
            root: "/",
            hooks: {
                "before": function () {
                },
                "after": function () {
                },
                "secure": function () {
                    return true;
                }
            },
            page404: function (page) {
                console.error({
                    page: page,
                    message: "404. Page not found"
                });
            }
        };

        options = options || {};
        ["routes", "mode", "root", "page404"].forEach(function (key) {
            settings[key] = options[key] || defaults[key];
        });

        settings.hooks = Object.assign({}, defaults.hooks, options.hooks || {});

        return settings;
    };

    /**
     * Get URI for Router "history" mode
     *
     * @private
     * @returns {string}
     */
    Router.prototype._getHistoryFragment = function () {
        var fragment = decodeURI(window.location.pathname);
        if (this.root !== "/") {
            fragment = fragment.replace(this.root, "");
        }
        return this._trimSlashes(fragment);
    };

    /**
     * Get URI for router "hash" mode
     *
     * @private
     * @returns {string}
     */
    Router.prototype._getHashFragment = function () {
        var hash = window.location.hash.substr(1).replace(/(\?.*)$/, "");
        return this._trimSlashes(hash);
    };

    /**
     * Get current URI
     *
     * @private
     * @returns {string}
     */
    Router.prototype._getFragment = function () {
        if (this.mode === "history") {
            return this._getHistoryFragment();
        } else {
            return this._getHashFragment();
        }
    };

    /**
     * Trim slashes for path
     *
     * @private
     * @param {string} path
     * @returns {string}
     */
    Router.prototype._trimSlashes = function (path) {
        if (typeof path !== "string") {
            return "";
        }
        return path.toString().replace(/\/$/, "").replace(/^\//, "");
    };

    /**
     * 404 Page Handler
     *
     * @private
     */
    Router.prototype._page404 = function (path) {
        this._currentPage = new Router.Page(path);
        this.notFoundHandler(path);
    };

    /**
     * Convert the string route rule to RegExp rule
     *
     * @param {string} route
     * @returns {RegExp}
     * @private
     */
    Router.prototype._parseRouteRule = function (route) {
        if (typeof route !== "string") {
            return route;
        }
        var uri = this._trimSlashes(route);
        var rule = uri
            .replace(/([\\\/\-\_\.])/g, "\\$1")
            .replace(/\{[a-zA-Z]+\}/g, "(:any)")
            .replace(/\:any/g, "[\\w\\-\\_\\.]+")
            .replace(/\:word/g, "[a-zA-Z]+")
            .replace(/\:num/g, "\\d+");

        return new RegExp("^" + rule + "$", "i");
    };

    /**
     * Parse query string and return object for it
     *
     * @param {string} query
     * @returns {object}
     * @private
     */
    Router.prototype._parseQuery = function (query) {
        var _query = {};
        if (typeof query !== "string") {
            return _query;
        }

        if (query[0] === "?") {
            query = query.substr(1);
        }

        this._queryString = query;
        query.split("&").forEach(function (row) {
            var parts = row.split("=");
            if (parts[0] !== "") {
                if (parts[1] === undefined) {
                    parts[1] = true;
                }
                _query[decodeURIComponent(parts[0])] = parts[1];
            }
        });
        return _query;
    };

    /**
     * Get query for `history` mode
     *
     * @returns {Object}
     * @private
     */
    Router.prototype._getHistoryQuery = function () {
        return this._parseQuery(window.location.search);
    };

    /**
     * Get query for `hash` mode
     *
     * @returns {Object}
     * @private
     */
    Router.prototype._getHashQuery = function () {
        var index = window.location.hash.indexOf("?");
        var query = (index !== -1) ? window.location.hash.substr(index) : "";
        return this._parseQuery(query);
    };

    /**
     * Get query as object
     *
     * @private
     * @returns {Object}
     */
    Router.prototype._getQuery = function () {
        if (this.mode === "history") {
            return this._getHistoryQuery();
        } else {
            return this._getHashQuery();
        }
    };

    /**
     * Add route to routes list
     *
     * @param {string|RegExp} rule
     * @param {function} handler
     * @param {{}} options
     * @returns {Router}
     */
    Router.prototype.add = function (rule, handler, options) {
        this.routes.push({
            rule: this._parseRouteRule(rule),
            handler: handler,
            options: options
        });
        return this;
    };

    /**
     * Remove a route from routes list
     *
     * @param param
     * @returns {Router}
     */
    Router.prototype.remove = function (param) {
        var _this = this;
        if (typeof param === "string") {
            param = this._parseRouteRule(param).toString();
        }
        this.routes.some(function (route, i) {
            if (route.handler === param || route.rule.toString() === param) {
                _this.routes.splice(i, 1);
                return true;
            }
            return false;
        });

        return this;
    };

    /**
     * Reset the state of Router
     *
     * @returns {Router}
     */
    Router.prototype.reset = function () {
        this.routes = [];
        this.mode = null;
        this.root = "/";
        this._pageState = {};
        this.removeUriListener();

        return this;
    };

    /**
     * Add current page in history stack
     * @private
     */
    Router.prototype._pushHistory = function () {
        var _this = this,
            fragment = this._getFragment();

        if (this.mode === "hash") {
            if (this._historyState === "add") {
                if (this._historyIdx !== this._historyStack.length - 1) {
                    this._historyStack.splice(this._historyIdx + 1);
                }

                this._historyStack.push({
                    path: fragment,
                    state: _this._pageState
                });

                this._historyIdx = this._historyStack.length - 1;
            }
            this._historyState = "add";
        }
    };

    /**
     *
     * @param asyncRequest boolean
     * @returns {PromiseResult<boolean> | boolean}
     * @private
     */
    Router.prototype._unloadCallback = function (asyncRequest) {
        var result;

        if (this._skipCheck) {
            return asyncRequest ? Promise.resolve(true) : true;
        }

        if (this._currentPage && this._currentPage.options && this._currentPage.options.unloadCb) {
            result = this._currentPage.options.unloadCb(this._currentPage, asyncRequest);
            if (!asyncRequest || result instanceof Promise) {
                return result;
            }
            return result ? Promise.resolve(result) : Promise.reject(result);
        } else {
            return asyncRequest ? Promise.resolve(true) : true;
        }
    };

    /**
     * Check if router has the action for current path
     *
     * @returns {boolean}
     * @private
     */
    Router.prototype._findRoute = function () {
        var _this = this,
            fragment = this._getFragment();

        return this.routes.some(function (route) {
            var match = fragment.match(route.rule);
            if (match) {
                match.shift();
                var query = _this._getQuery();
                var page = new Router.Page(fragment, query, match, _this._pageState, route.options);

                if (!_this.securityHook(page)) {
                    return false;
                }

                _this._currentPage = page;
                if (_this._skipCheck) {
                    _this._skipCheck = false;
                    return true;
                }
                _this.beforeHook(page);
                route.handler.apply(page, match);
                _this.afterHook(page);
                _this._pageState = null;

                window.onbeforeunload = function (ev) {
                    if (_this._unloadCallback(false)) {
                        return;
                    }
                    ev.returnValue = true;
                    return true;
                };

                return true;
            }
            return false;
        });
    };

    /**
     *
     */
    Router.prototype._treatAsync = function () {
        var result;

        result = this._currentPage.options.unloadCb(this._currentPage, true);
        if (!(result instanceof Promise)) {
            result = result ? Promise.resolve(result) : Promise.reject(result);
        }

        result
            .then(this._processUri.bind(this))
            .catch(this._resetState.bind(this));
    };

    /**
     *
     * @private
     */
    Router.prototype._resetState = function () {
        this._skipCheck = true;
        this.navigateTo(this._current, this._currentPage.state, true);
    };

    /**
     * Replace current page with new one
     */
    Router.prototype._processUri = function () {
        var fragment = this._getFragment(),
            found;

        this._current = fragment;
        this._pushHistory();

        found = this._findRoute.call(this);
        if (!found) {
            this._page404(fragment);
        }
    };

    /**
     * Check the URL and execute handler for its route
     *
     * @returns {Router}
     */
    Router.prototype.check = function () {
        if (this._skipCheck) return this;

        // if page has unload cb treat as promise
        if (this._currentPage && this._currentPage.options && this._currentPage.options.unloadCb) {
            this._treatAsync();
        } else {
            this._processUri();
        }
        return this;
    };

    /**
     * Add the URI listener
     *
     * @returns {Router}
     */
    Router.prototype.addUriListener = function () {
        if (this.mode === "history") {
            window.onpopstate = this.check.bind(this);
        } else {
            window.onhashchange = this.check.bind(this);
        }

        return this;
    };

    /**
     * Remove the URI listener
     *
     * @returns {Router}
     */
    Router.prototype.removeUriListener = function () {
        window.onpopstate = null;
        window.onhashchange = null;
        return this;
    };

    /**
     * Redirect to a page with replace state
     *
     * @param {string} path
     * @param {object} state
     * @param {boolean} silent
     *
     * @returns {Router}
     */
    Router.prototype.redirectTo = function (path, state, silent) {
        path = this._trimSlashes(path) || "";
        this._pageState = state || null;
        this._skipCheck = !!silent;

        if (this.mode === "history") {
            history.replaceState(state, null, this.root + this._trimSlashes(path));
            return this.check();
        } else {
            this._historyIdx--;
            window.location.hash = path;
        }
        return this;
    };

    /**
     * Navigate to a page
     *
     * @param {string} path
     * @param {object} state
     * @param {boolean} silent
     *
     * @returns {Router}
     */
    Router.prototype.navigateTo = function (path, state, silent) {
        path = this._trimSlashes(path) || "";
        this._pageState = state || null;
        this._skipCheck = !!silent;

        if (this.mode === "history") {
            history.pushState(state, null, this.root + this._trimSlashes(path));
            return this.check();
        } else {
            window.location.hash = path;
        }
        return this;
    };

    /**
     * Refresh page with recall route handler
     * @returns {Router}
     */
    Router.prototype.refresh = function () {
        if (!this._currentPage) {
            return this;
        }
        var path = this._currentPage.uri + "?" + this._queryString;
        return this.navigateTo(path, this._currentPage.state);
    };

    /**
     * Go Back in browser history
     * Simulate "Back" button
     *
     * @returns {Router}
     */
    Router.prototype.back = function () {
        if (this.mode === "history") {
            window.history.back();
            return this;
        }

        return this.go(this._historyIdx - 1);
    };

    /**
     * Go Forward in browser history
     * Simulate "Forward" button
     *
     * @returns {Router}
     */
    Router.prototype.forward = function () {
        if (this.mode === "history") {
            window.history.forward();
            return this;
        }

        return this.go(this._historyIdx + 1);
    };

    /**
     * Go to a specific history page
     *
     * @param {number} count
     * @returns {Router}
     */
    Router.prototype.go = function (count) {
        if (this.mode === "history") {
            window.history.go(count);
            return this;
        }

        var page = this._historyStack[count];
        if (!page) {
            return this;
        }

        this._historyIdx = count;
        this._historyState = "hold";
        return this.navigateTo(page.path, page.state);
    };

    return Router;
})));


!function (e, t) { "object" == typeof exports && "object" == typeof module ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : "object" == typeof exports ? exports.axios = t() : e.axios = t() }(this, function () { return function (e) { function t(r) { if (n[r]) return n[r].exports; var o = n[r] = { exports: {}, id: r, loaded: !1 }; return e[r].call(o.exports, o, o.exports, t), o.loaded = !0, o.exports } var n = {}; return t.m = e, t.c = n, t.p = "", t(0) }([function (e, t, n) { e.exports = n(1) }, function (e, t, n) { "use strict"; function r(e) { var t = new i(e), n = s(i.prototype.request, t); return o.extend(n, i.prototype, t), o.extend(n, t), n } var o = n(2), s = n(3), i = n(4), a = n(22), u = n(10), c = r(u); c.Axios = i, c.create = function (e) { return r(a(c.defaults, e)) }, c.Cancel = n(23), c.CancelToken = n(24), c.isCancel = n(9), c.all = function (e) { return Promise.all(e) }, c.spread = n(25), c.isAxiosError = n(26), e.exports = c, e.exports.default = c }, function (e, t, n) { "use strict"; function r(e) { return "[object Array]" === R.call(e) } function o(e) { return "undefined" == typeof e } function s(e) { return null !== e && !o(e) && null !== e.constructor && !o(e.constructor) && "function" == typeof e.constructor.isBuffer && e.constructor.isBuffer(e) } function i(e) { return "[object ArrayBuffer]" === R.call(e) } function a(e) { return "undefined" != typeof FormData && e instanceof FormData } function u(e) { var t; return t = "undefined" != typeof ArrayBuffer && ArrayBuffer.isView ? ArrayBuffer.isView(e) : e && e.buffer && e.buffer instanceof ArrayBuffer } function c(e) { return "string" == typeof e } function f(e) { return "number" == typeof e } function p(e) { return null !== e && "object" == typeof e } function d(e) { if ("[object Object]" !== R.call(e)) return !1; var t = Object.getPrototypeOf(e); return null === t || t === Object.prototype } function l(e) { return "[object Date]" === R.call(e) } function h(e) { return "[object File]" === R.call(e) } function m(e) { return "[object Blob]" === R.call(e) } function y(e) { return "[object Function]" === R.call(e) } function g(e) { return p(e) && y(e.pipe) } function v(e) { return "undefined" != typeof URLSearchParams && e instanceof URLSearchParams } function x(e) { return e.replace(/^\s*/, "").replace(/\s*$/, "") } function w() { return ("undefined" == typeof navigator || "ReactNative" !== navigator.product && "NativeScript" !== navigator.product && "NS" !== navigator.product) && ("undefined" != typeof window && "undefined" != typeof document) } function b(e, t) { if (null !== e && "undefined" != typeof e) if ("object" != typeof e && (e = [e]), r(e)) for (var n = 0, o = e.length; n < o; n++)t.call(null, e[n], n, e); else for (var s in e) Object.prototype.hasOwnProperty.call(e, s) && t.call(null, e[s], s, e) } function E() { function e(e, n) { d(t[n]) && d(e) ? t[n] = E(t[n], e) : d(e) ? t[n] = E({}, e) : r(e) ? t[n] = e.slice() : t[n] = e } for (var t = {}, n = 0, o = arguments.length; n < o; n++)b(arguments[n], e); return t } function j(e, t, n) { return b(t, function (t, r) { n && "function" == typeof t ? e[r] = S(t, n) : e[r] = t }), e } function C(e) { return 65279 === e.charCodeAt(0) && (e = e.slice(1)), e } var S = n(3), R = Object.prototype.toString; e.exports = { isArray: r, isArrayBuffer: i, isBuffer: s, isFormData: a, isArrayBufferView: u, isString: c, isNumber: f, isObject: p, isPlainObject: d, isUndefined: o, isDate: l, isFile: h, isBlob: m, isFunction: y, isStream: g, isURLSearchParams: v, isStandardBrowserEnv: w, forEach: b, merge: E, extend: j, trim: x, stripBOM: C } }, function (e, t) { "use strict"; e.exports = function (e, t) { return function () { for (var n = new Array(arguments.length), r = 0; r < n.length; r++)n[r] = arguments[r]; return e.apply(t, n) } } }, function (e, t, n) { "use strict"; function r(e) { this.defaults = e, this.interceptors = { request: new i, response: new i } } var o = n(2), s = n(5), i = n(6), a = n(7), u = n(22); r.prototype.request = function (e) { "string" == typeof e ? (e = arguments[1] || {}, e.url = arguments[0]) : e = e || {}, e = u(this.defaults, e), e.method ? e.method = e.method.toLowerCase() : this.defaults.method ? e.method = this.defaults.method.toLowerCase() : e.method = "get"; var t = [a, void 0], n = Promise.resolve(e); for (this.interceptors.request.forEach(function (e) { t.unshift(e.fulfilled, e.rejected) }), this.interceptors.response.forEach(function (e) { t.push(e.fulfilled, e.rejected) }); t.length;)n = n.then(t.shift(), t.shift()); return n }, r.prototype.getUri = function (e) { return e = u(this.defaults, e), s(e.url, e.params, e.paramsSerializer).replace(/^\?/, "") }, o.forEach(["delete", "get", "head", "options"], function (e) { r.prototype[e] = function (t, n) { return this.request(u(n || {}, { method: e, url: t, data: (n || {}).data })) } }), o.forEach(["post", "put", "patch"], function (e) { r.prototype[e] = function (t, n, r) { return this.request(u(r || {}, { method: e, url: t, data: n })) } }), e.exports = r }, function (e, t, n) { "use strict"; function r(e) { return encodeURIComponent(e).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+").replace(/%5B/gi, "[").replace(/%5D/gi, "]") } var o = n(2); e.exports = function (e, t, n) { if (!t) return e; var s; if (n) s = n(t); else if (o.isURLSearchParams(t)) s = t.toString(); else { var i = []; o.forEach(t, function (e, t) { null !== e && "undefined" != typeof e && (o.isArray(e) ? t += "[]" : e = [e], o.forEach(e, function (e) { o.isDate(e) ? e = e.toISOString() : o.isObject(e) && (e = JSON.stringify(e)), i.push(r(t) + "=" + r(e)) })) }), s = i.join("&") } if (s) { var a = e.indexOf("#"); a !== -1 && (e = e.slice(0, a)), e += (e.indexOf("?") === -1 ? "?" : "&") + s } return e } }, function (e, t, n) { "use strict"; function r() { this.handlers = [] } var o = n(2); r.prototype.use = function (e, t) { return this.handlers.push({ fulfilled: e, rejected: t }), this.handlers.length - 1 }, r.prototype.eject = function (e) { this.handlers[e] && (this.handlers[e] = null) }, r.prototype.forEach = function (e) { o.forEach(this.handlers, function (t) { null !== t && e(t) }) }, e.exports = r }, function (e, t, n) { "use strict"; function r(e) { e.cancelToken && e.cancelToken.throwIfRequested() } var o = n(2), s = n(8), i = n(9), a = n(10); e.exports = function (e) { r(e), e.headers = e.headers || {}, e.data = s(e.data, e.headers, e.transformRequest), e.headers = o.merge(e.headers.common || {}, e.headers[e.method] || {}, e.headers), o.forEach(["delete", "get", "head", "post", "put", "patch", "common"], function (t) { delete e.headers[t] }); var t = e.adapter || a.adapter; return t(e).then(function (t) { return r(e), t.data = s(t.data, t.headers, e.transformResponse), t }, function (t) { return i(t) || (r(e), t && t.response && (t.response.data = s(t.response.data, t.response.headers, e.transformResponse))), Promise.reject(t) }) } }, function (e, t, n) { "use strict"; var r = n(2); e.exports = function (e, t, n) { return r.forEach(n, function (n) { e = n(e, t) }), e } }, function (e, t) { "use strict"; e.exports = function (e) { return !(!e || !e.__CANCEL__) } }, function (e, t, n) { "use strict"; function r(e, t) { !s.isUndefined(e) && s.isUndefined(e["Content-Type"]) && (e["Content-Type"] = t) } function o() { var e; return "undefined" != typeof XMLHttpRequest ? e = n(12) : "undefined" != typeof process && "[object process]" === Object.prototype.toString.call(process) && (e = n(12)), e } var s = n(2), i = n(11), a = { "Content-Type": "application/x-www-form-urlencoded" }, u = { adapter: o(), transformRequest: [function (e, t) { return i(t, "Accept"), i(t, "Content-Type"), s.isFormData(e) || s.isArrayBuffer(e) || s.isBuffer(e) || s.isStream(e) || s.isFile(e) || s.isBlob(e) ? e : s.isArrayBufferView(e) ? e.buffer : s.isURLSearchParams(e) ? (r(t, "application/x-www-form-urlencoded;charset=utf-8"), e.toString()) : s.isObject(e) ? (r(t, "application/json;charset=utf-8"), JSON.stringify(e)) : e }], transformResponse: [function (e) { if ("string" == typeof e) try { e = JSON.parse(e) } catch (e) { } return e }], timeout: 0, xsrfCookieName: "XSRF-TOKEN", xsrfHeaderName: "X-XSRF-TOKEN", maxContentLength: -1, maxBodyLength: -1, validateStatus: function (e) { return e >= 200 && e < 300 } }; u.headers = { common: { Accept: "application/json, text/plain, */*" } }, s.forEach(["delete", "get", "head"], function (e) { u.headers[e] = {} }), s.forEach(["post", "put", "patch"], function (e) { u.headers[e] = s.merge(a) }), e.exports = u }, function (e, t, n) { "use strict"; var r = n(2); e.exports = function (e, t) { r.forEach(e, function (n, r) { r !== t && r.toUpperCase() === t.toUpperCase() && (e[t] = n, delete e[r]) }) } }, function (e, t, n) { "use strict"; var r = n(2), o = n(13), s = n(16), i = n(5), a = n(17), u = n(20), c = n(21), f = n(14); e.exports = function (e) { return new Promise(function (t, n) { var p = e.data, d = e.headers; r.isFormData(p) && delete d["Content-Type"]; var l = new XMLHttpRequest; if (e.auth) { var h = e.auth.username || "", m = e.auth.password ? unescape(encodeURIComponent(e.auth.password)) : ""; d.Authorization = "Basic " + btoa(h + ":" + m) } var y = a(e.baseURL, e.url); if (l.open(e.method.toUpperCase(), i(y, e.params, e.paramsSerializer), !0), l.timeout = e.timeout, l.onreadystatechange = function () { if (l && 4 === l.readyState && (0 !== l.status || l.responseURL && 0 === l.responseURL.indexOf("file:"))) { var r = "getAllResponseHeaders" in l ? u(l.getAllResponseHeaders()) : null, s = e.responseType && "text" !== e.responseType ? l.response : l.responseText, i = { data: s, status: l.status, statusText: l.statusText, headers: r, config: e, request: l }; o(t, n, i), l = null } }, l.onabort = function () { l && (n(f("Request aborted", e, "ECONNABORTED", l)), l = null) }, l.onerror = function () { n(f("Network Error", e, null, l)), l = null }, l.ontimeout = function () { var t = "timeout of " + e.timeout + "ms exceeded"; e.timeoutErrorMessage && (t = e.timeoutErrorMessage), n(f(t, e, "ECONNABORTED", l)), l = null }, r.isStandardBrowserEnv()) { var g = (e.withCredentials || c(y)) && e.xsrfCookieName ? s.read(e.xsrfCookieName) : void 0; g && (d[e.xsrfHeaderName] = g) } if ("setRequestHeader" in l && r.forEach(d, function (e, t) { "undefined" == typeof p && "content-type" === t.toLowerCase() ? delete d[t] : l.setRequestHeader(t, e) }), r.isUndefined(e.withCredentials) || (l.withCredentials = !!e.withCredentials), e.responseType) try { l.responseType = e.responseType } catch (t) { if ("json" !== e.responseType) throw t } "function" == typeof e.onDownloadProgress && l.addEventListener("progress", e.onDownloadProgress), "function" == typeof e.onUploadProgress && l.upload && l.upload.addEventListener("progress", e.onUploadProgress), e.cancelToken && e.cancelToken.promise.then(function (e) { l && (l.abort(), n(e), l = null) }), p || (p = null), l.send(p) }) } }, function (e, t, n) { "use strict"; var r = n(14); e.exports = function (e, t, n) { var o = n.config.validateStatus; n.status && o && !o(n.status) ? t(r("Request failed with status code " + n.status, n.config, null, n.request, n)) : e(n) } }, function (e, t, n) { "use strict"; var r = n(15); e.exports = function (e, t, n, o, s) { var i = new Error(e); return r(i, t, n, o, s) } }, function (e, t) { "use strict"; e.exports = function (e, t, n, r, o) { return e.config = t, n && (e.code = n), e.request = r, e.response = o, e.isAxiosError = !0, e.toJSON = function () { return { message: this.message, name: this.name, description: this.description, number: this.number, fileName: this.fileName, lineNumber: this.lineNumber, columnNumber: this.columnNumber, stack: this.stack, config: this.config, code: this.code } }, e } }, function (e, t, n) { "use strict"; var r = n(2); e.exports = r.isStandardBrowserEnv() ? function () { return { write: function (e, t, n, o, s, i) { var a = []; a.push(e + "=" + encodeURIComponent(t)), r.isNumber(n) && a.push("expires=" + new Date(n).toGMTString()), r.isString(o) && a.push("path=" + o), r.isString(s) && a.push("domain=" + s), i === !0 && a.push("secure"), document.cookie = a.join("; ") }, read: function (e) { var t = document.cookie.match(new RegExp("(^|;\\s*)(" + e + ")=([^;]*)")); return t ? decodeURIComponent(t[3]) : null }, remove: function (e) { this.write(e, "", Date.now() - 864e5) } } }() : function () { return { write: function () { }, read: function () { return null }, remove: function () { } } }() }, function (e, t, n) { "use strict"; var r = n(18), o = n(19); e.exports = function (e, t) { return e && !r(t) ? o(e, t) : t } }, function (e, t) { "use strict"; e.exports = function (e) { return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(e) } }, function (e, t) { "use strict"; e.exports = function (e, t) { return t ? e.replace(/\/+$/, "") + "/" + t.replace(/^\/+/, "") : e } }, function (e, t, n) { "use strict"; var r = n(2), o = ["age", "authorization", "content-length", "content-type", "etag", "expires", "from", "host", "if-modified-since", "if-unmodified-since", "last-modified", "location", "max-forwards", "proxy-authorization", "referer", "retry-after", "user-agent"]; e.exports = function (e) { var t, n, s, i = {}; return e ? (r.forEach(e.split("\n"), function (e) { if (s = e.indexOf(":"), t = r.trim(e.substr(0, s)).toLowerCase(), n = r.trim(e.substr(s + 1)), t) { if (i[t] && o.indexOf(t) >= 0) return; "set-cookie" === t ? i[t] = (i[t] ? i[t] : []).concat([n]) : i[t] = i[t] ? i[t] + ", " + n : n } }), i) : i } }, function (e, t, n) { "use strict"; var r = n(2); e.exports = r.isStandardBrowserEnv() ? function () { function e(e) { var t = e; return n && (o.setAttribute("href", t), t = o.href), o.setAttribute("href", t), { href: o.href, protocol: o.protocol ? o.protocol.replace(/:$/, "") : "", host: o.host, search: o.search ? o.search.replace(/^\?/, "") : "", hash: o.hash ? o.hash.replace(/^#/, "") : "", hostname: o.hostname, port: o.port, pathname: "/" === o.pathname.charAt(0) ? o.pathname : "/" + o.pathname } } var t, n = /(msie|trident)/i.test(navigator.userAgent), o = document.createElement("a"); return t = e(window.location.href), function (n) { var o = r.isString(n) ? e(n) : n; return o.protocol === t.protocol && o.host === t.host } }() : function () { return function () { return !0 } }() }, function (e, t, n) { "use strict"; var r = n(2); e.exports = function (e, t) { function n(e, t) { return r.isPlainObject(e) && r.isPlainObject(t) ? r.merge(e, t) : r.isPlainObject(t) ? r.merge({}, t) : r.isArray(t) ? t.slice() : t } function o(o) { r.isUndefined(t[o]) ? r.isUndefined(e[o]) || (s[o] = n(void 0, e[o])) : s[o] = n(e[o], t[o]) } t = t || {}; var s = {}, i = ["url", "method", "data"], a = ["headers", "auth", "proxy", "params"], u = ["baseURL", "transformRequest", "transformResponse", "paramsSerializer", "timeout", "timeoutMessage", "withCredentials", "adapter", "responseType", "xsrfCookieName", "xsrfHeaderName", "onUploadProgress", "onDownloadProgress", "decompress", "maxContentLength", "maxBodyLength", "maxRedirects", "transport", "httpAgent", "httpsAgent", "cancelToken", "socketPath", "responseEncoding"], c = ["validateStatus"]; r.forEach(i, function (e) { r.isUndefined(t[e]) || (s[e] = n(void 0, t[e])) }), r.forEach(a, o), r.forEach(u, function (o) { r.isUndefined(t[o]) ? r.isUndefined(e[o]) || (s[o] = n(void 0, e[o])) : s[o] = n(void 0, t[o]) }), r.forEach(c, function (r) { r in t ? s[r] = n(e[r], t[r]) : r in e && (s[r] = n(void 0, e[r])) }); var f = i.concat(a).concat(u).concat(c), p = Object.keys(e).concat(Object.keys(t)).filter(function (e) { return f.indexOf(e) === -1 }); return r.forEach(p, o), s } }, function (e, t) { "use strict"; function n(e) { this.message = e } n.prototype.toString = function () { return "Cancel" + (this.message ? ": " + this.message : "") }, n.prototype.__CANCEL__ = !0, e.exports = n }, function (e, t, n) { "use strict"; function r(e) { if ("function" != typeof e) throw new TypeError("executor must be a function."); var t; this.promise = new Promise(function (e) { t = e }); var n = this; e(function (e) { n.reason || (n.reason = new o(e), t(n.reason)) }) } var o = n(23); r.prototype.throwIfRequested = function () { if (this.reason) throw this.reason }, r.source = function () { var e, t = new r(function (t) { e = t }); return { token: t, cancel: e } }, e.exports = r }, function (e, t) { "use strict"; e.exports = function (e) { return function (t) { return e.apply(null, t) } } }, function (e, t) { "use strict"; e.exports = function (e) { return "object" == typeof e && e.isAxiosError === !0 } }]) });

const SaveScript = function (callback) {
    try {
        (function () {
            callback()
        })(callback);
    } catch (e) {
        console.log(e);
    }
}

function delay(callback, ms) {
    var timer = 0;
    return function () {
        var context = this, args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function () {
            callback.apply(context, args);
        }, ms || 0);
    };
}

const el = function (el) {
    var obj = {}
    if (typeof el == 'object') {
        obj.el = el;
    } else {
        obj.el = document.createElement(el);
    }
    obj.ch = [];
    obj.id = function (a) {
        this.el.id = a;
        globalThis[a] = {
            parent: this.el,
            el: globalThis.el(this.el),
            child: function (a) {
                return this.parent.appendChild(a.get())
            }
        }
        return this;
    }
    obj.text = function (a) {
        this.el.className += ' disable-selection ';
        this.el.innerText = a;
        return this;
    }
    obj.addModule = function (name, func) {
        this.el[name] = func;
        return this;
    }
    obj.html = function (a) {
        this.el.innerHTML = a;
        return this;
    }
    obj.name = function (a) {
        this.el.setAttribute('name', a);
        return this;
    }
    obj.href = function (a) {
        this.el.setAttribute('href', a);
        return this;
    }
    obj.rel = function (a) {
        this.el.setAttribute('rel', a);
        return this;
    }
    obj.val = function (a) {
        this.el.value = a;
        return this;
    }
    obj.css = function (a, b) {
        if (typeof a == "object") {
            var ky = Object.keys(a);
            ky.forEach(function (item) {
                this.el.style[item] = a[item];
            }, this)
            return this;
        } else {
            this.el.style[a] = b;
            return this;
        }
    }
    obj.change = function (func) {
        this.el.addEventListener('change', func, false);
        return this;
    }
    obj.keydown = function (func) {
        this.el.addEventListener('keydown', func, false);
        return this;
    }
    obj.mouseover = function (func) {
        this.el.addEventListener('mouseover', func, false);
        return this;
    }
    obj.resize = function (func) {
        var gopy = this;
        window.addEventListener('resize', function (e) {
            width = e.target.outerWidth;
            height = e.target.outerHeight;
            var elm = {
                el: gopy.el,
                width: width,
                height: height
            }
            setTimeout(function () {
                func(elm);
            }, 100)
        }, gopy)
        return gopy;
    }
    obj.load = function (func) {
        var gopy = this;
        var width = window.outerWidth;
        var height = window.outerHeight;
        var elm = {
            el: gopy.el,
            width: width,
            height: height
        }
        func(elm);
        return gopy;
    }
    obj.mouseout = function (func) {
        this.el.addEventListener('mouseout', func, false);
        return this;
    }
    obj.keypress = function (func) {
        this.el.addEventListener('keypress', func, false);
        return this;
    }
    obj.click = function (func) {
        this.el.addEventListener('click', func, false);
        return this;
    }
    obj.submit = function (func) {
        this.el.addEventListener('submit', function (e) {
            el = e.path[0];

            el = new FormData(el);

            var object = {};
            el.forEach(function (value, key) {
                object[key] = value;
            });
            var json = object;

            func(json)

            e.preventDefault();
        }, false);
        return this;
    }
    obj.keyup = function (func) {
        this.el.addEventListener('keyup', func, false);
        return this;
    }
    obj.src = function (a) {
        this.el.setAttribute('src', a);
        return this;
    }
    obj.required = function (a) {
        this.el.setAttribute('required', '');
        return this;
    }
    obj.required = function (a) {
        this.el.setAttribute('required', '');
        return this;
    }
    obj.width = function (a) {
        this.el.style.width = a;
        return this;
    }
    obj.margin = function (a) {
        this.el.style.margin = a;
        return this;
    }
    obj.outline = function (a) {
        this.el.style.outline = a;
        return this;
    }
    obj.border = function (a) {
        this.el.style.border = a;
        return this;
    }
    obj.padding = function (a) {
        this.el.style.padding = a;
        return this;
    }
    obj.fixed = function () {
        this.el.style.position = "fixed";
        return this;
    }
    obj.radius = function (a) {
        this.el.style.borderRadius = a;
        return this;
    }
    obj.bottom = function (a) {
        this.el.style.bottom = a;
        return this;
    }
    obj.right = function (a) {
        this.el.style.right = a;
        return this;
    }
    obj.left = function (a) {
        this.el.style.left = a;
        return this;
    }
    obj.top = function (a) {
        this.el.style.top = a;
        return this;
    }
    obj.float = function (a) {
        this.el.style.float = a;
        return this;
    }
    obj.color = function (a) {
        this.el.style.color = a;
        return this;
    }
    obj.align = function (a) {
        this.el.style.textAlign = a;
        return this;
    }
    obj.size = function (a) {
        this.el.style.fontSize = a;
        return this;
    }
    obj.fontWeight = function (a) {
        if (a == undefined) {
            a = 'bold';
        }
        this.el.style.fontWeight = a;
        return this;
    }
    obj.background = function (a) {
        this.el.style.background = a;
        return this;
    }
    obj.padding = function (a) {
        this.el.style.padding = a;
        return this;
    }
    obj.marginTop = function (a) {
        this.el.style.marginTop = a;
        return this;
    }
    obj.marginBottom = function (a) {
        this.el.style.marginBottom = a;
        return this;
    }
    obj.marginLeft = function (a) {
        this.el.style.marginLeft = a;
        return this;
    }
    obj.marginRight = function (a) {
        this.el.style.marginRight = a;
        return this;
    }
    obj.backgroundImage = function (a) {
        this.el.style.backgroundImage = "url(" + a + ")";
        return this;
    }
    obj.font = function (a) {
        this.el.style.fontFamily = a;
        return this;
    }
    obj.backgroundSize = function (a) {
        this.el.style.backgroundSize = a;
        return this;
    }
    obj.backgroundRepeat = function (a) {
        this.el.style.backgroundRepeat = a;
        return this;
    }
    obj.backgroundPosition = function (a) {
        this.el.style.backgroundPosition = a;
        return this;
    }
    obj.cursor = function (a) {
        this.el.style.cursor = a;
        return this;
    }
    obj.display = function (a) {
        this.el.style.display = a;
        return this;
    }
    obj.height = function (a) {
        this.el.style.height = a;
        return this;
    }
    obj.placeholder = function (a) {
        this.el.setAttribute('placeholder', a);
        return this;
    }
    obj.hold = function (a) {
        this.el.setAttribute('placeholder', a);
        return this;
    }
    obj.design = function () {
        this.el.setAttribute('contenteditable', true);
        return this;
    }
    obj.class = function (a) {
        if (this.el.className != "") {
            this.el.className += ' ' + a + ' ';
        } else {
            this.el.className += a;
        }
        return this;
    }
    obj.type = function (a) {
        this.el.setAttribute("type", a);
        return this;
    }
    obj.attr = function (a, d) {
        this.el.setAttribute(a, d);
        return this;
    }
    obj.data = function (a, d) {
        this.el.setAttribute('data-' + a, d);
        return this;
    }
    obj.aria = function (a, d) {
        this.el.setAttribute('aria-' + a, d);
        return this;
    }
    obj.get = function () {
        if (this.ch.length != 0) {
            this.ch.forEach(function (item) {
                this.el.appendChild(item)
            }, this)
            return this.el;
        } else {
            return this.el;
        }
    }

    obj.child = function (a) {
        this.ch.push(a.get());
        return this;
    }

    obj.roboto = function () {
        this.el.style.fontFamily = 'Roboto';
        return this;
    }


    obj.getChild = function (pop) {
        return {
            parent: this.get().children[pop],
            el: globalThis.el(this.get().children[pop]),
            child: function (a) {
                return this.parent.appendChild(a.get())
            }
        }
    }

    obj.row = function (a) {
        var d = div()
            .class('row')

        a.forEach(function (elm) {
            d.child(
                div().class(elm['class']).child(elm['content'])
            )
        }, d);
        this.ch.push(d.get());
        return this;
    }
    return obj;
}

globalThis.el = el;

function tanggal(a) {
    var newDate = new Date();
    if (a != undefined) {
        if (a === "gugus") {
            newDate = new Date(helper.sesiGet('tahun') + '-' + helper.sesiGet('bulan'));
        } else {
            newDate = new Date(a);
        }
    }

    var namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    var namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jum`at', 'Sabtu'];

    function buat(newDate) {
        var year = newDate.getFullYear();
        var month = (newDate.getMonth() + 1) + '';
        var day = (newDate.getDate()) + '';
        var format = '00';
        var ansMonth = format.substring(0, format.length - month.length) + month;
        var ansDay = format.substring(0, format.length - day.length) + day;
        var dayKnow = ansDay + '-' + ansMonth + '-' + year;
        if (a == null) {
            return "";
        } else {
            return dayKnow;
        }
    }

    function buatN(newDate) {
        var year = newDate.getFullYear();
        var month = newDate.getMonth();
        var day = (newDate.getDate()) + '';
        var format = '00';
        var ansMonth = namaBulan[month];
        var ansDay = format.substring(0, format.length - day.length) + day;
        var dayKnow = ansDay + ' ' + ansMonth + ' ' + year;
        if (a == null) {
            return "";
        } else {
            return dayKnow;
        }
    }

    function buatO(newDate) {
        var year = newDate.getFullYear();
        var month = (newDate.getMonth() + 1) + '';
        var day = (newDate.getDate()) + '';
        var format = '00';
        var ansMonth = format.substring(0, format.length - month.length) + month;
        var ansDay = format.substring(0, format.length - day.length) + day;
        var dayKnow = year + '-' + ansMonth + '-' + ansDay;
        return {
            full: dayKnow,
            day: newDate.getDay()
        };
    }

    function buatNum(newDate) {
        var year = newDate.getFullYear();
        var month = (newDate.getMonth() + 1) + '';
        var day = (newDate.getDate()) + '';
        var format = '00';
        var ansMonth = format.substring(0, format.length - month.length) + month;
        var ansDay = format.substring(0, format.length - day.length) + day;
        var dayKnow = year + ansMonth + ansDay;
        return Number(dayKnow);
    }

    function buatC(newDate) {
        var year = newDate.getFullYear();
        var month = newDate.getMonth();
        var day = newDate.getDate();
        var dateK = new Date(year, month, day);
        return dateK;
    }
    var date = new Date(),
        y = date.getFullYear(),
        m = date.getMonth();
    var firstDay = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
    var lastDay = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0)
    var returnData = {
        oneDayMilisecond: 86400000,
        milisecond: newDate.getTime(),
        normal: buatO(newDate).full,
        cek1: buatC(newDate),
        sekarang: buat(newDate),
        sekarang2: buatN(newDate),
        cek2: buatC(firstDay),
        normal2: buatO(firstDay).full,
        awal: buat(firstDay),
        awal2: buatN(firstDay),
        akhir: buat(lastDay),
        akhir2: buatN(lastDay),
        cek3: buatC(lastDay),
        normal3: buatO(lastDay).full,
        angka: buatNum(newDate),
        dayn: namaHari[buatO(newDate).day],
        day: buatO(newDate).day,
        day2n: namaHari[buatO(firstDay).day],
        day2: buatO(firstDay).day,
        day3n: namaHari[buatO(lastDay).day],
        day3: buatO(lastDay).day
    }
    return returnData;
}

const a = function () {
    return el('a')
}

const img = function () {
    return el('img');
}
const label = function () {
    return el('label')
}
const br = function () {
    return el('BR')
}

const div = function () {
    return el('div');
}
const p = function () {
    return el('p');
}
const line = function () {
    return el('hr')
        .css("padding", "0")
        .css("margin", "0")
}
const h1 = function () {
    return el('h1');
}
const h2 = function () {
    return el('h2');
}
const h3 = function () {
    return el('h3');
}
const h4 = function () {
    return el('h4');
}
const h5 = function () {
    return el('h5');
}
const h6 = function () {
    return el('h6');
}
const input = function () {
    return el('input');
}
const btn = function () {
    return el('button');
}
const tabel = function () {
    return el('TABLE');
}
const tr = function () {
    return el('TR');
}
const nav = function () {
    return el('nav');
}
const td = function () {
    return el('TD');
}
const th = function () {
    return el('TH');
}
const thead = function () {
    return el('THEAD');
}
const tbody = function () {
    return el('TBODY');
}
const form = function () {
    return el('FORM');
}
const ul = function () {
    return el('ul');
}
const li = function () {
    return el('li');
}
const option = function () {
    return el('option');
}
const textarea = function () {
    return el('textarea');
}

// bootstrap element select
const btSelect = function (text, name, el, act) {
    var a = select().name(name).class('form-control')
        .id(name)
        .child(
            option().val('').text('pilih data')
        )
    if (act != undefined) {
        Object.keys(act).forEach(function (eld) {
            a[eld](act[eld]);
        }, a)
    }
    if (el != undefined) {
        el.forEach(function (item) {
            a.child(
                option().val(item.value).text(item.name)
            )
        }, a)
    }
    var b = div()
        .class('form-group')
        .child(
            label().text(text)
        )
        .child(
            a
        )
    return b;
}

const select = function () {
    return el('select');
}
const span = function () {
    return el('span');
}
const i = function () {
    return el('i');
}
const video = function () {
    return el('video');
}
const canvas = function () {
    return el('canvas');
}
const icon = function (a) {
    return i().class(a)
        .css('cursor', 'pointer')
        .css('fontSize', '30px')
        .css('marginRight', '10px')
        .css('marginLeft', '10px')
        .css('transition', '0.5s')
}

const getElementById = function (a, func) {
    setTimeout(function () {
        func(globalThis[a]);
    }, 100)
}

const domp = function (a, ch) {
    var domp = document.getElementById(a);
    if (domp != null) {
        var parent = domp.parentNode;
        var newd = div().id(a).child(ch);
        parent.replaceChild(newd.get(), domp);
    } else {
        domp.appendChild(ch.get());
    }
}

const dompp = function (a, ch) {
    var domp = a;
    if (domp != null) {
        var parent = domp.parentNode;
        var newd = div().id(a).child(ch);
        parent.replaceChild(newd.get(), domp);
    } else {
        domp.appendChild(ch.get());
    }
}

const dom = function (a, ch) {
    var domp = a;
    domp.appendChild(ch.get());
}

const newStyle = function (ccs) {
    var style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = ccs;
    document.head.appendChild(style);
}

const prop = function (name, child, value) {
    if (value != undefined && child != undefined) {
        globalThis[name][child] = value
    } else {
        if (value != undefined) {
            return globalThis[name][child]
        } else {
            return globalThis[name]
        }
    }
}

const loadJs = function (url, callback) {
    var script = document.createElement('script');
    script.onload = function () {
        callback()
    };
    script.src = url;
    document.head.appendChild(script);
}

const headConf = function (callback) {
    document.head.innerHTML += callback;
}

const perulangan = function (a, b, c) {
    if (a != undefined && b != undefined && c != undefined) {
        for (i = a; i < b; i++) {
            c(i);
        }
    } else {
        // do nothing
    }
}

const loads = function (arr = [], success, errorf) {
    function loadScript(url) {
        return new Promise(function (resolve, reject) {
            let script = document.createElement("script");
            script.src = url;
            script.async = false;
            script.onload = function () {
                resolve(url);
            };
            script.onerror = function () {
                reject(url);
            };
            document.body.appendChild(script);
        });
    }

    let scripts = arr;

    // save all Promises as array
    let promises = [];
    scripts.forEach(function (url) {
        promises.push(loadScript(url));

    });

    Promise.all(promises)
        .then(function () {
            success();
        })
        .catch(function (script) {
            errorf(script)
        });
}

const childes = function (el = null, err = []) {
    var e = el;
    for (let x = 0; x < err.length; x++) {
        if ((err.length - 1) == x) {
            e = e.getChild(err[x])
        } else {
            e = e.getChild(err[x]).el;
        }
    }
    return e;
}

window.mobileCheck = function () {
    let check = false;
    (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
};

Array.prototype.addItemObject = function (a, val) {
    var t = this;
    var x = t.map(function (s) {
        s[a] = val;
        return s;
    })
    return t;
}

Array.prototype.removeItemObject = function (a) {
    var t = this;
    var x = t.map(function (s) {
        delete s[a];
        return s;
    })
    return t;
}

Array.prototype.renameItemObject = function (a, b) {
    var t = this;
    var x = t.map(function (s) {
        s[b] = s[a];
        return s;
    })
    return t;
}

Array.prototype.plusItemObject = function (a, b) {
    var t = this;
    var x = t.map(function (s) {
        if (typeof b === 'number') {
            s[a] += b;
        }
        return s;
    })
    return t;
}

Array.prototype.minItemObject = function (a, b) {
    var t = this;
    var x = t.map(function (s) {
        if (typeof b === 'number') {
            s[a] -= b;
        }
        return s;
    })
    return t;
}

Array.prototype.like = function (columnName, searchValues) {
    // Membuat salinan array untuk menghindari perubahan pada array asli
    var newArray = this.slice();
    // Mencari indeks kolom berdasarkan nama kolom
    var columnIndex = Object.keys(newArray[0]).indexOf(columnName);

    // Jika nama kolom ditemukan
    if (columnIndex !== -1) {
        // Mencari data berdasarkan nilai pada kolom yang ditentukan
        var results = newArray.filter(function (item) {
            if (Array.isArray(searchValues)) {
                var f = searchValues.filter(function (x) {
                    if (item[columnName].toLowerCase().indexOf(x) != -1) {
                        return item;
                    }
                });
                if (f.length > 0) {
                    return item;
                }
            } else {
                if (item[columnName].toLowerCase().indexOf(searchValues) != -1) {
                    return item;
                }
            }
        });

        return results;
    } else {
        // Jika nama kolom tidak ditemukan, kembalikan array kosong
        return [];
    }
};

Array.prototype.makeMaster = function (a, b) {
    var t = this;
    var n = t.map(function (s) {
        var x = {}
        x[a] = s;
        x[b] = s;
        return x
    })
    return n;
}

Array.prototype.cond = function (search = '', name = '') {
    if (search != '' && search != null && search != undefined && typeof search != 'object') {
        if (typeof search == 'number') {
            search = search.toString().toLowerCase();
        } else {
            search = search.toLowerCase();
        }

        var data = this;
        return data.filter(function (dat) {
            if (typeof dat == 'object') {
                var g = dat[name];
                var numcek = 0;
                if (g != null) {
                    if (typeof g == 'number') {
                        g = g.toString().toLowerCase();
                    } else {
                        g = g.toLowerCase();
                    }
                    if (numcek == 0) {
                        if (g == search) {
                            numcek = 1;
                        }
                    }
                }
                if (numcek == 1) {
                    return dat;
                }
            } else {
                if (dat != null) {
                    if (typeof dat == 'number') {
                        var dats = dat.toString().toLowerCase();
                        if (dats == search) {
                            return dat
                        }
                    } else {
                        if (dat.toLowerCase() == search) {
                            return dat
                        }
                    }
                }
            }
        })
    } else {
        return [];
    }
}