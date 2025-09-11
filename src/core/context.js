// modules/context.js
// Refactor du bloc Context de ton menu.js

const Context = (function () {
    let hooks = [];
    let currentIndex = 0;
    let container = null;

    const update = () => {
        console.log("Context updated!");
    };

    return {
        get container() {
            return container;
        },
        set container(value) {
            container = value;
            currentIndex = 0; // reset index à chaque nouveau container
        },

        useState(initialValue) {
            const idx = currentIndex++;
            hooks[idx] = hooks[idx] ?? initialValue;

            const setState = (newValue) => {
                hooks[idx] =
                    typeof newValue === "function"
                        ? newValue(hooks[idx])
                        : newValue;
                update();
            };

            return [hooks[idx], setState];
        },

        useReducer(reducer, initialState) {
            const idx = currentIndex++;
            hooks[idx] = hooks[idx] ?? initialState;

            const dispatch = (action) => {
                hooks[idx] = reducer(hooks[idx], action);
                update();
            };

            return [hooks[idx], dispatch];
        },

        useEffect(callback, deps) {
            const idx = currentIndex++;
            const prevDeps = hooks[idx];
            const hasNoDeps = !deps;
            const hasChanged = prevDeps
                ? !deps.every((el, i) => el === prevDeps[i])
                : true;

            if (hasNoDeps || hasChanged) {
                hooks[idx] = deps;
                callback();
            }
        },
    };
})();

export default Context;
