// Node-API wrapper for trackpad taps: require('haptic.node').tap(0 align | 1 level | 2 generic).
// NSHapticFeedbackManager (tools/haptic.swift) plays only while the trackpad is pressed down, so a
// scroll or a hover never got a tap. The trackpad's own actuator (private MultitouchSupport, the
// same one Force Click uses) taps any time; the AppKit call is only the fallback if it's missing.
#include <node_api.h>
#include <CoreFoundation/CoreFoundation.h>
#include <dlfcn.h>
#include <stddef.h>
#include <stdint.h>

void a365_haptic(int32_t kind);

typedef CFArrayRef (*ListFn)(void);
typedef int32_t (*IdFn)(const void *, uint64_t *);
typedef CFTypeRef (*CreateFn)(uint64_t);
typedef int32_t (*OpenFn)(CFTypeRef);
typedef int32_t (*ActFn)(CFTypeRef, int32_t, uint32_t, float, float);

static CFTypeRef actuator;
static ActFn actuate;
static int tried;

static void open_actuator(void) {
  tried = 1;
  void *h = dlopen("/System/Library/PrivateFrameworks/MultitouchSupport.framework/MultitouchSupport", RTLD_NOW);
  if (!h) return;
  ListFn list = (ListFn)dlsym(h, "MTDeviceCreateList");
  IdFn gid = (IdFn)dlsym(h, "MTDeviceGetDeviceID");
  CreateFn create = (CreateFn)dlsym(h, "MTActuatorCreateFromDeviceID");
  OpenFn open = (OpenFn)dlsym(h, "MTActuatorOpen");
  actuate = (ActFn)dlsym(h, "MTActuatorActuate");
  if (!list || !gid || !create || !open || !actuate) return;
  CFArrayRef all = list();
  if (!all) return;
  for (CFIndex i = 0; i < CFArrayGetCount(all) && !actuator; i++) {
    uint64_t id = 0;
    if (gid(CFArrayGetValueAtIndex(all, i), &id) != 0) continue;
    CFTypeRef a = create(id);
    if (a && open(a) == 0) actuator = a;
    else if (a) CFRelease(a);
  }
  CFRelease(all);
}

// actuation ids of the trackpad: higher is firmer
static const int32_t STRENGTH[] = { 3, 6, 4 };

static napi_value tap(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  int32_t k = 0, raw = 0;
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
  if (argc > 0) napi_get_value_int32(env, argv[0], &k);
  if (argc > 1) napi_get_value_int32(env, argv[1], &raw); // tap(_, id): a raw actuation id, for trying them out
  if (!tried) open_actuator();
  if (actuator && actuate(actuator, raw ? raw : STRENGTH[k >= 0 && k <= 2 ? k : 0], 0, 0, 2.0f) == 0) return NULL;
  a365_haptic(k);
  return NULL;
}

static napi_value init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "tap", NAPI_AUTO_LENGTH, tap, NULL, &fn);
  napi_set_named_property(env, exports, "tap", fn);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
