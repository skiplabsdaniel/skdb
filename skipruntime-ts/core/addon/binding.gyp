{
  "targets": [
    {
      "target_name": "skip-runtime",
      "sources": [
        "src/skcommon.cc",
        "src/skjson_array.cc",
        "src/skjson_object.cc",
        "src/skjson_utils.cc",
        "src/skiterator.cc"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "libraries": ["~/skip-runtime/libskip-runtime-ts.so"]
    }
  ]
}