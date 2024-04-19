const proxy_to_bindings_map = new WeakMap();
const proxy_to_target_lookup = new WeakMap();
const element_lookup = new WeakMap();

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
 * ```js
 * fmt('Hello, {0}!', 'world') => 'Hello, world!'
 * fmt('Hello, {}!', 'world') => 'Hello, world!'
 * fmt('Hello, {1}! My name is {0}.', 'John', 'world') => 'Hello, world! My name is John.'
 * ```
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

/**
 * Resolves a nested object property path.
 * 
 * ```js
 * const obj = {
 * 	foo: {
 * 		bar: 'baz'
 * 	}
 * };
 * 
 * const [base, key] = resolve_object_property(obj, 'foo.bar');
 * // base = obj.foo, key = 'bar'
 * ```
 * @param {object} target 
 * @param {string} property 
 * @returns 
 */
function resolve_object_property(target, property) {
	const path_parts = property.split('.');
	const parts_len = path_parts.length;

	let base_state = target;
	for (let i = 0; i < parts_len - 1; i++) {
		const part = path_parts[i];
		if (!base_state.hasOwnProperty(part))
			panic(VakaError.ERR_INVALID_OBJECT_PATH, property);

		base_state = base_state[part];
	}

	return [base_state, path_parts[parts_len - 1]];
}

const proxy_handlers = {
	set(target, property, value, receiver) {
		const [current, key] = resolve_object_property(target, property);
		current[key] = value;

		const state_meta = proxy_to_bindings_map.get(receiver);
		if (!state_meta)
			return;

		const bindings = state_meta.get(property);
		for (const binding of bindings)
			update_target(binding, value);
	}
};

/**
 * Creates a reactive state object with the provided initial state. Updating properties on this object will update anything bound to that property.
 * ```js
 * const state = reactive({
 * 	foo: 'bar'
 * 	qux: {
 * 		baz: 'quux'
 * 	}
 * });

 * state.foo = 'baz'; // this propagates to anything bound to `foo`.
 * state.qux.baz = 'corge'; // nested objects are reactive too.
 * ```
 * @param {object} initial_state 
 * @returns {Proxy<object>}
 */
export function reactive(initial_state) {
	const proxy = new Proxy(initial_state, proxy_handlers);

	proxy_to_bindings_map.set(proxy, new Map());
	proxy_to_target_lookup.set(proxy, initial_state);

	// apply proxies recursively to nested objects
	for (const [key, value] of Object.entries(initial_state)) {
		if (typeof value === 'object' && value !== null)
			initial_state[key] = reactive(value);
	}

	return proxy;
}

/**
 * Bind a reactive state property to a valid target. When the property is updated, the target will be updated to reflect the new value.
 * 
 * Currently supported targets are DOM elements inheriting from `HTMLElement`.
 * 
 * ```js
 * const my_element = $('#my-element'); // div
 * const state = reactive({
 * 	foo: 'bar'
 * });
 * 
 * bind(my_element, state, 'foo');
 * state.foo = 'baz'; // this will update the innerText of `my_element`.
 * ```
 * @param {HTMLElement} element 
 * @param {Proxy<object>} state 
 * @param {string} property 
 */
export function bind(element, state, property) {
	const [base_state, current_key] = resolve_object_property(state, property);
	const state_meta = proxy_to_bindings_map.get(base_state);
	if (!state_meta)
		panic(VakaError.ERR_NON_REACTIVE_STATE);

	update_target(element, base_state[current_key]);

	let callback;
	if (element instanceof HTMLInputElement) {
		const raw_target = proxy_to_target_lookup.get(base_state);
		callback = () => raw_target[current_key] = element.value;

		element.addEventListener('input', callback);
	}

	if (!state_meta.has(current_key))
		state_meta.set(current_key, new Set());

	state_meta.get(current_key).add(element);

	element_lookup.set(element, {
		attached_handler: callback,
		reactive_target: base_state,
		reactive_key: current_key
	});
}

/**
 * Unbind the reactivity of the given target.
 * @param {HTMLElement} element 
 * @returns 
 */
export function unbind(element) {
	const element_meta = element_lookup.get(element);
	if (!element_meta)
		return;

	if (element_meta.attached_handler)
		element.removeEventListener('input', element_meta.attached_handler);

	const state_meta = proxy_to_bindings_map.get(element_meta.reactive_target);
	state_meta.get(element_meta.reactive_key).delete(element);
}