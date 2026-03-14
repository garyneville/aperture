import { aggregateAzimuth } from '../../core/aggregate-azimuth.js';

declare const $: (nodeName: string) => { first(): { json: any }; all(): { json: any }[] };
declare const $input: { first(): { json: any }; all(): { json: any }[] };

const scanResults = $input.all().map(item => item.json);
const sampleMeta = $('Code: Prepare Azimuth Samples').all().map(item => item.json);

const result = aggregateAzimuth(scanResults, sampleMeta);

return [{ json: result }];
