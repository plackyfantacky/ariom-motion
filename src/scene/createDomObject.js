export function createDomObject(definition) {
    const element = document.getElementById(definition.element);

    if (!element) {
        console.warn(`DOM Object "${definition.id}" references missing element "${definition.element}". Object skipped.`);
        return null;
    }

    const originalStyles = ["translate", "opacity", "visibility"].map((property) => ({
        property,
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property),
    }));

    const originalInert = element.inert;
    const originalVisibility = originalStyles.find(({ property }) => {
        return property === "visibility";
    });

    return {
        userData: {
            type: "dom",
            sceneObjectId: definition.id,
            element,
            animation: definition.animation ?? {},
            setOpacity(opacity) {
                const value = String(opacity);

                if (element.style.opacity !== value) {
                    element.style.opacity = value;
                }

                const isHidden = opacity === 0;
                const isInert = originalInert || isHidden;

                if (element.inert !== isInert) {
                    element.inert = isInert;
                }

                const visibility = isHidden ? "hidden" : originalVisibility.value;
                const priority = isHidden ? "" : originalVisibility.priority;

                if (element.style.getPropertyValue("visibility") !== visibility || element.style.getPropertyPriority("visibility") !== priority) {
                    if (visibility === "") {
                        element.style.removeProperty("visibility");
                    } else {
                        element.style.setProperty("visibility", visibility, priority);
                    }
                }
            },

            destroy() {
                element.inert = originalInert;
                originalStyles.forEach(({ property, value, priority }) => {
                    if (value === "") {
                        element.style.removeProperty(property);
                    } else {
                        element.style.setProperty(property, value, priority);
                    }
                });
            },
        },
    };
}
