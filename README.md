# Ariom Motion

A data-driven animation system for interactive web scenes.

## Build

Install dependencies and build the production runtime:

```sh
npm ci
npm run build
```

The browser module is generated at `dist/ariom-motion.js`.
Three.js is included in the current bundle. Editor code and styles
are excluded from production.

## Browser integration

Host the built module and your scene dataset alongside your website:

```html
<div id="scene"></div>

<style>
    #scene {
        position: fixed;
        inset: 0;
    }
</style>

<script type="module">
    import { createMotion } from "./ariom-motion.js";

    const motion = await createMotion({
        mountElement: document.querySelector("#scene"),
        dataset: "./scene.json",
    });

    motion.on("navigate", (event) => {
        console.log(event.params.url);
    });

    window.addEventListener("pagehide", () => {
        motion.destroy();
    }, { once: true });
</script>
```

`mountElement` must have a non-zero width and height.

`dataset` accepts a JSON URL, a URL object, or an already loaded
dataset object. Relative URL strings resolve against the document URL.
Assets referenced by a dataset must also be available to the page.

Importing the module does not create a scene. Call `createMotion()`
to start an instance, and `destroy()` when removing it.

## Development editor

Run `npm run dev` and enable the editor in the startup options:

```js
editor: {
    enabled: true,
}
```

The editor can read `dataset`, `view` and `distance` URL parameters.
Production builds ignore editor options and does not read those parameters.

## Updating an integration

The runtime module and scene JSON can be replaced independently of
the consuming website's build, provided its integration remains
compatible with the runtime API and dataset format.