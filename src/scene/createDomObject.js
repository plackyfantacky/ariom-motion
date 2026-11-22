export function createDomObject(definition) {
    const element = document.getElementById(definition.element);

    if (!element) {
        console.warn(`DOM Object "${definition.id}" references missing element "${definition.element}". Object skipped.`);
        return null;
    }

    const originalStyles = ["translate", "opacity"].map((property) => ({
        property,
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property),
    }));

    return {
        userData: {
            type: "dom",
            sceneObjectId: definition.id,
            element,
            animation: definition.animation ?? {},

            destroy() {
                originalStyles.forEach(({ property, value, priority }) => {
                    if (value === "") {
                        element.style.removeProperty(property);
                    } else {
                        element.style.setProperty(property, value, priority);
                    }
                });
            }
        }
    }

}