// T is a typed function constructor. The first argument is a 
// function and the rest are a type annotation, with the final 
// argument being the return type. A passed function is both 
// returned in a typed form and, if possible, mutated in the 
// environment.
var T = function(fun/*, annotation*/) {
  // form a namespace based around globals
  T.init();

  // if an array was passed, treat this as a type constructor rather
  // than a typed *function* constructor. That is to say, if this call
  // was not meant to manipulate a function, simlpy return a function's
  // type which can be used elsewhere.
  if( typeof arguments[0] == 'object' && arguments.length == 1 ) {
    return T.Type.apply({}, arguments[0]);
  }

  // find function name by value
  var name = Object.keys(root).filter(function(k){ return root[k]==fun })[0];

  fun['typical_name'] = name || fun.name;

  // if could not find in scope, build and return a function.
  if( !name ) {
    return T.build.apply({}, toArray(arguments).slice(1).concat(fun));
  }

  // if the function was found in the scope, mutate it.  
  root[name] = T.build.apply({}, toArray(arguments).slice(1).concat(fun));
};

T.build = function(/* types, fun */) {
  // form a strictly typed function

  // parse out the function, the argument types, and
  // the return value, forming argument type checkers.
  var args = toArray(arguments),
      fun = last(args),
      lead = args.slice(0,-1),
      types = lead.slice(0,-1).map(argTypeChecker(fun['typical_name'])),
      retType = last(lead);

  // form a wrapper of the base function which will check
  // argument types, then fire, and then check the return
  // type.
  var f = function(/* args */) {
    var args = toArray(arguments);
    var errors = mapcat(function(isValid) {
      var arg = args[0];
      args = args.slice(1);
      return isValid(arg) ? [] : [isValid.message];
    }, types);

    if (!isEmpty(errors))
      throw new Error(errors.join(", "));

    // verify return value type
    var resp = fun.apply({}, arguments);
    if( !argTypeChecker(fun['typical_name'])(retType)(resp) ) {
      throw new Error("Expected return value of " + fun.typical_name + " to be of type "+getType(retType).name+".")
    }

    // return response if all checks pass
    return resp;
  };

  // mark the function as strictly typed with a signature for
  // its use as argument to other typed functions.
  f['typed'] = true;
  f['type'] = {
    ret: retType,
    args: lead.slice(0,-1) 
  };
  f['signature'] = T.render(lead);
  f['name'] = fun['typical_name'];

  // return the wrapper function
  return f;
};  

T.render = function(types) {
  // render a signature given the types
  var argNames = types.slice(0, types.length-1).map(getType).map(function(x) { return x.name });
  return "(" + argNames.join(", ")+") -> "+getType(last(types)).name;
};

T.checker = function(message, fun) {
  // a basic function for forming message-linked functions
  // which will be used as type-checkers.
  var f = function(/* args */) {
    return fun.apply(fun, arguments);
  };

  f['message'] = message;
  return f;
};

// flag type values. void signals a lack of return value,
// and Circular is used in recursive type definitions.
T.void = {};
T.Circular = {};

T.Type = function(args) {
  // define a function type by means of T.Type(ret, arg1, ...) with
  // each argument being a type such as Number.
  if( !(this instanceof T.Type) ) return new T.Type(toArray(arguments));
  this.ret = last(args);
  this.args = args.slice(0, -1);    
};

T.Or = function(args) {
  // form an algebraic type combining all of the provided types
  if( !(this instanceof T.Or) ) return new T.Or(toArray(arguments));
  this.types = args;
};

var root;
T.init = function() {
  // initialize Typical to have a root scope on
  // which all functions will be defined.

  // if a root element has been set, return
  if( root ) return;

  // attempt browser globals, fallback to node
  try {
    root = window;       
  } catch(err) {
    // a strict set of required globals
    root = GLOBAL; 
  } 
};

