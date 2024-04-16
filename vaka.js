const state_map = new WeakMap();

export class VakaError extends Error {
	static ERR_UNSUPPORTED_BIND = 0x1;
	static ERR_NON_REACTIVE_STATE = 0x2;
	static ERR_INVALID_OBJECT_PATH = 0x3;

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
	[VakaError.ERR_NON_REACTIVE_STATE]: 'Attempted to bind to a non-reactive state object',
	[VakaError.ERR_INVALID_OBJECT_PATH]: 'Unable to resove object path "{}"'
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

const proxy_handlers = {
	set(target, property, value, receiver) {
		set_object_path(property, target, value);

		console.log({ target, property, value, receiver });

		const state_meta = state_map.get(receiver);
		if (!state_meta)
			return;

		const bindings = state_meta.bindings.get(property);
		for (const binding of bindings)
			update_target(binding, value);
	}
};

export function reactive(state) {
	const proxy = new Proxy(state, proxy_handlers);

	state_map.set(proxy, {
		bindings: new Map()
	});

	for (const [key, value] of Object.entries(state)) {
		if (typeof value === 'object' && value !== null)
			state[key] = reactive(value);
	}

	return proxy;
}

export function bind(element, state, property) {
	const path_parts = property.split('.');
	const path_parts_len = path_parts.length;

	let base_state = state;
	for (let i = 0; i < path_parts_len - 1; i++) {
		const part = path_parts[i];
		if (!base_state.hasOwnProperty(part))
			panic(VakaError.ERR_INVALID_OBJECT_PATH, property);

		base_state = base_state[part];
	}

	const current_key = path_parts[path_parts_len - 1];
	const state_meta = state_map.get(base_state);
	if (!state_meta)
		panic(VakaError.ERR_NON_REACTIVE_STATE);

	update_target(element, base_state[current_key]);

	const bindings = state_meta.bindings;

	if (!bindings.has(current_key))
		bindings.set(current_key, new Set());

	bindings.get(current_key).add(element);
}