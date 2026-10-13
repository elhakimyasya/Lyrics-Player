const tabs = (options = {}) => {
    const config = {
        selector: '[data-tab]',
        selectorTargetAttribute: 'data-target-content',
        withStyles: true,
        classes: {
            tabActive: 'active',
            tabInactive: '',
            tabActiveContent: 'active',
            tabInactiveContent: '',
            tailwindTabActive: 'border-b-2 border-blue-600 text-blue-600 font-semibold',
            tailwindTabInactive: 'text-gray-500 hover:text-gray-700',
            tailwindTabActiveContent: 'block',
            tailwindTabInactiveContent: 'hidden',
        },
        ...options,
    };

    const elements = document.querySelectorAll(selector);
    if (!elements.length) {
        return;
    }

    const tabGetTarget = (tab) => {
        const element = tab.getAttribute(config.selectorTargetAttribute);

        return element ? document.querySelector(element) : null;
    };

    const allContents = Array.from(elements).map((tab) => tabGetTarget(tab)).filter((content) => content !== null);

    const tabActive = (selected, index = 0) => {
        const targetContent = tabGetTarget(selected);
        if (!targetContent) {
            return;
        }

        elements.forEach((tab) => {
            tab.removeAttribute('aria-selected');
            if (config.withStyles) {
                if (config.classes.tabActive) {
                    tab.classList.remove(config.classes.tabActive);
                }

                if (config.classes.tabInactive) {
                    tab.classList.add(config.classes.tabInactive);
                }
            } else {
                config.classes.tailwindTabActive.split(' ').forEach(content => content && tab.classList.remove(content));
                config.classes.tailwindTabInactive.split(' ').forEach(content => content && tab.classList.add(content));
            }
        });

        allContents.forEach((content) => {
            if (config.withStyles) {
                content.style.display = 'none';

                if (config.classes.tabActiveContent) {
                    content.classList.remove(config.classes.tabActiveContent);
                }

                if (config.classes.tabInactiveContent) {
                    content.classList.add(config.classes.tabInactiveContent);
                }
            } else {
                content.classList.remove('block');
                content.classList.add('hidden');

                config.classes.tailwindTabActiveContent.split(' ').forEach(content => content && content.classList.remove(content));
                config.classes.tailwindTabInactiveContent.split(' ').forEach(content => content && content.classList.add(content));
            }
        });

        selected.setAttribute('aria-selected', 'true');
        if (config.withStyles) {
            if (config.classes.tabInactive) {
                selected.classList.remove(config.classes.tabInactive);
            }

            if (config.classes.tabActive) {
                selected.classList.add(config.classes.tabActive);
            }
        } else {
            config.classes.tailwindTabInactive.split(' ').forEach(content => content && selected.classList.remove(content));
            config.classes.tailwindTabActive.split(' ').forEach(content => content && selected.classList.add(content));
        }

        if (config.withStyles) {
            targetContent.style.display = 'block';

            if (config.classes.tabInactiveContent) {
                targetContent.classList.remove(config.classes.tabInactiveContent);
            }

            if (config.classes.tabActiveContent) {
                targetContent.classList.add(config.classes.tabActiveContent);
            }
        } else {
            targetContent.classList.remove('hidden');
            targetContent.classList.add('block');

            config.classes.tailwindTabInactiveContent.split(' ').forEach(content => content && targetContent.classList.remove(content));
            config.classes.tailwindTabActiveContent.split(' ').forEach(content => content && targetContent.classList.add(content));
        }
    };

    elements.forEach((element, index) => {
        element.addEventListener('click', (event) => {
            event.preventDefault();

            tabActive(element, index);
        });
    });

    const elementTabDefault = Array.from(elements).findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    const elementTabIndexInitial = elementTabDefault !== -1 ? elementTabDefault : 0;
    if (elements[elementTabIndexInitial]) {
        tabActive(elements[elementTabIndexInitial], elementTabIndexInitial);
    }
};