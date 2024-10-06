// skiterator.cc
#include "skiterator.h"

#include <map>

#include "skcommon.h"
#include "skjson_utils.h"

#define CJSON void*
#define SKCONTEXT void*
#define SKITERATOR void*

extern "C" {
// NonEmptyIterator
CJSON SkipRuntime_NonEmptyIterator__first(SKITERATOR it);
CJSON SkipRuntime_NonEmptyIterator__next(SKITERATOR it);
CJSON SkipRuntime_NonEmptyIterator__uniqueValue(SKITERATOR it);
SKITERATOR SkipRuntime_NonEmptyIterator__clone(SKITERATOR it);
}

namespace skipruntime {

using skbinding::FromUtf8;
using skbinding::InitClass;
using skbinding::Metadata;
using skbinding::NewClass;
using v8::Array;
using v8::Context;
using v8::Exception;
using v8::External;
using v8::Function;
using v8::FunctionCallbackInfo;
using v8::FunctionTemplate;
using v8::HandleScope;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::ObjectTemplate;
using v8::Persistent;
using v8::Signature;
using v8::String;
using v8::Symbol;
using v8::TryCatch;
using v8::Value;

static Persistent<Function> kEmptyIteratorConstructor;

NonEmptyIterator::NonEmptyIterator(void* hdl) : m_hdl(hdl) {}

NonEmptyIterator::~NonEmptyIterator() {}

void NonEmptyIterator::Prototype(Local<FunctionTemplate> tpl) {
  NODE_SET_PROTOTYPE_METHOD(tpl, "next", Next);
  NODE_SET_PROTOTYPE_METHOD(tpl, "first", First);
  NODE_SET_PROTOTYPE_METHOD(tpl, "uniqueValue", UniqueValue);
  NODE_SET_PROTOTYPE_METHOD(tpl, "toArray", ToArray);
  NODE_SET_PROTOTYPE_METHOD(tpl, "forEach", ForEach);
  NODE_SET_PROTOTYPE_METHOD(tpl, "map", Map);
  Isolate* isolate = Isolate::GetCurrent();
  Local sym_iterator = Symbol::GetIterator(isolate);
  HandleScope handle_scope(isolate);
  Local<Signature> s = Signature::New(isolate, tpl);
  Local<FunctionTemplate> t =
      FunctionTemplate::New(isolate, Iterator, Local<Value>(), s);
  tpl->PrototypeTemplate()->Set(sym_iterator, t);
}

void NonEmptyIterator::Init(Local<Object> exports) {
  InitClass(exports, "NonEmptyIterator", New, Prototype,
            &kEmptyIteratorConstructor);
}

bool IsExternal(Local<Value> value) {
  return value->IsExternal();
}

void NonEmptyIterator::CreateAndWrap(Isolate* isolate, Local<Value> value,
                                     Local<Object> toWrap) {
  Local<External> external = value.As<External>();
  NonEmptyIterator* obj = new NonEmptyIterator(external->Value());
  obj->Wrap(toWrap);
}

void NonEmptyIterator::New(const FunctionCallbackInfo<Value>& args) {
  NewClass(args, IsExternal, CreateAndWrap);
}

Local<Value> NonEmptyIterator::Create(Isolate* isolate, Local<External> it) {
  Local<Context> context = isolate->GetCurrentContext();
  const int argc = 1;
  Local<Value> argv[argc] = {it};
  Local<Function> constructor = kEmptyIteratorConstructor.Get(isolate);
  return constructor->NewInstance(context, argc, argv).ToLocalChecked();
}

void NonEmptyIterator::Next(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  NonEmptyIterator* it = ObjectWrap::Unwrap<NonEmptyIterator>(args.Holder());
  void* skResult = SkipRuntime_NonEmptyIterator__next(it->m_hdl);
  args.GetReturnValue().Set(skjson::SKStoreToNode(isolate, skResult, false));
}

void NonEmptyIterator::First(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  NonEmptyIterator* it = ObjectWrap::Unwrap<NonEmptyIterator>(args.Holder());
  void* skResult = SkipRuntime_NonEmptyIterator__first(it->m_hdl);
  args.GetReturnValue().Set(skjson::SKStoreToNode(isolate, skResult, false));
}

void NonEmptyIterator::UniqueValue(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  NonEmptyIterator* it = ObjectWrap::Unwrap<NonEmptyIterator>(args.Holder());
  void* skResult = SkipRuntime_NonEmptyIterator__uniqueValue(it->m_hdl);
  args.GetReturnValue().Set(skjson::SKStoreToNode(isolate, skResult, false));
}

void NonEmptyIterator::Clone(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  NonEmptyIterator* it = ObjectWrap::Unwrap<NonEmptyIterator>(args.Holder());
  SKITERATOR cit = SkipRuntime_NonEmptyIterator__clone(it->m_hdl);
  args.GetReturnValue().Set(
      NonEmptyIterator::Create(isolate, External::New(isolate, cit)));
}

Local<Array> NonEmptyIterator::AsArray(
    const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  NonEmptyIterator* it = ObjectWrap::Unwrap<NonEmptyIterator>(args.Holder());
  Local<Array> jsArr = Array::New(isolate);
  void* skValue = SkipRuntime_NonEmptyIterator__next(it->m_hdl);
  while (skValue != nullptr) {
    Local<Value> jsValue = skjson::SKStoreToNode(isolate, skValue, false);
    jsArr->Set(context, jsArr->Length(), jsValue).FromJust();
  };
  return jsArr;
}

void NonEmptyIterator::ToArray(const FunctionCallbackInfo<Value>& args) {
  args.GetReturnValue().Set(NonEmptyIterator::AsArray(args));
}

void NonEmptyIterator::Iterator(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  Local sym_iterator = Symbol::GetIterator(isolate);
  args.GetReturnValue().Set(NonEmptyIterator::AsArray(args)
                                ->Get(context, sym_iterator)
                                .ToLocalChecked());
}

void NonEmptyIterator::ForEach(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  if (!args[0]->IsFunction() ||
      !(args[1]->IsObject() || args[1]->IsUndefined())) {
    isolate->ThrowException(
        Exception::TypeError(FromUtf8(isolate, "Invalid parameter type.")));
    return;
  }
  Local<Function> function = args[0].As<Function>();
  Local<Value> recv = Null(isolate);
  if (!args[1]->IsUndefined()) recv = args[1];
  NonEmptyIterator* it = ObjectWrap::Unwrap<NonEmptyIterator>(args.Holder());
  void* skValue = SkipRuntime_NonEmptyIterator__next(it->m_hdl);
  const int argc = 2;
  int index = 0;
  while (skValue != nullptr) {
    Local<Value> jsValue = skjson::SKStoreToNode(isolate, skValue, false);
    Local<Value> argv[argc] = {jsValue, Number::New(isolate, index)};
    void* result = skbinding::SKTryCatch(
        isolate, function, recv, argc, argv,
        [&it](Isolate* isolate, Local<Value> jsResult) { return it; },
        [](Isolate* isolate) {});
    if (result == nullptr) {
      return;
    }
    index++;
  }
}

void NonEmptyIterator::Map(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  if (!args[0]->IsFunction() ||
      !(args[1]->IsObject() || args[1]->IsUndefined())) {
    isolate->ThrowException(
        Exception::TypeError(FromUtf8(isolate, "Invalid parameter type.")));
    return;
  }
  Local<Function> function = args[0].As<Function>();
  Local<Value> recv = Null(isolate);
  if (!args[1]->IsUndefined()) recv = args[1];
  Local<Context> context = isolate->GetCurrentContext();
  NonEmptyIterator* it = ObjectWrap::Unwrap<NonEmptyIterator>(args.Holder());
  Local<Array> jsArr = Array::New(isolate);
  void* skValue = SkipRuntime_NonEmptyIterator__next(it->m_hdl);
  const int argc = 2;
  int index = 0;
  while (skValue != nullptr) {
    Local<Value> jsValue = skjson::SKStoreToNode(isolate, skValue, false);
    Local<Value> argv[argc] = {jsValue, Number::New(isolate, index)};
    void* result = skbinding::SKTryCatch(
        isolate, function, recv, argc, argv,
        [&it, &jsArr, &context](Isolate* isolate, Local<Value> jsResult) {
          jsArr->Set(context, jsArr->Length(), jsResult).FromJust();
          return it;
        },
        [](Isolate* isolate) {});
    if (result == nullptr) {
      return;
    }
    index++;
  }
  args.GetReturnValue().Set(jsArr);
}

}  // namespace skipruntime