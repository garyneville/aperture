import { prepareAltLocations } from '../../core/prepare-alt-locations.js';

declare const $: (nodeName: string) => { first(): { json: any }; all(): { json: any }[] };

const vars = $('Set Variables').first().json;
const locations = prepareAltLocations(vars.timezone || 'Europe/London');

return locations.map(loc => ({ json: loc }));