// function dependencies
var existy = function(x) {
  return typeof x != "undefined";
};
var toArray = function(x) {
  var a = [];
  for( var i = 0; i < x.length; i++ )
    a.push(x[i]);
  return a;
};
var isEmpty = function(x) {
  return x.length == 0;
};
var last = function(x) {
  return x[x.length-1];
};
var mapcat = function(f, xs) {
  return xs.map(f).reduce(function(a, b) {
    return a.concat(b);
  }, []);
};
var argTypeChecker = function(fun) {
  return function(type, argNum) {
    // form a checker function based on the provided type.
    var checker = getType(type);

    // define an error to display in the case of a type error.
    var msg = ["Expected argument at index ",
		argNum,
		" of ",
		fun,
		" to be of type ",
		checker.name,
		"."].join("");

    // return a checker.	       
    return T.checker(msg, checker.fun);
  };
};
var getType = function(type, typeRoot) {
  // maintain a link to the root type for Circular
  // references.
  var isRoot = false;
  if( !typeRoot ) {
   isRoot = true;
   typeRoot = type;
  }

  if( type instanceof T.Type ) {
    // a function type definition was passed 
    return {
      name: '(' + type.args.map(function(x) { 
        return getType(x, typeRoot); 
      }).map(function(x) {
       return x.name;
      }).join(", ") + ') -> ' + getType(type.ret, typeRoot).name,
      fun: function(x) {
	var goodRet = type.ret == x.type.ret;
	var goodArgs = type.args.map(function(t, i) {
	  // TODO: deep equality of types  
	  return t == x.type.args[i];
	}).reduce(function(a, b) {
	  return a && b;	  
	});	  
	return x.typed && goodRet && goodArgs;
      }
    };
  } else if( type instanceof T.Or ) {
    // check against an algebraic type of possible
    // types for the argument
    return {
      name: "("+type.types.map(function(x) {
        return getType(x, typeRoot).name
      }).join(" | ")+")",
      fun: function(x) {
        return type.types.map(function(t) {
	  return getType(t, typeRoot).fun(x);
	}).reduce(function(a, b) {
	  return a || b;
	}, false);
      }
    };
  } else if( type == T.void ) {
    // the void response type was passed
    return {
      name: "void",
      fun: function(x) {
	return !existy(x);
      }
    };
  } else if( type == T.Circular || (type == typeRoot && !isRoot) ) {
    return {
      name: '<Circular>',
      fun: function(x) {
        return getType(typeRoot).fun(x);
      }
    };
  } else if( typeof type == 'function' ) {
    // a constructor was passed
    if( type == Number ) {
      return {
	name: "Number",
	fun: function(x) { return typeof x == 'number' }
      };
    } else if( type == String ) {
      return {
	name: "String",
	fun: function(x) { return typeof x == 'string' }
      };
    } else if( type == Boolean ) {
      return {
	name: "Boolean",
	fun: function(x) { return typeof x == 'boolean' }
      }
    } else {
      // arbitrary constructor type checker
      return {
	name: type.name,
	fun: function(x) { return x instanceof type; }
      };	
    }
  } else if( typeof type == 'object' && type.map ) {
    // an array was passed
    return {
      name: "["+getType(type[0], typeRoot).name+"]",
      fun: function(xs) {
        if( typeof xs != 'object' || !xs.map ) return false;
	return xs.map(getType(type[0], typeRoot).fun).reduce(function(a,b) {
	  return a && b;
	}, true);
      }
    };
  } else if( typeof type == 'object' ) {    
    // an object was passed. objects are duck-typed.

    // render the key-pair types for use in the signature
    var valTypes = Object.keys(type).map(function(k) {
      var t = getType(type[k], typeRoot);
      t.pair = [k, getType(type[k], typeRoot).name].join(" => ");
      return t;
    });

    return {
      name: "{ "+valTypes.map(function(x){ return x.pair; }).join(", ")+" }",
      fun: function(xs) {
        if( typeof xs != 'object' || xs.map ) return false;
	var passed = true;
	for( var k in xs ) {
	  passed = passed && getType(type[k], typeRoot).fun(xs[k]);
	}
	return passed;
      }
    };
  }
};

// export the Typical function if in node
try {
  module.exports = T; 
} catch(err) {
  // no need to export in browser
}
