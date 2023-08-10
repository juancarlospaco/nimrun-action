import std/[random, macros, fenv]

macro fuzzing*(tipe: typedesc): untyped =
  doAssert tipe.kind == nnkSym and tipe.symKind == nskType, "Argument must be a static typedesc of primitive type."
  var r = initRand(max(tipe.strVal.len xor lineInfoObj(tipe).column + NimPatch, int8.high))
  case tipe.strVal
  of "int"     : result = newLit(int(r.rand(int.high)))
  of "int32"   : result = newLit(int32(r.rand(int32.high.int)))
  of "int16"   : result = newLit(int16(r.rand(int16.high.int)))
  of "int8"    : result = newLit(int8(r.rand(int8.high.int)))
  of "uint16"  : result = newLit(uint16(r.rand(uint16.high.int)))
  of "uint8"   : result = newLit(uint8(r.rand(uint8.high.int)))
  of "char"    : result = newLit(char(r.rand(char.high.int)))
  of "byte"    : result = newLit(byte(r.rand(byte.high.int)))
  of "Positive": result = newLit(Positive(r.rand(Positive.high.int)))
  of "Natural" : result = newLit(Natural(r.rand(Natural.high.int)))
  of "bool"    : result = newLit(bool(r.rand(1)))
  of "float"   : result = newLit(float(r.rand(maximumPositiveValue(float))))
  of "float64" : result = newLit(float64(r.rand(maximumPositiveValue(float64))))
  of "float32" : result = newLit(float32(r.rand(maximumPositiveValue(float32))))
  of "int64" : result = newLit(int64(r.rand(int32.high.int))) # Reduced range for JS compat.
  of "uint64": result = newLit(uint64(r.rand(int.high.int)))
  of "uint32": result = newLit(uint32(r.rand(int32.high.int)))
  of "BackwardsIndex": result = nnkCall.newTree(newIdentNode"BackwardsIndex", newLit(int(r.rand(int.high))))
  of "string", "cstring":
    var s = ""
    for _ in 0 .. r.rand(80): s.add(r.sample({'\x00'..'\xFF'} - {'"'}))
    if tipe.strVal == "string":
      result = newStrLitNode(s)
    else:
      result = nnkCall.newTree(newIdentNode"cstring", newStrLitNode(s))
  else: result = nnkCall.newTree(newIdentNode"default", tipe)
