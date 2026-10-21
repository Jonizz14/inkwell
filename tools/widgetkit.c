// Node-API wrapper around tools/widgetkit.swift: require('widgetkit.node').reload([kind]).
// Node-API is ABI-stable, so the same file loads in any Electron.
#include <node_api.h>
#include <stddef.h>

void a365_reload(const char *kind);

static napi_value reload(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
  char kind[64];
  size_t len = 0;
  napi_valuetype t = napi_undefined;
  if (argc > 0) napi_typeof(env, argv[0], &t);
  if (t == napi_string && napi_get_value_string_utf8(env, argv[0], kind, sizeof kind, &len) == napi_ok) a365_reload(kind);
  else a365_reload(NULL);
  return NULL;
}

static napi_value init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "reload", NAPI_AUTO_LENGTH, reload, NULL, &fn);
  napi_set_named_property(env, exports, "reload", fn);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
