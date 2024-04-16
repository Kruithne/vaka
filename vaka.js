const state_map = new WeakMap();

export class VakaError extends Error {
	static ERR_UNSUPPORTED_BIND = 0x1;
	static ERR_NON_REACTIVE_STATE = 0x2;

	constructor(code, ...params) {
		super(fmt(ERROR_STRINGS[code], ...params));
		this.name = this.constructor.name;
		this.code = code;

		if (Error.captureStackTrace)
			Error.captureStackTrace(this, VakaError);
	}
}

const ERROR_STRINGS = {
	[VakaError.ERR_UNSUPPORTED_BIND]: '"{}" is not a supported target for bind()',
	[VakaError.ERR_NON_REACTIVE_STATE]: 'Attempted to bind to a non-reactive state object'
}

function panic(code, ...params) {
	throw new VakaError(code, ...params);
}

/**
 * Formats a string, substituting placeholders with the provided parameters.
 * 
 * Placeholders are in the form of {n}, where n is the index of the parameter.
 * 
 * Indexless parameters are filled in order.
 * 
 * fmt('Hello, {0}!', 'world') => 'Hello, world!'
 * 
 * fmt('Hello, {}!', 'world') => 'Hello, world!'
 * 
 * fmt('Hello, {1}! My name is {0}.', 'John', 'world') => 'Hello, world! My name is John.'
 * 
 * @param {string} str 
 * @param  {...any} params 
 * @returns {string}
 */
export function fmt(str, ...params) {
	let i = 0;
	return str.replace(/{(\d*)}/g, (match, p1) => {
		if (p1 === '')
			return params[i++];

		return params[parseInt(p1)];
	});
}

/**
 * Resolves a dot delimited path in a plain object.
 * 
 * resolve_object_path('foo.bar', { foo: { bar: 42 } }) => 42
 * 
 * @param {string} path 
 * @param {object} obj
 * @returns {any} Undefined if the path does not exist in the object.
 */
export function resolve_object_path(path, obj) {
	const path_parts = path.split('.');

	let current = obj;
	for (const part of path_parts) {
		if (!current.hasOwnProperty(part))
			return undefined;

		current = current[part];
	}

	return current;
}

function update_target(target, value) {
	if (target instanceof HTMLElement) {
		if (target instanceof HTMLInputElement) {
			target.value = value;
			return;
		}

		target.innerText = value;
		return;
	}

	let target_type = typeof target;
	if (target_type === 'object')
		target_type = target === null ? 'null' : target.constructor.name;
	
	panic(VakaError.ERR_UNSUPPORTED_BIND, target_type);
}

export function reactive(state) {
	const handler = {
		set(target, property, value, receiver) {
			target[property] = value;

			const bindings = state_map.get(receiver)?.bindings?.get(property);
			if (bindings)
				for (const binding of bindings)
					update_target(binding, value);
		}
	};

	const proxy = new Proxy(state, handler);

	state_map.set(proxy, {
		bindings: new Map()
	});

	return proxy;
}

export function bind(element, state, property) {
	update_target(element, state[property]);

	const state_meta = state_map.get(state);
	if (!state_meta)
		panic(VakaError.ERR_NON_REACTIVE_STATE);

	const bindings = state_meta.bindings;

	if (!bindings.has(property))
		bindings.set(property, new Set());

	bindings.get(property).add(element);
}