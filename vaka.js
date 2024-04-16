const state_map = new WeakMap();

export class VakaError extends Error {
	static ERR_UNSUPPORTED_BIND = 0x1;

	constructor(code, ...params) {
		super(fmt(ERROR_STRINGS[code], ...params));
		this.name = this.constructor.name;
		this.code = code;

		if (Error.captureStackTrace)
			Error.captureStackTrace(this, VakaError);
	}
}

const ERROR_STRINGS = {
	[VakaError.ERR_UNSUPPORTED_BIND]: '"{}" is not a supported target for bind()'
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
 * Shorthand for document.getElementById.
 * @param {string} id 
 * @returns HTMLElement|null
 */
export function $(id) {
	return document.getElementById(id);
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
		throw new Error('bind() called on a non-reactive state object');

	const bindings = state_meta.bindings;

	if (!bindings.has(property))
		bindings.set(property, new Set());

	bindings.get(property).add(element);
}