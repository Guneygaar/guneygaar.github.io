var SortedReact = function(exports) {
  "use strict";
  function probe() {
    console.log("[sorted-react] probe ok");
    return { version: "0.1.0", built: true };
  }
  if (typeof window !== "undefined") {
    console.log("[sorted-react] bundle loaded, v0.1.0");
  }
  exports.probe = probe;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
}({});
//# sourceMappingURL=sorted-react.js.map
